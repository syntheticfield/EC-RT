const frames = [
  "./img/ART_01.jpeg",
  "./img/ART_02.jpeg",
  "./img/ART_03.jpeg",
];
const archiveTexts = [
  "DADA",
  "491",
  "4.49.91",
  "NO.6",
  "1973",
  "1977",
  "1978",
  "ASSUME POWER",
  "ARE WE NOT MEN?",
  "THE SYSTEM IS THE SOLUTION",
  "SPECIAL OUTDOOR EMISSARY",
  "ARCHIVE / SIGNAL / NOISE",
  "TEXTE SUR LES SCREENS DES ARCHIVES",
  "CIRCULATION",
  "FRAGMENT",
  "SCAN",
  "COPY",
  "EMERGENCE NUMERIQUE"
];

const ecosystem = document.getElementById("textEcosystem");

let cursorX = 24;
let cursorY = 28;

const lineHeight = 34;
const marginX = 24;
const marginY = 28;

function writeArchiveText() {
  const el = document.createElement("span");
  const text = archiveTexts[Math.floor(Math.random() * archiveTexts.length)];

  el.className = "written-fragment";
  el.textContent = text;

  ecosystem.appendChild(el);

  el.style.left = `${cursorX}px`;
  el.style.top = `${cursorY}px`;

  const width = el.offsetWidth + 28;

  cursorX += width;

  if (cursorX > window.innerWidth - 220) {
    cursorX = marginX;
    cursorY += lineHeight;
  }

  if (cursorY > window.innerHeight - 80) {
    cursorX = marginX;
    cursorY = marginY;
    ecosystem.innerHTML = "";
  }
}

setInterval(writeArchiveText, 180);

/* rythme irrégulier, pas mécanique */
setInterval(() => {
  spawnText();

  if (Math.random() > 0.65) {
    setTimeout(spawnText, random(80, 420));
  }

  if (Math.random() > 0.9) {
    burst();
  }
}, 520);

function burst() {
  const amount = Math.floor(random(6, 16));
  for (let i = 0; i < amount; i++) {
    setTimeout(spawnText, i * random(25, 90));
  }
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}