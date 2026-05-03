/* =========================
   EC@RT — Zone 13 Search and Destroy
   Orchestrateur principal

   Pipeline :
   Zone13Audio → Zone13AnalyserData → mapAudioToVisual → Zone13GlitchRenderer
   + Système archives vie/mort
   + Toggle stage via ecart:panel-open
   ========================= */

import { Zone13Audio }          from "./zone-13-audio.js";
import { Zone13AnalyserData }   from "./zone-13-analyser.js";
import { Zone13GlitchRenderer } from "./zone-13-glitch.js";
import { mapAudioToVisual }     from "./zone-13-bridge.js";
import { getZone13State, saveZone13State } from "./zone-13-state.js";

/* ─────────────────────────────
   CONFIG
   ───────────────────────────── */

const CONFIG = {
  images: [
    "./images/SND_01.jpeg",
    "./images/SND_02.jpeg",
    "./images/SND_03.jpeg",
    "./images/SND_04.jpeg",
    "./images/SND_05.jpeg",
    "./images/SND_06.jpeg",
    "./images/SND_07.jpeg",
    "./images/SND_08.jpeg"
  ],

  maxArchives: 7,         // archives simultanées max
  spawnInterval: 3200,    // ms entre chaque apparition
  lifeBase: 12000,        // durée de vie de base (ms)
  lifeVariance: 8000,     // variance aléatoire (ms)

  audioFiles: {
    main:   "./audio/SD_01.wav",
    layer:  "./audio/SD_02.wav",
    layer2: "./audio/SD_03.wav",
    layer3: "./audio/SD_04.wav"
  }
};

/* ─────────────────────────────
   ÉTAT
   ───────────────────────────── */

const state = {
  archives: [],
  glitchRenderer: null,
  audio: null,
  analyser: null,
  running: false,
  audioReady: false,
  frameId: null,
  spawnTimer: null
};

/* ─────────────────────────────
   DOM
   ───────────────────────────── */

const field   = document.getElementById("zone13ImageField");
const canvas  = document.getElementById("zone13GlitchCanvas");
const stage   = document.getElementById("zone13Stage");

/* ─────────────────────────────
   TOGGLE STAGE
   Réagit aux événements pannel-ui.
   Quand infoPanel s'ouvre → cache le stage.
   Quand tous les panels se ferment → réaffiche.
   ───────────────────────────── */

function showStage()  { stage?.classList.remove("is-hidden"); }
function hideStage()  { stage?.classList.add("is-hidden"); }

document.addEventListener("ecart:panel-open", (e) => {
  if (e.detail?.panel === "info") hideStage();
});

document.addEventListener("ecart:panel-close-others", () => {
  /* Déclenché quand un panel ferme tous les autres.
     Si aucun panel n'est actif après 50ms → réaffiche le stage. */
  setTimeout(() => {
    const anyOpen = document.querySelector(
      "#infoPanel.is-open, #soundPanel.is-open, #mobileMapOverlay.is-open"
    );
    if (!anyOpen) showStage();
  }, 50);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") showStage();
});

/* ─────────────────────────────
   ARCHIVES — vie / mort
   ───────────────────────────── */

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function createArchive(imageSrc) {
  const wrap = document.createElement("div");
  wrap.className = "zone13-archive";

  const img = document.createElement("img");
  img.className = "zone13-floating-image";
  img.src = imageSrc;
  img.draggable = false;

  const vitality = document.createElement("div");
  vitality.className = "zone13-vitality";
  const bar = document.createElement("div");
  bar.className = "zone13-vitality-bar";
  vitality.appendChild(bar);

  wrap.appendChild(img);
  wrap.appendChild(vitality);
  field.appendChild(wrap);

  const w = rand(180, 420);
  const h = w * rand(0.7, 1.4);
  const x = rand(5, 85);
  const y = rand(5, 75);
  const rot = rand(-18, 18);
  const life = CONFIG.lifeBase + rand(0, CONFIG.lifeVariance);

  wrap.style.cssText = `
    width: ${w}px;
    height: ${h}px;
    left: ${x}%;
    top: ${y}%;
    transform: rotate(${rot}deg) scale(0.4);
    opacity: 0;
    transition: transform 0.6s ease, opacity 0.6s ease;
  `;

  /* Apparition */
  requestAnimationFrame(() => {
    wrap.style.transform = `rotate(${rot}deg) scale(1)`;
    wrap.style.opacity = "1";
  });

  const archive = {
    el: wrap,
    bar,
    born: performance.now(),
    life,
    rot,
    x, y, w, h,
    dead: false
  };

  state.archives.push(archive);
  return archive;
}

function killArchive(archive) {
  if (archive.dead) return;
  archive.dead = true;

  /* Croix de mort */
  const cross = document.createElement("div");
  cross.className = "zone13-death-cross";
  cross.style.left = `calc(${archive.x}% + ${archive.w / 2}px)`;
  cross.style.top  = `calc(${archive.y}% + ${archive.h / 2}px)`;
  field.appendChild(cross);

  /* Disparition */
  archive.el.style.transform = `rotate(${archive.rot + rand(-12, 12)}deg) scale(0.6)`;
  archive.el.style.opacity   = "0";

  setTimeout(() => {
    archive.el.remove();
    cross.remove();
    state.archives = state.archives.filter(a => a !== archive);

    /* Persistance état */
    const s = getZone13State();
    s.visits = (s.visits || 0) + 1;
    saveZone13State(s);
  }, 700);
}

