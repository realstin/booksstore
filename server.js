const express = require('express');
const app = express();
require('dotenv').config();

const bookRoutes = require('./routes/books');
const errorHandler = require('./middleware/errorHandler');
const connectDB = require('./config/database');
const PORT =process.env.PORT;

//  Middleware 
app.use(express.json());

//  Routes 
app.use('/api/books', bookRoutes);

//  Error Handler (must be last)
app.use(errorHandler);


//  Server 
const startServer = async () => {
  
  // Database
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();