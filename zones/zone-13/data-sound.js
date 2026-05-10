window.ECART_SOUND = [
  {
    title: "Curatorial Voice - Search & Destroy (FR)",
    file: "../../assets/son/FR/SD.mp3"
  },
  {
    title: "Curatorial Voice - Search & Destroy (ENG)",
    file: "../../assets/son/EN/SD2.mp3"
  },
];

/* ═══════════════════════════════════════════════════════
   CHANNEL — contrôle de canal master
   Lu par zone-13.js et zone-01.js dans buildSoundPanel()

   state    : "open" | "cut"
   fadeTime : durée du fondu en secondes
   label    : affiché dans le sound panel
   ═══════════════════════════════════════════════════════ */
window.ECART_CHANNEL = {
  label:    "MAIN",
  state:    "open",
  fadeTime: 0.35
};
