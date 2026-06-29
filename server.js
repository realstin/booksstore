const express = require('express');
const app = express();
const books = [];

const mongoose = require('mongoose');
const bookRoutes = require('./routes/books');
const errorHandler = require('./middleware/errorHandler');


//  Middleware 

app.use(express.json());


// Database 

mongoose.connect('mongodb://localhost:27017/booksdb')
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));


//  Routes 

app.use('/api/books', bookRoutes);



//  Error Handler (must be last)

app.use(errorHandler);


//  Server 

app.listen(3000, () => {
  console.log('Server running on port 3000');
});