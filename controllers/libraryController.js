const mongoose = require('mongoose');
const User = require('../models/User');
const Book = require('../models/Book');

// ========== SAVE BOOK ==========
// POST /api/users/library/save/:bookId
// Adds a book to the authenticated user's savedBooks and increments savesCount.
// Duplicate saves are silently rejected — no error, no double-count.
exports.saveBook = async (req, res, next) => {
  try {
    const { bookId } = req.params;

    // Validate ObjectId format before hitting the database
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: `Invalid bookId: ${bookId}` });
    }

    // 1. Verify the book exists
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // 2. Load the authenticated user
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 3. Check for duplicate — compare as strings so ObjectId vs string never trips us up
    const alreadySaved = user.savedBooks.some(
      (id) => id.toString() === bookId
    );

    if (alreadySaved) {
      // Already in the library — return current state without changing anything
      return res.status(200).json({
        message: 'Book is already in your library',
        saved: true,
        savesCount: book.savesCount,
      });
    }

    // 4. Add the book reference and increment the global counter atomically
    user.savedBooks.push(book._id);
    book.savesCount += 1;

    // 5. Persist both documents
    await user.save();
    await book.save();

    return res.status(200).json({
      message: 'Book saved to your library',
      saved: true,
      savesCount: book.savesCount,
    });

  } catch (err) {
    next(err);
  }
};

// ========== REMOVE BOOK ==========
// DELETE /api/users/library/remove/:bookId
// Removes a book from the authenticated user's savedBooks and decrements savesCount.
// If the book was never saved by this user, nothing changes.
exports.removeBook = async (req, res, next) => {
  try {
    const { bookId } = req.params;

    // Validate ObjectId format before hitting the database
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: `Invalid bookId: ${bookId}` });
    }

    // 1. Verify the book exists
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // 2. Load the authenticated user
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 3. Check whether this user actually has the book saved
    const savedIndex = user.savedBooks.findIndex(
      (id) => id.toString() === bookId
    );

    if (savedIndex === -1) {
      // Not in the library — return current state without changing anything
      return res.status(200).json({
        message: 'Book is not in your library',
        saved: false,
        savesCount: book.savesCount,
      });
    }

    // 4. Remove the book reference from the user's list
    user.savedBooks.splice(savedIndex, 1);

    // 5. Decrement savesCount — never go below 0 (defensive guard)
    book.savesCount = Math.max(0, book.savesCount - 1);

    // 6. Persist both documents
    await user.save();
    await book.save();

    return res.status(200).json({
      message: 'Book removed from your library',
      saved: false,
      savesCount: book.savesCount,
    });

  } catch (err) {
    next(err);
  }
};

// ========== GET USER LIBRARY ==========
// GET /api/users/library
// Returns all books saved by the authenticated user as populated Book documents.
exports.getLibrary = async (req, res, next) => {
  try {
    // Load the user and populate savedBooks with the full Book documents
    const user = await User.findById(req.user.userId).populate({
      path: 'savedBooks',
      select:
        '_id title authors coverImage categories rating savesCount description pdfUrl featured language isbn publisher publishedDate pages edition createdAt updatedAt',
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      message: 'Library retrieved successfully',
      savedBooks: user.savedBooks,
      count: user.savedBooks.length,
    });

  } catch (err) {
    next(err);
  }
};
