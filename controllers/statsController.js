const User = require('../models/User');
const Book = require('../models/Book');

// ========== GET STATISTICS ==========
// Returns: totalUsers, totalBooks, totalSaves, averageRating
exports.getStats = async (req, res, next) => {
  try {
    // STEP 1: Count total users
    const totalUsers = await User.countDocuments();

    // STEP 2: Count total books
    const totalBooks = await Book.countDocuments();

    // STEP 3: Calculate total saves and average rating using aggregation
    const bookStats = await Book.aggregate([
      {
        // Stage 1: Group all books together
        $group: {
          _id: null,
          // Sum all savesCount values
          totalSaves: { $sum: '$savesCount' },
          // Calculate average of all ratings
          averageRating: { $avg: '$rating' }
        }
      }
    ]);

    // Extract the values (if no books exist, use 0)
    const totalSaves = bookStats[0]?.totalSaves || 0;
    const averageRating = bookStats[0]?.averageRating || 0;

    // STEP 4: Send response
    res.status(200).json({
      totalUsers,
      totalBooks,
      totalSaves,
      averageRating: Math.round(averageRating * 10) / 10 // Round to 1 decimal
    });

  } catch (error) {
    next(error);
  }
};