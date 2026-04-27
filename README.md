# Breathe

A 60-second ambient sound bath for your mind. Lives in your menu bar, takes over your screen, and gives you one minute of calm.

Inspired by [Still](https://stillapp.net/).

---

## What it does

Click the tray icon → screen fades to black → guided text sequence → ambient audio plays → you close your eyes for a minute → done.

The whole experience is a fullscreen overlay. No new windows, no switching spaces. It appears on top of whatever you're doing and fades away when it's over.

### The flow

1. "Stop your thoughts for 60 seconds"
2. Click **Begin**
3. "For a better experience, use headphones"
4. "Take a deep breath"
5. "Close your eyes"
6. Ambient audio plays (random pick from 6 tracks)
7. Timer counts down
8. "Welcome back" → "Did it slow down?" → feedback
9. "See you soon" → fade out

### Tray menu

Click the menu bar icon to see your personal stats and start a session.

- Minutes of calm
- Times it helped
- Take a breath button

### Onboarding

First launch shows a minimal intro — logo appears, animates to the tray, and a toast says "I live here now."

---

## Setup

```bash
npm install
npm start
```

## Build

```bash
npm run build        # macOS DMG
npm run build:win    # Windows
npm run build:all    # Both
```

---

## Project structure

```
breathe/
├── main.js                  # Electron main process
├── src/
│   ├── experience.html      # Fullscreen overlay UI
│   ├── experience.js        # Experience logic + animations
│   ├── preload.js           # Context bridge
│   ├── tray-popup.html      # Custom tray menu with insights
│   └── onboarding.html      # First-launch experience
├── assets/
│   ├── audio/               # 6 ambient sound files (~1 min each)
│   └── icons/               # App logo + tray icon
├── admin/
│   └── dashboard.html       # Analytics portal (local only, not shipped)
├── build/
│   └── entitlements.mac.plist
└── package.json
```

---

## Audio

Place `.mp3`, `.wav`, `.ogg`, or `.m4a` files in `assets/audio/`. The app picks one at random each session. Experience ends when the audio finishes naturally.

## Analytics

Session data is logged to Supabase:

- `device_id` — anonymous UUID per machine
- `helped` — user feedback (yes/no)
- `audio_file` — which track played
- `duration_seconds` — audio length
- `country_code`, `region_code` — from IP geolocation

Open `admin/dashboard.html` in a browser to view analytics. This file is gitignored and never shipped.

## License

MIT
