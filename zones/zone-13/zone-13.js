/* =========================
   EC@RT — Zone 13 : Search and Destroy
   Orchestrateur principal — version expérimentale

   Pipeline :
   Zone13Audio (granulaire stochastique)
     → AnalyserData
     → Zone13GlitchRenderer (canvas overlay global)
     → applyImageGlitch() (CSS distorsion par archive)

   Chaque archive a une "sensibilité" unique :
   certaines réagissent violemment, d'autres à peine.

   Sound Panel : grain engine contrôlable en temps réel.
   ========================= */

import { Zone13Audio }          from "./zone-13-audio.js";
import { Zone13AnalyserData }   from "./zone-13-analyser.js";
import { Zone13GlitchRenderer } from "./zone-13-glitch.js";
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
  audioFiles: [
    "./audio/SD_01.wav",
    "./audio/SD_02.wav",
    "./audio/SD_03.wav"
  ],
  srcLabels: ["SRC 01", "SRC 02", "SRC 03"],

  maxArchives:   7,
  spawnInterval: 3200,
  lifeBase:      12000,
  lifeVariance:  8000
};

/* ─────────────────────────────
   ÉTAT
   ───────────────────────────── */

const state = {
  archives:       [],
  glitchRenderer: null,
  audio:          null,
  analyser:       null,
  running:        false,
  audioReady:     false,
  frameId:        null,
  spawnTimer:     null
};

/* ─────────────────────────────
   DOM
   ───────────────────────────── */

const field  = document.getElementById("zone13ImageField");
const canvas = document.getElementById("zone13GlitchCanvas");

/* ─────────────────────────────
   DRAG — archives déplaçables
   ───────────────────────────── */

function makeDraggable(wrap, archive) {
  let active = false;
  let ox = 0, oy = 0;

  wrap.style.cursor = "grab";

  wrap.addEventListener("pointerdown", (e) => {
    active = true;
    wrap.setPointerCapture(e.pointerId);
    wrap.style.cursor     = "grabbing";
    wrap.style.zIndex     = "10";
    wrap.style.transition = "opacity 0.6s ease";

    const r = wrap.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    e.stopPropagation();
  });

  wrap.addEventListener("pointermove", (e) => {
    if (!active) return;
    const fr = field.getBoundingClientRect();
    const nx = e.clientX - fr.left - ox;
    const ny = e.clientY - fr.top  - oy;
    wrap.style.left = `${nx}px`;
    wrap.style.top  = `${ny}px`;
    archive.xPx = nx;
    archive.yPx = ny;
  });

  const end = () => {
    if (!active) return;
    active = false;
    wrap.style.cursor     = "grab";
    wrap.style.zIndex     = "";
    wrap.style.transition = "transform 0.6s ease, opacity 0.6s ease";
  };

  wrap.addEventListener("pointerup",     end);
  wrap.addEventListener("pointercancel", end);
}

/* ─────────────────────────────
   GLITCH PAR IMAGE (CSS)
   Chaque archive a sa propre sensibilité (0.15–1.0).
   Les effets CSS sont appliqués directement sur l'img
   et le wrapper pour une distorsion indépendante.
   ───────────────────────────── */

const BLEND_MODES = ["screen", "overlay", "difference", "hard-light", "exclusion", "color-dodge"];

