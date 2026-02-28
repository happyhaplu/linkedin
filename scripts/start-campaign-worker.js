/**
 * Start Campaign Worker
 * Run this file to start the background worker
 * Usage: npm run campaign-worker
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

// Import worker (will start automatically)
require('../lib/queue/workers/campaign-worker')

console.log('Campaign Worker Process Started')
console.log('Redis URL:', process.env.REDIS_URL || 'redis://localhost:6379')
console.log('Press Ctrl+C to stop')
