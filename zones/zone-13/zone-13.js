/* =========================
   EC@RT — Zone 13 : Search and Destroy
   Orchestrateur principal — simulation

   Intégration chaos-mode.js :
   ─ Si window.EC_CHAOS.active → skip les transforms DOM
     (chaos-mode prend le contrôle des positions)
   ─ createArchive() → EC_CHAOS.addElement(wrap)
   ─ killArchive()   → EC_CHAOS.removeElement(el)
   ─ plantPermanentCross() → EC_CHAOS.addElement(cross)
   Zone-13.js garde le contrôle des filtres CSS (glitch),
   de la vitalité et de la logique vie/mort.
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
    "./images/SND_01.jpeg", "./images/SND_02.jpeg",
    "./images/SND_03.jpeg", "./images/SND_04.jpeg",
    "./images/SND_05.jpeg", "./images/SND_06.jpeg",
    "./images/SND_07.jpeg", "./images/SND_08.jpeg"
  ],
  audioFiles: ["./audio/SD_01.wav", "./audio/SD_02.wav", "./audio/SD_03.wav"],
  srcLabels:  ["SD 01", "SD 02", "SD 03"],

  maxLiving:       5,
  spawnInterval:   4000,
  lifeBase:        18000,
  lifeVariance:    12000,
};

/* ─────────────────────────────
   POOL — pas de doublons
   ───────────────────────────── */

const imagePool = [...CONFIG.images].sort(() => Math.random() - 0.5);
let   poolIdx   = 0;
function getNextImage() { return poolIdx < imagePool.length ? imagePool[poolIdx++] : null; }

/* ─────────────────────────────
   ÉTAT
   ───────────────────────────── */

const state = {
  archives:       [],
  deadCrosses:    [],
  glitchRenderer: null,
  audio:          null,
  analyser:       null,
  running:        false,
  audioReady:     false,
  audioLoading:   false,
  frameId:        null,
  spawnTimer:     null
};

/* ─────────────────────────────
   HELPERS chaos
   ───────────────────────────── */

const chaosActive = () => !!window.EC_CHAOS?.active;

/* ─────────────────────────────
   DOM
   ───────────────────────────── */

const field  = document.getElementById("zone13ImageField");
const canvas = document.getElementById("zone13GlitchCanvas");

/* ─────────────────────────────
   GLITCH CSS par archive
   (filtres seulement — transforms gérés par chaos ou zone-13)
   ───────────────────────────── */

function applyArchiveGlitch(archive, audio) {
  if (!archive || archive.dead) return;
  const { amplitude, bass, mids, highs, transient } = audio;
  const s   = archive.sensitivity;
  const img = archive.el.querySelector(".z13-img");
  if (!img) return;

  /* ── CSS Filters (toujours actifs, chaos ou non) ── */
  const hue      = transient > 0.35 * s ? (Math.random() - 0.5) * 280 * s : bass * 60 * s;
  const contrast = 1 + bass * 2.2 * s + transient * 1.5 * s;
  const sat      = 1 + mids * 3.0 * s;
  const bright   = 1 + amplitude * 1.2 * s;
  const inv      = transient > 0.75 && Math.random() < 0.08 * s ? 1 : 0;

  img.style.filter = [
    `hue-rotate(${hue.toFixed(0)}deg)`,
    `contrast(${contrast.toFixed(2)})`,
    `saturate(${sat.toFixed(2)})`,
    `brightness(${bright.toFixed(2)})`,
    inv ? "invert(1)" : ""
  ].filter(Boolean).join(" ");

  /* Box-shadow echo coloré */
  if (transient > 0.45 * s) {
    const ex = (Math.random() - 0.5) * 30 * s;
    const ey = (Math.random() - 0.5) * 12 * s;
    img.style.boxShadow = `${ex.toFixed(0)}px ${ey.toFixed(0)}px 0 2px rgba(0,255,255,0.55),${-ex.toFixed(0)}px 0 0 2px rgba(255,0,200,0.45)`;
  } else {
    img.style.boxShadow = "";
  }

  /* ── Transforms — SEULEMENT si chaos n'est pas actif ── */
  if (!chaosActive()) {
    /* Burst sonore */
    const burstX = archive.burstX || 0;
    const burstY = archive.burstY || 0;
    archive.burstX = burstX * 0.88;
    archive.burstY = burstY * 0.88;

    const skewX    = transient > 0.5 * s ? (Math.random() - 0.5) * 20 * s : 0;
    const rotOff   = burstX * 0.08;

    if (archive.xPx === null) {
      archive.el.style.transform =
        `rotate(${archive.rot + rotOff}deg) skewX(${skewX.toFixed(1)}deg) translateX(${burstX.toFixed(1)}px) translateY(${burstY.toFixed(1)}px)`;
    } else {
      archive.el.style.transform =
        `rotate(${archive.rot + rotOff}deg) translateX(${burstX.toFixed(1)}px) translateY(${burstY.toFixed(1)}px)`;
    }
  }
  /* Si chaos est actif : chaos-mode.js gère le transform, on ne touche pas */
}

