#!/usr/bin/env node

/**
 * Postinstall — runs after `npm install breathe`
 * Spawns the actual installer in a detached process so npm doesn't kill it.
 */

const { spawn } = require('child_process');
const path = require('path');

const child = spawn(process.execPath, [path.join(__dirname, 'install-binary.js')], {
  stdio: 'inherit',
  detached: false,
});

child.on('close', (code) => {
  // Always exit 0 — never break npm install
  process.exit(0);
});

child.on('error', () => {
  process.exit(0);
});
