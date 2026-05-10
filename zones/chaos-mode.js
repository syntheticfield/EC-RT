/* =========================
   EC@RT — chaos-mode.js
   Mode chaos — contenu complet des pages

   Cible : archives, croix, liens nav, identité zone.
   Les éléments DOM sont extraits en position:fixed à
   leur coordonnée viewport exacte, puis animés via
   transform:translate (pointer-events suivent). ✓

   API publique (window.EC_CHAOS) :
     .toggle()
     .setMode('THERMAL'|'ORBITAL'|'FLUVIAL'|'RESONANCE')
     .audioBurst(amplitude)
     .addElement(el)     ← zone-13.js appelle ça sur spawn
     .removeElement(el)  ← zone-13.js appelle ça sur kill
     .active             ← bool, zone-13.js skip ses transforms si true

   Keyboard : [C] toggle · [1-4] mode · [Échap] off
   ========================= */

(function () {
  'use strict';

  /* ─────────────────────────────
     SÉLECTEURS
     Ce qui entre dans le champ chaos.
     Ordre : contenu principal → sidebar.
     ───────────────────────────── */

  const SELECTORS = [
    /* Zone 13 — archives et croix (le vrai contenu) */
    '.zone13-archive',
    '.z13-cross',

    /* Contenu générique d'autres zones */
    '.zone-content-image img:not(.zone13-floating-image)',
    '.zone-content figure',
    '.zone-article img',

    /* Sidebar — navigation et identité */
    '.zone-link',
    '.zone-identity-title',
    '.zone-identity-desc',
  ];

  /* Jamais de chaos ici */
  const NEVER = [
    '#ecartUiCluster',
    '#ecartTopRight',
    '#ecartAudioPanel',
    '#infoPanel',
    '#mobileMapOverlay',
    '#soundPanel',
    '[data-chaos-exclude]',
  ];

  /* ─────────────────────────────
     PARTICULE
     ───────────────────────────── */

  class Particle {
    constructor(el) {
      const r = el.getBoundingClientRect();
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

      /* Masse : archives lourdes, texte léger */
      const area = this.w * this.h;
      if (el.classList.contains('zone13-archive')) this.mass = 5;
      else if (el.classList.contains('z13-cross'))  this.mass = 0.4;
      else if (el.tagName === 'IMG')                this.mass = 3.5;
      else if (el.classList.contains('zone-link'))  this.mass = 1.2;
      else                                          this.mass = Math.max(0.6, Math.min(4, area / 4000));

      /* Marque l'élément comme sous contrôle chaos */
      el.dataset.chaosControlled = '1';

      /* Sauvegarde complète des styles inline */
      this._saved = {};
      ['position','left','top','width','margin','transform','transition','zIndex','pointerEvents','willChange']
        .forEach(p => { this._saved[p] = el.style[p]; });
    }

    pin() {
      const r = this.el.getBoundingClientRect();
      const s = this.el.style;
      /* Fige à la position viewport exacte */
      s.position     = 'fixed';
      s.left         = `${r.left}px`;
      s.top          = `${r.top}px`;
      s.width        = `${r.width}px`;
      s.margin       = '0';
      s.transition   = 'none';
      s.zIndex       = '800';
      s.pointerEvents = 'auto';
      s.willChange   = 'transform';
      s.transform    = '';
    }

    sync() {
      const dx = this.x - this.ox;
      const dy = this.y - this.oy;
      const r  = Math.max(-24, Math.min(24, this.rot));
      this.el.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) rotate(${r.toFixed(2)}deg)`;
    }

    springBack(cb) {
      const s = this.el.style;
      s.transition = 'transform 0.9s cubic-bezier(0.22,1,0.36,1)';
      s.transform  = 'translate(0px,0px) rotate(0deg)';
      setTimeout(() => { this.restore(); cb?.(); }, 950);
    }

    restore() {
      delete this.el.dataset.chaosControlled;
      const s = this.el.style;
      Object.entries(this._saved).forEach(([k, v]) => { s[k] = v; });
    }
  }

  /* ─────────────────────────────
     MOTEUR
     ───────────────────────────── */

  class ChaosEngine {
    constructor() {
      this.particles   = [];
      this.active      = false;
      this.mode        = 'THERMAL';
      this.temperature = 0;
      this.tick        = 0;
      this.mouse       = { x: -999, y: -999 };
      this._rafId      = null;
      this._mmov       = e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; };
      this._mleave     = ()  => { this.mouse.x = -999; this.mouse.y = -999; };
      this._observer   = null;
    }

    /* ── Collecte initiale des éléments ── */
    _collect() {
      const excluded = new Set();
      NEVER.forEach(s => document.querySelectorAll(s).forEach(el => excluded.add(el)));

      const isExcluded = el => {
        if (excluded.has(el)) return true;
        return NEVER.some(s => el.closest(s));
      };

      const seen = new Set();
      const out  = [];

      SELECTORS.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          if (seen.has(el) || isExcluded(el)) return;
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            seen.add(el);
            out.push(el);
          }
        });
      });

      return out;
    }

    /* ── Ajoute un élément dynamiquement (zone-13 spawn) ── */
    addElement(el) {
      if (!this.active) return;
      if (el.dataset.chaosControlled) return;

      /* Attendre que l'élément soit dans le DOM et visible */
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        if (r.width === 0) return;
        const p = new Particle(el);
        p.pin();
        p.vx = (Math.random() - 0.5) * 6;
        p.vy = (Math.random() - 0.5) * 6;
        this.particles.push(p);
      });
    }

    /* ── Retire un élément (zone-13 kill) ── */
    removeElement(el) {
      const idx = this.particles.findIndex(p => p.el === el);
      if (idx === -1) return;
      const p = this.particles.splice(idx, 1)[0];
      delete el.dataset.chaosControlled;
    }

    /* ── Activation ── */
    activate() {
      if (this.active) return;
      this.active      = true;
      this.tick        = 0;
      this.temperature = 0.52;

      document.body.classList.add('ec-chaos-on');

      /* Pin tous les éléments collectés */
      const els = this._collect();
      this.particles = els.map(el => {
        const p = new Particle(el);
        p.pin();
        p.vx = (Math.random() - 0.5) * 5;
        p.vy = (Math.random() - 0.5) * 5;
        return p;
      });

      /* Observer les nouveaux éléments (archives qui spawneront) */
      const field = document.getElementById('zone13ImageField');
      if (field) {
        this._observer = new MutationObserver(mutations => {
          mutations.forEach(m => {
            m.addedNodes.forEach(node => {
              if (node.nodeType === 1) this.addElement(node);
            });
          });
        });
        this._observer.observe(field, { childList: true });
      }

      document.addEventListener('mousemove',  this._mmov);
      document.addEventListener('mouseleave', this._mleave);
      document.dispatchEvent(new CustomEvent('ec-chaos:on'));
      this._loop();
    }

    /* ── Désactivation ── */
    deactivate() {
      if (!this.active) return;
      this.active = false;

      cancelAnimationFrame(this._rafId);
      this._observer?.disconnect();
      this._observer = null;
      document.removeEventListener('mousemove',  this._mmov);
      document.removeEventListener('mouseleave', this._mleave);

      let pending = this.particles.length;
      if (pending === 0) {
        document.body.classList.remove('ec-chaos-on');
        document.dispatchEvent(new CustomEvent('ec-chaos:off'));
        return;
      }

      this.particles.forEach(p => p.springBack(() => {
        if (--pending === 0) {
          document.body.classList.remove('ec-chaos-on');
          document.dispatchEvent(new CustomEvent('ec-chaos:off'));
        }
      }));

      this.particles = [];
    }

    toggle() { this.active ? this.deactivate() : this.activate(); }

    setMode(m) {
      this.mode = m;
      document.dispatchEvent(new CustomEvent('ec-chaos:mode', { detail: m }));
    }

    /* ── Burst depuis le son ── */
    audioBurst(amplitude = 0.8) {
      if (!this.active) return;
      const cx = window.innerWidth  / 2;
      const cy = window.innerHeight / 2;
      this.particles.forEach(p => {
        const dx = p.x - cx, dy = p.y - cy, d = Math.sqrt(dx*dx+dy*dy) || 1;
        const f  = (9 + amplitude * 20) / p.mass;
        p.vx += (dx/d) * f;
        p.vy += (dy/d) * f;
      });
      this.temperature = Math.min(1, this.temperature + amplitude * 0.3);
    }

    /* ── Chauffe locale (click) ── */
    heatAt(x, y, s = 0.1) {
      if (!this.active) return;
      this.temperature = Math.min(1, this.temperature + s);
      this.particles.forEach(p => {
        const dx = p.x-x, dy = p.y-y, d = Math.sqrt(dx*dx+dy*dy) || 1;
        if (d < 200) { const f = (s*140)/(d*p.mass); p.vx+=(dx/d)*f; p.vy+=(dy/d)*f; }
      });
    }

    /* ── Boucle physique ── */
    _loop() {
      if (!this.active) return;
      this._rafId = requestAnimationFrame(() => this._loop());
      this.tick  += 0.016;
      this.temperature *= 0.9993;

      const W = window.innerWidth, H = window.innerHeight;

      this.particles.forEach((p, i) => {
        let fx = 0, fy = 0;

        /* 1. Ressort vers l'origine */
        const sk = (1 - this.temperature) * 0.036;
        fx += (p.ox - p.x) * sk;
        fy += (p.oy - p.y) * sk;

        /* 2. Dérive bruit (pseudo-Perlin via sinus) */
        if (this.mode !== 'RESONANCE') {
          const na = this.temperature * 3.0;
          fx += Math.sin(this.tick * 0.62 + p.phase)  * Math.cos(this.tick * 0.41 + p.phase * 0.7)  * na;
          fy += Math.cos(this.tick * 0.55 + p.phase * 1.3) * Math.sin(this.tick * 0.37 + p.phase * 0.5) * na;
        }

        /* 3. Répulsion mutuelle */
        this.particles.forEach((q, j) => {
          if (i >= j) return;
          const dx = p.x-q.x, dy = p.y-q.y, d2 = dx*dx+dy*dy;
          const md = (Math.max(p.w,p.h) + Math.max(q.w,q.h)) * 0.5;
          if (d2 < md*md && d2 > 0.01) {
            const d = Math.sqrt(d2), f = Math.min(10, (md*md)/(d2*p.mass));
            fx += (dx/d)*f; fy += (dy/d)*f;
            /* Action / réaction */
            const fq = Math.min(10, (md*md)/(d2*q.mass));
            q.vx -= (dx/d)*fq*0.5; q.vy -= (dy/d)*fq*0.5;
          }
        });

        /* 4. Répulsion curseur */
        const cdx = p.x-this.mouse.x, cdy = p.y-this.mouse.y, cd2 = cdx*cdx+cdy*cdy;
        const cr = 110 + this.temperature * 60;
        if (cd2 < cr*cr && cd2 > 0.1) {
          const cd = Math.sqrt(cd2), cf = Math.min(16, 8000/(cd2*p.mass));
          fx += (cdx/cd)*cf; fy += (cdy/cd)*cf;
        }

        /* 5. Modes */
        if (this.mode === 'ORBITAL') {
          const dx = p.x-W/2, dy = p.y-H/2, d = Math.sqrt(dx*dx+dy*dy)||1;
          const tr = 80 + (i%7)*62;
          const rf = (tr-d)*0.02, tf = 0.75*this.temperature;
          fx += (dx/d)*rf + (-dy/d)*tf;
          fy += (dy/d)*rf + ( dx/d)*tf;
        }

        if (this.mode === 'FLUVIAL') {
          fx += 2.0 * this.temperature;
          fy += Math.sin(this.tick*0.46+p.phase)*1.2*this.temperature;
          if (p.x > W + p.w*0.5) { p.x = -p.w*0.5; p.vx *= 0.2; }
        }

        if (this.mode === 'RESONANCE') {
          p.vx *= 0.93; p.vy *= 0.93;
        }

        /* 6. Murs doux */
        const bx = p.w/2+6, by = p.h/2+6;
        if (p.x < bx)     fx += (bx-p.x)*0.42;
        if (p.x > W-bx)   fx -= (p.x-(W-bx))*0.42;
        if (p.y < by)     fy += (by-p.y)*0.42;
        if (p.y > H-by)   fy -= (p.y-(H-by))*0.42;

        /* Intégration */
        const damp = this.mode === 'RESONANCE' ? 0.91 : 0.882;
        p.vx = (p.vx + fx/p.mass) * damp;
        p.vy = (p.vy + fy/p.mass) * damp;

        /* Rotation */
        const tr = p.vx * 1.5;
        p.vrot = (p.vrot + (tr-p.rot)*0.13) * 0.87;
        p.rot  = Math.max(-24, Math.min(24, p.rot+p.vrot));

        p.x += p.vx;
        p.y += p.vy;
        p.sync();
      });
    }
  }

  /* ─────────────────────────────
     SINGLETON + CLAVIER
     ───────────────────────────── */

  window.EC_CHAOS = new ChaosEngine();

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return;

    if (e.key === 'c' || e.key === 'C') { window.EC_CHAOS.toggle(); return; }
    if (!window.EC_CHAOS.active) return;

    ({ '1':'THERMAL','2':'ORBITAL','3':'FLUVIAL','4':'RESONANCE' })[e.key]
      && window.EC_CHAOS.setMode(({ '1':'THERMAL','2':'ORBITAL','3':'FLUVIAL','4':'RESONANCE' })[e.key]);

    if (e.key === 'Escape') window.EC_CHAOS.deactivate();
  });

  document.addEventListener('click', e => {
    window.EC_CHAOS.heatAt(e.clientX, e.clientY, 0.08);
  });

  /* ─────────────────────────────
     BOUTON ∿ dans #ecartTopRight
     ───────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('ecartTopRight');
    if (!container) return;

    const btn = document.createElement('button');
    btn.id        = 'ecartChaosToggle';
    btn.className = 'ecart-chaos-btn';
    btn.type      = 'button';
    btn.setAttribute('aria-label', 'Mode chaos');
    btn.setAttribute('title', 'Mode chaos [C]');
    btn.textContent = '∿';
    container.appendChild(btn);

    const modeEl = document.createElement('span');
    modeEl.id        = 'ecartChaosMode';
    modeEl.className = 'ecart-chaos-mode';
    container.appendChild(modeEl);

    btn.addEventListener('click', () => window.EC_CHAOS.toggle());

    document.addEventListener('ec-chaos:on',  () => { btn.classList.add('is-active'); modeEl.textContent = 'THERMAL'; modeEl.classList.add('is-visible'); });
    document.addEventListener('ec-chaos:off', () => { btn.classList.remove('is-active'); modeEl.textContent = ''; modeEl.classList.remove('is-visible'); });
    document.addEventListener('ec-chaos:mode', e => { modeEl.textContent = e.detail; });
  });

})();
