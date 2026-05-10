/* ==========================================================
   EC@RT — HOME ARCHIVE NOISE
   Champ vivant de noms de zones + collisions sonores
   ========================================================== */

(() => {
  const canvas = document.getElementById("homeArchiveCanvas");
  const btn = document.getElementById("homeNoiseToggle");
  const status = document.getElementById("homeNoiseStatus");

  if (!canvas || !btn) return;

  const ctx = canvas.getContext("2d");

  const POOL = [
    "POSTER",
    "BACKGROUND",
    "ANTHROPOMORPH",
    "NWMV",
    "BAD PUBLICATIONS",
    "MAILERS",
    "VILE",
    "CAZAZZA",
    "FUTURIST SOUND",
    "IRÈNE DOGMATIC",
    "COUM",
    "491",
    "MAD",
    "SEARCH AND DESTROY",
    "EC@RT",
    "MAMCO",
    "HEAD",
    "QUICKKOPY",
    "CONCEPTUALISM",
    "BAY AREA DADA",
    "BAY AREA PUNK",
    "DADA",
    "PUNK",
    "MAIL ART",
    "ARCHIVE",
    "AUDIO-DESCRIPTION",
    "TRANSCRIPTION",
    "VOICE",
    "SYNTHESIS",
    "NOISE",
    "SIGNAL",
    "FRAGMENT",
    "TRACE",
    "RESIDUE",
    "DRIFT",
    "MUTATE",
    "RECOMPOSE",
    "ACCESS",
    "MEDIATION"
  ];

  const GLITCH = "!@#$%^&*░▒▓│╡╢╖╣║╗╝╛┐└┬├─┼╞╚╔╩╦╠═╬█▄▀■◆◇×//——";

  let W = 0;
  let H = 0;
  let entities = [];
  let frame = 0;

  let mx = -999;
  let my = -999;

  let AC = null;
  let masterGain = null;
  let noiseGain = null;
  let droneOsc = null;
  let soundOn = false;

  const POP_DESKTOP = 38;
  const POP_MOBILE = 24;

  function isMobile() {
    return window.innerWidth <= 760;
  }

  function targetPop() {
    return isMobile() ? POP_MOBILE : POP_DESKTOP;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    W = canvas.clientWidth;
    H = canvas.clientHeight;

    canvas.width = Math.max(1, W * dpr);
    canvas.height = Math.max(1, H * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ===============================
     AUDIO
     =============================== */

  function initAudio() {
    AC = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = AC.createGain();
    masterGain.gain.setValueAtTime(0, AC.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.34, AC.currentTime + 1.2);
    masterGain.connect(AC.destination);

    const sr = AC.sampleRate;
    const buffer = AC.createBuffer(1, sr * 2, sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = AC.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = AC.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 680;
    filter.Q.value = 0.42;

    noiseGain = AC.createGain();
    noiseGain.gain.value = 0.032;

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start();

    droneOsc = AC.createOscillator();
    droneOsc.type = "sawtooth";
    droneOsc.frequency.value = 46;

    const droneFilter = AC.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 120;

    const droneGain = AC.createGain();
    droneGain.gain.value = 0.075;

    droneOsc.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(masterGain);
    droneOsc.start();
  }

  function toggleSound() {
    if (!soundOn) {
      if (!AC) {
        initAudio();
      } else {
        AC.resume();
      }

      soundOn = true;
      btn.textContent = "■ NOISE";
      btn.classList.add("is-on");
    } else {
      if (AC) AC.suspend();

      soundOn = false;
      btn.textContent = "▶ NOISE";
      btn.classList.remove("is-on");
    }
  }

  function collisionSound(f1, f2) {
    if (!AC || !soundOn) return;

    [f1, f2].forEach((freq, i) => {
      const osc = AC.createOscillator();
      const gain = AC.createGain();

      osc.type = i === 0 ? "square" : "sawtooth";
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0.11, AC.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(AC.currentTime + i * 0.025);
      osc.stop(AC.currentTime + 0.34);
    });

    if (noiseGain) {
      noiseGain.gain.cancelScheduledValues(AC.currentTime);
      noiseGain.gain.setValueAtTime(0.22, AC.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.032, AC.currentTime + 0.42);
    }
  }

  function modAudio() {
    if (!AC || !soundOn) return;

    const locking = entities.filter(e => e.state === "locking").length;
    const destroying = entities.filter(e => e.state === "destroying").length;
    const energy = (locking + destroying * 2.4) / Math.max(1, targetPop());

    noiseGain.gain.setTargetAtTime(0.03 + energy * 0.15, AC.currentTime, 0.5);
    droneOsc.frequency.setTargetAtTime(46 + energy * 34, AC.currentTime, 1.0);
  }

  /* ===============================
     ENTITY
     =============================== */

  class Entity {
    constructor() {
      this.text = pick(POOL);
      this.display = this.text;

      this.x = Math.random() * W;
      this.y = Math.random() * H;

      this.vx = rand(-0.42, 0.42);
      this.vy = rand(-0.42, 0.42);

      this.size = isMobile() ? rand(8, 14) : rand(9, 18);
      this.opacity = 0;

      this.freq = rand(70, 980);

      this.state = "born";
      this.target = null;
      this.scatter = Math.random() * Math.PI * 2;

      this.age = 0;
      this.dead = false;
      this.glitchTimer = rand(80, 260);
    }

    update(all) {
      this.age++;

      if (this.state === "born") {
        this.opacity = Math.min(0.72, this.opacity + 0.012);
        this.vx *= 0.98;
        this.vy *= 0.98;

        if (this.opacity >= 0.72) {
          this.state = "searching";
        }
      }

      else if (this.state === "searching") {
        this.vx += rand(-0.025, 0.025);
        this.vy += rand(-0.025, 0.025);

        const speed = Math.hypot(this.vx, this.vy);

        if (speed > 0.55) {
          this.vx *= 0.55 / speed;
          this.vy *= 0.55 / speed;
        }

        if (Math.random() < 0.002 && this.age > 80) {
          const available = all.filter(e => e !== this && e.state === "searching");

          if (available.length) {
            this.target = pick(available);
            this.state = "locking";
          }
        }
      }

      else if (this.state === "locking") {
        if (!this.target || this.target.dead || this.target.state === "destroying") {
          this.target = null;
          this.state = "searching";
        } else {
          const dx = this.target.x - this.x;
          const dy = this.target.y - this.y;
          const dist = Math.hypot(dx, dy) || 1;

          if (dist < 18) {
            this.collide();
          } else {
            this.vx += (dx / dist) * 0.075;
            this.vy += (dy / dist) * 0.075;

            const speed = Math.hypot(this.vx, this.vy);

            if (speed > 1.65) {
              this.vx *= 1.65 / speed;
              this.vy *= 1.65 / speed;
            }
          }
        }
      }

      else if (this.state === "destroying") {
        this.opacity -= 0.045;
        this.vx = Math.cos(this.scatter) * 2.1;
        this.vy = Math.sin(this.scatter) * 2.1;

        if (this.opacity <= 0) {
          this.dead = true;
        }
      }

      this.x += this.vx;
      this.y += this.vy;

      const margin = 70;

      if (this.x < margin) this.vx += 0.04;
      if (this.x > W - margin) this.vx -= 0.04;
      if (this.y < margin) this.vy += 0.04;
      if (this.y > H - margin) this.vy -= 0.04;

      if (this.x < -140) this.x = W + 140;
      if (this.x > W + 140) this.x = -140;
      if (this.y < -140) this.y = H + 140;
      if (this.y > H + 140) this.y = -140;

      this.glitchTimer--;

      if (this.glitchTimer <= 0 && this.state !== "destroying") {
        this.glitch();
        this.glitchTimer = rand(120, 360);
      }
    }

    glitch() {
      let out = "";

      for (let i = 0; i < this.text.length; i++) {
        out += Math.random() < 0.22
          ? GLITCH[Math.floor(Math.random() * GLITCH.length)]
          : this.text[i];
      }

      this.display = out;

      window.setTimeout(() => {
        this.display = this.text;
      }, rand(55, 130));
    }

    collide() {
      const other = this.target;

      collisionSound(this.freq, other ? other.freq : 440);

      this.state = "destroying";
      this.scatter = Math.atan2(this.vy, this.vx);

      if (other && other.state !== "destroying") {
        other.state = "destroying";
        other.scatter = this.scatter + Math.PI + rand(-0.4, 0.4);
      }

      window.setTimeout(() => {
        const e = new Entity();
        e.x = this.x + rand(-80, 80);
        e.y = this.y + rand(-80, 80);
        entities.push(e);
      }, rand(500, 1100));
    }

    draw() {
      if (this.dead) return;

      ctx.save();

      let color = "rgba(244,240,226,1)";

      if (this.state === "locking") color = "rgba(255,48,0,1)";
      if (this.state === "destroying") color = "rgba(255,210,80,1)";
      if (this.state === "born") color = "rgba(130,255,170,1)";

      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = color;
      ctx.font = `${this.size}px "Courier New", Courier, monospace`;

      const jitter = this.state === "locking" ? 2.4 : 0;

      ctx.fillText(
        this.display,
        this.x + rand(-jitter, jitter),
        this.y + rand(-jitter, jitter)
      );

      if (this.state === "locking" && this.target) {
        ctx.globalAlpha = this.opacity * 0.14;
        ctx.strokeStyle = "#ff3000";
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 9]);

        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.target.x, this.target.y);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  /* ===============================
     ECOSYSTEM
     =============================== */

  function seed() {
    entities = [];

    for (let i = 0; i < targetPop(); i++) {
      entities.push(new Entity());
    }
  }

  function maintainPopulation() {
    const pop = targetPop();

    entities = entities.filter(e => !e.dead);

    while (entities.length < pop) {
      entities.push(new Entity());
    }

    if (entities.length > pop + 8) {
      entities.splice(0, entities.length - pop);
    }
  }

  function disturb(x, y) {
    entities.forEach(e => {
      const dx = e.x - x;
      const dy = e.y - y;
      const dist = Math.hypot(dx, dy);

      if (dist < 160 && dist > 0) {
        e.vx += (dx / dist) * 2.8;
        e.vy += (dy / dist) * 2.8;

        if (e.state === "searching" && Math.random() < 0.45) {
          const others = entities.filter(o => o !== e && o.state === "searching");

          if (others.length) {
            e.target = pick(others);
            e.state = "locking";
          }
        }
      }
    });
  }

  function updateStatus() {
    if (!status) return;

    const searching = entities.filter(e => e.state === "searching").length;
    const locking = entities.filter(e => e.state === "locking").length;
    const destroying = entities.filter(e => e.state === "destroying").length;

    status.textContent =
      `ENT ${String(entities.length).padStart(2, "0")} / ` +
      `LOCK ${String(locking).padStart(2, "0")} / ` +
      `DES ${String(destroying).padStart(2, "0")}`;
  }

  function drawMouseField() {
    if (mx < 0 || my < 0) return;

    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.strokeStyle = "#f4f0e2";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([1, 12]);

    ctx.beginPath();
    ctx.arc(mx, my, 92, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function loop() {
    frame++;

    ctx.fillStyle = "rgba(5,5,5,0.32)";
    ctx.fillRect(0, 0, W, H);

    drawMouseField();

    entities.forEach(e => e.update(entities));
    maintainPopulation();
    entities.forEach(e => e.draw());

    if (frame % 25 === 0) updateStatus();
    if (frame % 60 === 0) modAudio();

    requestAnimationFrame(loop);
  }

  /* ===============================
     EVENTS
     =============================== */

  btn.addEventListener("click", toggleSound);

  canvas.addEventListener("mousemove", e => {
    mx = e.clientX;
    my = e.clientY;
  });

  canvas.addEventListener("mouseleave", () => {
    mx = -999;
    my = -999;
  });

  canvas.addEventListener("click", e => {
    disturb(e.clientX, e.clientY);
  });

  canvas.addEventListener("touchstart", e => {
    const t = e.touches[0];
    if (!t) return;

    mx = t.clientX;
    my = t.clientY;

    disturb(mx, my);
  }, { passive: true });

  window.addEventListener("resize", () => {
    resize();
    seed();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && AC && soundOn) {
      AC.suspend();
    }

    if (!document.hidden && AC && soundOn) {
      AC.resume();
    }
  });

  /* ===============================
     START
     =============================== */

  resize();
  seed();
  updateStatus();
  loop();
})();