'use strict';

/* ═══════════════════════════════════════════════════════════
   EC@RT — Zone 05 BAD
   Table d’archives vivante — version optimisée anti-lag
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
  storageKey: 'ecart_zone05_bad_archive_surface_v2',

  fragmentsPerImage: 3,
  minSize: 120,
  maxSize: 280,

  proximityDistance: 135,
  energyDecay: 0.972,
  instabilityDecay: 0.985,

  driftStrength: 0.035,
  breathStrength: 0.006,

  maxVisibleLines: 14,
  saveDebounceMs: 160
};

const surface = document.getElementById('badArchiveSurface');
const threadsSvg = document.getElementById('badThreads');
const resetButton = document.getElementById('badReset');

let fragments = [];
let surfaceW = 0;
let surfaceH = 0;
let saveTimer = null;
let linePool = [];

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function measure() {
  if (!surface || !threadsSvg) return;

  const r = surface.getBoundingClientRect();
  surfaceW = r.width || window.innerWidth;
  surfaceH = r.height || window.innerHeight;

  threadsSvg.setAttribute('viewBox', `0 0 ${surfaceW} ${surfaceH}`);
}

function jaggedPolygon() {
  return {
    '--p1x': `${rand(0, 6).toFixed(2)}%`,
    '--p1y': `${rand(3, 18).toFixed(2)}%`,

    '--p2x': `${rand(12, 22).toFixed(2)}%`,
    '--p2y': `${rand(-8, 8).toFixed(2)}%`,

    '--p3x': `${rand(30, 44).toFixed(2)}%`,
    '--p3y': `${rand(0, 13).toFixed(2)}%`,

    '--p4x': `${rand(58, 72).toFixed(2)}%`,
    '--p4y': `${rand(-8, 10).toFixed(2)}%`,

    '--p5x': `${rand(88, 100).toFixed(2)}%`,
    '--p5y': `${rand(8, 25).toFixed(2)}%`,

    '--p6x': `${rand(94, 104).toFixed(2)}%`,
    '--p6y': `${rand(35, 52).toFixed(2)}%`,

    '--p7x': `${rand(86, 100).toFixed(2)}%`,
    '--p7y': `${rand(72, 96).toFixed(2)}%`,

    '--p8x': `${rand(64, 78).toFixed(2)}%`,
    '--p8y': `${rand(88, 106).toFixed(2)}%`,

    '--p9x': `${rand(42, 54).toFixed(2)}%`,
    '--p9y': `${rand(92, 104).toFixed(2)}%`,

    '--p10x': `${rand(18, 32).toFixed(2)}%`,
    '--p10y': `${rand(86, 102).toFixed(2)}%`,

    '--p11x': `${rand(-4, 10).toFixed(2)}%`,
    '--p11y': `${rand(62, 82).toFixed(2)}%`,

    '--p12x': `${rand(-6, 9).toFixed(2)}%`,
    '--p12y': `${rand(28, 48).toFixed(2)}%`
  };
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(BAD_CONFIG.storageKey) || '{}');
  } catch (_) {
    return {};
  }
}

function saveStateSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, BAD_CONFIG.saveDebounceMs);
}

function saveState() {
  const state = {};

  fragments.forEach(f => {
    state[f.id] = {
      x: Math.round(f.x),
      y: Math.round(f.y),
      rot: Number(f.rot.toFixed(2)),
      energy: Number(f.energy.toFixed(3)),
      instability: Number(f.instability.toFixed(3)),
      age: Number(f.age.toFixed(2)),
      z: f.z
    };
  });

  try {
    localStorage.setItem(BAD_CONFIG.storageKey, JSON.stringify(state));
  } catch (_) {}
}

function clearState() {
  try {
    localStorage.removeItem(BAD_CONFIG.storageKey);
  } catch (_) {}

  fragments.forEach(f => f.destroy());
  fragments = [];

  linePool.forEach(l => l.remove());
  linePool = [];

  spawn();
}

class BadFragment {
  constructor({ id, src, saved }) {
    this.id = id;
    this.src = src;

    this.w = rand(BAD_CONFIG.minSize, BAD_CONFIG.maxSize);
    this.h = this.w * rand(0.65, 1.25);

    this.x = rand(20, Math.max(30, surfaceW - this.w - 20));
    this.y = rand(20, Math.max(30, surfaceH - this.h - 20));
    this.rot = rand(-24, 24);
    this.z = Math.floor(rand(2, 24));

    this.energy = rand(0.04, 0.14);
    this.porosity = rand(0.35, 1);
    this.instability = rand(0.05, 0.28);
    this.age = rand(0, 100);
    this.proximity = 0;

    this.seed = rand(0, 9999);
    this.phase = rand(0, Math.PI * 2);
    this.breathSpeed = rand(0.00012, 0.00028);

    this.dragging = false;
    this.pointerId = null;
    this.offsetX = 0;
    this.offsetY = 0;

    if (saved) {
      this.x = saved.x ?? this.x;
      this.y = saved.y ?? this.y;
      this.rot = saved.rot ?? this.rot;
      this.energy = saved.energy ?? this.energy;
      this.instability = saved.instability ?? this.instability;
      this.age = saved.age ?? this.age;
      this.z = saved.z ?? this.z;
    }

    this.el = this.build();
    this.bind();
  }

  build() {
    const el = document.createElement('article');
    el.className = 'bad-fragment';
    el.style.zIndex = String(this.z);

    const halo = document.createElement('div');
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
      '--w': `${this.w}px`,
      '--h': `${this.h}px`,
      '--img': `url("${this.src}")`,
      '--bgw': `${bgW}px`,
      '--bgh': `${bgH}px`,
      '--bgx': `${rand(-bgW * 0.48, 0).toFixed(1)}px`,
      '--bgy': `${rand(-bgH * 0.48, 0).toFixed(1)}px`,
      ...jaggedPolygon()
    };

    Object.entries(vars).forEach(([key, value]) => {
      el.style.setProperty(key, value);
    });

    return el;
  }

  bind() {
    this.el.addEventListener('pointerdown', e => {
      e.preventDefault();

      this.dragging = true;
      this.pointerId = e.pointerId;
      this.el.setPointerCapture(e.pointerId);

      const r = surface.getBoundingClientRect();
      this.offsetX = e.clientX - r.left - this.x;
      this.offsetY = e.clientY - r.top - this.y;

      this.energy = 1;
      this.instability = clamp(this.instability + 0.18, 0, 1);

      this.z = 80;
      this.el.style.zIndex = String(this.z);
      this.el.classList.add('is-dragging');
    });

    this.el.addEventListener('pointermove', e => {
      if (!this.dragging || e.pointerId !== this.pointerId) return;

      const r = surface.getBoundingClientRect();

      this.x = clamp(
        e.clientX - r.left - this.offsetX,
        -this.w * 0.35,
        surfaceW - this.w * 0.65
      );

      this.y = clamp(
        e.clientY - r.top - this.offsetY,
        -this.h * 0.35,
        surfaceH - this.h * 0.65
      );

      this.energy = clamp(this.energy + 0.018, 0, 1);
      this.instability = clamp(this.instability + 0.008, 0, 1);
    });

    const endDrag = e => {
      if (e.pointerId !== this.pointerId) return;

      this.dragging = false;
      this.pointerId = null;

      this.z = Math.floor(rand(12, 38));
      this.el.style.zIndex = String(this.z);
      this.el.classList.remove('is-dragging');

      saveStateSoon();
    };

    this.el.addEventListener('pointerup', endDrag);
    this.el.addEventListener('pointercancel', endDrag);
  }

  centerX() {
    return this.x + this.w * 0.5;
  }

  centerY() {
    return this.y + this.h * 0.5;
  }

  update(now) {
    this.age += 0.003;

    if (!this.dragging) {
      this.energy *= BAD_CONFIG.energyDecay;
      this.instability *= BAD_CONFIG.instabilityDecay;

      this.x += Math.sin(now * 0.00008 + this.seed) * BAD_CONFIG.driftStrength * this.instability;
      this.y += Math.cos(now * 0.00007 + this.seed) * BAD_CONFIG.driftStrength * this.instability;
    }

    const breath = Math.sin(now * this.breathSpeed + this.phase);
    const slow = Math.sin(now * 0.00016 + this.seed);

    const scale = 1 + breath * BAD_CONFIG.breathStrength * this.porosity;
    const rot = this.rot + slow * 1.2 * this.instability + this.energy * 3.2;

    const dx = Math.sin(now * 0.00009 + this.seed) * this.porosity * 1.2;
    const dy = Math.cos(now * 0.00008 + this.seed) * this.porosity * 1.2;

    const opacity = clamp(
      0.84 + breath * 0.025 + this.proximity * 0.08,
      0.68,
      0.96
    );

    const halo = clamp(
      this.energy * 0.55 + this.proximity * 0.22,
      0,
      0.55
    );

    this.el.style.transform =
      `translate3d(${(this.x + dx).toFixed(2)}px, ${(this.y + dy).toFixed(2)}px, 0)
       rotate(${rot.toFixed(2)}deg)
       scale(${scale.toFixed(4)})`;

    this.el.style.opacity = opacity.toFixed(3);
    this.el.style.setProperty('--halo', halo.toFixed(3));
  }

  destroy() {
    this.el.remove();
  }
}

function getLine(index) {
  if (!linePool[index]) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke-linecap', 'round');
    threadsSvg.appendChild(line);
    linePool[index] = line;
  }

  return linePool[index];
}

function updateProximity() {
  fragments.forEach(f => {
    f.proximity *= 0.82;
  });

  let lineIndex = 0;

  for (let i = 0; i < fragments.length; i++) {
    const a = fragments[i];

    for (let j = i + 1; j < fragments.length; j++) {
      const b = fragments[j];

      const dx = b.centerX() - a.centerX();
      const dy = b.centerY() - a.centerY();
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (
        dist < BAD_CONFIG.proximityDistance &&
        lineIndex < BAD_CONFIG.maxVisibleLines
      ) {
        const force = 1 - dist / BAD_CONFIG.proximityDistance;

        a.proximity = Math.max(a.proximity, force);
        b.proximity = Math.max(b.proximity, force);

        if (!a.dragging) a.energy = clamp(a.energy + force * 0.0015, 0, 1);
        if (!b.dragging) b.energy = clamp(b.energy + force * 0.0015, 0, 1);

        const line = getLine(lineIndex++);
        line.setAttribute('x1', a.centerX().toFixed(1));
        line.setAttribute('y1', a.centerY().toFixed(1));
        line.setAttribute('x2', b.centerX().toFixed(1));
        line.setAttribute('y2', b.centerY().toFixed(1));
        line.setAttribute(
          'stroke',
          `rgba(255, 175, 90, ${(force * 0.24).toFixed(3)})`
        );
        line.setAttribute('stroke-width', (0.25 + force * 0.65).toFixed(2));
        line.style.display = '';
      }
    }
  }

  for (let i = lineIndex; i < linePool.length; i++) {
    linePool[i].style.display = 'none';
  }
}

function spawn() {
  measure();

  const saved = loadState();
  let id = 0;

  BAD_ARCHIVES.forEach(src => {
    for (let i = 0; i < BAD_CONFIG.fragmentsPerImage; i++) {
      const fragment = new BadFragment({
        id,
        src,
        saved: saved[id]
      });

      fragments.push(fragment);
      id++;
    }
  });
}

function tick(now) {
  updateProximity();
  fragments.forEach(f => f.update(now));
  requestAnimationFrame(tick);
}

function init() {
  if (!surface || !threadsSvg) return;

  spawn();

  window.addEventListener('resize', () => {
    measure();

    fragments.forEach(f => {
      f.x = clamp(f.x, -f.w * 0.35, surfaceW - f.w * 0.65);
      f.y = clamp(f.y, -f.h * 0.35, surfaceH - f.h * 0.65);
    });

    saveStateSoon();
  });

  if (resetButton) {
    resetButton.addEventListener('click', clearState);
  }

  requestAnimationFrame(tick);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}