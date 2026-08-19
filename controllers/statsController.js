const User = require('../models/User');
const Book = require('../models/Book');

// ── GET STATS ──────────────────────────────────────────────────────────────
// GET /api/stats  (public — no authentication required)
//
// Calculates all four homepage statistics live from the source collections.
// No singleton Stats document is read or written here.
//
// Calculation method for each field:
//   totalUsers      → User.countDocuments()
//   totalBooks      → Book.countDocuments()
//   totalSavedBooks → sum of every user's savedBooks array length via aggregation
//   averageRating   → average of Book.rating across all books via aggregation
//
exports.getStats = async (req, res, next) => {
  try {
    // Run all four queries in parallel — none depends on another.
    const [
      totalUsers,
      totalBooks,
      savedBooksAgg,
      avgRatingAgg,
    ] = await Promise.all([

      // 1. Count every user document
      User.countDocuments(),

      // 2. Count every book document
      Book.countDocuments(),

      // 3. Sum the length of savedBooks across all users.
      //    $ifNull guards against users whose savedBooks field is missing
      //    (e.g. documents created before the field was defined).
      User.aggregate([
        {
          $group: {
            _id: null,
            total: {
              $sum: { $size: { $ifNull: ['$savedBooks', []] } },
            },
          },
        },
      ]),

      // 4. Average Book.rating across all books.
      //    Only books with a rating field are included; books with rating: 0
      //    are still included so the average reflects the real dataset.
      Book.aggregate([
        {
          $group: {
            _id: null,
            avg: { $avg: '$rating' },
          },
        },
      ]),
    ]);

    // Extract scalar values from aggregation results.
    // Both aggregations return an empty array when the collection is empty —
    // fall back to 0 in that case so the response always contains a number.
    const totalSavedBooks = savedBooksAgg.length > 0 ? savedBooksAgg[0].total : 0;
    const averageRating   = avgRatingAgg.length  > 0 ? avgRatingAgg[0].avg   : 0;

    // Round averageRating to 1 decimal place (e.g. 4.3 not 4.333333…).
    // Use Number() to ensure it stays a number, not a string.
    const roundedAverageRating = Number(averageRating.toFixed(1));

    return res.status(200).json({
      totalUsers,
      totalBooks,
      totalSavedBooks,
      averageRating: roundedAverageRating,
    });

  } catch (error) {
    next(error);
  }
};