function applyImageGlitch(archive, audioState) {
  if (archive.dead) return;

  const { amplitude, bass, mids, highs, transient } = audioState;
  const s   = archive.sensitivity;
  const el  = archive.el;
  const img = el.querySelector("img");
  if (!img) return;

  /* ── Filtres CSS ── */
  const hueShift = transient > 0.38 / s
    ? (Math.random() - 0.5) * 210 * s
    : bass * 38 * s;

  const contrast   = 1 + bass * 1.4 * s;
  const saturate   = 1 + mids * 2.2 * s;
  const brightness = 1 + amplitude * 0.6 * s;
  const blur       = (transient > 0.65 * s && Math.random() < 0.4)
    ? Math.random() * 2.5 * s
    : 0;

  /* Inversion flash sur pic transient */
  const invert = transient > 0.78 && Math.random() < 0.06 * s ? 1 : 0;

  img.style.filter = [
    `hue-rotate(${hueShift}deg)`,
    `contrast(${contrast.toFixed(2)})`,
    `saturate(${saturate.toFixed(2)})`,
    `brightness(${brightness.toFixed(2)})`,
    blur   > 0.1 ? `blur(${blur.toFixed(1)}px)` : "",
    invert ? "invert(1)"                         : ""
  ].filter(Boolean).join(" ");

  /* ── Transform displacement ──
     Ne pas écraser la position si l'archive est en drag. */
  if (archive.xPx === null) {
    const skewX = transient > 0.45 * s
      ? (Math.random() - 0.5) * 14 * s
      : 0;
    const tx = amplitude > 0.08
      ? (Math.random() - 0.5) * 28 * s * amplitude
      : 0;

    el.style.transform = `rotate(${archive.rot}deg) skewX(${skewX.toFixed(2)}deg) translateX(${tx.toFixed(1)}px)`;
  }

  /* ── Mix-blend-mode chaos — déclenchement rare ── */
  if (transient > 0.6 * s && Math.random() < 0.04 * s && !archive._blending) {
    archive._blending = true;
    const mode = BLEND_MODES[Math.floor(Math.random() * BLEND_MODES.length)];
    el.style.mixBlendMode = mode;
    setTimeout(() => {
      el.style.mixBlendMode = "";
      archive._blending = false;
    }, 80 + Math.random() * 350);
  }

  /* ── Vitality bar teinée ── */
  const hb = (bass * 120 * s) | 0;
  archive.bar.style.background = `hsl(${hb}, 60%, 75%)`;
}

/* ─────────────────────────────
   ARCHIVES — vie / mort
   ───────────────────────────── */

function rand(min, max) { return Math.random() * (max - min) + min; }

function createArchive(imageSrc) {
  const wrap = document.createElement("div");
  wrap.className = "zone13-archive";

  const img = document.createElement("img");
  img.className = "zone13-floating-image";
  img.src       = imageSrc;
  img.draggable = false;

  const vitality = document.createElement("div");
  vitality.className = "zone13-vitality";
  const bar = document.createElement("div");
  bar.className = "zone13-vitality-bar";
  vitality.appendChild(bar);

  wrap.appendChild(img);
  wrap.appendChild(vitality);
  field.appendChild(wrap);

  const w    = rand(180, 420);
  const h    = w * rand(0.7, 1.4);
  const xPct = rand(5, 82);
  const yPct = rand(5, 72);
  const rot  = rand(-18, 18);
  const life = CONFIG.lifeBase + rand(0, CONFIG.lifeVariance);

  /* Sensibilité unique — distribue les rôles dans la scène */
  const sensitivity = 0.15 + Math.random() * 0.85;

  wrap.style.cssText = `
    width: ${w}px; height: ${h}px;
    left: ${xPct}%; top: ${yPct}%;
    transform: rotate(${rot}deg) scale(0.4);
    opacity: 0;
    transition: transform 0.6s ease, opacity 0.6s ease;
    pointer-events: auto;
  `;

  requestAnimationFrame(() => {
    wrap.style.transform = `rotate(${rot}deg) scale(1)`;
    wrap.style.opacity   = "1";
  });

  const archive = {
    el: wrap, bar,
    born: performance.now(), life, rot,
    xPct, yPct, w, h,
    xPx: null, yPx: null,
    sensitivity, _blending: false,
    dead: false
  };

  makeDraggable(wrap, archive);
  state.archives.push(archive);
  return archive;
}

function killArchive(archive) {
  if (archive.dead) return;
  archive.dead = true;

  const cross = document.createElement("div");
  cross.className = "zone13-death-cross";

  if (archive.xPx !== null) {
    cross.style.left = `${archive.xPx + archive.w / 2}px`;
    cross.style.top  = `${archive.yPx + archive.h / 2}px`;
  } else {
    cross.style.left = `calc(${archive.xPct}% + ${archive.w / 2}px)`;
    cross.style.top  = `calc(${archive.yPct}% + ${archive.h / 2}px)`;
  }
  field.appendChild(cross);

  archive.el.style.transform = `rotate(${archive.rot + rand(-12, 12)}deg) scale(0.5)`;
  archive.el.style.opacity   = "0";
  archive.el.style.filter    = "blur(4px) saturate(0)";

  setTimeout(() => {
    archive.el.remove();
    cross.remove();
    state.archives = state.archives.filter(a => a !== archive);
    const s = getZone13State();
    s.visits = (s.visits || 0) + 1;
    saveZone13State(s);
  }, 700);
}

