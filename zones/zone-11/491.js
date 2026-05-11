/* ═══════════════════════════════════════════════════════════
   ZONE 11 — 491
   GIF · TEXTES · POLYPHONIE VOCALE (iframe pool)
   N voix simultanées via N speechSynthesis indépendants
   + Web Audio (reverb, crackle, delay, panning)
   ═══════════════════════════════════════════════════════════ */


/* ════════════════════════════
   GIF
   ════════════════════════════ */

const frames     = ["./img/ART_01.jpeg", "./img/ART_02.jpeg", "./img/ART_03.jpeg"];
const gifFrame   = document.getElementById("gifFrame");
let   frameIndex = 0;

setInterval(() => {
  frameIndex   = (frameIndex + 1) % frames.length;
  gifFrame.src = frames[frameIndex];
}, 950);


/* ════════════════════════════
   ARCHIVE TEXTS
   ════════════════════════════ */

const archiveTexts = [
  "DADA", "491", "4.49.91", "NO.6",
  "the system is the solution",
  "THE LAST SHEET OF THE WINTER!",
  "THAT'S THE DOORBELL!",
  "QUACK",
  "WOOF! 1965! LAMP",
  "OONK OONK PHSSST PHSSST OOOONK",
  "OH... I WAS TOO LATE!!",
  "IT'S NOTHING BUT A CHAIN FROM A DIME STORE NECKLACE.",
  "COMMUNISTS!!",
  "GYAK",
  "DDDDDDDDDDDDD",
  "PLUS! YOU GET A FROG THAT HUMS A THREE NOTE DOODLE!",
  "FORSOOTH!",
  "IF I PULL INTO A TRUCK STOP I'LL WASTE TIME SWAPPIN LIES WITH OTHER DRIVERS",
  "TELL HIM IT'S TABASCO!",
  "MMM! THAT AROMA TELLS ME AN ARTIST IS IN THERE!",
  "LOOK, WHEN I USE LIVE BAIT, THEY BITE MORE!",
  "ARE YOU DEAD?",
  "THAT'S A STRANGE REQUEST",
  "HEY! THIS WOULD MAKE A SWELL SPACESHIP!",
  "TWINKLE, TWINKLE ENORMOUS COSMIC FURNACE!",
  "IN THIS ISSUE:", "DADADAY",
  "SPECIAL OUTDOOR EMBALMING ISSUE",
  "CHUCK STAKE VISIT 491",
  "SLUJ INTERNATIONAL 75",
  "THE BODY CAVITIES RUPTURE",
  "THE SYSTEM IS THE SOLUTION",
  "ARE WE NOT MEN?",
  "CASEY",
  "ON NEW YEAR'S DAY OF JANUARY 1975",
  "CIRCULATION",
];


/* ════════════════════════════════════════════════════════════
   POLYPHONIC TTS — POOL D'IFRAMES
   ════════════════════════════════════════════════════════════
   Chaque iframe possède son propre window.speechSynthesis.
   Elles tournent en parallèle → vraie superposition de voix.
   ════════════════════════════════════════════════════════════ */

const POOL_SIZE = 6;   /* nombre de voix simultanées max */
const ttsPool   = [];  /* slots : { id, iframe, busy, pan } */

/*
   Code injecté dans chaque iframe via srcdoc.
   Reçoit { type:'speak', id, text, rate, pitch, volume } via postMessage.
   Répond { type:'started'|'done', id }.
*/
const IFRAME_CODE = `<!DOCTYPE html><html><body><script>
var s = window.speechSynthesis, vv = [];
function lv(){ vv = s.getVoices(); }
lv();
if(s.onvoiceschanged !== undefined){ s.onvoiceschanged = lv; }
window.addEventListener('message', function(e){
  if(!e.data || e.data.type !== 'speak') return;
  var d = e.data;
  var u = new SpeechSynthesisUtterance(d.text);
  u.lang   = 'en-US';
  u.rate   = d.rate   || 0.72;
  u.pitch  = d.pitch  || 0.88;
  u.volume = d.volume || 0.70;
  var picked = vv.find(function(v){ return v.lang === 'en-US' && /google/i.test(v.name); })
            || vv.find(function(v){ return v.lang.startsWith('en'); })
            || vv[0];
  if(picked) u.voice = picked;
  u.onstart = function(){ e.source.postMessage({type:'started', id:d.id}, '*'); };
  u.onend   = function(){ e.source.postMessage({type:'done',    id:d.id}, '*'); };
  u.onerror = function(){ e.source.postMessage({type:'done',    id:d.id}, '*'); };
  s.speak(u);
});
<\/script></body></html>`;

