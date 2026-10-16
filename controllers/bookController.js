const Book       = require('../models/Book');
const axios      = require('axios');
const bookCache  = require('../utils/bookCache');
const logger     = require('../utils/logger');
const { notifyNewBook } = require('../utils/notifySubscribers');

// Fields an admin is allowed to set when creating or updating a book.
// savesCount is intentionally excluded — it is managed by the system
// (incremented/decremented when users save or remove a book).
// rating IS included — admins seed it from trusted sources (Amazon, Goodreads)
// and it can be updated to reflect current external ratings.
const EDITABLE_FIELDS = [
  'title', 'authors', 'description', 'categories', 'language',
  'isbn', 'publisher', 'publishedDate', 'coverImage', 'pdfUrl',
  'pages', 'edition', 'featured', 'rating',
];

const pickEditableFields = (body) =>
  EDITABLE_FIELDS.reduce((acc, key) => {
    if (body[key] !== undefined) acc[key] = body[key];
    return acc;
  }, {});

const createBook = async (req, res, next) => {
  try {
    const book = new Book(pickEditableFields(req.body));
    const savedBook = await book.save();

    logger.info({ bookId: savedBook._id }, '[BOOK] Created — clearing book list cache');
    bookCache.clearAllBookLists();

    // Notify all active subscribers — fire and forget, never awaited.
    // Email delivery runs in the background; the admin gets an instant response.
    notifyNewBook(savedBook);

    res.status(201).json(savedBook);
  } catch (err) {
    next(err);
  }
};

const getBooks = async (req, res, next) => {
  try {
    const { featured, limit, sort } = req.query;

    const filter = {};
    if (featured !== undefined) {
      filter.featured = featured === 'true';
    }

    const sortOption = sort || '-createdAt';
    const parsedLimit = Math.min(parseInt(limit, 10) || 0, 100) || 0;

    const cacheKey = bookCache.generateBookListKey(featured, sortOption, parsedLimit);
    const cachedBooks = bookCache.get(cacheKey);

    if (cachedBooks) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(cachedBooks);
    }

    let query = Book.find(filter).sort(sortOption);
    if (parsedLimit > 0) {
      query = query.limit(parsedLimit);
    }

    const books = await query;

    bookCache.set(cacheKey, books);

    // Book lists are dynamic — a new book can be added at any time.
    // no-store prevents browsers and proxies from caching this response,
    // ensuring every request reflects the current state of the database.
    // Individual book responses (getBookById) keep their own Cache-Control.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(books);
  } catch (err) {
    next(err);
  }
};

const getBookById = async (req, res, next) => {
  try {
    const cacheKey = bookCache.generateBookKey(req.params.id);
    const cachedBook = bookCache.get(cacheKey);

    if (cachedBook) {
      // no-store: savesCount changes every time someone saves/removes this book.
      // Browsers must not cache individual book responses or they will display
      // a stale count for the lifetime of their cache entry.
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(cachedBook);
    }

    const book = await Book.findById(req.params.id);

    if (!book) return res.status(404).json({ message: 'Book not found' });

    bookCache.set(cacheKey, book);

    // no-store on the DB-hit path for the same reason: savesCount is mutable.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(book);
  } catch (err) {
    next(err);
  }
};

const updateBook = async (req, res, next) => {
  try {
    const book = await Book.findByIdAndUpdate(
      req.params.id,
      pickEditableFields(req.body),
      { new: true }
    );
    if (!book) return res.status(404).json({ message: 'Book not found' });

    logger.info({ bookId: req.params.id }, '[BOOK] Updated — clearing book cache');
    bookCache.clearBook(req.params.id);

    res.status(200).json(book);
  } catch (err) {
    next(err);
  }
};

const deleteBook = async (req, res, next) => {
  try {
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });

    logger.info({ bookId: req.params.id }, '[BOOK] Deleted — clearing book cache');
    bookCache.clearBook(req.params.id);

    res.status(200).json({ message: 'Book deleted' });
  } catch (err) {
    next(err);
  }
};

const downloadBook = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    if (!book.pdfUrl) {
      return res.status(404).json({ message: 'PDF not available for this book' });
    }

    const safeTitle = (book.title || 'book')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80);

    const filename = `${safeTitle || 'book'}.pdf`;

    const response = await axios.get(book.pdfUrl, {
      responseType: 'stream',
      timeout: 30000
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    response.data.pipe(res);

  } catch (err) {
    logger.error({ err, bookId: req.params.id }, '[BOOK] Download error');

    if (err.response) {
      return res.status(502).json({ message: 'Unable to fetch the PDF file' });
    }

    next(err);
  }
};

// ============ TRENDING BOOKS ENDPOINT ============
//
// GET /api/books/trending
//
// Returns up to `limit` books ordered by who has been saved the most
// within a shrinking time window.  The algorithm:
//
//   1. TODAY        — books whose updatedAt >= start of today AND savesCount > 0
//   2. THIS WEEK    — books whose updatedAt >= 7 days ago AND savesCount > 0
//   3. THIS MONTH   — books whose updatedAt >= 30 days ago AND savesCount > 0
//   4. ALL-TIME     — any books with the highest savesCount (no date filter)
//
// A window is considered "empty" when it returns fewer than `minResults` books.
// We then widen to the next window.  If even all-time has no saves we fall
// back to the most recently added books so the section is never blank.
//
// Why updatedAt as the date proxy?
//   We don't store a "saved_at" timestamp per save event.  But every call to
//   saveBook / removeBook runs  Book.findByIdAndUpdate(…{ $inc: savesCount })
//   which bumps updatedAt automatically (Mongoose timestamps option).
//   A book whose savesCount > 0 and updatedAt is recent was almost certainly
//   saved recently — it's an accurate proxy without a new DB collection.

