#!/usr/bin/env node

/**
 * CLI launcher for Breathe.
 * Launches the prebuilt binary from ~/.breathe/
 *
 * Usage:
 *   breathe-a-min          → launch the app
 *   breathe-a-min update   → update to latest version
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const INSTALL_DIR = path.join(os.homedir(), '.breathe');
const cmd = process.argv[2];

function fail(msg) {
  console.error(`\n  \x1b[31m✗\x1b[0m  ${msg}`);
  console.error(`     Run: npm install -g breathe-a-min\n`);
  process.exit(1);
}

// ── Update command ──
if (cmd === 'update') {
  console.log('\n  \x1b[38;5;116m◯\x1b[0m  Checking for updates...\n');
  try {
    execSync('npm install -g breathe-a-min', { stdio: 'inherit' });
    console.log('\n  \x1b[38;5;151m◉\x1b[0m  Updated. Run \x1b[1mbreathe-a-min\x1b[0m to launch.\n');
  } catch (_) {
    console.error('\n  \x1b[38;5;222m◌\x1b[0m  Update failed. Try manually: npm install -g breathe-a-min\n');
  }
  process.exit(0);
}

// ── Launch ──
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