/* ─────────────────────────────
   BURST SONORE (positions)
   Ignoré si chaos actif (chaos gère les vélocités via audioBurst)
   ───────────────────────────── */

function triggerAudioBurst(amplitude = 0.8) {
  if (chaosActive()) return; /* chaos-mode s'en charge via audioBurst() */
  state.archives.forEach(archive => {
    if (archive.dead) return;
    archive.burstX = (Math.random() - 0.5) * 80 * archive.sensitivity * amplitude;
    archive.burstY = (Math.random() - 0.5) * 30 * archive.sensitivity * amplitude;
  });
}

/* ─────────────────────────────
   VITALITÉ
   ───────────────────────────── */

function vitalityColor(ratio) {
  if (ratio > 0.6) {
    const r = Math.round(255 * ((ratio - 0.6) / 0.4));
    return `rgb(${255 - r},255,80)`;
  } else if (ratio > 0.3) {
    return `rgb(255,${Math.round(200 * ((ratio-0.3)/0.3) + 55)},0)`;
  } else {
    const pulse = Math.sin(performance.now() * 0.012) * 0.5 + 0.5;
    return `rgba(255,${Math.round(40*(ratio/0.3))},0,${0.7+pulse*0.3})`;
  }
}

function updateVitality(archive, ratio) {
  if (!archive.bar) return;
  archive.bar.style.transform  = `scaleX(${ratio})`;
  archive.bar.style.background = vitalityColor(ratio);
  archive.bar.style.boxShadow  = ratio < 0.25 ? `0 0 8px 2px ${vitalityColor(ratio)}` : "";
}

/* ─────────────────────────────
   DRAG + CLICK
   Skip position si chaos actif (chaos gère les coords)
   ───────────────────────────── */

function makeInteractive(wrap, archive) {
  let active = false, startX = 0, startY = 0, hasMoved = false, ox = 0, oy = 0;

  wrap.addEventListener("pointerdown", (e) => {
    active = true; hasMoved = false;
    startX = e.clientX; startY = e.clientY;
    wrap.setPointerCapture(e.pointerId);
    const r = wrap.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    e.stopPropagation();
  });

  wrap.addEventListener("pointermove", (e) => {
    if (!active) return;
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > 8) {
      hasMoved = true;
      /* Si chaos actif → position gérée par chaos-mode (via transform)
         On skip les updates left/top mais la vélocité chaos suivra le pointeur */
      if (!chaosActive()) {
        wrap.style.cursor = "grabbing"; wrap.style.zIndex = "10";
        const fr = field.getBoundingClientRect();
        archive.xPx = e.clientX - fr.left - ox;
        archive.yPx = e.clientY - fr.top  - oy;
        wrap.style.left = `${archive.xPx}px`;
        wrap.style.top  = `${archive.yPx}px`;
      }
    }
  });

  wrap.addEventListener("pointerup", () => {
    if (!active) return; active = false;
    wrap.style.cursor = "pointer"; wrap.style.zIndex = "";
  });

  wrap.addEventListener("pointercancel", () => {
    active = false; wrap.style.cursor = "pointer"; wrap.style.zIndex = "";
  });
}

/* ─────────────────────────────
   ARCHIVES — création
   ───────────────────────────── */

function rand(min, max) { return Math.random() * (max - min) + min; }

