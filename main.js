const { app, BrowserWindow, ipcMain, screen, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// ── Single instance ──
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

let tray = null;
let experienceWindow = null;
let trayPopup = null;
let onboardingWindow = null;

const SUPABASE_URL = 'https://uusdrkboviwobxxgzrkl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1c2Rya2Jvdml3b2J4eGd6cmtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTExNzksImV4cCI6MjA5Mjg2NzE3OX0.dx4ZeiQ1sTWq1vmRuddiVp0y9laeIDJLHCoSiOeiXg8';

// ── Local stats ──
function getStatsPath() { return path.join(app.getPath('userData'), 'stats.json'); }

function loadStats() {
  try {
    if (fs.existsSync(getStatsPath()))
      return JSON.parse(fs.readFileSync(getStatsPath(), 'utf8'));
  } catch (_) {}
  return { totalSessions: 0, totalSeconds: 0, helpedCount: 0 };
}

function saveStats(stats) {
  try {
    fs.mkdirSync(path.dirname(getStatsPath()), { recursive: true });
    fs.writeFileSync(getStatsPath(), JSON.stringify(stats, null, 2));
  } catch (_) {}
}

// ── Device ID ──
function getDeviceId() {
  const idPath = path.join(app.getPath('userData'), 'device-id.txt');
  try {
    if (fs.existsSync(idPath)) return fs.readFileSync(idPath, 'utf8').trim();
  } catch (_) {}
  const { randomUUID } = require('crypto');
  const id = randomUUID();
  try {
    fs.mkdirSync(path.dirname(idPath), { recursive: true });
    fs.writeFileSync(idPath, id);
  } catch (_) {}
  return id;
}

// ── Geolocation (cached per launch) ──
let geoCache = null;
async function getGeo() {
  if (geoCache) return geoCache;
  try {
    // Try ip-api.com first (no key needed, 45 req/min)
    const res = await fetch('http://ip-api.com/json/?fields=countryCode,region');
    if (res.ok) {
      const data = await res.json();
      geoCache = { country: data.countryCode || null, region: data.region || null };
      return geoCache;
    }
  } catch (_) {}
  try {
    // Fallback to ipapi.co
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      geoCache = { country: data.country_code || null, region: data.region_code || null };
      return geoCache;
    }
  } catch (_) {}
  geoCache = { country: null, region: null };
  return geoCache;
}

