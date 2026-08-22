const mongoose = require('mongoose');
const User = require('../models/User');
const Book = require('../models/Book');
const bookCache = require('../utils/bookCache');

// ========== SAVE BOOK ==========
// POST /api/users/library/save/:bookId
//
// Adds a book to the authenticated user's savedBooks and increments
// Book.savesCount by exactly 1.
//
// Concurrency strategy:
//   Step 1 — User.updateOne with a { savedBooks: { $ne: bookId } } filter.
//            $addToSet only fires when the book is NOT already in the array.
//            modifiedCount === 0 means duplicate → return early, no counter change.
//            modifiedCount === 1 means genuinely new → proceed to Step 2.
//            Because the filter + write are a single atomic MongoDB operation,
//            two concurrent requests for the same user+book can never both pass:
//            the second one will find the book already present and get modifiedCount 0.
//
//   Step 2 — Book.findByIdAndUpdate with $inc: { savesCount: 1 }.
//            $inc is atomic at the document level — concurrent increments from
//            different users are serialized by MongoDB, so no increment is lost.
//
//   Step 3 — Evict the individual book from bookCache so the next GET /api/books/:id
//            returns the fresh savesCount from MongoDB rather than the stale cached value.
//            clearBook() also calls clearAllBookLists() which evicts every book-list
//            cache entry (Trending, Recently Added, etc.).
exports.saveBook = async (req, res, next) => {
  try {
    const { bookId } = req.params;

    // Validate ObjectId format before hitting the database
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: `Invalid bookId: ${bookId}` });
    }

    // 1. Confirm the book exists — needed for the 404 and to return current savesCount
    //    on a duplicate save without loading the full user document first.
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // 2. Atomically add bookId to the user's savedBooks array.
    //    The filter { savedBooks: { $ne: bookId } } means: only apply the update
    //    when the book is NOT already in the array. If it is already there,
    //    MongoDB matches zero documents → modifiedCount === 0.
    const userUpdate = await User.updateOne(
      { _id: req.user.userId, savedBooks: { $ne: bookId } },
      { $addToSet: { savedBooks: bookId } }
    );

    // 3. Duplicate detected — the book was already in savedBooks.
    //    Return the current (unchanged) savesCount with no side-effects.
    if (userUpdate.modifiedCount === 0) {
      return res.status(200).json({
        message: 'Book is already in your library',
        saved: true,
        savesCount: book.savesCount,
      });
    }

    // 4. Genuinely new save — atomically increment the book's counter.
    //    { new: true } returns the document AFTER the update so we send
    //    the authoritative post-increment value back to the client.
    const updatedBook = await Book.findByIdAndUpdate(
      bookId,
      { $inc: { savesCount: 1 } },
      { new: true }
    );

    // 5. Evict cache so subsequent GET /api/books/:id and GET /api/books
    //    reflect the new savesCount instead of the stale pre-save value.
    bookCache.clearBook(bookId);
    console.log(`[CACHE] Cleared book cache after save: ${bookId}`);

    return res.status(200).json({
      message: 'Book saved to your library',
      saved: true,
      savesCount: updatedBook.savesCount,
    });

  } catch (err) {
    next(err);
  }
};

// ========== REMOVE BOOK ==========
// DELETE /api/users/library/remove/:bookId
//
// Removes a book from the authenticated user's savedBooks and decrements
// Book.savesCount by exactly 1.
//
// Concurrency strategy:
//   Step 1 — User.updateOne with a { savedBooks: bookId } filter.
//            $pull only fires when the book IS in the array.
//            modifiedCount === 0 means it was not saved → return early, no counter change.
//            modifiedCount === 1 means genuinely removed → proceed to Step 2.
//            Two concurrent remove requests from the same user for the same book:
//            the second one finds the book already gone → modifiedCount 0 → no double-decrement.
//
//   Step 2 — Book.findOneAndUpdate with { savesCount: { $gt: 0 } } filter + $inc: { savesCount: -1 }.
//            The $gt: 0 guard means the decrement only fires when the counter is above zero,
//            so even if data was ever inconsistent the counter can never go negative.
//            $inc is atomic — concurrent decrements from different users are serialized by MongoDB.
//
//   Step 3 — Evict the individual book from bookCache (also clears all book-list caches)
//            so subsequent reads see the updated savesCount immediately.
exports.removeBook = async (req, res, next) => {
  try {
    const { bookId } = req.params;

    // Validate ObjectId format before hitting the database
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: `Invalid bookId: ${bookId}` });
    }

    // 1. Atomically remove bookId from the user's savedBooks array.
    //    The filter { savedBooks: bookId } means: only apply the update
    //    when the book IS currently in the array.
    //    If it is not there, MongoDB matches zero documents → modifiedCount === 0.
    const userUpdate = await User.updateOne(
      { _id: req.user.userId, savedBooks: bookId },
      { $pull: { savedBooks: bookId } }
    );

    // 2. Book was not in this user's library — nothing to change.
    //    Fetch the current savesCount so the response is still accurate.
    if (userUpdate.modifiedCount === 0) {
      const book = await Book.findById(bookId);
      return res.status(200).json({
        message: 'Book is not in your library',
        saved: false,
        savesCount: book ? book.savesCount : 0,
      });
    }

    // 3. Genuinely removed — atomically decrement the book's counter.
    //    The { savesCount: { $gt: 0 } } filter is a floor guard:
    //    if the counter is somehow already 0 (data inconsistency), the update
    //    matches zero documents and updatedBook will be null — handled below.
    //    { new: true } returns the document AFTER the update.
    const updatedBook = await Book.findOneAndUpdate(
      { _id: bookId, savesCount: { $gt: 0 } },
      { $inc: { savesCount: -1 } },
      { new: true }
    );

    // 4. Evict cache so subsequent GET /api/books/:id and GET /api/books
    //    reflect the new savesCount instead of the stale pre-remove value.
    bookCache.clearBook(bookId);
    console.log(`[CACHE] Cleared book cache after remove: ${bookId}`);

    return res.status(200).json({
      message: 'Book removed from your library',
      saved: false,
      // updatedBook is null only if savesCount was already 0 (floor guard fired)
      // — in that edge case return 0 rather than crashing.
      savesCount: updatedBook ? updatedBook.savesCount : 0,
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
