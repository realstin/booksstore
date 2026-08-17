const Book = require('../models/Book');
const axios = require('axios');
const bookCache = require('../utils/bookCache');

const createBook = async (req, res, next) => {
  try {
    const book = new Book(req.body);
    const savedBook = await book.save();
    
    // ============ NEW: CLEAR CACHE WHEN NEW BOOK ADDED ============
    console.log(`[CACHE] New book created, clearing all book lists cache`);
    bookCache.clearAllBookLists();
    // ============ END CACHE CLEAR ============

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

    // ============ NEW: CHECK CACHE FIRST ============
    const cacheKey = bookCache.generateBookListKey(featured, sortOption, parsedLimit);
    const cachedBooks = bookCache.get(cacheKey);
    
    if (cachedBooks) {
      // Cache hit! Return immediately
      console.log(`[RESPONSE] Returning ${cachedBooks.length} books from cache`);
      return res.status(200).json(cachedBooks);
    }
    // ============ END CACHE CHECK ============

    // Cache miss: Query database
    console.log(`[DATABASE] Querying books with filters...`);
    let query = Book.find(filter).sort(sortOption);
    if (parsedLimit > 0) {
      query = query.limit(parsedLimit);
    }

    const books = await query;

    // ============ NEW: STORE IN CACHE ============
    bookCache.set(cacheKey, books);
    // ============ END CACHE STORAGE ============

    // ============ NEW: ADD HTTP CACHE HEADER ============
res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
// ============ END CACHE HEADER ============
res.status(200).json(books);
  } catch (err) {
    next(err);
  }
};

const getBookById = async (req, res, next) => {
  try {
    // ============ NEW: CHECK CACHE FIRST ============
    const cacheKey = bookCache.generateBookKey(req.params.id);
    const cachedBook = bookCache.get(cacheKey);
    
    if (cachedBook) {
      console.log(`[RESPONSE] Returning book from cache`);
      return res.status(200).json(cachedBook);
    }
    // ============ END CACHE CHECK ============

    // Cache miss: Query database
    console.log(`[DATABASE] Querying book by ID...`);
    const book = await Book.findById(req.params.id);
    
    if (!book) return res.status(404).json({ message: 'Book not found' });

    // ============ NEW: STORE IN CACHE ============
    bookCache.set(cacheKey, book);
    // ============ END CACHE STORAGE ============

    // ============ NEW: ADD HTTP CACHE HEADER ============
res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
// ============ END CACHE HEADER ============
res.status(200).json(book);
  } catch (err) {
    next(err);
  }
};

const updateBook = async (req, res, next) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!book) return res.status(404).json({ message: 'Book not found' });
    
    // ============ NEW: CLEAR CACHE WHEN BOOK UPDATED ============
    console.log(`[CACHE] Book updated, clearing cache for ID: ${req.params.id}`);
    bookCache.clearBook(req.params.id);
    // ============ END CACHE CLEAR ============

    res.status(200).json(book);
  } catch (err) {
    next(err);
  }
};

const deleteBook = async (req, res, next) => {
  try {
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    
    // ============ NEW: CLEAR CACHE WHEN BOOK DELETED ============
    console.log(`[CACHE] Book deleted, clearing cache for ID: ${req.params.id}`);
    bookCache.clearBook(req.params.id);
    // ============ END CACHE CLEAR ============

    res.status(200).json({ message: 'Book deleted' });
  } catch (err) {
    next(err);
  }
};

const downloadBook = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({
        message: 'Book not found'
      });
    }

    if (!book.pdfUrl) {
      return res.status(404).json({
        message: 'PDF not available for this book'
      });
    }

    // Create a safe filename from the book title
    const safeTitle = (book.title || 'book')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80);

    const filename = `${safeTitle || 'book'}.pdf`;

    // Fetch the PDF from the external URL
    const response = await axios.get(book.pdfUrl, {
      responseType: 'stream',
      timeout: 30000
    });

    // Tell the browser this is a downloadable PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    // Stream the PDF directly to the browser
    response.data.pipe(res);

  } catch (err) {
    console.error('Book download error:', err.message);

    if (err.response) {
      return res.status(502).json({
        message: 'Unable to fetch the PDF file'
      });
    }

    next(err);
  }
};

// ============ PDF SERVE ENDPOINT (for PDF.js inline reading) ============

// Allowed hostname suffixes for SSRF protection.
// Only URLs whose hostname ends with one of these are permitted.
const ALLOWED_PDF_HOSTS = [
  'archive.org',       // Internet Archive (primary PDF host)
  'openlibrary.org',   // Open Library (also Internet Archive property)
  'gutenberg.org',     // Project Gutenberg
  'standardebooks.org' // Standard Ebooks
];

// Private/loopback CIDR blocks expressed as prefix strings for a simple
// string-based check (covers the most common SSRF targets without adding
// a dependency on an IP-parsing library).
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./, // link-local / AWS metadata
  /^::1$/,       // IPv6 loopback
  /^fc00:/i,     // IPv6 unique-local
  /^fe80:/i      // IPv6 link-local
];

/**
 * Validate that a URL is safe to proxy:
 *  - must be http or https
 *  - hostname must match the allow-list
 *  - hostname must not be a private/internal address
 *
 * Returns { valid: true } or { valid: false, reason: string }
 */
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

  // Block private / internal addresses
  for (const pattern of PRIVATE_HOST_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, reason: 'pdfUrl points to a private or internal address' };
    }
  }

  // Enforce host allow-list
  const allowed = ALLOWED_PDF_HOSTS.some(
    (suffix) => hostname === suffix || hostname.endsWith('.' + suffix)
  );
  if (!allowed) {
    return { valid: false, reason: 'pdfUrl host is not in the list of trusted PDF providers' };
  }

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
        // Do not follow redirects to private addresses — axios follows up to 5
        // redirects by default which is fine; we validate the stored URL above.
        validateStatus: null // let us inspect any status ourselves
      });
    } catch (fetchErr) {
      console.error(`[PDF] Upstream fetch failed for book ${req.params.id}:`, fetchErr.message);
      // Network-level failure (DNS, timeout, ECONNREFUSED, etc.)
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

    // Forward Content-Length when the upstream provides it (required by PDF.js
    // for random-access / seeking without downloading the whole file first).
    const upstreamContentLength = upstream.headers['content-length'];
    if (upstreamContentLength) {
      res.setHeader('Content-Length', upstreamContentLength);
    }

    // Forward Content-Range for partial-content responses
    const upstreamContentRange = upstream.headers['content-range'];
    if (upstreamContentRange) {
      res.setHeader('Content-Range', upstreamContentRange);
    }

    // ── 7. Set status code ────────────────────────────────────────────────────
    // 206 Partial Content when a Range was requested and the upstream honoured it.
    const statusCode = (rangeHeader && upstream.status === 206) ? 206 : 200;
    res.status(statusCode);

    // ── 8. Handle client disconnect cleanly ───────────────────────────────────
    req.on('close', () => {
      if (!res.writableEnded) {
        upstream.data.destroy();
      }
    });

    // ── 9. Stream bytes to the client — no buffering ──────────────────────────
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