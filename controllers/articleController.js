const Article = require('../models/Article');
const { notifyNewArticle } = require('../utils/notifySubscribers');
const logger = require('../utils/logger');

/**
 * articleController
 * -----------------------------------------------------------------
 * CRUD operations for articles.
 * Publishing triggers subscriber notifications via notifyNewArticle().
 */

// ── GET ALL ARTICLES ──────────────────────────────────────────────────────────
// GET /api/articles
// Public — returns only published articles for frontend
// Admin can pass ?includeUnpublished=true to see drafts
exports.getAllArticles = async (req, res, next) => {
  try {
    const filter = {};

    // Only show published articles unless admin explicitly requests unpublished
    const isAdmin = req.user?.role === 'admin';
    const includeUnpublished = req.query.includeUnpublished === 'true';

    if (!isAdmin || !includeUnpublished) {
      filter.published = true;
    }

    const articles = await Article.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .select('-__v');

    return res.status(200).json(articles);
  } catch (err) {
    next(err);
  }
};

// ── GET SINGLE ARTICLE ────────────────────────────────────────────────────────
// GET /api/articles/:slug
// Public — returns article by slug
exports.getArticleBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const article = await Article.findOne({ slug }).select('-__v');

    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    // Only admins can view unpublished articles
    if (!article.published && req.user?.role !== 'admin') {
      return res.status(404).json({ message: 'Article not found' });
    }

    return res.status(200).json(article);
  } catch (err) {
    next(err);
  }
};

// ── CREATE ARTICLE ────────────────────────────────────────────────────────────
// POST /api/articles
// Admin only
exports.createArticle = async (req, res, next) => {
  try {
    const {
      title,
      slug,
      subtitle,
      excerpt,
      date,
      location,
      category,
      coverImage,
      readTime,
      author,
      featured,
      published,
      event,
      content,
    } = req.body;

    // Validation
    if (!title || !slug || !excerpt || !date || !category || !author?.name) {
      return res.status(400).json({
        message: 'Missing required fields: title, slug, excerpt, date, category, author.name',
      });
    }

    // Check slug uniqueness
    const existing = await Article.findOne({ slug });
    if (existing) {
      return res.status(400).json({ message: 'Slug already exists' });
    }

    const article = new Article({
      title,
      slug: slug.toLowerCase().trim(),
      subtitle,
      excerpt,
      date,
      location,
      category,
      coverImage,
      readTime,
      author,
      featured,
      published: published || false,
      event,
      content: content || [],
      publishedAt: published ? new Date() : null,
    });

    await article.save();

    // If published on creation, notify subscribers
    if (published) {
      notifyNewArticle(article).catch((err) => {
        logger.error({ err, articleId: article._id }, '[ARTICLE] Notification failed');
      });
    }

    logger.info({ articleId: article._id, slug: article.slug }, '[ARTICLE] Created');
    return res.status(201).json(article);
  } catch (err) {
    next(err);
  }
};

// ── UPDATE ARTICLE ────────────────────────────────────────────────────────────
// PUT /api/articles/:id
// Admin only
exports.updateArticle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      slug,
      subtitle,
      excerpt,
      date,
      location,
      category,
      coverImage,
      readTime,
      author,
      featured,
      published,
      event,
      content,
    } = req.body;

    const article = await Article.findById(id);

    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    // Check slug uniqueness if changing
    if (slug && slug !== article.slug) {
      const existing = await Article.findOne({ slug });
      if (existing) {
        return res.status(400).json({ message: 'Slug already exists' });
      }
      article.slug = slug.toLowerCase().trim();
    }

    // Track if this is a publish action
    const wasUnpublished = !article.published;
    const isNowPublished = published === true;

    // Update fields
    if (title !== undefined) article.title = title;
    if (subtitle !== undefined) article.subtitle = subtitle;
    if (excerpt !== undefined) article.excerpt = excerpt;
    if (date !== undefined) article.date = date;
    if (location !== undefined) article.location = location;
    if (category !== undefined) article.category = category;
    if (coverImage !== undefined) article.coverImage = coverImage;
    if (readTime !== undefined) article.readTime = readTime;
    if (author !== undefined) article.author = author;
    if (featured !== undefined) article.featured = featured;
    if (event !== undefined) article.event = event;
    if (content !== undefined) article.content = content;

    if (published !== undefined) {
      article.published = published;
      // Set publishedAt only on first publish
      if (isNowPublished && wasUnpublished) {
        article.publishedAt = new Date();
      }
    }

    await article.save();

    // Notify subscribers if this is a new publish action
    if (wasUnpublished && isNowPublished) {
      notifyNewArticle(article).catch((err) => {
        logger.error({ err, articleId: article._id }, '[ARTICLE] Notification failed');
      });
      logger.info({ articleId: article._id }, '[ARTICLE] Published and notified');
    } else {
      logger.info({ articleId: article._id }, '[ARTICLE] Updated');
    }

    return res.status(200).json(article);
  } catch (err) {
    next(err);
  }
};

// ── DELETE ARTICLE ────────────────────────────────────────────────────────────
// DELETE /api/articles/:id
// Admin only
exports.deleteArticle = async (req, res, next) => {
  try {
    const { id } = req.params;

    const article = await Article.findByIdAndDelete(id);

    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    logger.info({ articleId: id, slug: article.slug }, '[ARTICLE] Deleted');
    return res.status(200).json({ message: 'Article deleted' });
  } catch (err) {
    next(err);
  }
};

// ── PUBLISH/UNPUBLISH ARTICLE ─────────────────────────────────────────────────
// PATCH /api/articles/:id/publish
// Admin only — toggle published status
exports.togglePublish = async (req, res, next) => {
  try {
    const { id } = req.params;
    const article = await Article.findById(id);

    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    const wasUnpublished = !article.published;
    article.published = !article.published;

    // Set publishedAt on first publish
    if (article.published && wasUnpublished) {
      article.publishedAt = new Date();
    }

    await article.save();

    // Notify if publishing
    if (wasUnpublished && article.published) {
      notifyNewArticle(article).catch((err) => {
        logger.error({ err, articleId: article._id }, '[ARTICLE] Notification failed');
      });
      logger.info({ articleId: article._id }, '[ARTICLE] Published via toggle');
    }

    return res.status(200).json(article);
  } catch (err) {
    next(err);
  }
};
