const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');

/**
 * Article routes
 * -----------------------------------------------------------------
 * Public routes return only published articles.
 * Admin routes (POST/PUT/DELETE/PATCH) require authentication + admin role.
 */

// ── PUBLIC ROUTES ─────────────────────────────────────────────────────────────

// GET /api/articles — list all published articles (admin can pass ?includeUnpublished=true)
router.get('/', articleController.getAllArticles);

// GET /api/articles/:slug — get single article by slug
router.get('/:slug', articleController.getArticleBySlug);

// ── ADMIN ROUTES ──────────────────────────────────────────────────────────────

// POST /api/articles — create new article
router.post('/', authenticate, requireAdmin, articleController.createArticle);

// PUT /api/articles/:id — update article
router.put('/:id', authenticate, requireAdmin, articleController.updateArticle);

// DELETE /api/articles/:id — delete article
router.delete('/:id', authenticate, requireAdmin, articleController.deleteArticle);

// PATCH /api/articles/:id/publish — toggle published status
router.patch('/:id/publish', authenticate, requireAdmin, articleController.togglePublish);

module.exports = router;
