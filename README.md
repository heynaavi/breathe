<p align="center">
  <img src="assets/icons/logo.png" width="80" />
</p>

<h1 align="center">Breathe</h1>

<p align="center">
  <sub>a 60-second sound bath for your mind</sub>
</p>

<p align="center">
  <a href="https://github.com/heynaavi/breathe/releases/latest"><img src="https://img.shields.io/github/v/release/heynaavi/breathe?style=flat-square&color=88b4a8" /></a>
  <a href="https://www.npmjs.com/package/breathe-a-min"><img src="https://img.shields.io/npm/v/breathe-a-min?style=flat-square&color=88b4a8" /></a>
  <img src="https://img.shields.io/badge/macOS%20·%20Windows-grey?style=flat-square" />
  <img src="https://img.shields.io/github/license/heynaavi/breathe?style=flat-square" />
</p>

<br>

Your screen fades to black. Ambient audio fills your headphones. For one minute, everything stops.

---

### Install

```bash
npm install -g breathe-a-min && breathe-a-min
```

Or grab the app → [macOS `.dmg`](https://github.com/heynaavi/breathe/releases/latest) · [Windows `.exe`](https://github.com/heynaavi/breathe/releases/latest)

---

### How it works

Click the menu bar icon. The rest happens on its own.

| | |
|:--|:--|
| 🌑 **Fade** | Screen goes dark. A gong rings. The world disappears. |
| 🎧 **Sound** | A random ambient track plays. Headphones recommended. |
| 🧘 **Breathe** | Close your eyes. One minute. That's it. |
| 🫧 **Return** | "Welcome back." Quick feedback. Fade out. |

Press `Esc` anytime to exit.

---

### Menu bar

Your stats and settings live in the tray popup.

| | |
|:--|:--|
| ◉ **Minutes** | Total time spent breathing |
| ◉ **Helped** | Times it actually slowed you down |
| 🔊 **Volume** | Adjust ambient audio level |
| ⌨️ **Shortcut** | Custom global hotkey — click to remap |

Default shortcut: `⌘ Shift B` (mac) · `Ctrl Shift B` (win)

---

### First launch

A cinematic onboarding plays once — logo blooms in, a gong sounds, and the app settles into your menu bar with a gentle "I live here, come take a breath."

---

### Platforms

| | Platform | File |
|---|----------|------|
| 🍎 | macOS (Apple Silicon) | `.dmg` |
| 🪟 | Windows (x64) | `.exe` (portable) |

---

### Build from source

```bash
git clone https://github.com/heynaavi/breathe.git
cd breathe && npm install && npm start
```

Package: `npm run build` (macOS) · `npm run build:win` (Windows) · `npm run build:all` (both)

Release: `npm run release patch` — bumps version, builds, pushes to GitHub + npm in one command.

---

### Project structure

```
breathe/
├── main.js              # Electron main process
├── src/
│   ├── experience.html  # Fullscreen overlay
│   ├── experience.js    # Session logic + animations
│   ├── preload.js       # Context bridge
│   ├── tray-popup.html  # Menu bar popup + settings
│   └── onboarding.html  # First-launch cinematic
├── assets/
│   ├── audio/           # Ambient tracks (~1 min each)
│   ├── gong.mp3         # Onboarding gong
│   └── icons/           # App + tray icons
├── scripts/
│   ├── release.js       # One-command release
│   ├── postinstall.js   # npm postinstall wrapper
│   └── install-binary.js
└── bin/
    └── breathe.js       # CLI launcher
```

---

<p align="center">
  <sub>MIT · made with stillness 🫧</sub>
</p>
