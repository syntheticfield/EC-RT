/* ==========================================================
   EC@RT — INTERFACE UNIFIÉE v10
   ========================================================== */

(function () {
  const LIGHT_KEY  = "ecart_light_mode";
  const FOCUS_KEY  = "ecart_focus_mode";

  /* ── Icônes SVG ── */
  const SVG_EYE_OPEN = `<svg class="eye-open" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

  const SVG_EYE_CLOSED = `<svg class="eye-closed" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  const SVG_SUN = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></svg>`;

  const SVG_PLAY  = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><polygon points="6,3 20,12 6,21"/></svg>`;
  const SVG_PAUSE = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><rect x="5"  y="4" width="4.5" height="16" rx="1"/><rect x="14.5" y="4" width="4.5" height="16" rx="1"/></svg>`;

  function qs(sel, root)  { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function emitPanelOpen(name) {
    document.dispatchEvent(
      new CustomEvent("ecart:panel-open", { detail: { panel: name } })
    );
  }

  function closeAllPanelsExcept(name) {
    document.dispatchEvent(
      new CustomEvent("ecart:panel-close-others", { detail: { panel: name } })
    );
  }

  /* ──────────────────────────────────────────────────────
     [3] Zones visitées supprimées — seule la zone courante
         est marquée (is-current / active), aucune mémorisation
     ────────────────────────────────────────────────────── */

  function applyCurrentZone(zones, currentZone) {
    zones.forEach(zone => {
      const id = zone.dataset.miniZone;
      const isCurrent = id === currentZone;
      zone.classList.toggle("is-current", isCurrent);
      zone.classList.toggle("active",     isCurrent);
    });
  }

  /* ──────────────────────────────────────────────────────
     CLUSTER — SOUND / MAP / INFO
     ────────────────────────────────────────────────────── */

  function initCluster() {
    const soundBtn = qs("#soundToggle");
    const mapBtn   = qs("#mobileMapToggle");
    const infoBtn  = qs("#infoToggle");

    if (!soundBtn && !mapBtn && !infoBtn) return;

    const cluster = document.createElement("div");
    cluster.className = "ecart-ui-cluster";
    cluster.id = "ecartUiCluster";

    if (infoBtn)  cluster.appendChild(infoBtn);
if (mapBtn)   cluster.appendChild(mapBtn);
if (soundBtn) cluster.appendChild(soundBtn);

    document.body.appendChild(cluster);

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeAllPanelsExcept("__none__");
    });
  }

  /* ──────────────────────────────────────────────────────
     TOAST — "SURFACE PHOTOSENSIBLE : ON / OFF"
     ────────────────────────────────────────────────────── */

  function showToast(message) {
    const existing = qs(".ecart-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className   = "ecart-toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 2700);
  }

  /* ──────────────────────────────────────────────────────
     CONTENEUR TOP-RIGHT — #ecartTopRight
     ────────────────────────────────────────────────────── */

  function getOrCreateTopRight() {
    let el = qs("#ecartTopRight");
    if (!el) {
      el = document.createElement("div");
      el.id = "ecartTopRight";
      document.body.appendChild(el);
    }
    return el;
  }

  /* ──────────────────────────────────────────────────────
     MODE FOCUS — bouton ŒIL
     ────────────────────────────────────────────────────── */

  function initFocusMode() {
    const container = getOrCreateTopRight();

    const btn = document.createElement("button");
    btn.id        = "ecartFocusToggle";
    btn.className = "ecart-focus-btn";
    btn.type      = "button";
    btn.setAttribute("aria-label", "Mode immersif");
    btn.innerHTML = SVG_EYE_OPEN + SVG_EYE_CLOSED;

    container.appendChild(btn);

    let isActive = localStorage.getItem(FOCUS_KEY) === "1";

    function applyFocus(active) {
      document.body.classList.toggle("ecart-focus-mode", active);
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-label", active ? "Quitter le mode immersif" : "Mode immersif");
      localStorage.setItem(FOCUS_KEY, active ? "1" : "0");
      if (active) closeAllPanelsExcept("sound");
    }

    if (isActive) applyFocus(true);
    btn.addEventListener("click", () => { isActive = !isActive; applyFocus(isActive); });
  }

  /* ──────────────────────────────────────────────────────
     MODE JOUR — bouton ☀
     ────────────────────────────────────────────────────── */

  function initLightMode() {
    const container = getOrCreateTopRight();

    const btn = document.createElement("button");
    btn.id        = "ecartLightToggle";
    btn.className = "ecart-light-btn";
    btn.type      = "button";
    btn.setAttribute("aria-label", "Mode jour");
    btn.innerHTML = SVG_SUN;

    container.appendChild(btn);

    let isLight = localStorage.getItem(LIGHT_KEY) === "1";

    function applyLight(on) {
      document.documentElement.classList.toggle("ecart-light-mode", on);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-label", on ? "Mode nuit" : "Mode jour");
      localStorage.setItem(LIGHT_KEY, on ? "1" : "0");
      requestAnimationFrame(() => {
        showToast(on ? "SURFACE PHOTOSENSIBLE : ON" : "SURFACE PHOTOSENSIBLE : OFF");
      });
    }

    if (isLight) applyLight(true);
    btn.addEventListener("click", () => { isLight = !isLight; applyLight(isLight); });
  }

  /* ──────────────────────────────────────────────────────
     SOUND — chaque piste = lecteur indépendant
     ────────────────────────────────────────────────────── */

  function initSoundDirect() {
    const btn = qs("#soundToggle");
    if (!btn) return;

    let sounds = Array.isArray(window.ECART_SOUND) ? [...window.ECART_SOUND] : [];

    if (!sounds.length) {
      btn.disabled = true;
      btn.style.opacity = "0.28";
      btn.title = "Aucun audio disponible";
      return;
    }

    let currentIndex = 0;

    const audio = new Audio();
    audio.preload = "metadata";

    const panel = document.createElement("div");
    panel.id = "ecartAudioPanel";
    panel.setAttribute("aria-hidden", "true");

    panel.innerHTML = `
      <div class="ecart-audio-panel-inner">
        <h2 class="ecart-audio-panel-title">SOUND</h2>
        <div class="ecart-audio-tracklist" id="ecartAudioTracklist"></div>
      </div>
    `;

    document.body.appendChild(panel);

    const tracklist = qs("#ecartAudioTracklist", panel);

    function setPanelVisible(on) {
      panel.classList.toggle("is-visible", on);
      panel.setAttribute("aria-hidden", on ? "false" : "true");
      btn.classList.toggle("is-open", on);
    }

    function setPlaying(on) {
      btn.classList.toggle("is-playing", on);
      panel.classList.toggle("is-playing", on);

      sounds.forEach((s, i) => {
        if (!s._ppEl) return;
        const isThis = (i === currentIndex);
        s._ppEl.innerHTML = (on && isThis) ? SVG_PAUSE : SVG_PLAY;
        s._ppEl.setAttribute("aria-label", (on && isThis) ? "Pause" : "Lecture");
      });
    }

    function resetProgress() {
      const s = sounds[currentIndex];
      if (s?._fillEl) s._fillEl.style.width = "0%";
    }

    function stopAll() {
      audio.pause();
      setPlaying(false);
    }

    function updateActiveTrack() {
      qsa(".ecart-audio-track", tracklist).forEach((el, i) => {
        el.classList.toggle("is-active", i === currentIndex);
      });
    }

    function play() {
      if (!audio.src) { loadTrack(currentIndex, true); return; }
      audio.play()
        .then(() => { setPanelVisible(true); setPlaying(true); })
        .catch(err => { console.warn("[EC@RT] Lecture bloquée :", err); setPlaying(false); });
    }

    function pause() {
      audio.pause();
      setPlaying(false);
    }

    function togglePlay() {
      audio.paused ? play() : pause();
    }

    function loadTrack(index, autoplay = false) {
      currentIndex = index;
      const sound  = sounds[currentIndex];
      stopAll(); resetProgress();
      updateActiveTrack();
      setPanelVisible(true);

      if (!sound.file) {
        console.warn("[EC@RT] Piste sans fichier :", sound);
        setPlaying(false);
        return;
      }
      audio.src = sound.file; audio.currentTime = 0; audio.load();
      if (autoplay) play(); else setPlaying(false);
    }

    sounds.forEach((sound, index) => {
      const item = document.createElement("div");
      item.className = "ecart-audio-track";

      const ppBtn = document.createElement("button");
      ppBtn.type      = "button";
      ppBtn.className = "ecart-track-pp";
      ppBtn.innerHTML = SVG_PLAY;
      ppBtn.setAttribute("aria-label", "Lecture");

      const body = document.createElement("div");
      body.className = "ecart-track-body";

      const header = document.createElement("div");
      header.className = "ecart-track-header";
      header.innerHTML = `
        <span class="ecart-audio-track-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="ecart-audio-track-title">${sound.title || `Piste ${index + 1}`}</span>
      `;

      const strip = document.createElement("div");
      strip.className = "ecart-track-progress-strip";

      const fill = document.createElement("div");
      fill.className = "ecart-track-progress-fill";
      strip.appendChild(fill);

      body.appendChild(header);
      body.appendChild(strip);
      item.appendChild(ppBtn);
      item.appendChild(body);
      tracklist.appendChild(item);

      sound._ppEl   = ppBtn;
      sound._fillEl = fill;
      sound._strip  = strip;

      ppBtn.addEventListener("click", e => {
        e.stopPropagation();
        if (currentIndex === index) togglePlay();
        else loadTrack(index, true);
      });

      body.addEventListener("click", () => {
        if (currentIndex === index) togglePlay();
        else loadTrack(index, true);
      });

      strip.addEventListener("click", e => {
        e.stopPropagation();
        if (!audio.duration || currentIndex !== index) return;
        const rect = strip.getBoundingClientRect();
        audio.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * audio.duration;
      });

      strip.addEventListener("touchend", e => {
        e.stopPropagation();
        if (!audio.duration || currentIndex !== index) return;
        const rect  = strip.getBoundingClientRect();
        const touch = e.changedTouches[0];
        audio.currentTime = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width)) * audio.duration;
      }, { passive: true });
    });

    audio.addEventListener("loadedmetadata", resetProgress);

    audio.addEventListener("timeupdate", () => {
      if (!audio.duration) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      const s   = sounds[currentIndex];
      if (s?._fillEl) s._fillEl.style.width = `${pct}%`;
    });

    audio.addEventListener("ended", () => {
      setPlaying(false);
      resetProgress();
      audio.currentTime = 0;
    });

    audio.addEventListener("error", () => {
      console.warn("[EC@RT] Erreur audio :", audio.src);
      setPlaying(false);
      resetProgress();
    });

    btn.addEventListener("click", () => {
      panel.classList.contains("is-visible")
        ? setPanelVisible(false)
        : (closeAllPanelsExcept("sound"), setPanelVisible(true), updateActiveTrack(), emitPanelOpen("sound"));
    });

    panel.addEventListener("click", e => { if (e.target === panel) setPanelVisible(false); });

    document.addEventListener("ecart:panel-close-others", e => {
      if (e.detail?.panel !== "sound") setPanelVisible(false);
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") setPanelVisible(false); });

    loadTrack(0, false);
    setPanelVisible(false);
  }

  /* ──────────────────────────────────────────────────────
     INFO
     ────────────────────────────────────────────────────── */

  function initInfoPanel() {
    const btn   = qs("#infoToggle");
    const panel = qs("#infoPanel");
    if (!btn || !panel) return;

    const data        = window.ECART_INFO || {};
    const title       = qs(".info-title",       panel);
    const description = qs(".info-description", panel);
    const refBox      = qs(".info-ref",          panel);

    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "infoPanel");

    if (title) title.textContent = data.title || "Information";
    if (description) {
      description.innerHTML = `<p>${(data.description || "").replace(/\n/g, "<br><br>")}</p>`;
      if (data.gameplay) {
        description.innerHTML += `<div class="info-gameplay"><h3>Gameplay</h3><p>${data.gameplay.replace(/\n/g, "<br><br>")}</p></div>`;
      }
    }
    if (refBox && Array.isArray(data.references) && data.references.length) {
      refBox.innerHTML = "<h3>Références</h3>" + data.references.map(r => `<div class="info-ref-item">${r}</div>`).join("");
    }

    function openPanel() {
      closeAllPanelsExcept("info");
      panel.classList.add("is-open");    btn.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false"); btn.setAttribute("aria-expanded", "true");
      emitPanelOpen("info");
    }
    function closePanel() {
      panel.classList.remove("is-open"); btn.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");  btn.setAttribute("aria-expanded", "false");
    }

    btn.addEventListener("click", () => { panel.classList.contains("is-open") ? closePanel() : openPanel(); });
    panel.addEventListener("click", e => { if (e.target === panel) closePanel(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closePanel(); });
    document.addEventListener("ecart:panel-close-others", e => { if (e.detail?.panel !== "info") closePanel(); });
  }

  /* ──────────────────────────────────────────────────────
     MAP
     [3] Pas de mémorisation des zones visitées
     [4] Flèches + label injectés dans .mobile-map-status-wrap
         (position visuelle gérée par CSS order: 2)
     ────────────────────────────────────────────────────── */

  function initMapPanel() {
    const toggle  = qs("#mobileMapToggle");
    const overlay = qs("#mobileMapOverlay");
    const panel   = qs("#mobileMapPanel");
    if (!toggle || !overlay || !panel) return;

    const zones       = qsa(".mini-zone", overlay);
    const currentZone = document.body.dataset.zone || "";

    const zoneList = [...zones]
      .map(z => ({ id: z.dataset.miniZone, name: z.dataset.zoneName || `Zone ${z.dataset.miniZone}`, href: z.getAttribute("href") }))
      .filter(z => z.id && z.href)
      .sort((a, b) => parseInt(a.id) - parseInt(b.id));

    const curIdx       = zoneList.findIndex(z => z.id === currentZone);
    const defaultLabel = curIdx >= 0 ? zoneList[curIdx].name : "—";

    const SVG_PREV = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 3 L4 12 L20 21"/></svg>`;
    const SVG_NEXT = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 3 L20 12 L4 21"/></svg>`;

    const statusWrap = qs(".mobile-map-status-wrap", overlay);
    if (statusWrap) {
      statusWrap.innerHTML = `
        <div class="map-nav-bar">
          <button class="map-nav-btn" id="mapNavPrev" type="button" aria-label="Zone précédente">${SVG_PREV}</button>
          <span class="map-nav-label" id="mobileMapStatus">${defaultLabel}</span>
          <button class="map-nav-btn" id="mapNavNext" type="button" aria-label="Zone suivante">${SVG_NEXT}</button>
        </div>
      `;
    }

    const status  = qs("#mobileMapStatus");
    const navPrev = qs("#mapNavPrev");
    const navNext = qs("#mapNavNext");

    let selectedIdx = curIdx;

    function selectZone(idx) {
      selectedIdx = idx;
      if (status) status.textContent = zoneList[idx]?.name || defaultLabel;
      zones.forEach(z => z.classList.remove("is-selected"));
      const targetId = zoneList[idx]?.id;
      if (targetId) {
        const el = [...zones].find(z => z.dataset.miniZone === targetId);
        if (el) el.classList.add("is-selected");
      }
    }

    if (navPrev && zoneList.length > 1) {
      navPrev.addEventListener("click", e => {
        e.stopPropagation();
        const base = selectedIdx >= 0 ? selectedIdx : 0;
        selectZone((base - 1 + zoneList.length) % zoneList.length);
      });
    }

    if (navNext && zoneList.length > 1) {
      navNext.addEventListener("click", e => {
        e.stopPropagation();
        const base = selectedIdx >= 0 ? selectedIdx : zoneList.length - 1;
        selectZone((base + 1) % zoneList.length);
      });
    }

    function setToggleState(isOpen) {
      toggle.classList.toggle("is-open", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      toggle.setAttribute("aria-label",    isOpen ? "Fermer la carte" : "Ouvrir la carte");
      overlay.setAttribute("aria-hidden",  isOpen ? "false" : "true");
    }

    function openMap() {
      closeAllPanelsExcept("map");
      overlay.classList.add("is-open");
      setToggleState(true);
      /* [3] Seule la zone courante est marquée, pas les visitées */
      applyCurrentZone(zones, currentZone);
      selectedIdx = curIdx;
      zones.forEach(z => z.classList.remove("is-selected"));
      if (curIdx >= 0) selectZone(curIdx);
      else if (status) status.textContent = defaultLabel;
      emitPanelOpen("map");
    }

    function closeMap() {
      overlay.classList.remove("is-open");
      setToggleState(false);
      zones.forEach(z => z.classList.remove("is-selected"));
      if (status) status.textContent = defaultLabel;
    }

    toggle.addEventListener("click", () => {
      overlay.classList.contains("is-open") ? closeMap() : openMap();
    });
    overlay.addEventListener("click", e => { if (e.target === overlay) closeMap(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeMap(); });
    document.addEventListener("ecart:panel-close-others", e => {
      if (e.detail?.panel !== "map") closeMap();
    });

    zones.forEach(zone => {
      zone.addEventListener("mouseenter", () => {
        if (status) status.textContent = zone.dataset.zoneName || `Zone ${zone.dataset.miniZone}`;
      });
      zone.addEventListener("mouseleave", () => {
        if (status) status.textContent = selectedIdx >= 0
          ? (zoneList[selectedIdx]?.name || defaultLabel)
          : defaultLabel;
      });
      zone.addEventListener("click", e => {
        e.stopPropagation();
        const id  = zone.dataset.miniZone;
        const idx = zoneList.findIndex(z => z.id === id);
        if (idx < 0) return;

        if (idx !== selectedIdx) {
          e.preventDefault();
          selectZone(idx);
        } else {
          /* [3] Navigation directe — plus de mémorisation */
          window.location.href = zoneList[idx].href;
        }
      });
    });

    /* Sidebar — état actif uniquement */
    qsa(".zone-link, .section-link").forEach(link => {
      const id = link.dataset.zoneLink || link.dataset.section;
      if (id) link.classList.toggle("active", id === currentZone);
    });

    /* [3] Marquer seulement la zone courante */
    applyCurrentZone(zones, currentZone);
    setToggleState(false);
  }

  /* ──────────────────────────────────────────────────────
     BOOT
     ────────────────────────────────────────────────────── */

  document.addEventListener("DOMContentLoaded", () => {
    initCluster();
    initFocusMode();
    initLightMode();
    initSoundDirect();
    initInfoPanel();
    initMapPanel();
  });
})();
