const express = require('express');
const app = express();
const books = [];
require('dotenv').config();

const mongoose = require('mongoose');
const bookRoutes = require('./routes/books');
const errorHandler = require('./middleware/errorHandler');

const PORT =process.env.PORT;


//  Middleware 

app.use(express.json());


// Database 

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));


//  Routes 

app.use('/api/books', bookRoutes);



//  Error Handler (must be last)

app.use(errorHandler);


//  Server 

app.listen( PORT, () => {
  console.log(`Server running on port ${PORT}`);
});