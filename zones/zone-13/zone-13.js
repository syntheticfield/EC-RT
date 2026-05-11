/**
 * EC@RT — Zone 13 : Search & Destroy
 */

import { Zone13Audio }          from './zone-13-audio.js';
import { Zone13AnalyserData }   from './zone-13-analyser.js';
import { Zone13GlitchRenderer } from './zone-13-glitch.js';

/* ─── CONFIG ──────────────────────────────────────── */

const AUDIO_SOURCES = [
  './audio/SD_01.wav', './audio/SD_02.wav',
  './audio/SD_03.wav', './audio/SD_04.wav'
];

const IMAGE_SOURCES = [
  './images/SND_01.jpeg', './images/SND_02.jpeg',
  './images/SND_03.jpeg', './images/SND_04.jpeg',
  './images/SND_05.jpeg', './images/SND_06.jpeg',
  './images/SND_07.jpeg', './images/SND_08.jpeg'
];

const CHAOS_SELECTORS = [
  '.zone13-archive', '.z13-cross',
  '.zone-link', '.zone-identity-title', '.zone-identity-desc'
];

const CHAOS_NEVER = [
  '#infoPanel', '#mobileMapOverlay', '#soundPanel',
  '[data-chaos-exclude]'
];

/* ─── STATE ───────────────────────────────────────── */

const STATE_KEY = 'ecart_zone13_state';
function getState()    {
  try { return JSON.parse(localStorage.getItem(STATE_KEY)) || { visits: 0 }; }
  catch { return { visits: 0 }; }
}
function saveState(s)  {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch {}
}

/* ─── HEALTH SYSTEM ───────────────────────────────── */

/*
  healthMap : WeakMap<HTMLElement, { hp, bar, overlay, baseMass }>
  hp : 0–100
  Sources de dégâts :
    — audio (tick)    : amplitude * 0.14  +  transient * 0.20  par frame
    — pointerdown     : −10 HP
    — drag (move)     : −0.04 HP / frame
*/

const healthMap = new WeakMap();

function injectHealthUI(wrap) {
  /* Barre de vie */
  const hWrap = document.createElement('div');
  hWrap.className = 'z13-health-wrap';
  const hBar = document.createElement('div');
  hBar.className = 'z13-health-bar';
  hWrap.appendChild(hBar);
  wrap.appendChild(hWrap);

  /* Overlay de mort */
  const overlay = document.createElement('div');
  overlay.className = 'z13-death-overlay';
  overlay.setAttribute('data-chaos-exclude', '');
  overlay.innerHTML =
    '<div class="z13-dead-cross" aria-hidden="true"></div>' +
    '<span class="z13-restore-label">RESTAURER L\'ARCHIVE</span>';
  wrap.appendChild(overlay);

  /* HP de départ aléatoire — scale viable 18–78 */
  const initHp = Math.floor(18 + Math.random() * 60);
  const state  = { hp: initHp, bar: hBar, overlay, baseMass: null };
  healthMap.set(wrap, state);
  updateHealthBar(state); /* afficher la barre dès l'injection */

  overlay.addEventListener('click', e => {
    e.stopPropagation();
    restoreArchive(wrap, state);
  });

  return state;
}

function updateHealthBar(state) {
  const pct = state.hp / 100;
  state.bar.style.transform = `scaleX(${pct.toFixed(4)})`;
  state.bar.classList.toggle('is-critic', state.hp < 25);
  state.bar.classList.toggle('is-low',    state.hp >= 25 && state.hp < 55);
}

function damageArchive(el, state, amount) {
  if (state.hp <= 0) return;
  state.hp = Math.max(0, state.hp - amount);
  updateHealthBar(state);
  if (state.hp <= 0) killArchive(el, state);
}

function killArchive(el, state) {
  /* Visuel : image très sombre */
  const img = el.querySelector('img');
  if (img) img.style.filter = 'grayscale(1) brightness(0.22)';

  /* Geler la particule chaos */
  const p = chaos.particles.find(q => q.el === el);
  if (p) {
    state.baseMass = p.mass;
    p.mass = 99;        /* quasiment immobile sous les forces */
    p.vx = p.vy = 0;
  }

  state.overlay.classList.add('is-dead');
}

function restoreArchive(el, state) {
  state.hp = 100;
  updateHealthBar(state);

  /* Retirer l'overlay */
  state.overlay.classList.remove('is-dead');

  /* Image normale */
  const img = el.querySelector('img');
  if (img) img.style.filter = '';

  /* Remettre la particule en mouvement */
  const p = chaos.particles.find(q => q.el === el);
  if (p) {
    p.mass = state.baseMass ?? 5;
    p.vx   = (Math.random() - 0.5) * 6;
    p.vy   = (Math.random() - 0.5) * 6;
  }
}