function buildTTSPool() {
  for (let i = 0; i < POOL_SIZE; i++) {
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;";
    iframe.srcdoc = IFRAME_CODE;
    document.body.appendChild(iframe);
    ttsPool.push({ id: i, iframe, busy: false, pan: 0 });
  }
}

/* Écoute les réponses des iframes */
window.addEventListener("message", (e) => {
  if (!e.data) return;
  const slot = ttsPool.find(s => s.id === e.data.id);
  if (!slot) return;

  if (e.data.type === "started") {
    /* Effets d'entrée : craquements depuis le côté du texte */
    initAudioEngine();
    const count = Math.floor(random(2, 6));
    for (let i = 0; i < count; i++) {
      setTimeout(() =>
        spawnCrackle(slot.pan + random(-0.16, 0.16), random(0.07, 0.20), random(280, 4200)),
        i * random(14, 52)
      );
    }
    spawnEcho(slot.pan);
  }

  if (e.data.type === "done") {
    /* Résidu sonore puis libération du slot */
    const tail = Math.floor(random(1, 4));
    for (let i = 0; i < tail; i++) {
      setTimeout(() =>
        spawnCrackle(slot.pan + random(-0.28, 0.28), random(0.02, 0.09), random(180, 2600)),
        i * random(80, 280)
      );
    }
    slot.busy = false;
  }
});

/* Envoie un texte au prochain slot libre */
function speakPolyphonic(text, pan) {
  if (!ttsReady || !ttsEnabled) return;

  const slot = ttsPool.find(s => !s.busy);
  if (!slot) return;  /* toutes les voix sont occupées */

  slot.busy = true;
  slot.pan  = pan;

  const rate   = random(0.60, 0.82);
  const pitch  = random(0.78, 0.96);
  const volume = random(0.54, 0.80);

  try {
    slot.iframe.contentWindow.postMessage(
      { type: "speak", id: slot.id, text: text.toLowerCase(), rate, pitch, volume },
      "*"
    );
  } catch (err) {
    slot.busy = false;
  }

  /*
     Craquements inter-mots estimés par timing
     (onboundary n'est pas accessible cross-iframe)
     ~420 ms par mot au rate 0.72
  */
  const words    = text.split(" ");
  const interval = Math.round(420 / rate);
  words.forEach((_, i) => {
    if (Math.random() > 0.48) {
      setTimeout(() => {
        if (!ttsEnabled) return;
        spawnCrackle(
          pan + random(-0.22, 0.22),
          random(0.03, 0.12),
          random(500, 3600)
        );
      }, i * interval + random(-40, 40));
    }
  });
}


/* ════════════════════════════════════════════════════════════
   WEB AUDIO ENGINE
   ════════════════════════════════════════════════════════════ */

let audioCtx   = null;
let masterOut  = null;
let reverbNode = null;

function initAudioEngine() {
  if (audioCtx) {
    /* Reprendre si suspendu (après un stopTransmission) */
    if (audioCtx.state === "suspended") audioCtx.resume();
    return;
  }

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  masterOut = audioCtx.createGain();
  masterOut.gain.value = 0.72;
  masterOut.connect(audioCtx.destination);

  reverbNode = buildReverb(5.0, 2.6);
  const reverbGain = audioCtx.createGain();
  reverbGain.gain.value = 0.55;
  reverbNode.connect(reverbGain);
  reverbGain.connect(masterOut);

  buildDrone();
  scheduleAmbientCrackle();
}

function buildReverb(durationSec, decay) {
  const conv   = audioCtx.createConvolver();
  const rate   = audioCtx.sampleRate;
  const length = Math.floor(rate * durationSec);
  const buf    = audioCtx.createBuffer(2, length, rate);

  for (let c = 0; c < 2; c++) {
    const ch   = buf.getChannelData(c);
    const asym = c === 0 ? 1.0 : 0.93;
    for (let i = 0; i < length; i++) {
      ch[i] = (Math.random() * 2 - 1) * asym
              * Math.pow(Math.max(0, 1 - i / length), decay);
    }
  }
  conv.buffer = buf;
  return conv;
}

