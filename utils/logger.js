/**
 * utils/logger.js
 * ─────────────────────────────────────────────────────────────────
 * Centralised logger built on pino.
 *
 * Development  → pino-pretty: human-readable, coloured, timestamped
 * Production   → structured JSON: one object per line, parseable by
 *                Render / Datadog / CloudWatch without extra config
 *
 * Usage throughout the codebase:
 *   const logger = require('./utils/logger');   // or '../utils/logger'
 *   logger.info('Server started');
 *   logger.info({ port: 3000 }, 'Server started');
 *   logger.warn({ bookId }, 'Cache miss — falling back to DB');
 *   logger.error({ err }, 'Unhandled error in servePdf');
 *
 * Log levels (lowest → highest severity):
 *   trace | debug | info | warn | error | fatal
 *
 * In production only info and above are emitted (debug/trace are silent).
 * In development all levels are shown.
 * ─────────────────────────────────────────────────────────────────
 */

const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino(
  {
    // Minimum level to emit. 'debug' in dev so we see everything;
    // 'info' in prod so trace/debug noise is suppressed.
    level: isDev ? 'debug' : 'info',

    // Rename pino's default 'msg' field to 'message' — more readable
    // in log aggregators and consistent with common logging conventions.
    messageKey: 'message',

    // Always include a human-readable ISO timestamp alongside the
    // epoch milliseconds pino writes by default.
    timestamp: pino.stdTimeFunctions.isoTime,

    // Serialise Error objects properly so stack traces appear in JSON logs.
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
  },
  isDev
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize:        true,
          translateTime:   'HH:MM:ss',
          ignore:          'pid,hostname',
          messageKey:      'message',
          // Show the level label in uppercase so it is easy to scan
          levelFirst:      true,
        },
      })
    : undefined  // undefined → pino defaults to writing JSON to stdout
);

module.exports = logger;
