const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * adminUserController
 * -----------------------------------------------------------------
 * Admin-only endpoints for user management.
 * All routes require authentication + admin role.
 */

// ── GET ALL USERS ─────────────────────────────────────────────────────────────
// GET /api/admin/users
// Returns all users with basic info (excludes password hash)
exports.getAllUsers = async (req, res, next) => {
  try {
    const { role, search, limit = 50, page = 1 } = req.query;

    const filter = {};

    // Role filter
    if (role && ['admin', 'user'].includes(role)) {
      filter.role = role;
    }

    // Search by name or email
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const users = await User.find(filter)
      .select('-password -__v') // Exclude password hash and version key
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .skip(skip)
      .lean();

    const total = await User.countDocuments(filter);

    return res.status(200).json({
      users,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET SINGLE USER ───────────────────────────────────────────────────────────
// GET /api/admin/users/:id
// Returns detailed user info (excludes password hash)
exports.getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select('-password -__v')
      .populate('savedBooks', 'title authors coverImage')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

// ── UPDATE USER ROLE ──────────────────────────────────────────────────────────
// PATCH /api/admin/users/:id/role
// Admin can promote/demote users
exports.updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['admin', 'user'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be "admin" or "user".' });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent admin from demoting themselves
    if (user._id.toString() === req.user._id.toString() && role === 'user') {
      return res.status(400).json({ message: 'You cannot demote yourself.' });
    }

    user.role = role;
    await user.save();

    logger.info(
      { userId: user._id, newRole: role, adminId: req.user._id },
      '[ADMIN] User role updated'
    );

    return res.status(200).json({
      message: `User role updated to ${role}`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── DELETE USER ───────────────────────────────────────────────────────────────
// DELETE /api/admin/users/:id
// Admin can delete users (except themselves)
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own account via admin panel.' });
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info(
      { userId: user._id, email: user.email, adminId: req.user._id },
      '[ADMIN] User deleted'
    );

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
};