function buildDrone() {
  const osc = audioCtx.createOscillator();
  osc.type  = "sawtooth";
  osc.frequency.value = 38;

  const lfo     = audioCtx.createOscillator();
  lfo.type      = "sine";
  lfo.frequency.value = 0.07;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value  = 1.6;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  lfo.start();

  const lpf = audioCtx.createBiquadFilter();
  lpf.type  = "lowpass";
  lpf.frequency.value = 90;
  lpf.Q.value = 1.2;

  const gain = audioCtx.createGain();
  gain.gain.value = 0.030;

  osc.connect(lpf);
  lpf.connect(gain);
  gain.connect(masterOut);
  osc.start();
}

function scheduleAmbientCrackle() {
  if (!audioCtx || !ttsEnabled) return;
  spawnCrackle(random(-0.9, 0.9), random(0.008, 0.044), random(200, 3200));
  setTimeout(scheduleAmbientCrackle, random(280, 1600));
}

function spawnCrackle(pan, intensity, centerFreq) {
  if (!audioCtx || !masterOut || !reverbNode) return;

  const duration = random(0.022, 0.20);
  const bufLen   = Math.floor(audioCtx.sampleRate * duration);
  const buf      = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const data     = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1)
              * Math.pow(1 - i / bufLen, random(1.1, 2.5));
  }

  const src    = audioCtx.createBufferSource();
  src.buffer   = buf;

  const filter = audioCtx.createBiquadFilter();
  filter.type  = "bandpass";
  filter.frequency.value = centerFreq || random(400, 4800);
  filter.Q.value = random(0.5, 3.8);

  const shaper = audioCtx.createWaveShaper();
  shaper.curve = makeDistortionCurve(random(5, 24));

  const panner = audioCtx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));

  const gain = audioCtx.createGain();
  gain.gain.value = intensity;

  src.connect(filter);
  filter.connect(shaper);
  shaper.connect(panner);
  panner.connect(gain);
  gain.connect(reverbNode);
  gain.connect(masterOut);
  src.start();
}

function spawnEcho(pan) {
  if (!audioCtx || !masterOut || !reverbNode) return;

  const osc = audioCtx.createOscillator();
  osc.type  = "sine";
  osc.frequency.value = random(140, 340);

  const delay = audioCtx.createDelay(3.0);
  delay.delayTime.value = random(0.20, 0.72);

  const feedback = audioCtx.createGain();
  feedback.gain.value = random(0.24, 0.42);

  const echoLpf = audioCtx.createBiquadFilter();
  echoLpf.type  = "lowpass";
  echoLpf.frequency.value = 1600;

  const panner = audioCtx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));

  const gain = audioCtx.createGain();
  const now  = audioCtx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.068, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

  osc.connect(delay);
  delay.connect(echoLpf);
  echoLpf.connect(feedback);
  feedback.connect(delay);
  delay.connect(panner);
  panner.connect(gain);
  gain.connect(reverbNode);

  osc.start();
  osc.stop(audioCtx.currentTime + 2.6);
}