/* ─── PARTICLE ────────────────────────────────────── */

class Particle {
  constructor(el) {
    const r    = el.getBoundingClientRect();
    this.el    = el;
    this.w     = Math.max(r.width,  16);
    this.h     = Math.max(r.height, 16);
    this.ox    = r.left + r.width  / 2;
    this.oy    = r.top  + r.height / 2;
    this.x     = this.ox;
    this.y     = this.oy;
    this.vx    = (Math.random() - 0.5) * 4;
    this.vy    = (Math.random() - 0.5) * 4;
    this.rot   = 0;
    this.vrot  = 0;
    this.phase = Math.random() * Math.PI * 2;

    this.dragging = false;
    this._dragOx = this._dragOy = this._dragVx = this._dragVy = this._dragPx = this._dragPy = 0;

    if      (el.classList.contains('zone13-archive')) this.mass = 5;
    else if (el.classList.contains('z13-cross'))      this.mass = 0.4;
    else if (el.tagName === 'IMG')                    this.mass = 3.5;
    else if (el.classList.contains('zone-link'))      this.mass = 1.2;
    else this.mass = Math.max(0.6, Math.min(4, (this.w * this.h) / 4000));

    el.dataset.chaosControlled = '1';
    this._saved = {};
    ['position','left','top','width','margin','transform','transition',
     'zIndex','pointerEvents','willChange','cursor']
      .forEach(p => { this._saved[p] = el.style[p]; });
  }

  pin() {
    const r = this.el.getBoundingClientRect();
    const s = this.el.style;
    s.position = 'fixed'; s.left = `${r.left}px`; s.top = `${r.top}px`;
    s.width = `${r.width}px`; s.margin = '0'; s.transition = 'none';
    s.zIndex = '800'; s.pointerEvents = 'auto';
    s.willChange = 'transform'; s.cursor = 'grab'; s.transform = '';
  }

  sync() {
    const dx = this.x - this.ox, dy = this.y - this.oy;
    const r  = Math.max(-24, Math.min(24, this.rot));
    this.el.style.transform =
      `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) rotate(${r.toFixed(2)}deg)`;
  }

  springBack(cb) {
    const s = this.el.style;
    s.transition = 'transform 0.9s cubic-bezier(0.22,1,0.36,1)';
    s.transform  = 'translate(0px,0px) rotate(0deg)';
    setTimeout(() => { this.restore(); cb?.(); }, 950);
  }

  restore() {
    delete this.el.dataset.chaosControlled;
    Object.entries(this._saved).forEach(([k, v]) => { this.el.style[k] = v; });
  }
}

/* ─── CHAOS ENGINE ────────────────────────────────── */

