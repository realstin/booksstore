const express = require('express');
const router  = express.Router();

const Book = require('../models/Book');

// The public address of the frontend. Every URL in the sitemap must use it,
// because search engines only trust a sitemap whose URLs belong to the site
// that serves it.
const SITE_URL = 'https://bookstowa.vercel.app';

// Public pages that need no login. Add new public pages here.
const STATIC_PATHS = [
  '/',
  '/about',
  '/team',
  '/contact',
  '/news',
  '/help',
  '/privacy',
  '/terms',
];

// Keep the generated XML in memory for an hour so repeated requests do not
// each query the database. A newly added book appears within an hour.
const CACHE_TTL_MS = 60 * 60 * 1000;

// A sitemap file may contain at most 50,000 URLs.
const MAX_BOOKS = 49000;

let cachedXml = null;
let cachedAt  = 0;

function urlEntry(path, lastModified) {
  const lastmod = lastModified
    ? `\n    <lastmod>${new Date(lastModified).toISOString()}</lastmod>`
    : '';

  return `  <url>\n    <loc>${SITE_URL}${path}</loc>${lastmod}\n  </url>`;
}

async function buildSitemap() {
  // Only the fields the sitemap needs; .lean() returns plain objects, which
  // is faster than full Mongoose documents.
  const books = await Book.find({}, '_id updatedAt')
    .sort({ updatedAt: -1 })
    .limit(MAX_BOOKS)
    .lean();

  const entries = [
    ...STATIC_PATHS.map((path) => urlEntry(path)),
    ...books.map((book) => urlEntry(`/books/${book._id}`, book.updatedAt)),
  ];

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join('\n') +
    '\n</urlset>\n'
  );
}

// GET /api/sitemap.xml
router.get('/', async (req, res, next) => {
  try {
    const now = Date.now();

    if (!cachedXml || now - cachedAt > CACHE_TTL_MS) {
      cachedXml = await buildSitemap();
      cachedAt  = now;
    }

    res.set('Cache-Control', 'public, max-age=3600');
    res.type('application/xml').send(cachedXml);
  } catch (err) {
    next(err);
  }
});

module.exports = router;