function updateArchives(now, audioState) {
  state.archives.forEach(archive => {
    if (archive.dead) return;

    const elapsed = now - archive.born;
    const ratio   = Math.max(0, 1 - elapsed / archive.life);

    /* Barre de vitalité */
    archive.bar.style.transform = `scaleX(${ratio})`;

    /* Amplitude audio accélère la mort */
    const lifeDrain = audioState
      ? 1 + audioState.amplitude * 2.4 + audioState.bass * 1.6
      : 1;

    if (elapsed > archive.life / lifeDrain) {
      killArchive(archive);
    }
  });
}

function spawnIfNeeded() {
  if (state.archives.filter(a => !a.dead).length < CONFIG.maxArchives) {
    const src = CONFIG.images[Math.floor(Math.random() * CONFIG.images.length)];
    createArchive(src);
  }
}

/* ─────────────────────────────
   GLITCH CANVAS
   ───────────────────────────── */

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width  = Math.floor(rect.width);
  canvas.height = Math.floor(rect.height);
  state.glitchRenderer?.resize();
}

/* ─────────────────────────────
   LOOP PRINCIPALE
   ───────────────────────────── */

function loop(now) {
  state.frameId = requestAnimationFrame(loop);

  let audioState = null;

  if (state.audioReady && state.analyser) {
    const raw = state.analyser.update();
    audioState = mapAudioToVisual(raw);
  }

  updateArchives(now, audioState);

  if (audioState && state.glitchRenderer && state.archives.length > 0) {
    /* Render glitch sur la première image vivante */
    const alive = state.archives.find(a => !a.dead);
    if (alive) {
      const img = alive.el.querySelector("img");
      if (img?.complete) {
        state.glitchRenderer.canvas.style.display = "block";
        state.glitchRenderer.render(audioState);
      }
    }
  } else if (state.glitchRenderer) {
    state.glitchRenderer.ctx.clearRect(
      0, 0,
      state.glitchRenderer.width,
      state.glitchRenderer.height
    );
  }
}

/* ─────────────────────────────
   INIT AUDIO (après geste)
   ───────────────────────────── */

async function initAudio() {
  if (state.audioReady) return;

  try {
    const audio = new Zone13Audio();
    await audio.init();

    await audio.loadBuffer("main",   CONFIG.audioFiles.main);
    await audio.loadBuffer("layer",  CONFIG.audioFiles.layer);
    await audio.loadBuffer("layer2", CONFIG.audioFiles.layer2);
    await audio.loadBuffer("layer3", CONFIG.audioFiles.layer3);

    const layerMain  = audio.createLayer("main",   { loop: true, gain: 0.22 });
    const layerExtra = audio.createLayer("layer",  { loop: true, gain: 0.10, playbackRate: 0.97 });
    const layerDeep  = audio.createLayer("layer2", { loop: true, gain: 0.08, playbackRate: 0.94 });
    const layerHigh  = audio.createLayer("layer3", { loop: true, gain: 0.06, playbackRate: 1.03 });

    await audio.resume();

    audio.startLayer(layerMain);
    audio.startLayer(layerExtra, 0.4);
    audio.startLayer(layerDeep,  0.8);
    audio.startLayer(layerHigh,  1.2);

    state.audio    = audio;
    state.analyser = new Zone13AnalyserData(audio.getAnalyser());
    state.audioReady = true;

    /* Glitch renderer sur le canvas */
    state.glitchRenderer = new Zone13GlitchRenderer(canvas, null);
    resizeCanvas();

    console.log("[Zone13] Audio initialisé");
  } catch (err) {
    console.warn("[Zone13] Audio échec :", err);
  }
}

/* ─────────────────────────────
   DÉMARRAGE
   ───────────────────────────── */

function start() {
  if (state.running) return;
  state.running = true;

  /* Spawn initial */
  spawnIfNeeded();
  state.spawnTimer = setInterval(spawnIfNeeded, CONFIG.spawnInterval);

  /* Loop */
  state.frameId = requestAnimationFrame(loop);

  /* État persistant */
  const s = getZone13State();
  if (!s.activated) {
    s.activated = true;
    saveZone13State(s);
  }

  console.log("[Zone13] Démarré");
}

/* Activation audio au premier geste utilisateur */
document.addEventListener("pointerdown", initAudio, { once: true });
document.addEventListener("keydown",     initAudio, { once: true });

/* Activation audio via le bouton SOUND
   — ouvrir le panel démarre les couches ambiantes si pas encore actif */
document.addEventListener("ecart:panel-open", (e) => {
  if (e.detail?.panel === "sound") initAudio();
});

/* Toggle mute via soundToggle (clic droit, hors ouverture panel)
   Maintenu sur le gainNode master — le panel reste fonctionnel */
(function () {
  const btn = document.getElementById("soundToggle");
  if (!btn) return;

  let muted = false;

  btn.addEventListener("click", () => {
    /* Premier clic = initAudio déjà appelé via ecart:panel-open
       Clics suivants = mute / unmute du gain master */
    if (!state.audio || !state.audio.masterGain) return;

    muted = !muted;

    const gain = state.audio.masterGain.gain;
    const now  = state.audio.ctx.currentTime;

    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(muted ? 0 : 0.8, now, 0.12);

    btn.setAttribute("aria-pressed", String(muted));
    btn.style.opacity = muted ? "0.42" : "1";
  });
})();

/* Resize */
window.addEventListener("resize", resizeCanvas);

/* Go */
document.addEventListener("DOMContentLoaded", start);
