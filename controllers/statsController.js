const Stats = require('../models/Stats');

// ── GET STATS ──────────────────────────────────────────────────────────────
// GET /api/books/stats
// Returns cached stats (no database calculation)
exports.getStats = async (req, res, next) => {
  try {
    console.log('[STATS] Fetching cached stats...');

    // Get the main stats document
    let stats = await Stats.findById('main');

    // If stats don't exist yet, create them with defaults
    if (!stats) {
      console.log('[STATS] Creating default stats document...');
      stats = await Stats.create({
        _id: 'main',
        totalUsers: 0,
        totalBooks: 0,
        totalSavedBooks: 0,
        averageRating: 0,
      });
    }

    console.log('[STATS] ✅ Returning cached stats');
    return res.status(200).json(stats);

  } catch (error) {
    next(error);
  }
};

// ── UPDATE STATS (Admin Only) ──────────────────────────────────────────────
// PUT /api/books/stats
// Updates stats manually (only admins should access this)
exports.updateStats = async (req, res, next) => {
  try {
    const { totalUsers, totalBooks, totalSavedBooks, averageRating } = req.body;

    console.log('[STATS] Updating stats...');

    // Update or create the main stats document
    let stats = await Stats.findByIdAndUpdate(
      'main',
      {
        totalUsers,
        totalBooks,
        totalSavedBooks,
        averageRating,
        lastUpdated: new Date(),
      },
      { new: true, upsert: true } // Create if doesn't exist
    );

    console.log('[STATS] ✅ Stats updated successfully');
    return res.status(200).json({
      message: 'Stats updated successfully',
      stats,
    });

  } catch (error) {
    next(error);
  }
};