class ChaosEngine {
  constructor() {
    this.particles   = [];
    this.active      = false;
    this.mode        = 'THERMAL';
    this.temperature = 0;
    this.tick        = 0;
    this.mouse       = { x: -999, y: -999 };
    this._rafId      = null;
    this._observer   = null;
    this._mmov   = e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; };
    this._mleave = ()  => { this.mouse.x = -999; this.mouse.y = -999; };
  }

  _collect() {
    const excluded = new Set();
    CHAOS_NEVER.forEach(s => document.querySelectorAll(s).forEach(el => excluded.add(el)));
    const isExcluded = el => excluded.has(el) || CHAOS_NEVER.some(s => el.closest(s));
    const seen = new Set(), out = [];
    CHAOS_SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (seen.has(el) || isExcluded(el)) return;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { seen.add(el); out.push(el); }
      });
    });
    return out;
  }

  addElement(el) {
    if (!this.active || el.dataset.chaosControlled) return;
    requestAnimationFrame(() => {
      if (el.getBoundingClientRect().width === 0) return;
      const p = new Particle(el);
      p.pin();
      p.vx = (Math.random() - 0.5) * 6;
      p.vy = (Math.random() - 0.5) * 6;
      this.particles.push(p);
    });
  }

  activate() {
    if (this.active) return;
    this.active = true;
    this.temperature = 0.52;
    document.body.classList.add('ec-chaos-on');
    this.particles = this._collect().map(el => {
      const p = new Particle(el);
      p.pin();
      p.vx = (Math.random() - 0.5) * 5;
      p.vy = (Math.random() - 0.5) * 5;
      return p;
    });
    const field = document.getElementById('zone13ImageField');
    if (field) {
      this._observer = new MutationObserver(mutations =>
        mutations.forEach(m => m.addedNodes.forEach(node => {
          if (node.nodeType === 1) this.addElement(node);
        }))
      );
      this._observer.observe(field, { childList: true });
    }
    document.addEventListener('mousemove',  this._mmov);
    document.addEventListener('mouseleave', this._mleave);
    this._loop();
  }

  setMode(m) { this.mode = m; }

  audioBurst(amplitude) {
    if (!this.active) return;
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    this.particles.forEach(p => {
      if (p.dragging) return;
      const dx = p.x - cx, dy = p.y - cy, d = Math.sqrt(dx*dx+dy*dy) || 1;
      const f  = (9 + amplitude * 20) / p.mass;
      p.vx += (dx/d)*f; p.vy += (dy/d)*f;
    });
    this.temperature = Math.min(1, this.temperature + amplitude * 0.3);
  }

  heatAt(x, y, s) {
    if (!this.active) return;
    this.temperature = Math.min(1, this.temperature + s);
    this.particles.forEach(p => {
      if (p.dragging) return;
      const dx = p.x-x, dy = p.y-y, d = Math.sqrt(dx*dx+dy*dy) || 1;
      if (d < 200) { const f=(s*140)/(d*p.mass); p.vx+=(dx/d)*f; p.vy+=(dy/d)*f; }
    });
  }

  startDrag(el, cx, cy) {
    const p = this.particles.find(q => q.el === el);
    if (!p) return;
    p.dragging = true;
    p._dragOx = cx - p.x; p._dragOy = cy - p.y;
    p._dragPx = cx; p._dragPy = cy;
    p._dragVx = p._dragVy = p.vx = p.vy = p.vrot = 0;
    el.style.zIndex = '950'; el.style.cursor = 'grabbing'; el.style.transition = 'none';
  }

  moveDrag(el, cx, cy) {
    const p = this.particles.find(q => q.el === el);
    if (!p?.dragging) return;
    p._dragVx = cx - p._dragPx; p._dragVy = cy - p._dragPy;
    p._dragPx = cx; p._dragPy = cy;
    p.x = cx - p._dragOx; p.y = cy - p._dragOy;

    /* Dégâts de déplacement */
    const dist = Math.sqrt(p._dragVx**2 + p._dragVy**2);
    if (dist > 0.5) {
      const hState = healthMap.get(el);
      if (hState) damageArchive(el, hState, 0.04 + dist * 0.002);
    }
  }

  endDrag(el) {
    const p = this.particles.find(q => q.el === el);
    if (!p?.dragging) return;
    p.dragging = false;
    p.vx = p._dragVx * 0.55; p.vy = p._dragVy * 0.55;
    el.style.zIndex = '800'; el.style.cursor = 'grab';
  }

  _loop() {
    if (!this.active) return;
    this._rafId = requestAnimationFrame(() => this._loop());
    this.tick += 0.016;
    this.temperature *= 0.9993;
    const W = window.innerWidth, H = window.innerHeight;

    this.particles.forEach((p, i) => {
      if (p.dragging) { p.sync(); return; }

      let fx = 0, fy = 0;
      const sk = (1 - this.temperature) * 0.036;
      fx += (p.ox - p.x) * sk;
      fy += (p.oy - p.y) * sk;

      if (this.mode !== 'RESONANCE') {
        const na = this.temperature * 3.0;
        fx += Math.sin(this.tick*0.62+p.phase) * Math.cos(this.tick*0.41+p.phase*0.7) * na;
        fy += Math.cos(this.tick*0.55+p.phase*1.3) * Math.sin(this.tick*0.37+p.phase*0.5) * na;
      }

      this.particles.forEach((q, j) => {
        if (i >= j) return;
        const dx=p.x-q.x, dy=p.y-q.y, d2=dx*dx+dy*dy;
        const md=(Math.max(p.w,p.h)+Math.max(q.w,q.h))*0.5;
        if (d2<md*md && d2>0.01) {
          const d=Math.sqrt(d2), f=Math.min(10,(md*md)/(d2*p.mass));
          fx+=(dx/d)*f; fy+=(dy/d)*f;
          const fq=Math.min(10,(md*md)/(d2*q.mass));
          q.vx-=(dx/d)*fq*0.5; q.vy-=(dy/d)*fq*0.5;
        }
      });

      const cdx=p.x-this.mouse.x, cdy=p.y-this.mouse.y, cd2=cdx*cdx+cdy*cdy;
      const cr=110+this.temperature*60;
      if (cd2<cr*cr && cd2>0.1) {
        const cd=Math.sqrt(cd2), cf=Math.min(16,8000/(cd2*p.mass));
        fx+=(cdx/cd)*cf; fy+=(cdy/cd)*cf;
      }

      if (this.mode==='ORBITAL') {
        const dx=p.x-W/2, dy=p.y-H/2, d=Math.sqrt(dx*dx+dy*dy)||1;
        const tr=80+(i%7)*62, rf=(tr-d)*0.02, tf=0.75*this.temperature;
        fx+=(dx/d)*rf+(-dy/d)*tf; fy+=(dy/d)*rf+(dx/d)*tf;
      }
      if (this.mode==='FLUVIAL') {
        fx+=2.0*this.temperature;
        fy+=Math.sin(this.tick*0.46+p.phase)*1.2*this.temperature;
        if (p.x>W+p.w*0.5) { p.x=-p.w*0.5; p.vx*=0.2; }
      }
      if (this.mode==='RESONANCE') { p.vx*=0.93; p.vy*=0.93; }

      const bx=p.w/2+6, by=p.h/2+6;
      if (p.x<bx)   fx+=(bx-p.x)*0.42;
      if (p.x>W-bx) fx-=(p.x-(W-bx))*0.42;
      if (p.y<by)   fy+=(by-p.y)*0.42;
      if (p.y>H-by) fy-=(p.y-(H-by))*0.42;

      const damp = this.mode==='RESONANCE' ? 0.91 : 0.882;
      p.vx = (p.vx+fx/p.mass)*damp;
      p.vy = (p.vy+fy/p.mass)*damp;
      const tr = p.vx*1.5;
      p.vrot = (p.vrot+(tr-p.rot)*0.13)*0.87;
      p.rot  = Math.max(-24, Math.min(24, p.rot+p.vrot));
      p.x += p.vx; p.y += p.vy;
      p.sync();
    });
  }
}

