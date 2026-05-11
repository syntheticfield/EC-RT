/* ==========================================================
   EC@RT — HOME ARCHIVE NOISE  v2
   Champ vivant · zones nommées + émergence sonore
   ========================================================== */

(() => {
  const canvas = document.getElementById("homeArchiveCanvas");
  const btn    = document.getElementById("homeNoiseToggle");
  const status = document.getElementById("homeNoiseStatus");

  if (!canvas || !btn) return;

  const ctx = canvas.getContext("2d");

  /* ── Zones → URLs navigables ─────────────────────────── */
  const ZONES = [
    { name: "POSTER",             href: "zones/zone-01/zone-01.html" },
    { name: "BACKGROUND",         href: "zones/zone-02/zone-02.html" },
    { name: "ANTHROPOMORPH",      href: "zones/zone-03/zone-03.html" },
    { name: "NWMV",               href: "zones/zone-04/zone-04.html" },
    { name: "BAD PUBLICATIONS",   href: "zones/zone-05/zone-05.html" },
    { name: "MAILERS",            href: "zones/zone-05/zone-05.html" },
    { name: "VILE",               href: "zones/zone-06/zone-06.html" },
    { name: "CAZAZZA",            href: "zones/zone-07/zone-07.html" },
    { name: "FUTURIST SOUND",     href: "zones/zone-08/zone-08.html" },
    { name: "IRENE DOGMATIC",     href: "zones/zone-09/zone-09.html" },
    { name: "COUM",               href: "zones/zone-10/zone-10.html" },
    { name: "491",                href: "zones/zone-11/zone-11.html" },
    { name: "MAD",                href: "zones/zone-12/zone-12.html" },
    { name: "SEARCH AND DESTROY", href: "zones/zone-13/zone-13.html" },
  ];

  /* ── Mots ambiants ───────────────────────────────────── */
  const AMBIENT = [
    "EC@RT", "MAMCO", "HEAD", "QUICKKOPY CONCEPTUALISM",
    "CONCEPTUALISM", "BAY AREA DADA", "BAY AREA PUNK",
    "DADA", "PUNKY", "MAIL-ART", "NOISYARCHIVES",
    "VILE MAGAZINE", "491", "COUM TRANSMISSIONS", "NOISY MEDIATION",
    "BEAUTY KILLERS", "ROLE MODELS",
    "NORTH WEST MOUNTED VALISE",
    "KOPYKOPY", "FUTURIST SOUND", "IRENE DOGMATIC",
  ];

  const GLITCH = "!@#$%^&*abcde░▒▓│╡╖╣║╗╛┐└┬├─┼╚╔╠═╬a▄▀■◆◇x——//";

  let W = 0, H = 0;
  let entities = [];
  let frame = 0;
  let mx = -999, my = -999;
  let hoveredEntity = null;

  /* ── Audio ───────────────────────────────────────────── */
  let AC = null, masterGain = null, noiseGain = null, droneOsc = null;
  let analyserNode = null, freqData = null, timeData = null;
  let soundOn = false;
  const audioState = { amplitude: 0, bass: 0, mids: 0, highs: 0 };

  const POP_DESKTOP = 36;
  const POP_MOBILE  = 22;

  function isMobile() { return window.innerWidth <= 760; }
  function targetPop() { return isMobile() ? POP_MOBILE : POP_DESKTOP; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width  = Math.max(1, W * dpr);
    canvas.height = Math.max(1, H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* =====================================================
     AUDIO
     ===================================================== */

  function initAudio() {
    AC = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = AC.createGain();
    masterGain.gain.setValueAtTime(0, AC.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.30, AC.currentTime + 1.2);
    masterGain.connect(AC.destination);

    /* Analyser pour l'emergence sonore */
    analyserNode = AC.createAnalyser();
    analyserNode.fftSize = 512;
    analyserNode.smoothingTimeConstant = 0.82;
    masterGain.connect(analyserNode);
    freqData = new Uint8Array(analyserNode.frequencyBinCount);
    timeData = new Uint8Array(analyserNode.fftSize);

    /* Bruit blanc filtre */
    const sr     = AC.sampleRate;
    const buffer = AC.createBuffer(1, sr * 2, sr);
    const data   = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const noise = AC.createBufferSource();
    noise.buffer = buffer;
    noise.loop   = true;

    const filter = AC.createBiquadFilter();
    filter.type            = "bandpass";
    filter.frequency.value = 680;
    filter.Q.value         = 0.42;

    noiseGain = AC.createGain();
    noiseGain.gain.value = 0.030;

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start();

    /* Drone basse frequence */
    droneOsc = AC.createOscillator();
    droneOsc.type            = "sawtooth";
    droneOsc.frequency.value = 46;

    const droneFilter = AC.createBiquadFilter();
    droneFilter.type            = "lowpass";
    droneFilter.frequency.value = 120;

    const droneGain = AC.createGain();
    droneGain.gain.value = 0.058;

    droneOsc.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(masterGain);
    droneOsc.start();
  }

  function readAnalyser() {
    if (!analyserNode || !freqData || !timeData) return;
    analyserNode.getByteFrequencyData(freqData);
    analyserNode.getByteTimeDomainData(timeData);

    let s = 0;
    for (let i = 0; i < timeData.length; i++) s += Math.abs((timeData[i] - 128) / 128);
    audioState.amplitude = s / timeData.length;

    const band = (start, end) => {
      let sum = 0, n = 0;
      for (let i = start; i < Math.min(end, freqData.length); i++) { sum += freqData[i]; n++; }
      return n ? (sum / n) / 255 : 0;
    };
    audioState.bass  = band(0, 8);
    audioState.mids  = band(8, 48);
    audioState.highs = band(48, 120);
  }

  function toggleSound() {
    if (!soundOn) {
      if (!AC) initAudio(); else AC.resume();
      soundOn = true;
      btn.textContent = "NOISE ON";
      btn.classList.add("is-on");
    } else {
      if (AC) AC.suspend();
      soundOn = false;
      btn.textContent = "NOISE OFF";
      btn.classList.remove("is-on");
    }
  }

  function collisionSound(f1, f2) {
    if (!AC || !soundOn) return;
    [f1, f2].forEach((freq, i) => {
      const osc  = AC.createOscillator();
      const gain = AC.createGain();
      osc.type = i === 0 ? "square" : "sawtooth";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.09, AC.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 0.24);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(AC.currentTime + i * 0.020);
      osc.stop(AC.currentTime + 0.30);
    });
    if (noiseGain) {
      noiseGain.gain.cancelScheduledValues(AC.currentTime);
      noiseGain.gain.setValueAtTime(0.16, AC.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.030, AC.currentTime + 0.40);
    }
  }

  function modAudio() {
    if (!AC || !soundOn) return;
    const locking    = entities.filter(e => e.state === "locking").length;
    const destroying = entities.filter(e => e.state === "destroying").length;
    const energy     = (locking + destroying * 2.4) / Math.max(1, targetPop());
    noiseGain.gain.setTargetAtTime(0.026 + energy * 0.12, AC.currentTime, 0.5);
    droneOsc.frequency.setTargetAtTime(46 + energy * 28, AC.currentTime, 1.0);
  }

  /* =====================================================
     ENTITY
     ===================================================== */

  class Entity {
    constructor(forceZone) {
      const useZone = forceZone !== undefined
        ? forceZone
        : Math.random() < 0.40;

      const zoneData  = useZone ? pick(ZONES) : null;
      this.zone       = zoneData;
      this.text       = zoneData ? zoneData.name : pick(AMBIENT);
      this.href       = zoneData ? zoneData.href : null;
      this.display    = this.text;

      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.vx = rand(-0.36, 0.36);
      this.vy = rand(-0.36, 0.36);

      const base = isMobile() ? rand(7, 13) : rand(9, 16);
      this.size  = zoneData ? base * rand(1.1, 1.45) : base;

      this.opacity    = 0;
      this.maxOpacity = zoneData ? rand(0.82, 0.94) : rand(0.46, 0.68);
      this.freq       = rand(80, 960);
      this.sensitivity = zoneData ? rand(0.42, 0.90) : rand(0.18, 0.65);

      this.state       = "born";
      this.target      = null;
      this.scatter     = Math.random() * Math.PI * 2;
      this.age         = 0;
      this.dead        = false;
      this.glitchTimer = rand(90, 300);
      this.hovered     = false;
      this.pulse       = 0;
    }

    update(all) {
      this.age++;

      /* Emergence sonore */
      if (soundOn && audioState.amplitude > 0.008) {
        const s = this.sensitivity;
        if (this.state === "searching" || this.state === "locking") {
          this.vx += (Math.random() - 0.5) * audioState.bass * 1.5 * s;
          this.vy += (Math.random() - 0.5) * audioState.bass * 1.5 * s;
        }
        if (audioState.highs > 0.30 && Math.random() < audioState.highs * 0.07)
          this.glitch();
        this.pulse = this.zone
          ? Math.min(1, audioState.mids * 3.8 * s)
          : 0;
      } else {
        this.pulse = 0;
      }

      /* FSM */
      if (this.state === "born") {
        this.opacity = Math.min(this.maxOpacity, this.opacity + 0.009);
        this.vx *= 0.98; this.vy *= 0.98;
        if (this.opacity >= this.maxOpacity) this.state = "searching";
      }

      else if (this.state === "searching") {
        this.vx += rand(-0.020, 0.020);
        this.vy += rand(-0.020, 0.020);
        const spd = Math.hypot(this.vx, this.vy);
        if (spd > 0.50) { this.vx *= 0.50 / spd; this.vy *= 0.50 / spd; }
        if (Math.random() < 0.0018 && this.age > 80) {
          const pool = all.filter(e => e !== this && e.state === "searching");
          if (pool.length) { this.target = pick(pool); this.state = "locking"; }
        }
      }

      else if (this.state === "locking") {
        if (!this.target || this.target.dead || this.target.state === "destroying") {
          this.target = null; this.state = "searching";
        } else {
          const dx   = this.target.x - this.x;
          const dy   = this.target.y - this.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 18) {
            this.collide();
          } else {
            this.vx += (dx / dist) * 0.068;
            this.vy += (dy / dist) * 0.068;
            const spd = Math.hypot(this.vx, this.vy);
            if (spd > 1.50) { this.vx *= 1.50 / spd; this.vy *= 1.50 / spd; }
          }
        }
      }

      else if (this.state === "destroying") {
        this.opacity -= 0.040;
        this.vx = Math.cos(this.scatter) * 1.9;
        this.vy = Math.sin(this.scatter) * 1.9;
        if (this.opacity <= 0) this.dead = true;
      }

      this.x += this.vx;
      this.y += this.vy;

      const m = 70;
      if (this.x < m)     this.vx += 0.040;
      if (this.x > W - m) this.vx -= 0.040;
      if (this.y < m)     this.vy += 0.040;
      if (this.y > H - m) this.vy -= 0.040;

      if (this.x < -140) this.x = W + 140;
      if (this.x > W + 140) this.x = -140;
      if (this.y < -140) this.y = H + 140;
      if (this.y > H + 140) this.y = -140;

      this.glitchTimer--;
      if (this.glitchTimer <= 0 && this.state !== "destroying") {
        this.glitch();
        this.glitchTimer = rand(130, 400);
      }
    }

    glitch() {
      const rate = this.zone ? 0.12 : 0.22;
      let out = "";
      for (let i = 0; i < this.text.length; i++) {
        out += Math.random() < rate
          ? GLITCH[Math.floor(Math.random() * GLITCH.length)]
          : this.text[i];
      }
      this.display = out;
      window.setTimeout(() => { this.display = this.text; }, rand(40, 115));
    }

    collide() {
      const other = this.target;
      collisionSound(this.freq, other ? other.freq : 440);
      this.state   = "destroying";
      this.scatter = Math.atan2(this.vy, this.vx);
      if (other && other.state !== "destroying") {
        other.state   = "destroying";
        other.scatter = this.scatter + Math.PI + rand(-0.4, 0.4);
      }
      window.setTimeout(() => {
        const e = new Entity();
        e.x = this.x + rand(-80, 80);
        e.y = this.y + rand(-80, 80);
        entities.push(e);
      }, rand(500, 1100));
    }

    /* Detection de hit pour navigation */
    hitTest(px, py) {
      const approxW = this.size * this.text.length * 0.60;
      return px > this.x - 4        && px < this.x + approxW + 4 &&
             py > this.y - this.size && py < this.y + 6;
    }

    draw() {
      if (this.dead) return;
      ctx.save();

      let r, g, b;
      if (this.state === "locking")         { r=255; g=48;  b=0;   }
      else if (this.state === "destroying") { r=255; g=210; b=80;  }
      else if (this.state === "born")       { r=130; g=255; b=170; }
      else if (this.zone)                   { r=255; g=255; b=255; }
      else                                  { r=244; g=240; b=226; }

      /* Emergence: teinte rouge sur zones searching */
      if (this.pulse > 0 && this.zone && this.state === "searching") {
        g = Math.max(0, Math.round(g * (1 - this.pulse * 0.72)));
        b = Math.max(0, Math.round(b * (1 - this.pulse * 0.90)));
      }

      const alpha = this.hovered
        ? Math.min(1, this.opacity * 1.40)
        : this.opacity;

      ctx.globalAlpha = alpha;
      ctx.fillStyle   = `rgb(${r},${g},${b})`;

      /* Glow zones en emergence ou hover */
      if (this.zone && (this.pulse > 0.18 || this.hovered)) {
        if (this.hovered) {
          ctx.shadowColor = "rgba(255,255,255,0.85)";
          ctx.shadowBlur  = 12;
        } else {
          ctx.shadowColor = `rgba(255,${Math.round(48*(1-this.pulse))},0,0.55)`;
          ctx.shadowBlur  = 10 * this.pulse;
        }
      }

      const weight = this.zone ? "500" : "400";
      ctx.font = `${weight} ${this.size}px "Courier New", Courier, monospace`;

      const jitter = this.state === "locking" ? 2.0 : 0;
      ctx.fillText(
        this.display,
        this.x + rand(-jitter, jitter),
        this.y + rand(-jitter, jitter)
      );

      /* Soulignement discret au hover sur les zones */
      if (this.hovered && this.href) {
        const tw = ctx.measureText(this.display).width;
        ctx.globalAlpha = alpha * 0.55;
        ctx.fillStyle   = "rgba(255,255,255,0.9)";
        ctx.fillRect(this.x, this.y + 2.5, tw, 0.8);
      }

      /* Fil de tracking locking */
      if (this.state === "locking" && this.target) {
        ctx.globalAlpha = this.opacity * 0.11;
        ctx.strokeStyle = "#ff3000";
        ctx.lineWidth   = 0.5;
        ctx.setLineDash([2, 9]);
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.target.x, this.target.y);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  /* =====================================================
     ECOSYSTEME
     ===================================================== */

  function seed() {
    entities = [];
    const pop       = targetPop();
    const zoneCount = Math.min(ZONES.length, Math.round(pop * 0.42));
    for (let i = 0; i < zoneCount; i++) entities.push(new Entity(true));
    for (let i = zoneCount; i < pop; i++) entities.push(new Entity(false));
  }

  function maintainPopulation() {
    const pop = targetPop();
    entities = entities.filter(e => !e.dead);
    while (entities.length < pop) entities.push(new Entity());
    if (entities.length > pop + 8) entities.splice(0, entities.length - pop);
  }

  function disturb(x, y) {
    entities.forEach(e => {
      const dx   = e.x - x;
      const dy   = e.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist < 160 && dist > 0) {
        e.vx += (dx / dist) * 2.5;
        e.vy += (dy / dist) * 2.5;
        if (e.state === "searching" && Math.random() < 0.40) {
          const pool = entities.filter(o => o !== e && o.state === "searching");
          if (pool.length) { e.target = pick(pool); e.state = "locking"; }
        }
      }
    });
  }

  function checkHover(px, py) {
    hoveredEntity = null;
    for (const e of entities) {
      if (!e.dead && e.href && e.hitTest(px, py)) {
        hoveredEntity = e;
        break;
      }
    }
    entities.forEach(e => { e.hovered = (e === hoveredEntity); });
    canvas.style.cursor = hoveredEntity ? "pointer" : "default";
  }

  function updateStatus() {
    if (!status) return;
    const locking    = entities.filter(e => e.state === "locking").length;
    const destroying = entities.filter(e => e.state === "destroying").length;
    status.textContent =
      `ENT ${String(entities.length).padStart(2, "0")} / ` +
      `LOCK ${String(locking).padStart(2, "0")} / ` +
      `DES ${String(destroying).padStart(2, "0")}`;
  }

  function drawMouseField() {
    if (mx < 0 || my < 0) return;
    ctx.save();
    ctx.globalAlpha = 0.036;
    ctx.strokeStyle = "#f4f0e2";
    ctx.lineWidth   = 0.5;
    ctx.setLineDash([1, 12]);
    ctx.beginPath();
    ctx.arc(mx, my, 88, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /* =====================================================
     BOUCLE
     ===================================================== */

  function loop() {
    frame++;
    if (soundOn) readAnalyser();

    ctx.fillStyle = "rgba(5,5,5,0.28)";
    ctx.fillRect(0, 0, W, H);

    drawMouseField();

    entities.forEach(e => e.update(entities));
    maintainPopulation();
    entities.forEach(e => e.draw());

    if (frame % 25 === 0) updateStatus();
    if (frame % 60 === 0) modAudio();

    requestAnimationFrame(loop);
  }

  /* =====================================================
     EVENEMENTS
     ===================================================== */

  btn.addEventListener("click", toggleSound);

  canvas.addEventListener("mousemove", e => {
    mx = e.clientX; my = e.clientY;
    checkHover(e.clientX, e.clientY);
  });

  canvas.addEventListener("mouseleave", () => {
    mx = -999; my = -999;
    hoveredEntity = null;
    entities.forEach(e => { e.hovered = false; });
    canvas.style.cursor = "default";
  });

  canvas.addEventListener("click", e => {
    if (hoveredEntity && hoveredEntity.href) {
      window.location.href = hoveredEntity.href;
      return;
    }
    disturb(e.clientX, e.clientY);
  });

  canvas.addEventListener("touchstart", e => {
    const t = e.touches[0];
    if (!t) return;
    mx = t.clientX; my = t.clientY;
    disturb(mx, my);
  }, { passive: true });

  window.addEventListener("resize", () => { resize(); seed(); });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && AC && soundOn)  AC.suspend();
    if (!document.hidden && AC && soundOn) AC.resume();
  });

  /* START */
  resize();
  seed();
  updateStatus();
  loop();
})();
