#!/usr/bin/env node

/**
 * CLI launcher for Breathe.
 * Launches the prebuilt binary from ~/.breathe/
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const INSTALL_DIR = path.join(os.homedir(), '.breathe');

function fail(msg) {
  console.error(`\n  \x1b[31m✗\x1b[0m  ${msg}`);
  console.error(`     Run: npm install -g breathe-a-min\n`);
  process.exit(1);
}

if (process.platform === 'darwin') {
  const appPath = path.join(INSTALL_DIR, 'Breathe.app');
  if (!fs.existsSync(appPath)) fail('Breathe.app not found. Reinstall to download it.');
  spawn('open', ['-a', appPath], { stdio: 'ignore', detached: true }).unref();
} else if (process.platform === 'win32') {
  const exePath = path.join(INSTALL_DIR, 'Breathe.exe');
  if (!fs.existsSync(exePath)) fail('Breathe.exe not found. Reinstall to download it.');
  spawn(exePath, [], { stdio: 'ignore', detached: true }).unref();
} else {
  fail(`Unsupported platform: ${process.platform}`);
}