const chaos = new ChaosEngine();
document.addEventListener('click', e => chaos.heatAt(e.clientX, e.clientY, 0.08));

/* ─── DRAG ────────────────────────────────────────── */

function bindDrag() {
  let activeEl = null, activePtr = null;

  document.addEventListener('pointerdown', e => {
    /* Ignorer les clics sur l'overlay de restauration */
    if (e.target.closest('.z13-death-overlay')) return;

    const archive = e.target.closest('.zone13-archive');
    if (!archive) return;
    e.preventDefault(); e.stopPropagation();

    /* Dégâts de contact */
    const hState = healthMap.get(archive);
    if (hState) damageArchive(archive, hState, 10);

    activeEl = archive; activePtr = e.pointerId;
    archive.setPointerCapture(e.pointerId);
    chaos.startDrag(archive, e.clientX, e.clientY);
  });

  document.addEventListener('pointermove', e => {
    if (!activeEl || e.pointerId !== activePtr) return;
    chaos.moveDrag(activeEl, e.clientX, e.clientY);
  });

  const endDrag = e => {
    if (!activeEl || e.pointerId !== activePtr) return;
    chaos.endDrag(activeEl);
    activeEl = activePtr = null;
  };

  document.addEventListener('pointerup',     endDrag);
  document.addEventListener('pointercancel', endDrag);
}

/* ─── AUDIO / TICK ────────────────────────────────── */

let engine = null, analyserData = null, glitch = null;
let transmitting = false, rafId = null;
let lastMode = null, modeCooldown = 0;
const MODE_FRAMES = 45;
const rand = (a, b) => a + Math.random() * (b - a);

function modeFromAudio({ amplitude, bass, transient }) {
  if (transient > 0.65 || amplitude > 0.50) return 'RESONANCE';
  if (amplitude > 0.32 || bass > 0.28)      return 'FLUVIAL';
  if (amplitude > 0.15)                      return 'ORBITAL';
  return 'THERMAL';
}

function tick() {
  if (!transmitting) return;
  const raw = analyserData.update();
  glitch.render(raw);

  /* Burst chaos */
  if (raw.amplitude > 0.04 || raw.transient > 0.2)
    chaos.audioBurst(raw.amplitude * 0.75 + raw.transient * 0.45);

  /* Dégâts audio sur toutes les archives vivantes */
  if (raw.amplitude > 0.05 || raw.transient > 0.12) {
    const dmg = raw.amplitude * 0.14 + raw.transient * 0.20;
    chaos.particles.forEach(p => {
      if (!p.el.classList.contains('zone13-archive')) return;
      const hState = healthMap.get(p.el);
      if (hState) damageArchive(p.el, hState, dmg);
    });
  }

  /* Mode chaos */
  if (--modeCooldown <= 0) {
    const m = modeFromAudio(raw);
    if (m !== lastMode) { chaos.setMode(m); lastMode = m; modeCooldown = MODE_FRAMES; }
  }

  rafId = requestAnimationFrame(tick);
}

