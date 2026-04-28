<p align="center">
  <img src="assets/icons/logo.png" width="120" alt="Breathe" />
</p>

<h3 align="center">Breathe</h3>

<p align="center">
  A 60-second sound bath for your mind.<br/>
  <sub>Lives in your menu bar. Takes over your screen. Gives you one minute of calm.</sub>
</p>

<p align="center">
  <a href="https://github.com/heynaavi/breathe/releases/latest">Download</a> ·
  <a href="https://www.npmjs.com/package/breathe-a-min">npm</a> ·
  <a href="#how-it-works">How it works</a>
</p>

---

### Install

```bash
npm install -g breathe-a-min
```

Or [download the latest release](https://github.com/heynaavi/breathe/releases/latest) directly.

---

### How it works

Click the menu bar icon. Your screen fades to black.

</text>
</invoke>
1. *"Stop your thoughts for 60 seconds"*
2. Click **Begin**
3. *"For a better experience, use headphones"*
4. *"Take a deep breath"*
5. *"Close your eyes"*
6. Ambient audio plays — a random track each time
7. Timer counts down
8. *"Welcome back"* — quick feedback — *"See you soon"*

The whole experience is a fullscreen overlay. No windows, no switching spaces. It appears on top of everything and fades away when it's over.

Press `Esc` anytime to exit.

---

### Menu bar

<sub>Your personal stats live in the tray popup.</sub>

- Minutes of calm
- Times it helped
- Start a session

---

### Platforms

| | Platform | File |
|---|----------|------|
| 🍎 | macOS (Apple Silicon) | `.dmg` |
| 🪟 | Windows | `.exe` (portable) |

---

### Development

```bash
git clone https://github.com/heynaavi/breathe.git
cd breathe
npm install
npm start
```

### Build

```bash
npm run build          # macOS
npm run build:win      # Windows
npm run build:all      # Both
```

### Release

```bash
npm run release patch  # 1.0.1 → 1.0.2
npm run release minor  # 1.0.1 → 1.1.0
```

Bumps version, commits, tags, builds, creates GitHub Release, and npm auto-publishes via CI.

---

### Project structure

```
breathe/
├── main.js              # Electron main process
├── src/
│   ├── experience.html  # Fullscreen overlay
│   ├── experience.js    # Session logic + animations
│   ├── preload.js       # Context bridge
│   ├── tray-popup.html  # Menu bar popup
│   └── onboarding.html  # First-launch experience
├── assets/
│   ├── audio/           # Ambient tracks (~1 min each)
│   └── icons/           # App + tray icons
├── scripts/
│   ├── release.js       # One-command release
│   ├── postinstall.js   # npm postinstall wrapper
│   └── install-binary.js # Binary downloader
└── bin/
    └── breathe.js       # CLI launcher
```

---

<p align="center">
  <sub>Made by <a href="https://github.com/heynaavi">Naveen</a></sub>
</p>
