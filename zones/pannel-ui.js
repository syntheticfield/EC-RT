/* ==========================================================
   EC@RT — INTERFACE UNIFIÉE v9
   ========================================================== */

(function () {
  const STORAGE_KEY = "ecart_visited_zones";
  const LIGHT_KEY   = "ecart_light_mode";
  const FOCUS_KEY   = "ecart_focus_mode";

  /* ── Icônes SVG — [6] identiques desktop/tablette/phone ── */
  const SVG_EYE_OPEN = `<svg class="eye-open" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

  const SVG_EYE_CLOSED = `<svg class="eye-closed" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  const SVG_SUN = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></svg>`;

  /* [5][6] SVG play/pause — rendu identique sur tous les appareils */
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
     ZONES VISITÉES
     ────────────────────────────────────────────────────── */

  function getVisitedZones() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }

  function addVisitedZone(id) {
    if (!id) return;
    const visited = getVisitedZones();
    if (!visited.includes(id)) {
      visited.push(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visited));
    }
  }

  function applyVisitedZones(zones, currentZone) {
    const visited = getVisitedZones();
    zones.forEach(zone => {
      const id = zone.dataset.miniZone;
      const isCurrent = id === currentZone;
      zone.classList.toggle("is-current", isCurrent);
      zone.classList.toggle("active",     isCurrent);
      zone.classList.toggle("is-visited", visited.includes(id) && !isCurrent);
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

    if (soundBtn) cluster.appendChild(soundBtn);
    if (mapBtn)   cluster.appendChild(mapBtn);
    if (infoBtn)  cluster.appendChild(infoBtn);

    document.body.appendChild(cluster);

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeAllPanelsExcept("__none__");
    });
  }

  /* ──────────────────────────────────────────────────────
     TOAST — "SURFACE PHOTOSENSIBLE : ON / OFF"
     [3] Taille réduite, positionné à gauche du bouton œil
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
     SOUND — [5] chaque piste = lecteur indépendant
     [6] SVG play/pause identique partout
     ────────────────────────────────────────────────────── */

  function initSoundDirect() {
    const btn = qs("#soundToggle");
    if (!btn) return;

    let sounds = Array.isArray(window.ECART_SOUND) ? [...window.ECART_SOUND] : [];
    const hasVoice = sounds.some(s => s.type === "voice");
    if (!hasVoice) sounds.push({ title: "Voix de l'écran", type: "voice" });

    if (!sounds.length) {
      btn.disabled = true;
      btn.style.opacity = "0.28";
      btn.title = "Aucun audio disponible";
      return;
    }

    let currentIndex = 0;
    let currentMode  = "audio";

    const audio = new Audio();
    audio.preload = "metadata";

    /* ── Création du panel — sans lecteur global ── */
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

    /* ── État panel ── */
    function setPanelVisible(on) {
      panel.classList.toggle("is-visible", on);
      panel.setAttribute("aria-hidden", on ? "false" : "true");
      btn.classList.toggle("is-open", on);
    }

    /* ── [5][6] Met à jour tous les boutons pp ── */
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
      window.speechSynthesis.cancel();
      setPlaying(false);
    }

    function updateActiveTrack() {
      qsa(".ecart-audio-track", tracklist).forEach((el, i) => {
        el.classList.toggle("is-active", i === currentIndex);
      });
    }

    /* ── Voix ── */
    function collectScreenText() {
      const info  = window.ECART_INFO || {};
      const texts = [];
      if (info.title)       texts.push(info.title);
      if (info.subtitle)    texts.push(info.subtitle);
      if (info.description) texts.push(info.description);
      if (info.gameplay)    texts.push(info.gameplay);
      if (Array.isArray(info.references)) texts.push(...info.references);
      const clean = texts.map(t => String(t).replace(/\s+/g, " ").trim()).filter(Boolean);
      return clean.length ? clean.join(". ") : "Aucune information disponible.";
    }

    function speakText(text) {
      const content = text?.trim() || "Aucun texte lisible détecté.";
      const utterance = new SpeechSynthesisUtterance(content);
      utterance.lang = "fr-FR"; utterance.rate = 0.88; utterance.pitch = 0.92; utterance.volume = 1;
      utterance.onstart = () => {
        currentMode = "voice";
        setPlaying(true);
        const s = sounds[currentIndex];
        if (s?._fillEl) s._fillEl.style.width = "100%";
      };
      utterance.onend = utterance.onerror = () => { setPlaying(false); resetProgress(); };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }

    /* ── Lecture ── */
    function play() {
      const sound = sounds[currentIndex];
      if (sound?.type === "voice") { speakText(collectScreenText()); return; }
      if (!audio.src) { loadTrack(currentIndex, true); return; }
      window.speechSynthesis.cancel();
      audio.play()
        .then(() => { currentMode = "audio"; setPanelVisible(true); setPlaying(true); })
        .catch(err => { console.warn("[EC@RT] Lecture bloquée :", err); setPlaying(false); });
    }

    function pause() {
      if (currentMode === "voice") window.speechSynthesis.cancel();
      else audio.pause();
      setPlaying(false);
    }

    function togglePlay() {
      const sound = sounds[currentIndex];
      if (sound?.type === "voice") {
        panel.classList.contains("is-playing") ? pause() : play();
        return;
      }
      audio.paused ? play() : pause();
    }

    function loadTrack(index, autoplay = false) {
      currentIndex = index;
      const sound  = sounds[currentIndex];
      stopAll(); resetProgress();
      updateActiveTrack();
      setPanelVisible(true);

      if (sound.type === "voice") {
        currentMode = "voice";
        audio.removeAttribute("src");
        if (autoplay) speakText(collectScreenText());
        return;
      }

      currentMode = "audio";
      if (!sound.file) {
        console.warn("[EC@RT] Piste sans fichier :", sound);
        setPlaying(false);
        return;
      }
      audio.src = sound.file; audio.currentTime = 0; audio.load();
      if (autoplay) play(); else setPlaying(false);
    }

    /* ── [5] Génération des pistes — lecteur par piste ── */
    sounds.forEach((sound, index) => {
      const item = document.createElement("div");
      item.className = "ecart-audio-track";

      /* Bouton play/pause propre à cette piste */
      const ppBtn = document.createElement("button");
      ppBtn.type      = "button";
      ppBtn.className = "ecart-track-pp";
      ppBtn.innerHTML = SVG_PLAY;
      ppBtn.setAttribute("aria-label", "Lecture");

      /* Corps : titre + barre de progression */
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

      /* Références stockées sur l'objet sound */
      sound._ppEl   = ppBtn;
      sound._fillEl = fill;
      sound._strip  = strip;

      /* Clic sur le bouton pp */
      ppBtn.addEventListener("click", e => {
        e.stopPropagation();
        if (currentIndex === index) togglePlay();
        else loadTrack(index, true);
      });

      /* Clic sur le corps de piste */
      body.addEventListener("click", () => {
        if (currentIndex === index) togglePlay();
        else loadTrack(index, true);
      });

      /* Seek sur la barre — pointer */
      strip.addEventListener("click", e => {
        e.stopPropagation();
        if (currentMode === "voice" || !audio.duration || currentIndex !== index) return;
        const rect = strip.getBoundingClientRect();
        audio.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * audio.duration;
      });

      /* Seek tactile */
      strip.addEventListener("touchend", e => {
        e.stopPropagation();
        if (currentMode === "voice" || !audio.duration || currentIndex !== index) return;
        const rect  = strip.getBoundingClientRect();
        const touch = e.changedTouches[0];
        audio.currentTime = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width)) * audio.duration;
      }, { passive: true });
    });

    /* ── Événements audio ── */
    audio.addEventListener("loadedmetadata", resetProgress);

    audio.addEventListener("timeupdate", () => {
      if (!audio.duration) return;
      const pct  = (audio.currentTime / audio.duration) * 100;
      const s    = sounds[currentIndex];
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

    /* ── Bouton cluster SOUND ── */
    btn.addEventListener("click", () => {
      panel.classList.contains("is-visible")
        ? setPanelVisible(false)
        : (closeAllPanelsExcept("sound"), setPanelVisible(true), updateActiveTrack(), emitPanelOpen("sound"));
    });

    /* ── Fermeture ── */
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

    function openPanel()  {
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
     ────────────────────────────────────────────────────── */

  function initMapPanel() {
    const toggle  = qs("#mobileMapToggle");
    const overlay = qs("#mobileMapOverlay");
    const panel   = qs("#mobileMapPanel");
    if (!toggle || !overlay || !panel) return;

    const zones       = qsa(".mini-zone", overlay);
    const currentZone = document.body.dataset.zone || "";
    const zoneLinks   = qsa(".zone-link, .section-link");

    if (currentZone) addVisitedZone(currentZone);

    const zoneList = [...zones]
      .map(z => ({ id: z.dataset.miniZone, name: z.dataset.zoneName || `Zone ${z.dataset.miniZone}`, href: z.getAttribute("href") }))
      .filter(z => z.id && z.href)
      .sort((a, b) => parseInt(a.id) - parseInt(b.id));

    const curIdx       = zoneList.findIndex(z => z.id === currentZone);
    const defaultLabel = curIdx >= 0 ? zoneList[curIdx].name : "Sélectionne une zone.";

    const statusWrap = qs(".mobile-map-status-wrap", overlay);
    if (statusWrap) {
      statusWrap.innerHTML = `
        <div class="map-nav-bar">
          <button class="map-nav-btn" id="mapNavPrev" type="button" aria-label="Zone précédente">&#8592;</button>
          <span class="mobile-map-status map-nav-label" id="mobileMapStatus">${defaultLabel}</span>
          <button class="map-nav-btn" id="mapNavNext" type="button" aria-label="Zone suivante">&#8594;</button>
        </div>
      `;
    }

    const status  = qs("#mobileMapStatus");
    const navPrev = qs("#mapNavPrev");
    const navNext = qs("#mapNavNext");

    if (navPrev && zoneList.length > 1) {
      navPrev.addEventListener("click", e => {
        e.stopPropagation();
        const idx = (curIdx - 1 + zoneList.length) % zoneList.length;
        addVisitedZone(zoneList[idx].id);
        window.location.href = zoneList[idx].href;
      });
    }

    if (navNext && zoneList.length > 1) {
      navNext.addEventListener("click", e => {
        e.stopPropagation();
        const idx = (curIdx + 1) % zoneList.length;
        addVisitedZone(zoneList[idx].id);
        window.location.href = zoneList[idx].href;
      });
    }

    let typingTimer = null;

    function setToggleState(isMapOpen) {
      toggle.classList.toggle("is-open", isMapOpen);
      toggle.setAttribute("aria-expanded",  isMapOpen ? "true" : "false");
      toggle.setAttribute("aria-label",     isMapOpen ? "Fermer la carte" : "Ouvrir la carte");
      overlay.setAttribute("aria-hidden",   isMapOpen ? "false" : "true");
    }

    function stopTyping() { if (typingTimer) { clearInterval(typingTimer); typingTimer = null; } }

    function typeText(el, text, speed) {
      if (!el) return;
      stopTyping(); el.textContent = "";
      let i = 0;
      typingTimer = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) stopTyping(); }, speed || 24);
    }

    function resetStatus() { stopTyping(); if (status) status.textContent = defaultLabel; }

    function resetZones() {
      stopTyping();
      zones.forEach(zone => {
        zone.dataset.armed = "false";
        zone.classList.remove("is-armed", "is-hovered");
        const hint = qs(".mobile-zone-hint", zone);
        if (hint) hint.textContent = "";
      });
    }

    function setHoveredZone(id) {
      zoneLinks.forEach(l => l.classList.remove("is-hovered"));
      zones.forEach(z => z.classList.remove("is-hovered"));
      qsa(`[data-zone-link="${id}"], [data-section="${id}"]`).forEach(l => l.classList.add("is-hovered"));
      qsa(`.mini-zone[data-mini-zone="${id}"]`, overlay).forEach(z => z.classList.add("is-hovered"));
    }

    function clearHoveredZone() {
      zoneLinks.forEach(l => l.classList.remove("is-hovered"));
      zones.forEach(z => z.classList.remove("is-hovered"));
    }

    function openMap() {
      closeAllPanelsExcept("map");
      overlay.classList.add("is-open");
      setToggleState(true);
      resetZones(); resetStatus();
      applyVisitedZones(zones, currentZone);
      emitPanelOpen("map");
    }

    function closeMap() {
      overlay.classList.remove("is-open");
      setToggleState(false);
      resetZones(); resetStatus(); clearHoveredZone();
    }

    toggle.addEventListener("click", () => { overlay.classList.contains("is-open") ? closeMap() : openMap(); });
    overlay.addEventListener("click", e => { if (e.target === overlay) closeMap(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeMap(); });
    document.addEventListener("ecart:panel-close-others", e => { if (e.detail?.panel !== "map") closeMap(); });

    zones.forEach(zone => {
      zone.dataset.armed = "false";

      zone.addEventListener("mouseenter", () => {
        const id   = zone.dataset.miniZone;
        const name = zone.dataset.zoneName || `Zone ${id}`;
        if (id) setHoveredZone(id);
        if (status) typeText(status, `vers ${name}…`);
      });

      zone.addEventListener("mouseleave", () => {
        clearHoveredZone();
        if (!zones.some(z => z.dataset.armed === "true")) resetStatus();
      });

      zone.addEventListener("click", e => {
        e.stopPropagation();
        const name    = zone.dataset.zoneName || "zone";
        const isArmed = zone.dataset.armed === "true";

        if (!isArmed) {
          zones.forEach(other => {
            if (other !== zone) { other.dataset.armed = "false"; other.classList.remove("is-armed"); }
          });
          zone.dataset.armed = "true";
          zone.classList.add("is-armed");
          if (status) typeText(status, `vers ${name}…`);
          return;
        }

        addVisitedZone(zone.dataset.miniZone);
      });
    });

    zoneLinks.forEach(link => {
      const id = link.dataset.zoneLink || link.dataset.section;
      if (!id) return;
      link.classList.toggle("active", id === currentZone);
      link.addEventListener("mouseenter", () => setHoveredZone(id));
      link.addEventListener("mouseleave", clearHoveredZone);
    });

    applyVisitedZones(zones, currentZone);
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