// ── Tray ──
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icons', 'trray-icon.png');
  let icon;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
    icon.setTemplateImage(true);
  } else {
    const canvas = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAMlJREFUWEft1rENwjAQBdD/DZCSA0awBBNQsAIjsAQlOUBKNkBiAhZgBJagYAVGYAkKcoBIkSxZsnN3cWHJ9v/3/ewYGPl4I+fHfwHsAJwBnABcADz6AnYVcABwA3Cv5l8APgG8+wJqAFMAMwDzKv8N4APAqy+gBjABMAWwqPJfAN4AvPoC/gDGAKYAFlX+C8AbgFdfwB/AGMAEwLLKfwF4B/DqC6gBjAFMAKyq/BeANwCvvoAawAjAGMCmyn8BeAPw6gv4AUGiSCHGOWatAAAAAElFTkSuQmCC`;
    icon = nativeImage.createFromDataURL(canvas);
    icon.setTemplateImage(true);
  }
  tray = new Tray(icon);
  tray.setToolTip('Breathe — Take a moment');
  tray.on('click', () => toggleTrayPopup());
  tray.on('right-click', () => toggleTrayPopup());
}

// ── Tray Popup ──
function toggleTrayPopup() {
  if (trayPopup) { trayPopup.close(); trayPopup = null; return; }
  if (experienceWindow) return;

  const trayBounds = tray.getBounds();
  const popupWidth = 250;
  const popupHeight = 230;
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - popupWidth / 2);
  let y = process.platform === 'darwin'
    ? trayBounds.y + trayBounds.height + 4
    : trayBounds.y - popupHeight - 4;

  trayPopup = new BrowserWindow({
    x, y, width: popupWidth, height: popupHeight,
    frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false,
    roundedCorners: false, hasShadow: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });

  trayPopup.loadFile('src/tray-popup.html');
  trayPopup.once('ready-to-show', () => {
    trayPopup.show();
    const stats = loadStats();
    trayPopup.webContents.send('init-stats', stats);
  });
  trayPopup.on('blur', () => { if (trayPopup) { trayPopup.close(); trayPopup = null; } });
  trayPopup.on('closed', () => { trayPopup = null; });
}

// ── Experience Window (overlay) ──
function startExperience() {
  if (experienceWindow) return;
  if (trayPopup) { trayPopup.close(); trayPopup = null; }

  const { bounds } = screen.getPrimaryDisplay();
  experienceWindow = new BrowserWindow({
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    frame: false, transparent: true, hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, resizable: false,
    movable: false, show: false, roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      backgroundThrottling: false,
    },
  });
  if (process.platform === 'darwin') {
    experienceWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    experienceWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  experienceWindow.loadFile('src/experience.html');
  experienceWindow.once('ready-to-show', () => { experienceWindow.show(); experienceWindow.focus(); });
  experienceWindow.on('closed', () => { experienceWindow = null; });
}

// ── IPC ──
ipcMain.on('end-experience', () => {
  if (experienceWindow) { experienceWindow.close(); experienceWindow = null; }
});

ipcMain.on('start-experience', () => { startExperience(); });

ipcMain.on('quit-app', () => { app.quit(); });

ipcMain.on('send-feedback', async (_, data) => {
  const { helped, audioFile, durationSeconds } = data;
  const deviceId = getDeviceId();
  const geo = await getGeo();

  // Update local stats
  const stats = loadStats();
  stats.totalSessions++;
  stats.totalSeconds += (durationSeconds || 60);
  if (helped) stats.helpedCount++;
  saveStats(stats);

  // Send to Supabase
  fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      device_id: deviceId,
      helped,
      audio_file: audioFile || null,
      duration_seconds: durationSeconds || null,
      country_code: geo.country,
      region_code: geo.region,
    }),
  }).then(res => {
    if (!res.ok) console.error('[Supabase] Insert failed:', res.status);
  }).catch(err => console.error('[Supabase] Network error:', err.message));
});

ipcMain.handle('get-stats', () => loadStats());

ipcMain.handle('get-tray-bounds', () => {
  if (tray) return tray.getBounds();
  return { x: 0, y: 0, width: 0, height: 0 };
});

ipcMain.on('end-onboarding', () => {
  if (onboardingWindow) { onboardingWindow.close(); onboardingWindow = null; }
});

function isFirstLaunch() {
  return !fs.existsSync(getStatsPath());
}

function showOnboarding() {
  const { bounds } = screen.getPrimaryDisplay();
  onboardingWindow = new BrowserWindow({
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    frame: false, transparent: true, hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, resizable: false,
    movable: false, show: false, roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      backgroundThrottling: false,
    },
  });
  if (process.platform === 'darwin') {
    onboardingWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    onboardingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  onboardingWindow.loadFile('src/onboarding.html');
  onboardingWindow.once('ready-to-show', () => { onboardingWindow.show(); onboardingWindow.focus(); });
  onboardingWindow.on('closed', () => {
    onboardingWindow = null;
    // Mark as launched by saving initial stats
    saveStats({ totalSessions: 0, totalSeconds: 0, helpedCount: 0 });
  });
}

ipcMain.handle('get-sound-files', () => {
  let soundsDir;
  if (app.isPackaged) {
    soundsDir = path.join(process.resourcesPath, 'assets', 'audio');
  } else {
    soundsDir = path.join(__dirname, 'assets', 'audio');
  }
  try {
    const files = fs.readdirSync(soundsDir).filter(f =>
      f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg') || f.endsWith('.m4a')
    );
    return files.map(f => path.join(soundsDir, f));
  } catch (_) { return []; }
});

// ── App Ready ──
app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  createTray();
  getGeo();

  if (isFirstLaunch()) {
    showOnboarding();
  }
});

app.on('window-all-closed', (e) => e.preventDefault());
