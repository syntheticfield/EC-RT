'use strict';

/* ═══════════════════════════════════════════════════════════
   EC@RT — Zone 05 BAD
   Table d'archives — déplacement libre des fragments
   ═══════════════════════════════════════════════════════════ */

const BAD_ARCHIVES = [
  './BAD-img/BAD_01.png',
  './BAD-img/BAD_02.png',
  './BAD-img/BAD_03.png',
  './BAD-img/BAD_04.png',
  './BAD-img/BAD_05.png',
  './BAD-img/BAD_06.png',
  './BAD-img/BAD_07.png',
  './BAD-img/BAD_08.png',
  './BAD-img/BAD_09.png',
  './BAD-img/BAD_10.png',
  './BAD-img/BAD_11.png',
  './BAD-img/BAD_12.png',
  './BAD-img/BAD_13.png',
  './BAD-img/BAD_14.png',
  './BAD-img/BAD_15.png',
  './BAD-img/BAD_16.png'
];

const BAD_CONFIG = {
  storageKey: 'ecart_zone05_bad_v4',
  fragmentsPerImage: 3,
  minSize: 120,
  maxSize: 280,
  saveDebounceMs: 160
};

const surface   = document.getElementById('badArchiveSurface');
const resetButton = document.getElementById('badReset');

let fragments = [];
let surfaceW  = 0;
let surfaceH  = 0;
let saveTimer = null;
let topZ      = 40;

const rand  = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ─── mesures ─────────────────────────────────────────────── */

function measure() {
  surfaceW = surface.offsetWidth  || window.innerWidth;
  surfaceH = surface.offsetHeight || window.innerHeight;
}

/* ─── forme déchirée ──────────────────────────────────────── */

function jaggedPolygon() {
  return {
    '--p1x':  `${rand(0,   6).toFixed(2)}%`, '--p1y':  `${rand(3,  18).toFixed(2)}%`,
    '--p2x':  `${rand(12, 22).toFixed(2)}%`, '--p2y':  `${rand(-8,  8).toFixed(2)}%`,
    '--p3x':  `${rand(30, 44).toFixed(2)}%`, '--p3y':  `${rand(0,  13).toFixed(2)}%`,
    '--p4x':  `${rand(58, 72).toFixed(2)}%`, '--p4y':  `${rand(-8, 10).toFixed(2)}%`,
    '--p5x':  `${rand(88,100).toFixed(2)}%`, '--p5y':  `${rand(8,  25).toFixed(2)}%`,
    '--p6x':  `${rand(94,104).toFixed(2)}%`, '--p6y':  `${rand(35, 52).toFixed(2)}%`,
    '--p7x':  `${rand(86,100).toFixed(2)}%`, '--p7y':  `${rand(72, 96).toFixed(2)}%`,
    '--p8x':  `${rand(64, 78).toFixed(2)}%`, '--p8y':  `${rand(88,106).toFixed(2)}%`,
    '--p9x':  `${rand(42, 54).toFixed(2)}%`, '--p9y':  `${rand(92,104).toFixed(2)}%`,
    '--p10x': `${rand(18, 32).toFixed(2)}%`, '--p10y': `${rand(86,102).toFixed(2)}%`,
    '--p11x': `${rand(-4, 10).toFixed(2)}%`, '--p11y': `${rand(62, 82).toFixed(2)}%`,
    '--p12x': `${rand(-6,  9).toFixed(2)}%`, '--p12y': `${rand(28, 48).toFixed(2)}%`
  };
}

/* ─── localStorage ────────────────────────────────────────── */

function loadState() {
  try { return JSON.parse(localStorage.getItem(BAD_CONFIG.storageKey) || '{}'); }
  catch (_) { return {}; }
}

function saveStateSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const state = {};
    fragments.forEach(f => {
      state[f.id] = { x: Math.round(f.x), y: Math.round(f.y), rot: +f.rot.toFixed(2), z: f.z };
    });
    try { localStorage.setItem(BAD_CONFIG.storageKey, JSON.stringify(state)); } catch (_) {}
  }, BAD_CONFIG.saveDebounceMs);
}

function clearState() {
  try { localStorage.removeItem(BAD_CONFIG.storageKey); } catch (_) {}
  fragments.forEach(f => f.el.remove());
  fragments = [];
  topZ = 40;
  spawn();
}

