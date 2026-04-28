#!/usr/bin/env node

/**
 * preuninstall.js — cleans up ~/.breathe/ when the package is uninstalled.
 * Runs automatically via npm's preuninstall lifecycle hook.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const INSTALL_DIR = path.join(os.homedir(), '.breathe');

// TTY output (npm silences lifecycle scripts)
let ttyFd = null;
try {
  const ttyPath = process.platform === 'win32' ? '\\\\.\\CON' : '/dev/tty';
  ttyFd = fs.openSync(ttyPath, 'w');
} catch (_) {}

function out(msg) {
  if (ttyFd !== null) {
    fs.writeSync(ttyFd, msg + '\n');
  } else {
    process.stderr.write(msg + '\n');
  }
}

try {
  if (fs.existsSync(INSTALL_DIR)) {
    fs.rmSync(INSTALL_DIR, { recursive: true, force: true });
    out('');
    out('   \x1b[38;5;116m◯\x1b[0m  \x1b[1mBreathe\x1b[0m removed');
    out('   \x1b[2mcleaned up ~/.breathe\x1b[0m');
    out('');
  }
} catch (_) {
  // Never crash npm uninstall
}
