# Desktop App Blueprint

How we build menu-bar Electron apps — from scaffold to ship.
Extracted from the Whip Me Bad project. Use this as a skill/boilerplate for any new desktop tool.

---

## Architecture

```
my-app/
├── main.js                  # Electron main process — app lifecycle, tray, IPC, windows
├── src/
│   ├── preload.js           # Context bridge — exposes safe IPC to renderer
│   ├── overlay.html         # Transparent fullscreen window (if needed)
│   ├── tray-popup.html      # Tray popup UI (nodeIntegration: true, no preload)
│   ├── onboarding.html      # First-launch experience (uses preload)
│   └── analytics.js         # Silent telemetry module (optional)
├── assets/
│   ├── icons/
│   │   ├── logo.png         # App icon (1024x1024 source)
│   │   ├── logo.icns        # macOS icon
│   │   ├── logo.ico         # Windows icon
│   │   ├── logo-256.png     # Windows builder needs this
│   │   └── Tray-icon.png    # Menu bar icon (22x22 @2x, template image)
│   └── sounds/              # Audio assets if needed
├── bin/
│   └── my-app.js            # CLI entry for `npx my-app` usage
├── build/
│   └── entitlements.mac.plist
├── package.json
├── .gitignore
└── .github/
    └── workflows/
        └── publish.yml      # Auto-publish to npm on GitHub Release
```

---

## 1. Project Init

```bash
mkdir my-app && cd my-app
npm init -y
npm install --save-dev electron electron-builder
```

---

## 2. package.json — The Full Config

This is the single source of truth for app metadata, build config, and scripts.

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "description": "Short description",
  "author": "Name <email>",
  "license": "MIT",
  "repository": { "type": "git", "url": "https://github.com/user/my-app.git" },
  "homepage": "https://github.com/user/my-app",
  "keywords": ["electron", "desktop", "menu-bar"],
  "publishConfig": { "registry": "https://registry.npmjs.org/" },
  "main": "main.js",
  "bin": { "my-app": "bin/my-app.js" },
  "scripts": {
    "start": "electron .",
    "dev": "electron .",
    "build": "electron-builder --mac",
    "build:dmg": "electron-builder --mac dmg",
    "build:zip": "electron-builder --mac zip",
    "build:win": "electron-builder --win",
    "build:all": "electron-builder --mac --win"
  },
  "build": {
    "appId": "com.yourname.my-app",
    "productName": "My App",
    "mac": {
      "category": "public.app-category.developer-tools",
      "icon": "assets/icons/logo.png",
      "target": ["dmg", "zip"],
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist",
      "extendInfo": { "LSUIElement": true }
    },
    "dmg": {
      "title": "My App",
      "backgroundColor": "#0a0608",
      "contents": [
        { "x": 130, "y": 220 },
        { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
      ]
    },
    "win": {
      "target": ["nsis", "portable"],
      "icon": "assets/icons/logo-256.png"
    },
    "nsis": {
      "oneClick": false,
      "perMachine": true,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "My App"
    },
    "files": ["main.js", "src/**/*", "assets/**/*"],
    "extraResources": []
  },
  "dependencies": {},
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.1.8"
  }
}
```

Key points:
- `LSUIElement: true` — hides from Dock on macOS (menu-bar-only app)
- `hardenedRuntime: true` — required for macOS notarization
- `bin` field — enables `npx my-app` after npm install
- `files` array — controls what goes into the built app

---

## 3. main.js — Core Patterns

### App Lifecycle

```js
const { app, BrowserWindow, ipcMain, screen, Tray, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ── Settings persistence ──
let SETTINGS_PATH = '';
const defaults = { paused: false, volume: 0.85 };
let settings = { ...defaults };

function initSettings() {
  SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
  try {
    if (fs.existsSync(SETTINGS_PATH))
      Object.assign(settings, JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')));
  } catch (_) {}
}

function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  } catch (_) {}
}

function isFirstLaunch() { return !fs.existsSync(SETTINGS_PATH); }
```

### Single Instance Lock

```js
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
app.on('second-instance', () => { if (tray) tray.popUpContextMenu(); });
```

### Tray Icon

```js
let tray = null;

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icons', 'Tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(false);
  tray = new Tray(icon);
  tray.setToolTip('My App');
  tray.on('click', () => showTrayPopup());
}
```

### Tray Popup Window

```js
let trayPopup = null;

