'use strict';

/* ═══════════════════════════════════════════════════════════
   EC@RT — Zone 05 BAD
   Table d’archives vivante · version tablette dense légère
   32 fragments · drag + reset + zoom/pan
   ═══════════════════════════════════════════════════════════ */

const BAD_ARCHIVES = [
  './BAD-img/BAD_01.png', './BAD-img/BAD_02.png',
  './BAD-img/BAD_03.png', './BAD-img/BAD_04.png',
  './BAD-img/BAD_05.png', './BAD-img/BAD_06.png',
  './BAD-img/BAD_07.png', './BAD-img/BAD_08.png',
  './BAD-img/BAD_09.png', './BAD-img/BAD_10.png',
  './BAD-img/BAD_11.png', './BAD-img/BAD_12.png',
  './BAD-img/BAD_13.png', './BAD-img/BAD_14.png',
  './BAD-img/BAD_15.png', './BAD-img/BAD_16.png'
];

const CFG = {
  storageKey:       'ecart_zone05_bad_v5',
  fragmentsPerImg:  2,
  minSize:          90,
  maxSize:          190,
  proximityDist:    115,
  energyDecay:      0.968,
  instabilityDecay: 0.980,
  driftStrength:    0.022,
  breathStrength:   0.004,
  maxLines:         9,
  saveDelay:        200,
  minZoom:          0.5,
  maxZoom:          3.5
};

const surface     = document.getElementById('badArchiveSurface');
const threadsSvg  = document.getElementById('badThreads');
const resetButton = document.getElementById('badReset');

let fragments  = [];
let surfaceW   = 0;
let surfaceH   = 0;
let saveTimer  = null;
let linePool   = [];
let frameCount = 0;

let zoom = 1;
let offsetX = 0;
let offsetY = 0;
let panning = false;
let panStartX = 0;
let panStartY = 0;
let panOX = 0;
let panOY = 0;
let pinchDist = null;

const rand  = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function applyTransform() {
  surface.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
}

function screenToSurface(cx, cy) {
  return {
    x: (cx - offsetX) / zoom,
    y: (cy - offsetY) / zoom
  };
}

function zoomAt(cx, cy, factor) {
  const nz = clamp(zoom * factor, CFG.minZoom, CFG.maxZoom);
  if (nz === zoom) return;

  const p = screenToSurface(cx, cy);

  zoom = nz;
  offsetX = cx - p.x * zoom;
  offsetY = cy - p.y * zoom;

  applyTransform();
}

function measure() {
  const r = surface.getBoundingClientRect();

  surfaceW = r.width || window.innerWidth;
  surfaceH = r.height || window.innerHeight;

  threadsSvg.setAttribute('viewBox', `0 0 ${surfaceW} ${surfaceH}`);
}

function jaggedPolygon() {
  return {
    '--p1x': `${rand(0,6).toFixed(1)}%`,
    '--p1y': `${rand(3,18).toFixed(1)}%`,

    '--p2x': `${rand(12,22).toFixed(1)}%`,
    '--p2y': `${rand(-8,8).toFixed(1)}%`,

    '--p3x': `${rand(30,44).toFixed(1)}%`,
    '--p3y': `${rand(0,13).toFixed(1)}%`,

    '--p4x': `${rand(58,72).toFixed(1)}%`,
    '--p4y': `${rand(-8,10).toFixed(1)}%`,

    '--p5x': `${rand(88,100).toFixed(1)}%`,
    '--p5y': `${rand(8,25).toFixed(1)}%`,

    '--p6x': `${rand(94,104).toFixed(1)}%`,
    '--p6y': `${rand(35,52).toFixed(1)}%`,

    '--p7x': `${rand(86,100).toFixed(1)}%`,
    '--p7y': `${rand(72,96).toFixed(1)}%`,

    '--p8x': `${rand(64,78).toFixed(1)}%`,
    '--p8y': `${rand(88,106).toFixed(1)}%`,

    '--p9x': `${rand(42,54).toFixed(1)}%`,
    '--p9y': `${rand(92,104).toFixed(1)}%`,

    '--p10x': `${rand(18,32).toFixed(1)}%`,
    '--p10y': `${rand(86,102).toFixed(1)}%`,

    '--p11x': `${rand(-4,10).toFixed(1)}%`,
    '--p11y': `${rand(62,82).toFixed(1)}%`,

    '--p12x': `${rand(-6,9).toFixed(1)}%`,
    '--p12y': `${rand(28,48).toFixed(1)}%`
  };
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(CFG.storageKey) || '{}');
  } catch {
    return {};
  }
}

function saveStateSoon() {
  clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    const state = {};

    fragments.forEach(f => {
      state[f.id] = {
        x: Math.round(f.x),
        y: Math.round(f.y),
        rot: +f.rot.toFixed(2),
        energy: +f.energy.toFixed(3),
        instability: +f.instability.toFixed(3),
        age: +f.age.toFixed(2),
        z: f.z
      };
    });

    try {
      localStorage.setItem(CFG.storageKey, JSON.stringify(state));
    } catch {}
  }, CFG.saveDelay);
}

