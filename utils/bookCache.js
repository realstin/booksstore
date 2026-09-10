/**
 * In-Memory Cache Manager for Books
 * Stores frequently accessed book data in RAM for instant retrieval
 */

const logger = require('./logger');

class BookCache {
  constructor() {
    this.cache = {}; // Stores all cached data
  }

  /**
   * Generate a cache key from query parameters
   * Example: "books:featured=true:sort=-rating:limit=6"
   */
  generateBookListKey(featured, sort, limit) {
    return `books:featured=${featured}:sort=${sort}:limit=${limit}`;
  }

  /**
   * Generate a cache key for a single book
   * Example: "book:507f1f77bcf86cd799439011"
   */
  generateBookKey(bookId) {
    return `book:${bookId}`;
  }

  /**
   * Set data in cache
   * Usage: cache.set("books:featured=true:sort=-rating:limit=6", booksArray)
   */
  set(key, value) {
    this.cache[key] = value;
    logger.debug({ key }, '[CACHE] Stored');
  }

  /**
   * Get data from cache
   * Returns the cached value, or null if not found
   */
  get(key) {
    if (this.cache[key]) {
      logger.debug({ key }, '[CACHE] HIT');
      return this.cache[key];
    }
    logger.debug({ key }, '[CACHE] MISS');
    return null;
  }

  /**
   * Clear all cached data (when books change)
   * Call this when createBook, updateBook, or deleteBook happens
   */
  clearAll() {
    this.cache = {};
    logger.debug('[CACHE] Cleared all entries');
  }

  /**
   * Clear a specific book from cache (and related book lists)
   * Call this when a specific book is updated/deleted
   */
  clearBook(bookId) {
    const key = this.generateBookKey(bookId);
    delete this.cache[key];
    logger.debug({ key }, '[CACHE] Cleared book entry');
    // Also clear all book lists since they might contain this book
    this.clearAllBookLists();
  }

  /**
   * Clear all book list caches (but keep individual book caches)
   */
  clearAllBookLists() {
    const keysToDelete = Object.keys(this.cache).filter(key => key.startsWith('books:'));
    keysToDelete.forEach(key => {
      delete this.cache[key];
      logger.debug({ key }, '[CACHE] Cleared list entry');
    });
  }

  /**
   * Get cache stats (for debugging)
   */
  getStats() {
    return {
      totalKeys:    Object.keys(this.cache).length,
      keys:         Object.keys(this.cache),
      memorySizeKB: (JSON.stringify(this.cache).length / 1024).toFixed(2),
    };
  }
}

// Create a single instance to use throughout the app
const bookCache = new BookCache();

module.exports = bookCache;