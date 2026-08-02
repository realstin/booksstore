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

module.exports = {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
  downloadBook
};