function updateArchives(now, audioState) {
  for (const archive of state.archives) {
    if (archive.dead) continue;

    const elapsed = now - archive.born;
    const ratio   = Math.max(0, 1 - elapsed / archive.life);
    archive.bar.style.transform = `scaleX(${ratio})`;

    /* L'audio granulaire accélère la mort via amplitude */
    const drain = audioState
      ? 1 + audioState.amplitude * 2.8 + audioState.bass * 1.8
      : 1;

    if (elapsed > archive.life / drain) {
      killArchive(archive);
    } else if (audioState) {
      applyImageGlitch(archive, audioState);
    }
  }
}

function spawnIfNeeded() {
  const alive = state.archives.filter(a => !a.dead).length;
  if (alive < CONFIG.maxArchives) {
    const src = CONFIG.images[Math.floor(Math.random() * CONFIG.images.length)];
    createArchive(src);
  }
}

/* ─────────────────────────────
   CANVAS RESIZE
   ───────────────────────────── */

function resizeCanvas() {
  const r = canvas.getBoundingClientRect();
  canvas.width  = Math.floor(r.width);
  canvas.height = Math.floor(r.height);
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
    /* bridge inline */
    audioState = {
      amplitude: raw.amplitude,
      bass:      raw.bass,
      mids:      raw.mids,
      highs:     raw.highs,
      transient: raw.transient
    };
  }

  updateArchives(now, audioState);

  if (state.glitchRenderer) {
    if (audioState) {
      state.glitchRenderer.render(audioState);
    } else {
      state.glitchRenderer.clear();
    }
  }
}

/* ─────────────────────────────
   SOUND PANEL — Grain Engine UI
   ───────────────────────────── */

function buildSoundPanel() {
  const inner = document.querySelector("#soundPanel .sound-panel-inner");
  if (!inner || inner.querySelector(".z13-grain-engine")) return;

  /* ── Structure HTML injectée ── */
  const ui = document.createElement("div");
  ui.className = "z13-grain-engine";

  /* Sources */
  const sourcesHTML = CONFIG.srcLabels.map((label, i) => `
    <div class="z13-source" data-src="${i}">
      <button class="z13-src-btn is-on" data-src="${i}">${label}</button>
      <div class="z13-src-grains">
        <span class="z13-grain-dot"></span>
        <span class="z13-grain-dot"></span>
        <span class="z13-grain-dot"></span>
      </div>
      <div class="z13-src-pulse" data-src="${i}"></div>
    </div>
  `).join("");

  ui.innerHTML = `
    <div class="z13-engine-label">GRAIN ENGINE</div>

    <div class="z13-sources">${sourcesHTML}</div>

    <div class="z13-params">
      <div class="z13-param">
        <span class="z13-param-label">DENSITY</span>
        <input type="range" class="z13-slider" id="z13Density"
          min="0" max="1" step="0.01" value="${state.audio.grainDensity}">
        <span class="z13-param-val" id="z13DensityVal">${state.audio.grainDensity.toFixed(2)}</span>
      </div>
      <div class="z13-param">
        <span class="z13-param-label">PITCH ↕</span>
        <input type="range" class="z13-slider" id="z13Pitch"
          min="0" max="1" step="0.01" value="${state.audio.grainPitch}">
        <span class="z13-param-val" id="z13PitchVal">${state.audio.grainPitch.toFixed(2)}</span>
      </div>
      <div class="z13-param">
        <span class="z13-param-label">POSITION</span>
        <input type="range" class="z13-slider" id="z13Pos"
          min="0" max="1" step="0.01" value="${state.audio.grainPos}">
        <span class="z13-param-val" id="z13PosVal">${state.audio.grainPos.toFixed(2)}</span>
      </div>
      <div class="z13-param">
        <span class="z13-param-label">GRAIN SIZE</span>
        <input type="range" class="z13-slider" id="z13Size"
          min="0" max="1" step="0.01" value="${state.audio.grainSize}">
        <span class="z13-param-val" id="z13SizeVal">${state.audio.grainSize.toFixed(2)}</span>
      </div>
    </div>
  `;

  inner.appendChild(ui);

  /* ── Wire toggles sources ── */
  ui.querySelectorAll(".z13-src-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = +btn.dataset.src;
      state.audio.grainActive[i] = !state.audio.grainActive[i];
      btn.classList.toggle("is-on", state.audio.grainActive[i]);
    });
  });

  /* ── Wire sliders ── */
  function wireSlider(id, prop, valId) {
    const el = ui.querySelector(`#${id}`);
    const vl = ui.querySelector(`#${valId}`);
    if (!el) return;
    el.addEventListener("input", () => {
      state.audio[prop] = +el.value;
      if (vl) vl.textContent = (+el.value).toFixed(2);
    });
  }

  wireSlider("z13Density", "grainDensity", "z13DensityVal");
  wireSlider("z13Pitch",   "grainPitch",   "z13PitchVal");
  wireSlider("z13Pos",     "grainPos",     "z13PosVal");
  wireSlider("z13Size",    "grainSize",    "z13SizeVal");

  /* ── Callback grain → flash pulse ── */
  state.audio.onGrainFire = (srcIdx) => {
    const pulse = ui.querySelector(`.z13-src-pulse[data-src="${srcIdx}"]`);
    if (pulse) {
      pulse.classList.add("is-firing");
      setTimeout(() => pulse.classList.remove("is-firing"), 90);
    }
    /* Anime un des 3 dots aléatoirement */
    const grains = ui.querySelectorAll(`.z13-source[data-src="${srcIdx}"] .z13-grain-dot`);
    if (grains.length) {
      const dot = grains[Math.floor(Math.random() * grains.length)];
      dot.classList.add("is-active");
      setTimeout(() => dot.classList.remove("is-active"), 120);
    }
  };
}

