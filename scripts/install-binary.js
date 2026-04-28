#!/usr/bin/env node

/**
 * install-binary.js
 * Downloads the prebuilt Breathe binary from GitHub Releases.
 * Detects OS, downloads the right asset, extracts to ~/.breathe/
 *
 * npm v7+ silences postinstall output — we write to /dev/tty directly.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { execSync } = require('child_process');

// ── Config ──
const REPO = 'heynaavi/breathe';
const VERSION = require('../package.json').version;
const INSTALL_DIR = path.join(os.homedir(), '.breathe');
const VERSION_FILE = path.join(INSTALL_DIR, '.version');
const RELEASES_URL = `https://github.com/${REPO}/releases`;

// ── Colors (soft, calming palette) ──
const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[38;5;116m',     // soft teal
  green: '\x1b[38;5;151m',    // sage green
  yellow: '\x1b[38;5;222m',   // warm amber
  lavender: '\x1b[38;5;183m', // soft purple
  grey: '\x1b[38;5;245m',     // muted grey
};

// ── TTY output (bypasses npm's silenced pipes) ──
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

function clearLine(msg) {
  if (ttyFd !== null) {
    fs.writeSync(ttyFd, `\x1b[2K\r${msg}`);
  } else {
    process.stderr.write(`\x1b[2K\r${msg}`);
  }
}

// ── Progress bar ──
function progressBar(ratio) {
  const width = 20;
  const filled = Math.round(width * Math.min(ratio, 1));
  const empty = width - filled;
  const pct = Math.round(ratio * 100);
  const bar = '●'.repeat(filled) + '·'.repeat(empty);
  return `${c.cyan}${bar}${c.reset} ${c.dim}${pct}%${c.reset}`;
}

function formatSize(bytes) {
  if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes > 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

// ── Asset name mapping ──
function getAssetInfo() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'darwin') {
    const archSuffix = arch === 'arm64' ? 'arm64-mac' : 'mac';
    return {
      fileName: `Breathe-${VERSION}-${archSuffix}.zip`,
      extract: extractZipMac,
      label: `macOS ${arch === 'arm64' ? '(Apple Silicon)' : '(Intel)'}`,
    };
  } else if (platform === 'win32') {
    return {
      fileName: `Breathe.${VERSION}.exe`,
      extract: extractExeWin,
      label: 'Windows',
    };
  }
  return null;
}

// ── Download with progress ──
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (res) => {
      // Follow redirects (GitHub sends 302)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const totalBytes = parseInt(res.headers['content-length'], 10) || 0;
      let downloaded = 0;
      const file = fs.createWriteStream(dest);

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        file.write(chunk);
        if (totalBytes > 0) {
          const size = `${formatSize(downloaded)} / ${formatSize(totalBytes)}`;
          clearLine(`   ${progressBar(downloaded / totalBytes)}  ${c.grey}${size}${c.reset}`);
        }
      });

      res.on('end', () => {
        file.end(() => {
          clearLine(`   ${progressBar(1)}  ${c.grey}${formatSize(downloaded)}${c.reset}\n`);
          resolve();
        });
      });

      res.on('error', reject);
    });

    request.on('error', reject);
  });
}

// ── Extractors ──
function extractZipMac(zipPath) {
  out(`   ${c.dim}unpacking...${c.reset}`);
  execSync(`unzip -o -q "${zipPath}" -d "${INSTALL_DIR}"`, { stdio: 'ignore' });
  try {
    execSync(`xattr -rd com.apple.quarantine "${INSTALL_DIR}" 2>/dev/null`, { stdio: 'ignore' });
  } catch (_) {}
}

function extractExeWin(exePath) {
  out(`   ${c.dim}installing...${c.reset}`);
  const dest = path.join(INSTALL_DIR, 'Breathe.exe');
  fs.copyFileSync(exePath, dest);
}

// ── Main ──
async function main() {
  out('');
  out(`   ${c.cyan}◯${c.reset}  ${c.bold}Breathe${c.reset}`);
  out(`   ${c.dim}a 60-second sound bath for your mind${c.reset}`);
  out('');

  const asset = getAssetInfo();
  if (!asset) {
    out(`   ${c.yellow}◌${c.reset}  platform not supported ${c.dim}(${process.platform}/${process.arch})${c.reset}`);
    out('');
    out(`   ${c.dim}download manually:${c.reset}`);
    out(`   ${c.lavender}${RELEASES_URL}${c.reset}`);
    out('');
    return;
  }

  // Check if already installed at this version
  if (fs.existsSync(VERSION_FILE)) {
    const installed = fs.readFileSync(VERSION_FILE, 'utf8').trim();
    if (installed === VERSION) {
      const binaryExists = process.platform === 'darwin'
        ? fs.existsSync(path.join(INSTALL_DIR, 'Breathe.app'))
        : fs.existsSync(path.join(INSTALL_DIR, 'Breathe.exe'));

      if (binaryExists) {
        out(`   ${c.green}◉${c.reset}  already installed ${c.dim}v${VERSION}${c.reset}`);
        out(`   ${c.dim}run:${c.reset} ${c.cyan}breathe-a-min${c.reset}`);
        out('');
        out(`   ${c.dim}github:${c.reset} ${c.lavender}https://github.com/${REPO}${c.reset}`);
        out('');
        return;
      }
    }
  }

  // Ensure install directory
  fs.mkdirSync(INSTALL_DIR, { recursive: true });

  const url = `https://github.com/${REPO}/releases/download/v${VERSION}/${asset.fileName}`;
  const tmpFile = path.join(os.tmpdir(), `breathe-${VERSION}-${asset.fileName}`);

  out(`   ${c.dim}v${VERSION} · ${asset.label}${c.reset}`);
  out('');

  try {
    await download(url, tmpFile);
    asset.extract(tmpFile);

    // Write version marker
    fs.writeFileSync(VERSION_FILE, VERSION);

    // Cleanup
    try { fs.unlinkSync(tmpFile); } catch (_) {}

    out('');
    out(`   ${c.green}◉${c.reset}  installed ${c.dim}→ ~/.breathe${c.reset}`);
    out(`   ${c.dim}run:${c.reset} ${c.cyan}breathe-a-min${c.reset}`);
    out('');
    out(`   ${c.dim}github:${c.reset} ${c.lavender}https://github.com/${REPO}${c.reset}`);
    out('');
  } catch (err) {
    // Cleanup on failure
    try { fs.unlinkSync(tmpFile); } catch (_) {}

    out('');
    out(`   ${c.yellow}◌${c.reset}  couldn't download ${c.dim}(${err.message})${c.reset}`);
    out('');
    out(`   ${c.dim}grab it manually:${c.reset}`);
    out(`   ${c.lavender}${RELEASES_URL}/tag/v${VERSION}${c.reset}`);
    out('');
  }
}

// Never crash npm install
main().catch(() => process.exit(0));
