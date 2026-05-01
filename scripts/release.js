#!/usr/bin/env node

/**
 * release.js — One-command release for Breathe
 *
 * Usage:
 *   node scripts/release.js patch     → 1.0.0 → 1.0.1
 *   node scripts/release.js minor     → 1.0.0 → 1.1.0
 *   node scripts/release.js major     → 1.0.0 → 2.0.0
 *   node scripts/release.js 1.2.3    → sets exact version
 *
 * What it does:
 *   1. Bumps version in package.json
 *   2. Commits + tags
 *   3. Pushes to GitHub
 *   4. Builds mac (dmg + zip) — skip with --skip-build
 *   5. Creates GitHub Release + uploads assets
 *   6. npm publish is handled by GitHub Actions on release
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Colors ──
const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[38;5;116m',
  green: '\x1b[38;5;151m',
  yellow: '\x1b[38;5;222m',
  lavender: '\x1b[38;5;183m',
};

function log(icon, msg) { console.log(`   ${icon}  ${msg}`); }
function step(msg) { log(`${c.cyan}◯${c.reset}`, msg); }
function done(msg) { log(`${c.green}◉${c.reset}`, msg); }
function warn(msg) { log(`${c.yellow}◌${c.reset}`, msg); }
function info(msg) { console.log(`      ${c.dim}${msg}${c.reset}`); }

function run(cmd, opts = {}) {
  try {
    const stdio = opts.silent ? 'pipe' : 'inherit';
    const result = execSync(cmd, { encoding: 'utf8', stdio, cwd: path.join(__dirname, '..') });
    return typeof result === 'string' ? result.trim() : '';
  } catch (err) {
    if (opts.safe) return '';
    console.error(`\n   ${c.yellow}◌${c.reset}  command failed: ${c.dim}${cmd}${c.reset}`);
    if (err.stderr) console.error(`      ${c.dim}${err.stderr.toString().trim()}${c.reset}`);
    console.error('');
    process.exit(1);
  }
}

// ── Version bump ──
function bumpVersion(current, bump) {
  const [major, minor, patch] = current.split('.').map(Number);
  switch (bump) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    default:
      // Exact version string
      if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
      return null;
  }
}

// ── Preflight checks ──
function preflight() {
  // Git clean?
  const status = run('git status --porcelain', { silent: true, safe: true });
  if (status && !process.argv.includes('--allow-dirty')) {
    warn('working tree has uncommitted changes');
    info('commit them first, or use --allow-dirty');
    process.exit(1);
  }

  // On main branch?
  const branch = run('git branch --show-current', { silent: true, safe: true });
  if (branch && branch !== 'main' && branch !== 'master') {
    warn(`on branch ${c.reset}${c.bold}${branch}${c.reset}${c.dim} — expected main`);
    info('switch to main or use --allow-dirty');
    process.exit(1);
  }

  // gh CLI available?
  try {
    execSync('gh --version', { stdio: 'pipe' });
  } catch (_) {
    warn('GitHub CLI (gh) not found');
    info('install: brew install gh');
    process.exit(1);
  }

  // electron-builder available?
  const skipBuild = process.argv.includes('--skip-build');
  if (!skipBuild) {
    try {
      execSync('npx electron-builder --version', { stdio: 'pipe' });
    } catch (_) {
      warn('electron-builder not found');
      info('run: npm install');
      process.exit(1);
    }
  }
}

// ── Find build assets ──
function findAssets(version) {
  const distDir = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distDir)) return [];

  const files = fs.readdirSync(distDir);
  const assets = [];

  // Look for zip (mac), dmg (mac), exe (win)
  for (const f of files) {
    const lower = f.toLowerCase();
    if (lower.endsWith('.zip') || lower.endsWith('.dmg') || lower.endsWith('.exe')) {
      // Skip blockmap files and other noise
      if (lower.endsWith('.blockmap')) continue;
      assets.push(path.join(distDir, f));
    }
  }

  return assets;
}

// ── Main ──
async function main() {
  const bump = process.argv[2];
  const skipBuild = process.argv.includes('--skip-build');

  console.log('');
  console.log(`   ${c.cyan}◯${c.reset}  ${c.bold}Breathe${c.reset} ${c.dim}release${c.reset}`);
  console.log('');

  if (!bump) {
    info('usage: node scripts/release.js <patch|minor|major|x.y.z>');
    info('');
    info('flags:');
    info('  --skip-build     skip electron-builder, just tag + release');
    info('  --allow-dirty    allow uncommitted changes');
    console.log('');
    process.exit(0);
  }

  // Read current version
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const oldVersion = pkg.version;
  const newVersion = bumpVersion(oldVersion, bump);

  if (!newVersion) {
    warn(`invalid version bump: ${bump}`);
    info('use: patch, minor, major, or an exact version like 1.2.3');
    console.log('');
    process.exit(1);
  }

  step(`version ${c.dim}${oldVersion}${c.reset} → ${c.green}${newVersion}${c.reset}`);
  console.log('');

  // Preflight
  preflight();

  // 1. Bump version in package.json
  step('bumping version');
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  done(`package.json → ${c.dim}v${newVersion}${c.reset}`);

  // Also update package-lock.json if it exists
  const lockPath = path.join(__dirname, '..', 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    try {
      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      lock.version = newVersion;
      if (lock.packages && lock.packages['']) {
        lock.packages[''].version = newVersion;
      }
      fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
    } catch (_) {}
  }

  // 2. Git commit + tag
  console.log('');
  step('committing');
  run('git add -A', { silent: true });
  run(`git commit -m "release: v${newVersion}"`, { silent: true, safe: true });
  done(`committed`);

  step('tagging');
  run(`git tag v${newVersion}`, { silent: true });
  done(`tagged ${c.dim}v${newVersion}${c.reset}`);

  // 3. Push
  step('pushing to github');
  run('git push origin main --tags');
  done('pushed');

  // 4. Build
  if (!skipBuild) {
    console.log('');
    step('building app');
    info('this may take a few minutes...');
    console.log('');
    // Clean dist to avoid uploading stale assets
    const distDir = path.join(__dirname, '..', 'dist');
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }
    
    // Load .env and inject credentials into build environment
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=').trim();
          if (key && value) process.env[key.trim()] = value;
        }
      });
    }
    
    run('npx electron-builder --mac dmg zip');
    run('npx electron-builder --win portable --x64');
    console.log('');
    done('build complete');
  }

  // 5. Create GitHub Release + upload assets
  console.log('');
  step('creating github release');

  const assets = findAssets(newVersion);
  let assetFlags = '';
  if (assets.length > 0) {
    assetFlags = assets.map(a => `"${a}"`).join(' ');
    info(`${assets.length} asset(s) to upload`);
    for (const a of assets) {
      info(`  ${path.basename(a)}`);
    }
  } else if (!skipBuild) {
    warn('no build assets found in dist/');
    info('release will be created without binaries');
  }

  const releaseCmd = `gh release create v${newVersion} ${assetFlags} --title "v${newVersion}" --notes "Breathe v${newVersion}" --latest`;
  run(releaseCmd);
  done('github release created');

  // 6. Done
  console.log('');
  console.log(`   ${c.green}◉${c.reset}  ${c.bold}released v${newVersion}${c.reset}`);
  console.log('');
  info(`github  → ${c.lavender}https://github.com/${require('../package.json').repository.url.match(/github\.com\/(.+?)\.git/)?.[1] || 'heynaavi/breathe'}/releases/tag/v${newVersion}${c.reset}`);
  info(`npm     → ${c.dim}auto-publishes via github action${c.reset}`);
  console.log('');
}

main().catch((err) => {
  console.error('');
  warn(`release failed: ${err.message}`);
  console.error('');
  process.exit(1);
});
