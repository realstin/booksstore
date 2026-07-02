const express = require('express');
const router = express.Router();

const validateBook = require('../middleware/validateBook');

const {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook
} = require('../controllers/bookController');


// CREATE a new book
router.post('/', validateBook, createBook);


// GET all books
router.get('/', getBooks);


// GET one book by ID
router.get('/:id', getBookById);


// UPDATE book by ID
router.put('/:id', validateBook, updateBook);


// DELETE book by ID
router.delete('/:id', deleteBook);


module.exports = router;