function makeDistortionCurve(amount) {
  const n     = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x  = (i * 2) / n - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function vwToPan(leftVw) {
  return (parseFloat(leftVw) / 100) * 2 - 1;
}


/* ════════════════════════════
   TTS — ÉTAT & ACTIVATION
   ════════════════════════════ */

let ttsReady   = false;
let ttsEnabled = true;   /* ON par défaut — démarre au 1er geste */

/* Premier geste utilisateur : lance tout */
function activateTTS() {
  if (ttsReady) return;
  ttsReady = true;
  initAudioEngine();
  updateTransmissionBtn();
}

document.addEventListener("click",      activateTTS, { once: true, passive: true });
document.addEventListener("touchstart", activateTTS, { once: true, passive: true });
document.addEventListener("keydown",    activateTTS, { once: true, passive: true });


/* ════════════════════════════
   BOUTON TRANSMISSION
   ════════════════════════════ */

function updateTransmissionBtn() {
  const btn = document.getElementById("transmissionToggle");
  if (!btn) return;
  if (ttsEnabled) {
    btn.textContent = "TRANSMISSION";
    btn.classList.remove("tx-off");
    btn.title = "Couper la transmission";
  } else {
    btn.textContent = "TRANSMISSION OFF";
    btn.classList.add("tx-off");
    btn.title = "Relancer la transmission";
  }
}

function stopAllVoices() {
  ttsPool.forEach(slot => {
    try { slot.iframe.contentWindow.speechSynthesis.cancel(); } catch (e) {}
    slot.busy = false;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  buildTTSPool();

  /* Bouton TRANSMISSION — bas gauche */
  const txBtn = document.getElementById("transmissionToggle");
  if (txBtn) {
    txBtn.addEventListener("click", () => {
      ttsEnabled = !ttsEnabled;

      if (!ttsEnabled) {
        stopAllVoices();
        if (audioCtx) audioCtx.suspend();
      } else {
        ttsReady = true;
        initAudioEngine();           /* reprend l'AudioContext */
        scheduleAmbientCrackle();    /* relance les craquements */
      }

      updateTransmissionBtn();
    });
  }

  /* soundToggle existant — reste compatible */
  const soundBtn = document.getElementById("soundToggle");
  if (soundBtn && !(window.ECART_SOUND || []).length) {
    soundBtn.disabled      = false;
    soundBtn.style.opacity = "";
    soundBtn.title         = "Activer / désactiver les voix 491";

    soundBtn.addEventListener("click", () => {
      ttsEnabled = !ttsEnabled;
      if (!ttsEnabled) {
        stopAllVoices();
        if (audioCtx) audioCtx.suspend();
      } else {
        ttsReady = true;
        initAudioEngine();
        scheduleAmbientCrackle();
      }
      updateTransmissionBtn();
    });
  }

  updateTransmissionBtn();
});


/* ════════════════════════════
   TEXT ECOSYSTEM
   ════════════════════════════ */

const ecosystem = document.getElementById("textEcosystem");

function launchText() {
  const vertical = Math.random() > 0.62;
  const text     = archiveTexts[Math.floor(Math.random() * archiveTexts.length)];
  const leftVw   = random(4, 88);
  const pan      = vwToPan(leftVw);

  const el = document.createElement("div");
  el.className   = vertical ? "soft-text vertical-text" : "soft-text horizontal-text";
  el.style.left  = `${leftVw}vw`;
  el.style.top   = `${random(6, 84)}vh`;
  el.style.transform = "rotate(0deg)";

  ecosystem.appendChild(el);
  typeLetters(el, text, vertical);

  /* 65 % des textes sont lus — les 4 slots permettent la superposition */
  if (Math.random() < 0.65) {
    speakPolyphonic(text, pan);
  } else if (ttsEnabled && Math.random() < 0.38) {
    /* Texte muet mais craquements spatiaux */
    initAudioEngine();
    setTimeout(() =>
      spawnCrackle(pan, random(0.03, 0.10), random(400, 2800)),
      random(80, 500)
    );
  }

  setTimeout(() => {
    el.classList.add("fade-out");
    setTimeout(() => el.remove(), 5200);
  }, random(22000, 42000));
}


/* ════════════════════════════
   TYPE LETTERS
   ════════════════════════════ */

function typeLetters(el, text, vertical) {
  const letters = text.split("");
  let i = 0;

  function write() {
    if (i >= letters.length) return;
    const span       = document.createElement("span");
    span.textContent = letters[i] === " " ? "\u00A0" : letters[i];
    el.appendChild(span);
    i++;
    setTimeout(write, random(vertical ? 35 : 25, vertical ? 90 : 70));
  }

  write();
}


/* ════════════════════════════
   ORGANIC LOOP
   ════════════════════════════ */

function organicLoop() {
  if (document.querySelectorAll(".soft-text").length < 12) launchText();
  setTimeout(organicLoop, random(800, 2400));
}

organicLoop();


/* ════════════════════════════
   RANDOM
   ════════════════════════════ */

function random(min, max) {
  return Math.random() * (max - min) + min;
}
