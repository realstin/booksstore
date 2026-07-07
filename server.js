const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');

const bookRoutes = require('./routes/books');
const errorHandler = require('./middleware/errorHandler');
const connectDB = require('./config/database');
const authRoutes = require("./routes/auth");
const PORT =process.env.PORT;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://bookstowa.vercel.app",
    ],
    credentials: true,
  })
);

app.use(express.json());

// Parse cookies from incoming requests
app.use(cookieParser());

//  Routes
app.use("/api/auth", authRoutes); 
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