const getTrending = async (req, res, next) => {
  try {
    const limit      = Math.min(parseInt(req.query.limit, 10) || 4, 20);
    const minResults = 1; // widen the window when fewer than this many books match

    const now        = new Date();

    // ── Helper: start of today in UTC ────────────────────────────────────────
    const startOfToday = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ));

    const sevenDaysAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const windows = [
      { label: 'today',     filter: { savesCount: { $gt: 0 }, updatedAt: { $gte: startOfToday } } },
      { label: 'week',      filter: { savesCount: { $gt: 0 }, updatedAt: { $gte: sevenDaysAgo } } },
      { label: 'month',     filter: { savesCount: { $gt: 0 }, updatedAt: { $gte: thirtyDaysAgo } } },
      { label: 'all-time',  filter: { savesCount: { $gt: 0 } } },
      { label: 'recent',    filter: {} },  // final fallback — most recently added
    ];

    // Trending results are time-sensitive — don't serve from cache.
    // The cache key still needs to be cleared when savesCount changes (handled
    // by clearBook in libraryController), but for this endpoint we skip caching
    // entirely because results differ per time window and would need TTL logic.

    let books  = [];
    let window = 'none';

    for (const w of windows) {
      const sortField = w.label === 'recent' ? '-createdAt' : '-savesCount';
      books = await Book.find(w.filter).sort(sortField).limit(limit);

      if (books.length >= minResults) {
        window = w.label;
        break;
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ books, window });

  } catch (err) {
    next(err);
  }
};

// ============ END TRENDING BOOKS ENDPOINT ============

// ============ PDF SERVE ENDPOINT (for PDF.js inline reading) ============

// Block SSRF to private/internal infrastructure.
// The host allow-list has been intentionally removed — any public http/https
// URL stored in our own database is permitted.
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,  // link-local / AWS metadata
  /^::1$/,        // IPv6 loopback
  /^fc00:/i,      // IPv6 unique-local
  /^fe80:/i       // IPv6 link-local
];

function validatePdfUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { valid: false, reason: 'pdfUrl is not a valid URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'pdfUrl must use http or https' };
  }

  const hostname = parsed.hostname.toLowerCase();

  for (const pattern of PRIVATE_HOST_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, reason: 'pdfUrl points to a private or internal address' };
    }
  }

  // No host allow-list — any public http/https URL is permitted.
  return { valid: true };
}

const servePdf = async (req, res, next) => {
  try {
    // ── 1. Look up the book ──────────────────────────────────────────────────
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    if (!book.pdfUrl) {
      return res.status(404).json({ message: 'PDF not available for this book' });
    }

    // ── 2. SSRF / URL validation ─────────────────────────────────────────────
    const check = validatePdfUrl(book.pdfUrl);
    if (!check.valid) {
      logger.error({ bookId: req.params.id, reason: check.reason }, '[PDF] Blocked unsafe pdfUrl');
      return res.status(422).json({ message: check.reason });
    }

    // ── 3. Forward Range header if PDF.js sent one ───────────────────────────
    const rangeHeader = req.headers['range'];
    const upstreamHeaders = {};
    if (rangeHeader) {
      upstreamHeaders['Range'] = rangeHeader;
    }

    // ── 4. Fetch the PDF from the external source ────────────────────────────
    let upstream;
    try {
      upstream = await axios.get(book.pdfUrl, {
        responseType: 'stream',
        timeout: 30000,
        headers: upstreamHeaders,
        validateStatus: null
      });
    } catch (fetchErr) {
      logger.error({ err: fetchErr, bookId: req.params.id }, '[PDF] Upstream fetch failed');
      return res.status(502).json({ message: 'Unable to reach the PDF source' });
    }

    // ── 5. Handle upstream HTTP errors ───────────────────────────────────────
    if (upstream.status === 404) {
      return res.status(404).json({ message: 'PDF file not found at source' });
    }
    if (upstream.status === 403) {
      return res.status(502).json({ message: 'Access to the PDF source was denied' });
    }
    if (upstream.status >= 400) {
      logger.error({ bookId: req.params.id, upstreamStatus: upstream.status }, '[PDF] Upstream returned error status');
      return res.status(502).json({ message: 'Unable to fetch the PDF file' });
    }

    // ── 6. Build response headers ─────────────────────────────────────────────
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Accept-Ranges', 'bytes');

    const upstreamContentLength = upstream.headers['content-length'];
    if (upstreamContentLength) {
      res.setHeader('Content-Length', upstreamContentLength);
    }

    const upstreamContentRange = upstream.headers['content-range'];
    if (upstreamContentRange) {
      res.setHeader('Content-Range', upstreamContentRange);
    }

    // ── 7. Set status code ────────────────────────────────────────────────────
    const statusCode = (rangeHeader && upstream.status === 206) ? 206 : 200;
    res.status(statusCode);

    // ── 8. Handle client disconnect cleanly ───────────────────────────────────
    req.on('close', () => {
      if (!res.writableEnded) {
        upstream.data.destroy();
      }
    });

    // ── 9. Stream bytes to the client ─────────────────────────────────────────
    upstream.data.pipe(res);

  } catch (err) {
    logger.error({ err, bookId: req.params.id }, '[PDF] Unhandled error in servePdf');
    next(err);
  }
};

// ============ END PDF SERVE ENDPOINT ============

module.exports = {
  createBook,
  getBooks,
  getBookById,
  getTrending,
  updateBook,
  deleteBook,
  downloadBook,
  servePdf
};
