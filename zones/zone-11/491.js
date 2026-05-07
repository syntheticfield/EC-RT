/* ═══════════════════════════
   GIF IMAGES
   ═══════════════════════════ */

const frames = [
  "./img/ART_01.jpeg",
  "./img/ART_02.jpeg",
  "./img/ART_03.jpeg"
];

const gifFrame =
  document.getElementById("gifFrame");

let frameIndex = 0;

/* faux gif */

setInterval(() => {

  frameIndex =
    (frameIndex + 1) % frames.length;

  gifFrame.src =
    frames[frameIndex];

}, 950);

/* ═══════════════════════════
   ARCHIVE TEXTS
   ═══════════════════════════ */

const archiveTexts = [

  "DADA",
  "491",
  "4.49.91",
  "NO.6",
  "the system is the solution",
   "THE LAST SHEET OF THE WINTER!",
  "THAT'S THE DOORBELL!",
  "QUACK",
  "WOOF! 1965! LAMP",
   "the system is the solution",

  "OONK OONK PHSSST PHSSST OOOONK",
  "the system is the solution",

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

  "IN THIS ISSUE:",
  "DADADAY",

  "SPECIAL OUTDOOR EMBALMING ISSUE",

  "CHUCK STAKE VISIT 491",

  "SLUJ INTERNATIONAL 75",

  "THE BODY CAVITIES RUPTURE",

  "THE LAST SHEET OF THE WINTER!",

  "COMMUNISTS!!",

  "IT'S NOTHING BUT A CHAIN FROM A DIME STORE NECKLACE.",

  "THE SYSTEM IS THE SOLUTION",

  "ARE WE NOT MEN?",

  "SPECIAL OUTDOOR EMISSARY",

  "TEXTE SUR LES SCREENS DES ARCHIVES",

  "TWINKLE TWINKLE ENORMOUS COSMIC FURNACE!",

  "LOOK WHEN I USE LIVE BAIT THEY BITE MORE!",

  "CASEY",

  "ON NEW YEAR'S DAY OF JANUARY 1975",

  "CIRCULATION",


];

/* ═══════════════════════════
   TEXT ECOSYSTEM
   ═══════════════════════════ */

const ecosystem =
  document.getElementById(
    "textEcosystem"
  );

/* ═══════════════════════════
   CREATE TEXT
   ═══════════════════════════ */

function launchText() {

  const vertical =
    Math.random() > 0.62;

  const text =
    archiveTexts[
      Math.floor(
        Math.random()
        * archiveTexts.length
      )
    ];

  const el =
    document.createElement("div");

  el.className =
    vertical
      ? "soft-text vertical-text"
      : "soft-text horizontal-text";

  /* positions fixes */

  el.style.left =
    `${random(4, 88)}vw`;

  el.style.top =
    `${random(6, 84)}vh`;

  /* aucune rotation */

  el.style.transform =
    "rotate(0deg)";

  ecosystem.appendChild(el);

  /* écriture */

  typeLetters(el, text, vertical);

  /* disparition */

  setTimeout(() => {

    el.classList.add("fade-out");

    setTimeout(() => {
      el.remove();
    }, 2400);

  }, random(9000, 18000));
}

/* ═══════════════════════════
   TYPE LETTERS
   ═══════════════════════════ */

function typeLetters(
  el,
  text,
  vertical
) {

  const letters =
    text.split("");

  let i = 0;

  function write() {

    if (i >= letters.length)
      return;

    const span =
      document.createElement("span");

    span.textContent =
      letters[i] === " "
        ? "\u00A0"
        : letters[i];

    el.appendChild(span);

    i++;

    /* rapide */

    setTimeout(

      write,

      random(
        vertical ? 35 : 25,
        vertical ? 90 : 70
      )

    );
  }

  write();
}

/* ═══════════════════════════
   ORGANIC LOOP
   ═══════════════════════════ */

function organicLoop() {

  const active =
    document.querySelectorAll(
      ".soft-text"
    ).length;

  if (active < 12) {
    launchText();
  }

  setTimeout(

    organicLoop,

    random(800, 2400)

  );
}

organicLoop();

/* ═══════════════════════════
   RANDOM
   ═══════════════════════════ */

function random(min, max) {

  return (
    Math.random()
    * (max - min)
    + min
  );
}