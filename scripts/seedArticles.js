/**
 * seedArticles.js
 * -----------------------------------------------------------------
 * One-time script to seed the original hardcoded articles into MongoDB.
 * Run once from the backend directory:
 *
 *   node scripts/seedArticles.js
 *
 * Safe to run multiple times — skips articles whose slug already exists.
 * -----------------------------------------------------------------
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Article  = require('../models/Article');

const ARTICLES = [
  {
    slug:      'introducing-bookstore',
    title:     'Introducing BookStore: A New Way to Discover Trusted Technology Books',
    subtitle:  'We are building a platform designed to help learners discover carefully selected, up-to-date books without wasting hours searching the web.',
    excerpt:   'BookStore is live. We built it to solve a problem every developer knows: finding trustworthy, current learning resources takes too long. Here is why we built it and what comes next.',
    date:      'July 20, 2026',
    location:  'Kigali, Rwanda',
    category:  'Product',
    coverImage: null,
    readTime:  '4 min read',
    author: {
      name:     'IRATUZI M. Justin',
      role:     'Founder & Full Stack Developer',
      initials: 'IJ',
    },
    featured:    true,
    published:   true,
    publishedAt: new Date('2026-07-20'),
    content: [
      { type: 'paragraph', content: 'Every developer has felt the frustration. You want to learn something new — maybe Kubernetes, maybe machine learning, maybe system design — and you spend the first hour just trying to figure out which book is worth reading. Links are outdated. Reviews are scattered across Reddit threads. Some editions are years behind the current technology.' },
      { type: 'paragraph', content: 'BookStore exists to solve exactly that. We curate, organize, and verify technology books so that learners can skip the searching and go straight to learning. Every book in our library has been reviewed for quality, relevance, and accuracy. We keep the collection up to date as technologies evolve.' },
      { type: 'heading',   content: 'What we built' },
      { type: 'paragraph', content: 'Version one of BookStore is focused entirely on books. Not courses, not videos, not podcasts — just books. We believe books are still one of the most effective ways to build deep, lasting knowledge. A well-written book gives you context, reasoning, and depth that a quick tutorial often cannot.' },
      { type: 'paragraph', content: 'The platform is designed to feel calm and focused. No advertisements. No cluttered interfaces. No dark patterns. Just a clean, organized library of trusted resources.' },
      { type: 'heading',   content: 'The reading experience' },
      { type: 'paragraph', content: 'We spent a significant amount of time designing the reading experience. The interface is built for long reading sessions — comfortable typography, generous spacing, distraction-free layouts, and reading progress tracking so you always know where you left off.' },
      { type: 'paragraph', content: 'You can save books to your personal library, mark favorites, download for offline reading, and organize your collection the way that works best for you.' },
      { type: 'heading',   content: 'What is coming next' },
      { type: 'paragraph', content: 'This is version one. We have a lot more planned. Personal reading dashboards, community recommendations, smarter discovery tools, and expert-curated collections are all on the roadmap. We will keep you updated right here as we ship each one.' },
      { type: 'paragraph', content: 'If you have feedback, suggestions, or just want to say hello, reach out through the Contact page. We read every message.' },
    ],
  },
  {
    slug:      'bookstore-design-principles',
    title:     'The Design Principles Behind BookStore',
    subtitle:  'How we think about design, and why every decision starts with the learner.',
    excerpt:   'Great design is invisible. Here are the principles we used to shape every corner of the BookStore experience.',
    date:      'July 15, 2026',
    location:  'Kigali, Rwanda',
    category:  'Engineering',
    coverImage: null,
    readTime:  '5 min read',
    author: {
      name:     'IRATUZI M. Justin',
      role:     'Founder & Full Stack Developer',
      initials: 'IJ',
    },
    featured:    false,
    published:   true,
    publishedAt: new Date('2026-07-15'),
    content: [
      { type: 'paragraph', content: 'When we started designing BookStore, we made one decision early on that shaped everything else: the learner comes first. Not the business model, not the feature roadmap — the person sitting down to read and learn.' },
      { type: 'heading',   content: 'Calm over stimulating' },
      { type: 'paragraph', content: 'Most digital products are designed to maximize engagement. More clicks, more time on site, more notifications. We deliberately went the other way. BookStore is designed to be calm. The interface should fade into the background so the content can come forward.' },
      { type: 'paragraph', content: 'That means no advertisements, no autoplay, no push notifications, no gamification mechanics that turn learning into a numbers game. Just a clean, focused environment where reading is easy.' },
      { type: 'heading',   content: 'Whitespace as a design tool' },
      { type: 'paragraph', content: 'We use a lot of whitespace. This is a deliberate choice. Generous spacing reduces cognitive load, makes text easier to read, and gives the design a premium, editorial feel. Every element on the page has room to breathe.' },
      { type: 'heading',   content: 'Typography matters' },
      { type: 'paragraph', content: 'We spent more time on typography than on almost any other design decision. The right typeface, the right size, the right line height — these details have an enormous impact on how comfortable it is to read for long periods. We tested many options before settling on our current choices.' },
      { type: 'paragraph', content: 'Good typography is largely invisible. You do not notice it when it is right. You only notice it when it is wrong — when the lines are too long, the spacing too tight, the contrast too low. We worked hard to get it right.' },
      { type: 'heading',   content: 'Consistent, not repetitive' },
      { type: 'paragraph', content: 'Consistency means that once you learn how one part of the interface works, every other part works the same way. It reduces the learning curve and makes the product feel reliable and trustworthy. But consistency should never become repetitive — every section of the product should feel purposeful, not like a copy of the one before it.' },
    ],
  },
];

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.\n');

    let seeded = 0;
    let skipped = 0;

    for (const data of ARTICLES) {
      const existing = await Article.findOne({ slug: data.slug });

      if (existing) {
        console.log(`⏭  Skipped  — "${data.slug}" already exists`);
        skipped++;
        continue;
      }

      await Article.create(data);
      console.log(`✅ Seeded   — "${data.slug}"`);
      seeded++;
    }

    console.log(`\nDone. ${seeded} seeded, ${skipped} skipped.`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

seed();