function clearState() {
  try {
    localStorage.removeItem(CFG.storageKey);
  } catch {}

  zoom = 1;
  offsetX = 0;
  offsetY = 0;
  applyTransform();

  fragments.forEach(f => f.el.remove());
  fragments = [];

  linePool.forEach(l => l.remove());
  linePool = [];

  spawn();
}

class BadFragment {
  constructor({ id, src, saved }) {
    this.id  = id;
    this.src = src;

    this.w = rand(CFG.minSize, CFG.maxSize);
    this.h = this.w * rand(0.65, 1.25);

    this.x   = rand(20, Math.max(30, surfaceW - this.w - 20));
    this.y   = rand(20, Math.max(30, surfaceH - this.h - 20));
    this.rot = rand(-22, 22);
    this.z   = Math.floor(rand(2, 24));

    this.energy      = rand(0.04, 0.12);
    this.porosity    = rand(0.35, 1);
    this.instability = rand(0.05, 0.25);
    this.age         = rand(0, 100);
    this.proximity   = 0;
    this.seed        = rand(0, 9999);
    this.phase       = rand(0, Math.PI * 2);
    this.breathSpeed = rand(0.00012, 0.00026);

    this.dragging  = false;
    this.pointerId = null;
    this.offsetX   = 0;
    this.offsetY   = 0;

    if (saved) {
      this.x           = saved.x ?? this.x;
      this.y           = saved.y ?? this.y;
      this.rot         = saved.rot ?? this.rot;
      this.energy      = saved.energy ?? this.energy;
      this.instability = saved.instability ?? this.instability;
      this.age         = saved.age ?? this.age;
      this.z           = saved.z ?? this.z;
    }

    this.el = this._build();
    this._bind();
  }

  _build() {
    const el = document.createElement('article');

    el.className = 'bad-fragment';
    el.style.zIndex = String(this.z);
    el.style.willChange = 'transform';

    el.appendChild(
      Object.assign(document.createElement('div'), {
        className: 'bad-fragment__halo'
      })
    );

    el.appendChild(
      Object.assign(document.createElement('div'), {
        className: 'bad-fragment__paper'
      })
    );

    surface.appendChild(el);

    const bgScale = rand(1.2, 2.0);
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

    Object.entries(vars).forEach(([k, v]) => {
      el.style.setProperty(k, v);
    });

    return el;
  }

  _bind() {
    this.el.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();

      this.dragging  = true;
      this.pointerId = e.pointerId;

      this.el.setPointerCapture(e.pointerId);

      const p = screenToSurface(e.clientX, e.clientY);

      this.offsetX = p.x - this.x;
      this.offsetY = p.y - this.y;

      this.energy      = 1;
      this.instability = clamp(this.instability + 0.18, 0, 1);

      this.z = 80;
      this.el.style.zIndex = '80';
      this.el.classList.add('is-dragging');
    });

    this.el.addEventListener('pointermove', e => {
      if (!this.dragging || e.pointerId !== this.pointerId) return;

      const p = screenToSurface(e.clientX, e.clientY);

      this.x = clamp(
        p.x - this.offsetX,
        -this.w * 0.35,
        surfaceW - this.w * 0.65
      );

      this.y = clamp(
        p.y - this.offsetY,
        -this.h * 0.35,
        surfaceH - this.h * 0.65
      );

      this.energy      = clamp(this.energy + 0.016, 0, 1);
      this.instability = clamp(this.instability + 0.007, 0, 1);
    });

    const endDrag = e => {
      if (e.pointerId !== this.pointerId) return;

      this.dragging  = false;
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
      this.energy      *= CFG.energyDecay;
      this.instability *= CFG.instabilityDecay;

      this.x += Math.sin(now * 0.00008 + this.seed) * CFG.driftStrength * this.instability;
      this.y += Math.cos(now * 0.00007 + this.seed) * CFG.driftStrength * this.instability;
    }

    const breath = Math.sin(now * this.breathSpeed + this.phase);
    const slow   = Math.sin(now * 0.00016 + this.seed);

    const scale = 1 + breath * CFG.breathStrength * this.porosity;
    const rot   = this.rot + slow * 1.1 * this.instability + this.energy * 3;

    const dx = Math.sin(now * 0.00009 + this.seed) * this.porosity * 1.0;
    const dy = Math.cos(now * 0.00008 + this.seed) * this.porosity * 1.0;

    const opa = clamp(
      0.84 + breath * 0.022 + this.proximity * 0.07,
      0.68,
      0.96
    );

    const halo = clamp(
      this.energy * 0.50 + this.proximity * 0.20,
      0,
      0.55
    );

    this.el.style.transform =
      `translate3d(${(this.x + dx).toFixed(1)}px, ${(this.y + dy).toFixed(1)}px, 0) ` +
      `rotate(${rot.toFixed(1)}deg) scale(${scale.toFixed(3)})`;

    this.el.style.opacity = opa.toFixed(2);
    this.el.style.setProperty('--halo', halo.toFixed(2));
  }
}