function showTrayPopup() {
  if (trayPopup) { trayPopup.close(); trayPopup = null; return; }

  const trayBounds = tray.getBounds();
  const popupWidth = 280, popupHeight = 360;
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - popupWidth / 2);
  let y = process.platform === 'darwin'
    ? trayBounds.y + trayBounds.height + 4
    : trayBounds.y - popupHeight - 4;

  trayPopup = new BrowserWindow({
    x, y, width: popupWidth, height: popupHeight,
    frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });

  trayPopup.loadFile('src/tray-popup.html');
  trayPopup.once('ready-to-show', () => {
    trayPopup.show();
    trayPopup.webContents.send('init-settings', settings);
  });
  trayPopup.on('blur', () => { if (trayPopup) { trayPopup.close(); trayPopup = null; } });
  trayPopup.on('closed', () => { trayPopup = null; });
}
```

### Transparent Overlay Window (optional)

```js
function createOverlay() {
  const { bounds } = screen.getPrimaryDisplay();
  const winOptions = {
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    transparent: true, frame: false, alwaysOnTop: true,
    focusable: false, skipTaskbar: true, resizable: false,
    hasShadow: false, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      backgroundThrottling: false,
    },
  };
  if (process.platform === 'darwin') winOptions.type = 'panel';

  const overlay = new BrowserWindow(winOptions);
  if (process.platform === 'darwin') overlay.setAlwaysOnTop(true, 'screen-saver', 1);
  else overlay.setAlwaysOnTop(true);
  overlay.setIgnoreMouseEvents(true);
  overlay.loadFile('src/overlay.html');
}
```

### App Ready

```js
app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  initSettings();
  createTray();

  if (isFirstLaunch()) {
    if (process.platform === 'darwin') app.dock.show();
    showOnboarding();
  } else {
    startApp();
  }
});

app.on('window-all-closed', (e) => e.preventDefault());
```

---

## 4. Preload — Context Bridge

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  onSomeEvent: (fn) => ipcRenderer.on('some-event', (_, data) => fn(data)),
  sendAction: (data) => ipcRenderer.send('action', data),
  invokeAsync: () => ipcRenderer.invoke('get-something'),
});
```

