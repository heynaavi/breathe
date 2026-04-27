const backdrop = document.getElementById('backdrop');
const messageEl = document.getElementById('message');
const beginBtn = document.getElementById('beginBtn');
const timerEl = document.getElementById('timer');
const exitHint = document.getElementById('exitHint');
const dot = document.getElementById('dot');

let audio = null;
let timerInterval = null;
let isEnding = false;
let currentAudioFile = null;
let audioDuration = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showMessage(text) {
  return new Promise(async (resolve) => {
    messageEl.textContent = text;
    messageEl.classList.add('visible');
    await sleep(100);
    resolve();
  });
}

function hideMessage() {
  return new Promise(async (resolve) => {
    messageEl.classList.remove('visible');
    await sleep(2000);
    resolve();
  });
}

function formatTime(s) {
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function fadeAudioIn(audioEl, targetVol, duration) {
  const steps = 60;
  const stepTime = duration / steps;
  const increment = targetVol / steps;
  let current = 0;
  const interval = setInterval(() => {
    current += increment;
    if (current >= targetVol) {
      audioEl.volume = targetVol;
      clearInterval(interval);
    } else {
      audioEl.volume = current;
    }
  }, stepTime);
}

function fadeAudioOut(audioEl, duration) {
  return new Promise(resolve => {
    if (!audioEl || audioEl.volume === 0) { resolve(); return; }
    const steps = 60;
    const stepTime = duration / steps;
    const decrement = audioEl.volume / steps;
    let current = audioEl.volume;
    const interval = setInterval(() => {
      current -= decrement;
      if (current <= 0.01) {
        audioEl.volume = 0;
        clearInterval(interval);
        resolve();
      } else {
        audioEl.volume = current;
      }
    }, stepTime);
  });
}

// ── Main sequence ──
async function startSequence() {
  // Fade backdrop to black over 3 seconds
  await sleep(300);
  backdrop.classList.add('visible');
  await sleep(3500);

  // Show first message
  await showMessage('Stop your thoughts for 60 seconds');
  await sleep(1900);

  // Show begin button (already in DOM, just fade in)
  beginBtn.classList.add('visible');
}

// Begin button click
beginBtn.addEventListener('click', async () => {
  // Hide cursor after clicking begin
  document.body.classList.add('cursor-hidden');

  beginBtn.classList.remove('visible');
  await sleep(600);

  await hideMessage();
  await sleep(800);

  // Message 2
  await showMessage('For a better experience, use headphones');
  await sleep(2800);
  await hideMessage();
  await sleep(900);

  // Message 3
  await showMessage('Take a deep breath');
  await sleep(2800);
  await hideMessage();
  await sleep(900);

  // Message 4 — then start audio
  await showMessage('Close your eyes');
  await sleep(2200);
  await hideMessage();
  await sleep(600);

  // Start audio and show dot
  startAudio();
  await sleep(300);
  dot.classList.add('visible');
  await sleep(3000);
  dot.classList.remove('visible');

  // Show subtle exit hint
  await sleep(1000);
  exitHint.classList.add('visible');
  timerEl.classList.add('visible');

  // Timer counts down from audio duration
  let totalSeconds = 60; // default fallback
  if (audio && audio.duration && isFinite(audio.duration)) {
    totalSeconds = Math.ceil(audio.duration);
  } else if (audio) {
    // Wait for metadata to load
    await new Promise(resolve => {
      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && isFinite(audio.duration)) {
          totalSeconds = Math.ceil(audio.duration);
        }
        resolve();
      });
      setTimeout(resolve, 1000); // fallback
    });
  }

  let seconds = totalSeconds;
  timerEl.textContent = formatTime(seconds);
  timerInterval = setInterval(() => {
    seconds--;
    if (seconds < 0) seconds = 0;
    timerEl.textContent = formatTime(seconds);
  }, 1000);
});

async function startAudio() {
  const files = await window.bridge.getSoundFiles();
  if (files.length > 0) {
    const randomFile = files[Math.floor(Math.random() * files.length)];
    currentAudioFile = randomFile.split('/').pop().split('\\').pop();
    audio = new Audio(`file://${randomFile}`);
    audio.volume = 0;
    audio.play();
    fadeAudioIn(audio, 0.8, 5000);

    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration && isFinite(audio.duration)) {
        audioDuration = Math.ceil(audio.duration);
      }
    });

    audio.addEventListener('ended', () => {
      if (!isEnding) endExperience();
    });
  }
}

async function endExperience() {
  if (isEnding) return;
  isEnding = true;

  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  timerEl.classList.remove('visible');
  exitHint.classList.remove('visible');

  // If audio is still playing, fade it out
  if (audio && !audio.ended) {
    await fadeAudioOut(audio, 3000);
    audio.pause();
    audio = null;
  }

  await sleep(2000);

  // Show staggered feedback: welcome first, then question
  document.body.classList.remove('cursor-hidden');
  const welcomeEl = document.getElementById('feedbackWelcome');
  const bottomEl = document.getElementById('feedbackBottom');

  welcomeEl.classList.add('visible');
  await sleep(1800);
  bottomEl.classList.add('visible');
}

async function handleFeedback(helped) {
  const welcomeEl = document.getElementById('feedbackWelcome');
  const bottomEl = document.getElementById('feedbackBottom');

  bottomEl.classList.remove('visible');
  await sleep(600);
  welcomeEl.classList.remove('visible');

  window.bridge.sendFeedback({
    helped,
    audioFile: currentAudioFile,
    durationSeconds: audioDuration || 60,
  });

  await sleep(1500);
  await showMessage('See you soon');
  await sleep(2500);
  await hideMessage();
  await sleep(1200);

  backdrop.classList.remove('visible');
  await sleep(1800);
  window.bridge.endExperience();
}

// ESC to exit — immediate smooth close
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (isEnding) return;
    isEnding = true;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

    // Stop audio immediately
    if (audio) {
      audio.pause();
      audio = null;
    }

    // Quick fade out
    messageEl.classList.remove('visible');
    timerEl.classList.remove('visible');
    exitHint.classList.remove('visible');
    backdrop.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
    backdrop.classList.remove('visible');

    setTimeout(() => {
      window.bridge.endExperience();
    }, 900);
  }
});

// Start
startSequence();