function getLine(i) {
  if (!linePool[i]) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');

    l.setAttribute('stroke-linecap', 'round');

    threadsSvg.appendChild(l);
    linePool[i] = l;
  }

  return linePool[i];
}

function updateProximity() {
  fragments.forEach(f => {
    f.proximity *= 0.80;
  });

  let li = 0;
  const dist2 = CFG.proximityDist * CFG.proximityDist;

  for (let i = 0; i < fragments.length; i++) {
    const a = fragments[i];

    for (let j = i + 1; j < fragments.length; j++) {
      const b = fragments[j];

      const dx = b.centerX() - a.centerX();
      const dy = b.centerY() - a.centerY();

      const d2 = dx * dx + dy * dy;

      if (d2 < dist2 && li < CFG.maxLines) {
        const force = 1 - Math.sqrt(d2) / CFG.proximityDist;

        a.proximity = Math.max(a.proximity, force);
        b.proximity = Math.max(b.proximity, force);

        if (!a.dragging) a.energy = clamp(a.energy + force * 0.0012, 0, 1);
        if (!b.dragging) b.energy = clamp(b.energy + force * 0.0012, 0, 1);

        const ln = getLine(li++);

        ln.setAttribute('x1', a.centerX().toFixed(0));
        ln.setAttribute('y1', a.centerY().toFixed(0));
        ln.setAttribute('x2', b.centerX().toFixed(0));
        ln.setAttribute('y2', b.centerY().toFixed(0));

        ln.setAttribute(
          'stroke',
          `rgba(255,175,90,${(force * 0.22).toFixed(2)})`
        );

        ln.setAttribute(
          'stroke-width',
          (0.25 + force * 0.60).toFixed(2)
        );

        ln.style.display = '';
      }
    }
  }

  for (let i = li; i < linePool.length; i++) {
    linePool[i].style.display = 'none';
  }
}

function spawn() {
  measure();

  const saved = loadState();
  let id = 0;

  BAD_ARCHIVES.forEach(src => {
    for (let i = 0; i < CFG.fragmentsPerImg; i++) {
      fragments.push(
        new BadFragment({
          id,
          src,
          saved: saved[id]
        })
      );

      id++;
    }
  });
}

function tick(now) {
  if (frameCount % 2 === 0) {
    updateProximity();
  }

  fragments.forEach(f => f.update(now));

  frameCount++;

  requestAnimationFrame(tick);
}

const UI_SELECTORS = [
  '.sidebar',
  '#badReset',
  '#soundToggle',
  '#infoToggle',
  '#mobileMapToggle',
  '#soundPanel',
  '#infoPanel',
  '#mobileMapOverlay'
];

function isUI(target) {
  return UI_SELECTORS.some(s => target.closest(s));
}

function bindNavigation() {
  window.addEventListener(
    'wheel',
    e => {
      if (isUI(e.target)) return;

      e.preventDefault();

      zoomAt(
        e.clientX,
        e.clientY,
        e.deltaY < 0 ? 1.08 : 0.92
      );
    },
    { passive: false }
  );

  surface.addEventListener('pointerdown', e => {
    if (
      e.target.closest('.bad-fragment') ||
      e.target.closest('button') ||
      e.target.closest('a')
    ) {
      return;
    }

    e.preventDefault();

    panning = true;

    panStartX = e.clientX;
    panStartY = e.clientY;

    panOX = offsetX;
    panOY = offsetY;
  });

  window.addEventListener('pointermove', e => {
    if (!panning) return;

    offsetX = panOX + (e.clientX - panStartX);
    offsetY = panOY + (e.clientY - panStartY);

    applyTransform();
  });

  window.addEventListener('pointerup', () => {
    panning = false;
  });

  window.addEventListener('pointercancel', () => {
    panning = false;
  });

  surface.addEventListener(
    'touchmove',
    e => {
      if (e.touches.length !== 2) return;

      e.preventDefault();

      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;

      const dist = Math.sqrt(dx * dx + dy * dy);

      if (pinchDist !== null) {
        const cx = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;

        zoomAt(cx, cy, dist / pinchDist);
      }

      pinchDist = dist;
    },
    { passive: false }
  );

  surface.addEventListener('touchend', () => {
    pinchDist = null;
  });

  surface.addEventListener('touchcancel', () => {
    pinchDist = null;
  });

  applyTransform();
}

function init() {
  if (!surface || !threadsSvg) return;

  spawn();
  bindNavigation();

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

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();