/* ─── Fragment ────────────────────────────────────────────── */

class BadFragment {
  constructor({ id, src, saved }) {
    this.id  = id;
    this.src = src;

    this.w   = rand(BAD_CONFIG.minSize, BAD_CONFIG.maxSize);
    this.h   = this.w * rand(0.65, 1.25);
    this.x   = rand(20, Math.max(30, surfaceW - this.w - 20));
    this.y   = rand(20, Math.max(30, surfaceH - this.h - 20));
    this.rot = rand(-24, 24);
    this.z   = Math.floor(rand(2, 40));

    if (saved) {
      this.x   = saved.x   ?? this.x;
      this.y   = saved.y   ?? this.y;
      this.rot = saved.rot ?? this.rot;
      this.z   = saved.z   ?? this.z;
    }

    this.dragging  = false;
    this.pointerId = null;
    this.offsetX   = 0;
    this.offsetY   = 0;

    this.el = this.build();
    this.applyTransform();
    this.bind();
  }

  build() {
    const el    = document.createElement('article');
    el.className  = 'bad-fragment';
    el.style.zIndex = String(this.z);

    const halo  = document.createElement('div');
    halo.className = 'bad-fragment__halo';

    const paper = document.createElement('div');
    paper.className = 'bad-fragment__paper';

    el.appendChild(halo);
    el.appendChild(paper);
    surface.appendChild(el);

    const bgScale = rand(1.2, 2.1);
    const bgW = this.w * bgScale;
    const bgH = this.h * bgScale;

    const vars = {
      '--w':   `${this.w}px`,
      '--h':   `${this.h}px`,
      '--img': `url("${this.src}")`,
      '--bgw': `${bgW}px`,
      '--bgh': `${bgH}px`,
      '--bgx': `${rand(-bgW * 0.48, 0).toFixed(1)}px`,
      '--bgy': `${rand(-bgH * 0.48, 0).toFixed(1)}px`,
      ...jaggedPolygon()
    };

    Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));

    return el;
  }

  applyTransform() {
    this.el.style.transform =
      `translate3d(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px, 0) rotate(${this.rot.toFixed(2)}deg)`;
  }

  bind() {
    this.el.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();

      this.dragging  = true;
      this.pointerId = e.pointerId;
      this.el.setPointerCapture(e.pointerId);
      this.el.classList.add('is-dragging');

      /* monter au premier plan */
      this.z = ++topZ;
      this.el.style.zIndex = String(this.z);

      this.offsetX = e.clientX - this.x;
      this.offsetY = e.clientY - this.y;
    });

    this.el.addEventListener('pointermove', e => {
      if (!this.dragging || e.pointerId !== this.pointerId) return;
      e.preventDefault();

      this.x = clamp(e.clientX - this.offsetX, -this.w * 0.35, surfaceW - this.w * 0.65);
      this.y = clamp(e.clientY - this.offsetY, -this.h * 0.35, surfaceH - this.h * 0.65);

      this.applyTransform();
    });

    const endDrag = e => {
      if (e.pointerId !== this.pointerId) return;
      this.dragging  = false;
      this.pointerId = null;
      this.el.classList.remove('is-dragging');
      saveStateSoon();
    };

    this.el.addEventListener('pointerup',     endDrag);
    this.el.addEventListener('pointercancel', endDrag);
  }
}

/* ─── spawn / init ────────────────────────────────────────── */

function spawn() {
  measure();
  const saved = loadState();
  let id = 0;

  BAD_ARCHIVES.forEach(src => {
    for (let i = 0; i < BAD_CONFIG.fragmentsPerImage; i++) {
      fragments.push(new BadFragment({ id, src, saved: saved[id] }));
      id++;
    }
  });
}

function init() {
  if (!surface) return;

  spawn();

  window.addEventListener('resize', () => {
    measure();
    fragments.forEach(f => {
      f.x = clamp(f.x, -f.w * 0.35, surfaceW - f.w * 0.65);
      f.y = clamp(f.y, -f.h * 0.35, surfaceH - f.h * 0.65);
      f.applyTransform();
    });
    saveStateSoon();
  });

  if (resetButton) {
    resetButton.addEventListener('click', clearState);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}