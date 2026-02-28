#!/usr/bin/env node

/**
 * Start All Campaign Workers
 * Uses tsx to run TypeScript workers directly
 */

const path = require('path');
const { spawn } = require('child_process');

console.log('🚀 Starting All Campaign Workers...\n');

const tsxBin  = path.join(__dirname, '..', 'node_modules', '.bin', 'tsx');
const envFile  = path.join(__dirname, '..', '.env.local');
const rootDir  = path.join(__dirname, '..');

const workers = [
  { name: 'Campaign Processor', file: 'lib/queue/workers/campaign-worker.ts',      emoji: '⚙️'  },
  { name: 'Status Checker',     file: 'lib/queue/workers/status-checker-worker.ts', emoji: '🔍' },
  { name: 'Inbox Scanner',      file: 'lib/queue/workers/inbox-scanner-worker.ts',  emoji: '📬' },
];

const processes = [];

workers.forEach((worker) => {
  console.log(`${worker.emoji}  Starting ${worker.name}...`);

  const workerProcess = spawn(
    tsxBin,
    [`--env-file=${envFile}`, path.join(rootDir, worker.file)],
    { stdio: 'inherit', env: process.env, cwd: rootDir }
  );

  workerProcess.on('error', (err) => console.error(`❌ ${worker.name} error:`, err));
  workerProcess.on('exit', (code) => console.log(`🛑 ${worker.name} exited with code ${code}`));

  processes.push(workerProcess);
});

console.log('\n✅ All workers started!');
console.log('Press Ctrl+C to stop all workers\n');

// Graceful shutdown
function shutdown() {
  console.log('\n🛑 Stopping all workers...');
  processes.forEach((p) => p.kill('SIGTERM'));
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
