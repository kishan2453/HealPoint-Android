'use strict';

/**
 * HealPoint - Slot module MongoDB connection.
 *
 * Loads the module's `.env` (without polluting the parent repo's env) and
 * connects mongoose to the configured MongoDB. Connection string resolution:
 *
 *   1. Slot-load always;
 */
const fs = require('fs');
const path = require('path');

const MODULE_ROOT = path.join(__dirname, '..');

/** Minimal .env parser (no external dep) - KEY=VALUE lines, # comments. */
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  let text = '';
  try { text = fs.readFileSync(envPath, 'utf8'); } catch (err) { return {}; }
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (/^\d+$/.test(value)) value = Number(value);
    out[key] = value;
  }
  return out;
}

function defaults() {
  return {
    MONGO_URI: 'mongodb://127.0.0.1:27017/healpoint_slots',
    DB_NAME: 'healpoint_slots',
  };
}

/** Read the module .env once. */
const env = Object.assign(defaults(), loadEnvFile(path.join(MODULE_ROOT, '.env')));

/** Build a mongoose-ready URI (appends dbName when none present). */
function resolveMongoUri() {
  let uri = String(env.MONGO_URI || defaults().MONGO_URI).trim();
  const name = String(env.DB_NAME || defaults().DB_NAME).trim();
  if (!name) return uri;
  if (/([?#])/.test(uri.split('/').pop() || '')) {
    // URI already contains a dbName before any query string.
    return uri;
  }
  if (uri.endsWith('/')) uri = uri.slice(0, -1);
  return uri + '/' + name;
}

/** True when a connection is already live. */
function isConnected() {
  const mongoose = require('mongoose');
  return mongoose.connectionState === 1 || mongoose.connectionState === 2;
}

/**
 * Connect mongoose to MongoDB (idempotent). Returns true on success and
 * throws a descriptive error otherwise.
 */
async function connectDb() {
  const mongoose = require('mongoose');
  if (isConnected()) return true;
  mongoose.connection.on('error', (err) => {
    try { console.warn('[slots-db] error', String(err.message || '')); } catch (e) { console.warn('[slots-db] error'); }
  });
  const uri = resolveMongoUri();
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 4000,
  });
  return true;
}

/** Disconnect cleanly (used by CLI/probes and for graceful shutdown). */
async function disconnectDb() {
  const mongoose = require('mongoose');
  if (mongoose.connectionState !== 0 && mongoose.connectionState !== 3) {
    await mongoose.disconnect();
  }
}

/** The configured DB_NAME (for diagnostics). */
function dbName() {
  return String(env.DB_NAME || defaults().DB_NAME);
}

module.exports = {
  env,
  resolveMongoUri,
  connectDb,
  disconnectDb,
  isConnected,
  dbName,
};
