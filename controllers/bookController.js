const Book = require('../models/Book');
const axios = require('axios');
const bookCache = require('../utils/bookCache');

const createBook = async (req, res, next) => {
  try {
    const book = new Book(req.body);
    const savedBook = await book.save();

    console.log(`[CACHE] New book created, clearing all book lists cache`);
    bookCache.clearAllBookLists();

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
      console.log(`[RESPONSE] Returning ${cachedBooks.length} books from cache`);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(cachedBooks);
    }

    console.log(`[DATABASE] Querying books with filters...`);
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
      console.log(`[RESPONSE] Returning book from cache`);
      // no-store: savesCount changes every time someone saves/removes this book.
      // Browsers must not cache individual book responses or they will display
      // a stale count for the lifetime of their cache entry.
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(cachedBook);
    }

    console.log(`[DATABASE] Querying book by ID...`);
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
    const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!book) return res.status(404).json({ message: 'Book not found' });

    console.log(`[CACHE] Book updated, clearing cache for ID: ${req.params.id}`);
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

    console.log(`[CACHE] Book deleted, clearing cache for ID: ${req.params.id}`);
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
    console.error('Book download error:', err.message);

    if (err.response) {
      return res.status(502).json({ message: 'Unable to fetch the PDF file' });
    }

    next(err);
  }
};

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
      console.error(`[PDF] Blocked unsafe pdfUrl for book ${req.params.id}: ${check.reason}`);
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
      console.error(`[PDF] Upstream fetch failed for book ${req.params.id}:`, fetchErr.message);
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
      console.error(`[PDF] Upstream returned ${upstream.status} for book ${req.params.id}`);
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
    console.error(`[PDF] Unhandled error serving book ${req.params.id}:`, err.message);
    next(err);
  }
};

// ============ END PDF SERVE ENDPOINT ============

module.exports = {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
  downloadBook,
  servePdf
};