/* ─────────────────────────────
   INIT AUDIO
   ───────────────────────────── */

async function initAudio() {
  if (state.audioReady) return;

  try {
    const audio = new Zone13Audio();
    await audio.init();
    await audio.loadBuffers(CONFIG.audioFiles);
    await audio.resume();

    audio.startGranular();

    state.audio      = audio;
    state.analyser   = new Zone13AnalyserData(audio.getAnalyser());
    state.audioReady = true;

    state.glitchRenderer = new Zone13GlitchRenderer(canvas);
    resizeCanvas();

    buildSoundPanel();

    console.log("[Zone13] Grain engine démarré");
  } catch (err) {
    console.warn("[Zone13] Audio échec :", err);
  }
}

/* ─────────────────────────────
   MUTE MASTER
   ───────────────────────────── */

(function () {
  const btn = document.getElementById("soundToggle");
  if (!btn) return;
  let muted = false;

  btn.addEventListener("click", () => {
    if (!state.audio?.masterGain) return;
    muted = !muted;
    const gain = state.audio.masterGain.gain;
    const now  = state.audio.ctx.currentTime;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(muted ? 0 : 0.72, now, 0.12);
    btn.setAttribute("aria-pressed", String(muted));
    btn.style.opacity = muted ? "0.42" : "1";
  });
})();

/* ─────────────────────────────
   EVENTS
   ───────────────────────────── */

document.addEventListener("ecart:panel-open", (e) => {
  if (e.detail?.panel === "sound") initAudio();
});

document.addEventListener("pointerdown", initAudio, { once: true });
document.addEventListener("keydown",     initAudio, { once: true });
window.addEventListener("resize", resizeCanvas);

/* ─────────────────────────────
   START
   ───────────────────────────── */

function start() {
  if (state.running) return;
  state.running = true;

  spawnIfNeeded();
  state.spawnTimer = setInterval(spawnIfNeeded, CONFIG.spawnInterval);
  state.frameId    = requestAnimationFrame(loop);

  const s = getZone13State();
  if (!s.activated) { s.activated = true; saveZone13State(s); }

  console.log("[Zone13] Démarré");
}

document.addEventListener("DOMContentLoaded", start);