/* ─── IMAGES ──────────────────────────────────────── */

function loadImages() {
  const field = document.getElementById('zone13ImageField');
  if (!field) return [];
  const wrappers = [];
  IMAGE_SOURCES.forEach((src, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'zone13-archive';
    Object.assign(wrap.style, {
      width:     `${Math.round(rand(180, 320))}px`,
      height:    `${Math.round(rand(180, 320) * rand(0.68, 1.30))}px`,
      left:      `${rand(2, 70).toFixed(1)}%`,
      top:       `${rand(4, 68).toFixed(1)}%`,
      transform: `rotate(${rand(-14, 14).toFixed(1)}deg)`,
      zIndex:    String(Math.floor(rand(1, 8)) + i),
      opacity:   rand(0.72, 0.96).toFixed(2)
    });
    const img = document.createElement('img');
    img.src = src; img.className = 'zone13-floating-image';
    img.alt = ''; img.draggable = false; img.loading = 'lazy';
    wrap.appendChild(img);
    injectHealthUI(wrap);
    field.appendChild(wrap);
    wrappers.push(wrap);
  });
  return wrappers;
}

/* ─── CANVAS ──────────────────────────────────────── */

function initCanvas() {
  const canvas = document.getElementById('zone13GlitchCanvas');
  if (!canvas) return;
  glitch = new Zone13GlitchRenderer(canvas);
  glitch.resize();
  window.addEventListener('resize', () => glitch?.resize());
}

/* ─── TRANSMISSION ────────────────────────────────── */

async function startTransmission(btn, label) {
  if (transmitting) return;
  btn.disabled = true;
  label.textContent = 'CHARGEMENT';
  try {
    engine = new Zone13Audio();
    await engine.init();
    await engine.loadBuffers(AUDIO_SOURCES);
    await engine.resume();
    analyserData = new Zone13AnalyserData(engine.getAnalyser());
    engine.onTrigger = () => btn.classList.add('is-firing');
    engine.onEnd     = () => btn.classList.remove('is-firing');
    engine.startCycle();
    transmitting = true;
    btn.disabled = false;
    btn.classList.add('is-active');
    label.textContent = 'TRANSMISSION';
    btn.setAttribute('aria-label', 'Couper la transmission');
    chaos.setMode('THERMAL'); lastMode = 'THERMAL';
    tick();
  } catch (err) {
    console.error('[Z13]', err);
    btn.disabled = false;
    label.textContent = 'ERREUR';
    setTimeout(() => { label.textContent = 'TRANSMISSION'; }, 2200);
  }
}

function stopTransmission(btn, label) {
  transmitting = false;
  cancelAnimationFrame(rafId); rafId = null;
  try { engine?.ctx?.suspend(); } catch {}
  glitch?.clear();
  chaos.setMode('THERMAL'); lastMode = 'THERMAL';
  btn.classList.remove('is-active', 'is-firing');
  label.textContent = 'TRANSMISSION';
  btn.setAttribute('aria-label', 'Activer la transmission');
}

function createTransmissionBtn() {
  const btn = document.createElement('button');
  btn.id        = 'z13TransmitBtn';
  btn.className = 'z13-transmission-btn';
  btn.type      = 'button';
  btn.setAttribute('aria-label', 'Activer la transmission');
  btn.setAttribute('data-chaos-exclude', '');
  btn.innerHTML = '<span class="z13-tx-ring" aria-hidden="true"></span>'
                + '<span class="z13-tx-label">TRANSMISSION</span>';
  document.body.appendChild(btn);
  return btn;
}

/* ─── INIT ────────────────────────────────────────── */

function init() {
  const state = getState();
  saveState({ ...state, visits: (state.visits || 0) + 1 });

  const wrappers = loadImages();

  /* Tuer 1 ou 2 archives aléatoires par défaut
     — après que chaos.activate() ait créé les particules */
  requestAnimationFrame(() => requestAnimationFrame(() => {
    chaos.activate();
    const count = Math.random() < 0.5 ? 1 : 2;
    const pool  = [...wrappers].sort(() => Math.random() - 0.5).slice(0, count);
    pool.forEach(el => {
      const hState = healthMap.get(el);
      if (hState) { hState.hp = 0; killArchive(el, hState); }
    });
  }));

  initCanvas();
  bindDrag();

  const btn   = createTransmissionBtn();
  const label = btn.querySelector('.z13-tx-label');
  btn.addEventListener('click', () => {
    if (transmitting) stopTransmission(btn, label);
    else              startTransmission(btn, label);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
