const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');

/**
 * Team routes
 * -----------------------------------------------------------------
 * Public routes return only active team members.
 * Admin routes (POST/PUT/DELETE) require authentication + admin role.
 */

// ── PUBLIC ROUTES ─────────────────────────────────────────────────────────────

// GET /api/team — list all active team members (admin can pass ?includeInactive=true)
router.get('/', teamController.getAllTeamMembers);

// GET /api/team/:id — get single team member by ID
router.get('/:id', teamController.getTeamMemberById);

// ── ADMIN ROUTES ──────────────────────────────────────────────────────────────

// POST /api/team — create new team member
router.post('/', authenticate, requireAdmin, teamController.createTeamMember);

// PUT /api/team/:id — update team member
router.put('/:id', authenticate, requireAdmin, teamController.updateTeamMember);

// DELETE /api/team/:id — delete team member
router.delete('/:id', authenticate, requireAdmin, teamController.deleteTeamMember);

module.exports = router;