Rules:
- Overlay and onboarding windows use preload (contextIsolation: true)
- Tray popup uses nodeIntegration: true (simpler, it's a trusted local UI)

---

## 5. Tray Popup HTML Pattern

```html
<script>
const { ipcRenderer } = require('electron');

ipcRenderer.on('init-settings', (_, settings) => {
  // Populate UI from settings
});

// Send actions back to main
function togglePause() { ipcRenderer.send('toggle-pause'); }
function quit() { ipcRenderer.send('quit-app'); }
</script>
```

Design system approach:
- CSS variables for theming (dark default + `@media (prefers-color-scheme: light)`)
- Inter or DM Sans from Google Fonts
- Compact layout: 280px wide, groups with rounded cards
- Icon buttons for actions, sliders for values, pills for status

---

## 6. bin/ CLI Entry

```js
#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const electronPath = (() => {
  try { return require('electron'); } catch (_) {
    console.error('Electron not found. Install it: npm install -g electron');
    process.exit(1);
  }
})();

const child = spawn(electronPath, [path.join(__dirname, '..')], {
  stdio: 'inherit', detached: true,
});
child.unref();
```

This enables: `npx my-app` or `npm install -g my-app && my-app`

---

## 7. macOS Entitlements

`build/entitlements.mac.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key><true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key><true/>
    <key>com.apple.security.automation.apple-events</key><true/>
</dict>
</plist>
```

---

## 8. Silent Analytics (Optional)

Pattern: queue events locally, batch-flush to Supabase via edge function.

```js
const queue = [];
const FLUSH_INTERVAL = 10000;

function track(eventType, meta) {
  queue.push({ device_id: deviceId, session_id: sessionId, trigger_type: eventType, ... });
}

async function flush() {
  if (!queue.length) return;
  const batch = queue.splice(0, 50);
  try {
    await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
      body: JSON.stringify(batch),
    });
  } catch (_) { queue.unshift(...batch); }
}

setInterval(flush, FLUSH_INTERVAL);
```

Edge function handles server-side enrichment (region from IP, etc.) so the client stays thin.

Device ID: generate a UUID once, persist to `app.getPath('userData')/device-id.txt`.
Session ID: new UUID per app launch.

---

## 9. Build & Ship

### Build locally

```bash
npm run build:dmg    # macOS DMG
npm run build:win    # Windows NSIS installer + portable EXE
npm run build:all    # Both
```

Outputs land in `dist/`.

### Publish to npm

```bash
npm login
npm publish
```

### GitHub Actions — Auto-publish on Release

`.github/workflows/publish.yml`:
```yaml
name: Publish Package
on:
  release:
    types: [published]

jobs:
  publish-npm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Release flow

With the release script (see Section 15):
```bash
npm run release patch    # does everything below in one command
```

Manual flow (if needed):
1. Bump version in `package.json`
2. `git commit -m "release: vX.Y.Z — description"`
3. `git tag vX.Y.Z`
4. `git push origin main --tags`
5. `npm run build:all`
6. Create GitHub Release → attach DMG + EXE → publish
7. GitHub Action auto-publishes to npm

---

## 10. .gitignore

```
node_modules/
dist/
build/icon.icns
build/icon.ico
*.dmg
*.exe
*.AppImage
*.mov
.DS_Store
```

---

## 11. IPC Patterns Summary

| Direction | Method | Use |
|-----------|--------|-----|
| Main → Renderer | `win.webContents.send(channel, data)` | Push state/events to UI |
| Renderer → Main (fire & forget) | `ipcRenderer.send(channel, data)` | Button clicks, toggles |
| Renderer → Main (async response) | `ipcRenderer.invoke(channel)` / `ipcMain.handle` | Get data back |
| Renderer listens | `ipcRenderer.on(channel, callback)` | React to main process events |

---

## 12. Window Types We Use

| Window | frame | transparent | nodeIntegration | contextIsolation | preload | Purpose |
|--------|-------|-------------|-----------------|------------------|---------|---------|
| Tray popup | false | true | true | false | none | Settings/controls |
| Overlay | false | true | false | true | yes | Fullscreen visual effects |
| Onboarding | false | true | false | true | yes | First-launch experience |
| Insights/modal | false | false | false | true | yes | Data display |

---

## 13. Platform Differences

| Concern | macOS | Windows |
|---------|-------|---------|
| Hide from Dock | `app.dock.hide()` + `LSUIElement: true` | N/A (skipTaskbar) |
| Tray popup position | Below tray icon | Above tray icon |
| Overlay always-on-top | `setAlwaysOnTop(true, 'screen-saver', 1)` | `setAlwaysOnTop(true)` |
| Overlay window type | `type: 'panel'` | default |
| App icon | `.icns` | `.ico` / `.png 256x256` |
| Installer | DMG | NSIS |

---

## Quick Start Checklist

- [ ] `npm init` + install electron + electron-builder
- [ ] Create `main.js` with tray + single instance lock + settings persistence
- [ ] Create `src/preload.js` with context bridge
- [ ] Create `src/tray-popup.html` with settings UI
- [ ] Create tray icon asset (22x22 @2x PNG)
- [ ] Create app icons (logo.png, logo.icns, logo.ico, logo-256.png)
- [ ] Add `build/entitlements.mac.plist`
- [ ] Add `bin/my-app.js` for npx support
- [ ] Add `.github/workflows/publish.yml`
- [ ] Test: `npm start`
- [ ] Build: `npm run build:all`
- [ ] Ship: tag → push → GitHub Release → npm publish

---

## 14. npm Packaging — Ship Without Electron

The biggest lesson from Whip Me Bad: **don't make users install Electron via npm**. It's ~200MB, takes forever, and often fails. Instead, ship a tiny npm package that downloads the prebuilt binary at install time. This is the same pattern Playwright, Puppeteer, and the `electron` npm package itself use.

### The Flow

```
npm install -g my-app
```

1. npm downloads your package (tiny — just JS, no electron)
2. npm runs your `postinstall` script automatically
3. Postinstall detects the OS (`process.platform`)
4. Downloads the right prebuilt binary from GitHub Releases (.zip for mac, .exe for windows)
5. Extracts it to `~/.my-app/`
6. `bin/my-app.js` just launches that installed binary

### File Structure

```
package.json          → "postinstall": "node scripts/postinstall.js"
scripts/
  postinstall.js      → thin wrapper that spawns install-binary.js
  install-binary.js   → detects OS, downloads from GitHub Releases, extracts
bin/
  my-app.js           → launches ~/.my-app/My App.app (mac) or My App.exe (win)
```

### package.json Changes

```json
{
  "main": "main.js",
  "bin": { "my-app": "bin/my-app.js" },
  "files": ["bin/", "scripts/", "README.md"],
  "scripts": {
    "postinstall": "node scripts/postinstall.js",
    "start": "electron .",
    "build:all": "electron-builder --mac --win"
  }
}
```

Key points:
- `files` whitelist keeps the npm tarball tiny (ours is 6.4KB)
- `main` field is still needed for electron-builder, but npm auto-includes it — strip it in CI before `npm publish` (see workflow below)
- `electron` stays in `devDependencies` only — users never download it

### Critical Lesson: npm Hides Postinstall Output

npm v7+ **silences all lifecycle script output** (both stdout AND stderr). Your beautiful progress bar? Users see nothing.

**The fix: write to `/dev/tty` directly.** This bypasses npm's pipe entirely.

```js
const fs = require('fs');

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
```

Falls back to stderr if `/dev/tty` isn't available (CI environments, piped output).

### Progress Bar Tips

- Use `\x1b[2K\r` before each update to clear the full line — prevents jitter from npm's own spinner
- Update every 10% not every 5% — less flicker
- Write a clean 100% bar on completion before the newline

```js
ttyWrite(`\x1b[2K\r  Downloading... ${progressBar(downloaded / size)}`);
```

### macOS: Use ZIP Not DMG

`hdiutil` (DMG mounting) fails inside npm's postinstall process environment. Use `.zip` instead:

```js
// Build with: electron-builder --mac zip
// Extract with:
execSync(`unzip -o -q "${zipPath}" -d "${INSTALL_DIR}"`);
```

Also strip the quarantine attribute so Gatekeeper doesn't block it:
```js
execSync(`xattr -rd com.apple.quarantine "${appPath}" 2>/dev/null`);
```

`ditto -xk` also fails on electron-builder zips (strict about symlinks). Plain `unzip` works.

### Windows: Use Portable EXE

```js
// Build with: electron-builder --win portable
// Just copy the exe:
fs.copyFileSync(downloadedExe, path.join(INSTALL_DIR, 'My App.exe'));
```

### Version Caching

Write a `.version` file after install. Skip download if already at the right version:

```js
const versionFile = path.join(INSTALL_DIR, '.version');
if (fs.existsSync(versionFile)) {
  const installed = fs.readFileSync(versionFile, 'utf8').trim();
  if (installed === VERSION && fs.existsSync(binaryPath)) {
    // Already installed — skip
    return;
  }
}
// ... after successful install:
fs.writeFileSync(versionFile, VERSION);
```

### Download Function: Flush Before Extract

The write stream must be fully flushed before you try to unzip. Use the callback form:

```js
res.on('end', () => {
  file.end(() => {    // ← wait for flush!
    resolve();
  });
});
```

Without this, `unzip` sees a truncated file and fails with "End-of-central-directory signature not found".

### bin/my-app.js — The Launcher

```js
#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const INSTALL_DIR = path.join(os.homedir(), '.my-app');

if (process.platform === 'darwin') {
  spawn('open', ['-a', path.join(INSTALL_DIR, 'My App.app')], { stdio: 'ignore', detached: true }).unref();
} else {
  spawn(path.join(INSTALL_DIR, 'My App.exe'), [], { stdio: 'ignore', detached: true }).unref();
}
```

### CI Workflow: Publish Without OTP Issues

```yaml
name: Publish Package
on:
  release:
    types: [published]

jobs:
  publish-npm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - run: |
          node -e "
            const pkg = require('./package.json');
            delete pkg.main;
            require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2));
          "
          npm publish --ignore-scripts
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Key points:
- `--ignore-scripts` prevents postinstall from running on the CI runner (it's Linux, no mac/win binary to download)
- Strip `main` field before publish so `main.js` doesn't get included in the tarball
- Use Node 22+ to avoid deprecation warnings
- npm token must be a **Granular Access Token** (not classic) to bypass 2FA/OTP in CI

### Graceful Failure

Never let the postinstall crash `npm install`. Always catch errors and exit 0:

```js
main().catch(() => process.exit(0));
```

If download fails, show a manual download link and move on. The package still installs — the user just needs to grab the binary themselves.

### GitHub Release Asset Naming

GitHub converts spaces to dots in release asset names. Match your postinstall asset names to what GitHub actually serves:

```
Local build:  "Whip Me Bad-1.2.1-arm64-mac.zip"
GitHub asset: "Whip.Me.Bad-1.2.1-arm64-mac.zip"  ← use this in your script
```

---

## 15. One-Command Release Script

The manual release flow (bump → commit → tag → push → build → create release → upload assets) is tedious and error-prone. Automate it with a single `scripts/release.js`.

### Usage

```bash
npm run release patch     # 1.0.0 → 1.0.1
npm run release minor     # 1.0.0 → 1.1.0
npm run release major     # 1.0.0 → 2.0.0
npm run release 2.0.0     # exact version
```

Add to package.json:
```json
{
  "scripts": {
    "release": "node scripts/release.js"
  }
}
```

### What it does (in order)

1. Preflight checks (dirty tree, wrong branch, missing tools)
2. Bumps version in `package.json` AND `package-lock.json`
3. `git add -A && git commit && git tag vX.Y.Z`
4. `git push origin main --tags`
5. Cleans `dist/` then builds mac + windows
6. Creates GitHub Release via `gh` CLI + uploads assets
7. npm publish happens automatically via GitHub Action

### Preflight Checks

Always validate before doing anything destructive:

```js
function preflight() {
  // Dirty tree?
  const status = run('git status --porcelain', { silent: true });
  if (status && !allowDirty) exit('commit first or use --allow-dirty');

  // Wrong branch?
  const branch = run('git branch --show-current', { silent: true });
  if (branch !== 'main' && branch !== 'master') exit('switch to main');

  // gh CLI installed?
  try { execSync('gh --version', { stdio: 'pipe' }); }
  catch (_) { exit('install gh: brew install gh'); }
}
```

### Clean dist Before Build

Critical: always wipe `dist/` before building. Otherwise stale assets from previous versions get uploaded to the new release.

```js
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
```

### Cross-Compile Windows from macOS

electron-builder can build Windows `.exe` from macOS — no Wine needed. It downloads the pre-built Windows Electron binary and packages your app into it. No actual compilation happens.

**Important:** Run mac and win builds as separate commands. Combining `--mac --win --x64` applies `--x64` to both platforms, which may not be what you want (e.g., you want arm64 for mac but x64 for win).

```js
// Build mac native arch (arm64 on Apple Silicon)
run('npx electron-builder --mac dmg zip');
// Build win x64 (most Windows users)
run('npx electron-builder --win portable --x64');
```

What you CAN'T do from macOS: Windows code signing (needs signtool.exe + certificate). The build will warn "signing is skipped" — that's fine for distribution outside enterprise environments.

### Bump package-lock.json Too

If you only bump `package.json`, npm will complain about version mismatch. Update both:

```js
const lockPath = path.join(__dirname, '..', 'package-lock.json');
if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  lock.version = newVersion;
  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = newVersion;
  }
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
}
```

### GitHub Release via `gh` CLI

Requires: `brew install gh && gh auth login`

```js
// Find assets in dist/
const assets = fs.readdirSync('dist')
  .filter(f => f.endsWith('.zip') || f.endsWith('.dmg') || f.endsWith('.exe'))
  .map(f => `"dist/${f}"`).join(' ');

// Create release + upload in one command
run(`gh release create v${version} ${assets} --title "v${version}" --notes "Release notes" --latest`);
```

If upload fails (network issues), you can retry without recreating:
```bash
gh release upload v1.0.0 dist/MyApp.dmg --clobber
gh release edit v1.0.0 --draft=false --latest
```

### execSync Gotcha

`execSync` with `stdio: 'inherit'` returns `null`, not a string. Guard against it:

```js
function run(cmd, opts = {}) {
  const stdio = opts.silent ? 'pipe' : 'inherit';
  const result = execSync(cmd, { encoding: 'utf8', stdio });
  return typeof result === 'string' ? result.trim() : '';
}
```

### Flags

Support `--skip-build` (just tag + release, useful when you've already built) and `--allow-dirty` (for when you have uncommitted changes that are part of the release).

---

## 16. DMG Build Flakiness on Apple Silicon

`hdiutil resize` sometimes fails with "Resource temporarily unavailable" (exit code 35) on ARM Macs. electron-builder retries automatically but can still fail after all attempts.

Workarounds:
- Retry the build — it usually works on the second attempt
- Build DMG and ZIP separately: `electron-builder --mac zip` first (always works), then `electron-builder --mac dmg`
- The ZIP is the important one anyway — it's what the npm postinstall downloads

---

## 17. npm Package Name Conflicts

npm package names are globally unique. Check availability before you commit to a name:

```bash
npm view my-app-name 2>&1  # 404 = available
```

If taken, options:
- Scoped: `@yourname/my-app` (always available)
- Suffixed: `my-app-desktop`, `my-app-cli`
- Creative: pick something unique

---

## 18. Supabase Analytics — Lessons

### RLS Policies

If using Supabase with the `anon` key (no auth), you need explicit RLS policies for both INSERT and SELECT:

```sql
-- Allow the app to record sessions
CREATE POLICY "Allow anonymous inserts"
  ON public.sessions FOR INSERT TO anon WITH CHECK (true);

-- Allow the admin dashboard to read data
CREATE POLICY "Allow anonymous reads"
  ON public.sessions FOR SELECT TO anon USING (true);
```

Without the SELECT policy, the REST API returns empty arrays even when data exists. The MCP/service role bypasses RLS, so you won't notice the problem during development.

### Silent Error Swallowing

Never do this:
```js
fetch(url, { ... }).catch(() => {});
```

Always log failures, even for fire-and-forget analytics:
```js
fetch(url, { ... })
  .then(res => { if (!res.ok) console.error('[Supabase] Insert failed:', res.status); })
  .catch(err => console.error('[Supabase] Network error:', err.message));
```

### IP Geolocation

For country/region without storing IP addresses:
- Primary: `ip-api.com` (free, no key, 45 req/min) — returns `countryCode`, `region`
- Fallback: `ipapi.co` (free tier, rate-limited) — returns `country_code`, `region_code`
- Cache per app launch (geo doesn't change mid-session)
- Never store the IP address itself — just the derived country/region codes

```js
let geoCache = null;
async function getGeo() {
  if (geoCache) return geoCache;
  try {
    const res = await fetch('http://ip-api.com/json/?fields=countryCode,region');
    if (res.ok) {
      const data = await res.json();
      geoCache = { country: data.countryCode, region: data.region };
      return geoCache;
    }
  } catch (_) {}
  geoCache = { country: null, region: null };
  return geoCache;
}
```

---

## 19. CI Workflow — Improved

Strip both `main` and `devDependencies` before publishing. This keeps the npm tarball minimal and prevents electron from being listed as a dependency.

```yaml
name: Publish to npm
on:
  release:
    types: [published]

jobs:
  publish-npm:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - name: Strip main field and publish
        run: |
          node -e "
            const pkg = require('./package.json');
            delete pkg.main;
            delete pkg.devDependencies;
            require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2));
          "
          npm publish --ignore-scripts
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### NPM_TOKEN Setup

1. npmjs.com → Access Tokens → Generate New Token → **Granular Access Token** (bypasses 2FA in CI)
2. GitHub repo → Settings → Secrets → Actions → New: `NPM_TOKEN`

---

## Updated Quick Start Checklist

- [ ] `npm init` + install electron + electron-builder
- [ ] Create `main.js` with tray + single instance lock + settings persistence
- [ ] Create `src/preload.js` with context bridge
- [ ] Create `src/tray-popup.html` with settings UI
- [ ] Create tray icon asset (22x22 @2x PNG)
- [ ] Create app icons (logo.png, logo.icns, logo.ico, logo-256.png)
- [ ] Add `build/entitlements.mac.plist`
- [ ] Add `bin/my-app.js` for npx support
- [ ] Add `scripts/postinstall.js` + `scripts/install-binary.js`
- [ ] Add `scripts/release.js` for one-command releases
- [ ] Add `.github/workflows/publish.yml`
- [ ] Check npm name availability: `npm view my-app-name`
- [ ] Set up `NPM_TOKEN` secret in GitHub repo
- [ ] Test: `npm start`
- [ ] Build: `npm run build:all`
- [ ] Ship: `npm run release patch`