function createArchive(imageSrc) {
  const wrap = document.createElement("div");
  wrap.className = "zone13-archive";

  const img = document.createElement("img");
  img.className = "zone13-floating-image z13-img";
  img.src = imageSrc; img.draggable = false;

  const vitalWrap = document.createElement("div");
  vitalWrap.className = "z13-vital-wrap";
  const bar = document.createElement("div");
  bar.className = "z13-vital-bar";
  vitalWrap.appendChild(bar);

  wrap.appendChild(img);
  wrap.appendChild(vitalWrap);
  field.appendChild(wrap);

  const w    = rand(180, 420), h = w * rand(0.7, 1.4);
  const xPct = rand(4, 80),    yPct = rand(4, 68);
  const rot  = rand(-18, 18);
  const life = CONFIG.lifeBase + rand(0, CONFIG.lifeVariance);

  wrap.style.cssText = `
    width:${w}px;height:${h}px;left:${xPct}%;top:${yPct}%;
    transform:rotate(${rot}deg) scale(0.4);opacity:0;
    transition:transform 0.55s ease,opacity 0.55s ease;
    pointer-events:auto;cursor:pointer;
  `;

  requestAnimationFrame(() => {
    wrap.style.transform = `rotate(${rot}deg) scale(1)`;
    wrap.style.opacity   = "1";
  });

  const archive = {
    imageSrc, el: wrap, bar,
    born: performance.now(), life, rot,
    xPct, yPct, w, h, xPx: null, yPx: null,
    burstX: 0, burstY: 0,
    sensitivity: 0.25 + Math.random() * 0.75,
    dead: false
  };

  makeInteractive(wrap, archive);
  state.archives.push(archive);

  /* Intégrer au chaos si actif — après un frame pour que les coords soient stables */
  if (chaosActive()) {
    setTimeout(() => window.EC_CHAOS?.addElement(wrap), 100);
  }

  return archive;
}

/* ─────────────────────────────
   MORT — croix PERMANENTE
   ───────────────────────────── */

function killArchive(archive) {
  if (archive.dead) return;
  archive.dead = true;

  /* Retirer du chaos avant la disparition */
  window.EC_CHAOS?.removeElement(archive.el);

  archive.el.style.transition = "transform 0.6s ease,opacity 0.6s ease,filter 0.6s";
  archive.el.style.transform  = `rotate(${archive.rot + rand(-15,15)}deg) scale(0.45)`;
  archive.el.style.opacity    = "0";
  archive.el.style.filter     = "blur(6px) saturate(0)";

  const cx = archive.xPx !== null ? archive.xPx + archive.w/2 : `${archive.xPct}%`;
  const cy = archive.yPx !== null ? archive.yPx + archive.h/2 : `${archive.yPct}%`;

  setTimeout(() => {
    archive.el.remove();
    state.archives = state.archives.filter(a => a !== archive);
    plantPermanentCross(archive, cx, cy);
    const s = getZone13State(); s.visits = (s.visits||0)+1; saveZone13State(s);
  }, 650);
}

/* ─────────────────────────────
   CROIX PERMANENTE
   ───────────────────────────── */

function plantPermanentCross(archive, cx, cy) {
  const cross = document.createElement("div");
  cross.className = "z13-cross";

  if (typeof cx === "string") { cross.style.left = cx; cross.style.top = typeof cy==="string"?cy:`${cy}px`; }
  else { cross.style.left = `${cx}px`; cross.style.top = `${cy}px`; }

  const hint = document.createElement("span");
  hint.className   = "z13-cross-hint";
  hint.textContent = "↺ RESTAURER";
  cross.appendChild(hint);
  field.appendChild(cross);

  const record = { archive, cross, imageSrc: archive.imageSrc, cx, cy };
  state.deadCrosses.push(record);

  cross.addEventListener("mouseenter", () => cross.classList.add("is-hovered"));
  cross.addEventListener("mouseleave", () => cross.classList.remove("is-hovered"));
  cross.addEventListener("click",      (e) => { e.stopPropagation(); resurrectArchive(record); });
  cross.addEventListener("touchend",   (e) => { e.preventDefault(); resurrectArchive(record); }, { passive: false });

  /* Intégrer la croix au chaos */
  if (chaosActive()) {
    setTimeout(() => window.EC_CHAOS?.addElement(cross), 80);
  }
}

/* ─────────────────────────────
   RÉSURRECTION
   ───────────────────────────── */

