#!/usr/bin/env node

/**
 * Start Status Checker Worker
 * Monitors connection request acceptance status
 */

const path = require('path');

// Try to load dotenv if available
try {
  const dotenv = require('dotenv');
  const envPath = path.join(__dirname, '..', '.env.local');
  dotenv.config({ path: envPath });
  console.log('Loaded environment from .env.local');
} catch (e) {
  console.log('dotenv not available or .env.local not found, using system environment');
}

console.log('Starting Status Checker Worker...');
console.log('Redis URL:', process.env.REDIS_URL || 'redis://localhost:6379');

// Import worker (will start automatically)
require('../lib/queue/workers/status-checker-worker');

console.log('Status Checker Worker Process Started');
console.log('Press Ctrl+C to stop');
