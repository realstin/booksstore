/**
 * seedTeam.js
 * -----------------------------------------------------------------
 * One-time script to seed the original hardcoded team member into MongoDB.
 * Run once from the backend directory:
 *
 *   node scripts/seedTeam.js
 *
 * Safe to run multiple times — skips if the member already exists.
 * -----------------------------------------------------------------
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Team     = require('../models/Team');

const MEMBERS = [
  {
    name:   'IRATUZI M. Justin',
    role:   'CEO & Founder',
    bio:    'Builder and visionary behind BookStore. Passionate about helping learners discover trusted technology resources — faster and smarter.',
    photo:  '', // Add your photo URL here after uploading (see instructions below)
    order:  0,
    active: true,
    socials: [
      { label: 'X (Twitter)', href: 'https://x.com/irmjustin',      icon: 'x'      },
      { label: 'GitHub',      href: 'https://github.com/realstin',   icon: 'github' },
      { label: 'Website',     href: 'https://irmjustin.github.io/',  icon: 'globe'  },
    ],
  },
];

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.\n');

    let seeded  = 0;
    let skipped = 0;

    for (const data of MEMBERS) {
      const existing = await Team.findOne({ name: data.name });

      if (existing) {
        console.log(`⏭  Skipped  — "${data.name}" already exists`);
        skipped++;
        continue;
      }

      await Team.create(data);
      console.log(`✅ Seeded   — "${data.name}"`);
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
