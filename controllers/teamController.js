const Team = require('../models/Team');
const logger = require('../utils/logger');

/**
 * teamController
 * -----------------------------------------------------------------
 * CRUD operations for team members.
 * Public endpoints return only active members.
 */

// ── GET ALL TEAM MEMBERS ──────────────────────────────────────────────────────
// GET /api/team
// Public — returns only active team members, sorted by order
exports.getAllTeamMembers = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;

    const filter = {};

    // Only show active members unless admin explicitly requests inactive
    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin || includeInactive !== 'true') {
      filter.active = true;
    }

    const members = await Team.find(filter)
      .sort({ order: 1, createdAt: 1 })
      .select('-__v')
      .lean();

    return res.status(200).json(members);
  } catch (err) {
    next(err);
  }
};

// ── GET SINGLE TEAM MEMBER ────────────────────────────────────────────────────
// GET /api/team/:id
// Public — returns team member by ID
exports.getTeamMemberById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const member = await Team.findById(id).select('-__v').lean();

    if (!member) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    // Only admins can view inactive members
    if (!member.active && req.user?.role !== 'admin') {
      return res.status(404).json({ message: 'Team member not found' });
    }

    return res.status(200).json(member);
  } catch (err) {
    next(err);
  }
};

// ── CREATE TEAM MEMBER ────────────────────────────────────────────────────────
// POST /api/team
// Admin only
exports.createTeamMember = async (req, res, next) => {
  try {
    const { name, role, bio, photo, socials, order, active } = req.body;

    // Validation
    if (!name || !role || !bio) {
      return res.status(400).json({
        message: 'Missing required fields: name, role, bio',
      });
    }

    const member = new Team({
      name,
      role,
      bio,
      photo: photo || '',
      socials: socials || [],
      order: order !== undefined ? order : 0,
      active: active !== undefined ? active : true,
    });

    await member.save();

    logger.info({ memberId: member._id, name: member.name }, '[TEAM] Member created');
    return res.status(201).json(member);
  } catch (err) {
    next(err);
  }
};

// ── UPDATE TEAM MEMBER ────────────────────────────────────────────────────────
// PUT /api/team/:id
// Admin only
exports.updateTeamMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, role, bio, photo, socials, order, active } = req.body;

    const member = await Team.findById(id);

    if (!member) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    // Update fields
    if (name !== undefined) member.name = name;
    if (role !== undefined) member.role = role;
    if (bio !== undefined) member.bio = bio;
    if (photo !== undefined) member.photo = photo;
    if (socials !== undefined) member.socials = socials;
    if (order !== undefined) member.order = order;
    if (active !== undefined) member.active = active;

    await member.save();

    logger.info({ memberId: member._id }, '[TEAM] Member updated');
    return res.status(200).json(member);
  } catch (err) {
    next(err);
  }
};

// ── DELETE TEAM MEMBER ────────────────────────────────────────────────────────
// DELETE /api/team/:id
// Admin only
exports.deleteTeamMember = async (req, res, next) => {
  try {
    const { id } = req.params;

    const member = await Team.findByIdAndDelete(id);

    if (!member) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    logger.info({ memberId: id, name: member.name }, '[TEAM] Member deleted');
    return res.status(200).json({ message: 'Team member deleted' });
  } catch (err) {
    next(err);
  }
};