function resurrectArchive(record) {
  const { imageSrc, cross, cx, cy } = record;
  cross.classList.add("is-ghost");
  cross.style.pointerEvents = "none";
  window.EC_CHAOS?.removeElement(cross);

  const wrap = document.createElement("div");
  wrap.className = "zone13-archive";
  const img = document.createElement("img");
  img.className = "zone13-floating-image z13-img"; img.src = imageSrc; img.draggable = false;
  const vw = document.createElement("div"); vw.className = "z13-vital-wrap";
  const bar = document.createElement("div"); bar.className = "z13-vital-bar";
  vw.appendChild(bar); wrap.appendChild(img); wrap.appendChild(vw);
  field.appendChild(wrap);

  const w   = rand(160, 380), h = w * rand(0.7, 1.4);
  const rot = rand(-14, 14);
  const life = CONFIG.lifeBase * 0.55 + rand(0, CONFIG.lifeVariance * 0.4);
  const fr   = field.getBoundingClientRect();
  let pxLeft, pxTop;
  if (typeof cx === "string" && cx.includes("%")) {
    pxLeft = (parseFloat(cx)/100)*fr.width  - w/2;
    pxTop  = (parseFloat(cy)/100)*fr.height - h/2;
  } else { pxLeft = (parseFloat(cx)||0) - w/2; pxTop  = (parseFloat(cy)||0) - h/2; }

  wrap.style.cssText = `
    width:${w}px;height:${h}px;left:${pxLeft}px;top:${pxTop}px;
    transform:rotate(${rot}deg) scale(0.3);opacity:0;filter:brightness(3) saturate(0);
    transition:transform 0.8s ease,opacity 0.8s ease,filter 1.2s ease;
    pointer-events:auto;cursor:pointer;
  `;
  requestAnimationFrame(() => {
    wrap.style.transform = `rotate(${rot}deg) scale(1)`;
    wrap.style.opacity   = "1"; wrap.style.filter = "";
  });

  const archive = {
    imageSrc, el: wrap, bar,
    born: performance.now(), life, rot,
    xPct: null, yPct: null, xPx: pxLeft, yPx: pxTop, w, h,
    burstX: (Math.random()-0.5)*60, burstY: (Math.random()-0.5)*30,
    sensitivity: 0.5 + Math.random() * 0.5,
    dead: false, resurrected: true
  };

  makeInteractive(wrap, archive);
  state.archives.push(archive);
  if (chaosActive()) setTimeout(() => window.EC_CHAOS?.addElement(wrap), 100);
}

/* ─────────────────────────────
   UPDATE BOUCLE
   ───────────────────────────── */

function updateArchives(now, audioState) {
  for (const archive of state.archives) {
    if (archive.dead) continue;
    const elapsed = now - archive.born;
    const ratio   = Math.max(0, 1 - elapsed / archive.life);
    updateVitality(archive, ratio);

    const drain = audioState
      ? 1 + audioState.amplitude * 3.2 + audioState.bass * 2.0 : 1;

    if (ratio <= 0 || elapsed > archive.life / drain) { killArchive(archive); continue; }
    if (audioState) applyArchiveGlitch(archive, audioState);
    else { archive.burstX = (archive.burstX||0)*0.9; archive.burstY = (archive.burstY||0)*0.9; }
  }
}

function spawnIfNeeded() {
  if (state.archives.filter(a=>!a.dead).length >= CONFIG.maxLiving) return;
  const src = getNextImage(); if (!src) return;
  createArchive(src);
}

/* ─────────────────────────────
   CANVAS
   ───────────────────────────── */

function resizeCanvas() {
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.floor(r.width); canvas.height = Math.floor(r.height);
  state.glitchRenderer?.resize();
}

/* ─────────────────────────────
   LOOP
   ───────────────────────────── */

function loop(now) {
  state.frameId = requestAnimationFrame(loop);
  let audioState = null;
  if (state.audioReady && state.analyser) {
    const raw = state.analyser.update();
    audioState = { amplitude:raw.amplitude, bass:raw.bass, mids:raw.mids, highs:raw.highs, transient:raw.transient };
  }
  updateArchives(now, audioState);
  if (state.glitchRenderer)
    audioState && audioState.amplitude > 0.02 ? state.glitchRenderer.render(audioState) : state.glitchRenderer.clear();
}

/* ─────────────────────────────
   INIT AUDIO
   ───────────────────────────── */

