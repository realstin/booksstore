const express = require('express');
const router = express.Router();
const adminUserController = require('../controllers/adminUserController');
const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');

/**
 * Admin user management routes
 * -----------------------------------------------------------------
 * All routes require authentication + admin role.
 */

// Apply middleware to all routes
router.use(authenticate);
router.use(requireAdmin);

// GET /api/admin/users — list all users (with filters, pagination)
router.get('/', adminUserController.getAllUsers);

// GET /api/admin/users/:id — get single user details
router.get('/:id', adminUserController.getUserById);

// PATCH /api/admin/users/:id/role — update user role (admin/user)
router.patch('/:id/role', adminUserController.updateUserRole);

// DELETE /api/admin/users/:id — delete user
router.delete('/:id', adminUserController.deleteUser);

module.exports = router;