async function initAudio() {
  if (state.audioReady || state.audioLoading) return;
  state.audioLoading = true;
  try {
    const audio = new Zone13Audio();
    await audio.init(); await audio.resume();
    await audio.loadBuffers(CONFIG.audioFiles);

    audio.onTrigger = (srcIdx) => {
      const amp = 0.85 + Math.random() * 0.15;
      triggerAudioBurst(amp);
      /* Propagation au chaos */
      window.EC_CHAOS?.audioBurst(amp);
      /* Update panel LED */
      document.querySelectorAll(".z13-src-row").forEach((row, i) => row.classList.toggle("is-playing", i === srcIdx));
    };

    audio.onEnd = () => {
      document.querySelectorAll(".z13-src-row").forEach(r => r.classList.remove("is-playing"));
    };

    audio.startCycle();
    state.audio = audio;
    state.analyser = new Zone13AnalyserData(audio.getAnalyser());
    state.audioReady = true; state.audioLoading = false;
    state.glitchRenderer = new Zone13GlitchRenderer(canvas);
    resizeCanvas();
    injectGrainSection_enable();
    console.log("[Zone13] Audio démarré");
  } catch (err) { state.audioLoading = false; console.warn("[Zone13] Audio échec :", err); }
}

/* ─────────────────────────────
   SOUND PANEL
   ───────────────────────────── */

let _grainSectionEl = null;

function injectGrainSection() {
  const panelInner = document.querySelector("#ecartAudioPanel .ecart-audio-panel-inner");
  if (!panelInner || panelInner.querySelector(".z13-sound-section")) return;

  const sourcesHTML = CONFIG.srcLabels.map((label, i) => `
    <div class="z13-src-row" data-src="${i}">
      <span class="z13-src-led"></span>
      <span class="z13-src-name">${label}</span>
      <span class="z13-src-bar"></span>
    </div>`).join("");

  const section = document.createElement("div");
  section.className = "z13-sound-section";
  section.innerHTML = `
    <div class="z13-sound-label">SOUND DESIGN</div>
    <button class="z13-activate-btn" id="z13ActivateBtn" type="button">
      <span class="z13-ring"></span>ACTIVER
    </button>
    <p class="z13-loading-msg" id="z13Loading" hidden>Chargement…</p>
    <div class="z13-src-list z13-locked" id="z13SrcList">${sourcesHTML}</div>
    <button class="z13-trigger-btn z13-locked" id="z13TriggerBtn" type="button" disabled>↗ DÉCLENCHER</button>
    <p class="z13-sim-hint">${CONFIG.images.length} archives · pool unique · croix permanentes</p>
  `;

  panelInner.appendChild(section);
  _grainSectionEl = section;

  section.querySelector("#z13ActivateBtn").addEventListener("click", async (e) => {
    if (state.audioLoading || state.audioReady) return;
    e.currentTarget.disabled    = true;
    e.currentTarget.textContent = "…";
    section.querySelector("#z13Loading").hidden = false;
    await initAudio();
  });

  section.querySelector("#z13TriggerBtn").addEventListener("click", () => state.audio?.manualTrigger());
}

function injectGrainSection_enable() {
  if (!_grainSectionEl) return;
  const s = _grainSectionEl;
  s.querySelector("#z13ActivateBtn").hidden  = true;
  s.querySelector("#z13Loading").hidden      = true;
  s.querySelector("#z13SrcList").classList.remove("z13-locked");
  s.querySelector("#z13TriggerBtn").classList.remove("z13-locked");
  s.querySelector("#z13TriggerBtn").disabled = false;
}

/* ─────────────────────────────
   MUTE MASTER
   ───────────────────────────── */

(function() {
  const btn = document.getElementById("soundToggle");
  if (!btn) return;
  let muted = false;
  btn.addEventListener("click", () => {
    if (!state.audio?.masterGain) return;
    muted = !muted;
    const { gain } = state.audio.masterGain;
    const now = state.audio.ctx.currentTime;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(muted ? 0 : 0.92, now, 0.12);
    btn.setAttribute("aria-pressed", String(muted));
  });
})();

/* ─────────────────────────────
   START
   ───────────────────────────── */

function start() {
  if (state.running) return;
  state.running = true;
  injectGrainSection();
  for (let i = 0; i < CONFIG.maxLiving; i++) spawnIfNeeded();
  state.spawnTimer = setInterval(spawnIfNeeded, CONFIG.spawnInterval);
  state.frameId    = requestAnimationFrame(loop);
  const s = getZone13State();
  if (!s.activated) { s.activated = true; saveZone13State(s); }
  console.log("[Zone13] Simulation démarrée — pool:", imagePool.length, "images");
}

window.addEventListener("resize", resizeCanvas);
document.addEventListener("DOMContentLoaded", start);
