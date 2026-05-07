/* ==========================================================
   EC@RT — INTERFACE UNIFIÉE  v3
   ========================================================== */

(function () {
  const STORAGE_KEY = "ecart_visited_zones";

  function qs(sel, root)  { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function emitPanelOpen(name) {
    document.dispatchEvent(new CustomEvent("ecart:panel-open", { detail: { panel: name } }));
  }
  function closeAllPanelsExcept(name) {
    document.dispatchEvent(new CustomEvent("ecart:panel-close-others", { detail: { panel: name } }));
  }


  /* ──────────────────────────────────────────────────────
     ZONES VISITÉES
     ────────────────────────────────────────────────────── */

  function getVisitedZones() {
    try   { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }

  function addVisitedZone(id) {
    if (!id) return;
    const v = getVisitedZones();
    if (!v.includes(id)) { v.push(id); localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); }
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
     CLUSTER
     Règle : le cluster ne se ferme JAMAIS automatiquement.
     Il reste ouvert jusqu'à ce que l'utilisateur reclique
     sur MENU ou appuie sur Escape.
     ────────────────────────────────────────────────────── */

  function initCluster() {
    const soundBtn = qs("#soundToggle");
    const mapBtn   = qs("#mobileMapToggle");
    const infoBtn  = qs("#infoToggle");

    if (!soundBtn && !mapBtn && !infoBtn) return;

    const cluster = document.createElement("div");
    cluster.className = "ecart-ui-cluster";
    cluster.id = "ecartUiCluster";

    const menuBtn = document.createElement("button");
    menuBtn.type      = "button";
    menuBtn.className = "ecart-ui-menu-btn";
    menuBtn.setAttribute("aria-label",    "Ouvrir les contrôles");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.innerHTML =
      '<span class="ecart-menu-label ecart-menu-label--closed">MENU</span>' +
      '<span class="ecart-menu-label ecart-menu-label--open">✕</span>';

    /* Ordre flex-column → SOUND (haut) · MAP · INFO · MENU (bas) */
    if (soundBtn) cluster.appendChild(soundBtn);
    if (mapBtn)   cluster.appendChild(mapBtn);
    if (infoBtn)  cluster.appendChild(infoBtn);
    cluster.appendChild(menuBtn);

    document.body.appendChild(cluster);

    let isOpen = false;

    function openCluster() {
      isOpen = true;
      cluster.classList.add("is-open");
      menuBtn.setAttribute("aria-expanded", "true");
      menuBtn.setAttribute("aria-label",    "Fermer les contrôles");
    }

    function closeCluster() {
      isOpen = false;
      cluster.classList.remove("is-open");
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute("aria-label",    "Ouvrir les contrôles");
    }

    /* MENU toggle — seul déclencheur de fermeture du cluster */
    menuBtn.addEventListener("click", e => {
      e.stopPropagation();
      isOpen ? closeCluster() : openCluster();
    });

    /* Escape ferme le cluster (et les panels ouverts) */
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeCluster();
    });

    /*
      PAS de fermeture automatique au clic extérieur.
      Le cluster reste visible tant que l'utilisateur ne
      reclique pas sur MENU.
    */

    window._ecartCluster = { open: openCluster, close: closeCluster };
  }


  /* ──────────────────────────────────────────────────────
     SOUND — lecture directe + barre audio
     ────────────────────────────────────────────────────── */

  function initSoundDirect() {
    const btn    = qs("#soundToggle");
    const sounds = window.ECART_SOUND || [];

    if (!btn) return;

    if (!sounds.length) {
      btn.disabled = true;
      btn.style.opacity = "0.28";
      btn.title = "Aucun audio disponible";
      return;
    }

    const sound = sounds[0];
    const audio = new Audio(sound.file);
    audio.preload = "metadata";

    /* ── Barre audio ── */
    const bar = document.createElement("div");
    bar.id = "ecartAudioBar";

    const metaHtml = (sound.date || sound.year)
      ? `<div class="ecart-audio-meta">${sound.date || sound.year}</div>` : "";

    bar.innerHTML = `
      <div class="ecart-audio-progress-strip" id="ecartAudioStrip"
           role="progressbar" aria-label="Progression" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
        <div class="ecart-audio-progress-fill" id="ecartAudioFill"></div>
      </div>
      <div class="ecart-audio-body">
        <button class="ecart-audio-playpause" id="ecartAudioPP" type="button" aria-label="Lecture / Pause">
          <span class="ecart-audio-icon ecart-audio-icon--play"  aria-hidden="true">▶</span>
          <span class="ecart-audio-icon ecart-audio-icon--pause" aria-hidden="true">⏸</span>
        </button>
        <div class="ecart-audio-info">
          <div class="ecart-audio-title">${sound.title || "Audio"}</div>
          ${metaHtml}
        </div>
        <div class="ecart-audio-time" aria-live="off">
          <span id="ecartAudioCurrent">00:00</span>
          <span class="ecart-audio-sep"> / </span>
          <span id="ecartAudioDuration">--:--</span>
        </div>
        <button class="ecart-audio-close" type="button" aria-label="Fermer">✕</button>
      </div>`;

    document.body.appendChild(bar);

    const fill       = qs("#ecartAudioFill");
    const strip      = qs("#ecartAudioStrip");
    const ppBtn      = qs("#ecartAudioPP");
    const closeBtn   = qs(".ecart-audio-close", bar);
    const currentEl  = qs("#ecartAudioCurrent");
    const durationEl = qs("#ecartAudioDuration");

    function fmt(sec) {
      if (!Number.isFinite(sec)) return "00:00";
      return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(Math.floor(sec%60)).padStart(2,"0")}`;
    }

    function setPlaying(on) {
      btn.classList.toggle("is-playing", on);
      bar.classList.toggle("is-playing", on);
    }

    audio.addEventListener("loadedmetadata", () => { durationEl.textContent = fmt(audio.duration); });

    audio.addEventListener("timeupdate", () => {
      if (!audio.duration) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      fill.style.width = `${pct}%`;
      strip.setAttribute("aria-valuenow", Math.round(pct));
      currentEl.textContent = fmt(audio.currentTime);
    });

    audio.addEventListener("ended", () => {
      setPlaying(false);
      fill.style.width = "0%";
      currentEl.textContent = "00:00";
      /* bar reste visible après la fin */
    });

    audio.addEventListener("error", () => {
      console.warn("[EC@RT] Erreur de chargement audio :", sound.file);
      setPlaying(false);
    });

    /* ── Lecture / Pause ── */
    function play() {
      audio.play()
        .then(() => {
          bar.classList.add("is-visible");
          document.body.classList.add("ecart-audio-active");
          setPlaying(true);
        })
        .catch(err => console.warn("[EC@RT] Lecture bloquée :", err));
    }

    function pause() {
      audio.pause();
      setPlaying(false);
      /* body.ecart-audio-active reste pour garder la barre visible */
    }

    function toggle() { audio.paused ? play() : pause(); }

    /* Bouton SOUND (dans le cluster) */
    btn.addEventListener("click", toggle);

    /* Bouton ▶/⏸ sur la barre */
    ppBtn.addEventListener("click", toggle);

    /* Seek au clic sur la bande */
    strip.addEventListener("click", e => {
      if (!audio.duration) return;
      const rect = strip.getBoundingClientRect();
      audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
    });

    /* Seek au touch */
    strip.addEventListener("touchend", e => {
      if (!audio.duration) return;
      const rect = strip.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(1, (e.changedTouches[0].clientX - rect.left) / rect.width));
      audio.currentTime = pct * audio.duration;
    }, { passive: true });

    /* Fermer la barre */
    closeBtn.addEventListener("click", () => {
      if (!audio.paused) pause();
      bar.classList.remove("is-visible");
      document.body.classList.remove("ecart-audio-active");
      audio.currentTime = 0;
      fill.style.width = "0%";
      currentEl.textContent = "00:00";
    });
  }


  /* ──────────────────────────────────────────────────────
     INFO
     Fermeture : re-clic sur le bouton INFO ou clic backdrop.
     Pas de bouton ✕ interne.
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
      const text = data.description || "";
      description.innerHTML = `<p>${text.replace(/\n/g, "<br><br>")}</p>`;
    }
if (data.gameplay && description) {
  description.innerHTML += `
    <div class="info-gameplay">
      <h3>Gameplay</h3>
      <p>${data.gameplay.replace(/\n/g, "<br><br>")}</p>
    </div>
  `;
}
    if (refBox && Array.isArray(data.references) && data.references.length) {
      refBox.innerHTML =
        "<h3>Références</h3>" +
        data.references.map(r => `<div class="info-ref-item">${r}</div>`).join("");
    }

    function openPanel() {
      closeAllPanelsExcept("info");
      panel.classList.add("is-open");
      btn.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      btn.setAttribute("aria-expanded", "true");
      emitPanelOpen("info");
    }

    function closePanel() {
      panel.classList.remove("is-open");
      btn.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      btn.setAttribute("aria-expanded", "false");
    }

    /* Re-clic sur INFO → ferme si ouvert */
    btn.addEventListener("click", () => {
      panel.classList.contains("is-open") ? closePanel() : openPanel();
    });

    /* Clic sur le backdrop (zone hors carte) → ferme */
    panel.addEventListener("click", e => { if (e.target === panel) closePanel(); });

    document.addEventListener("keydown", e => { if (e.key === "Escape") closePanel(); });

    document.addEventListener("ecart:panel-close-others", e => {
      if (e.detail?.panel !== "info") closePanel();
    });
  }


  /* ──────────────────────────────────────────────────────
     MAP
     Fermeture : re-clic sur MAP ou clic backdrop.
     ────────────────────────────────────────────────────── */

  function initMapPanel() {
    const toggle  = qs("#mobileMapToggle");
    const overlay = qs("#mobileMapOverlay");
    const panel   = qs("#mobileMapPanel");
    const status  = qs("#mobileMapStatus");

    if (!toggle || !overlay || !panel) return;

    const zones     = qsa(".mini-zone", overlay);
    const currentZone = document.body.dataset.zone || "";
    const zoneLinks = qsa(".zone-link, .section-link");

    let typingTimer = null;

    if (currentZone) addVisitedZone(currentZone);

    function setToggleState(isOpen) {
      toggle.classList.toggle("is-open", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      toggle.setAttribute("aria-label",    isOpen ? "Fermer la carte" : "Ouvrir la carte");
      overlay.setAttribute("aria-hidden",  isOpen ? "false" : "true");
    }

    function stopTyping() {
      if (typingTimer) { clearInterval(typingTimer); typingTimer = null; }
    }

    function typeText(el, text, speed) {
      if (!el) return;
      stopTyping();
      el.textContent = "";
      let i = 0;
      typingTimer = setInterval(() => {
        el.textContent = text.slice(0, ++i);
        if (i >= text.length) stopTyping();
      }, speed || 24);
    }

    function resetStatus() {
      stopTyping();
      if (status) status.textContent = "Sélectionne une zone.";
    }

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
      resetZones();
      resetStatus();
      applyVisitedZones(zones, currentZone);
      emitPanelOpen("map");
    }

    function closeMap() {
      overlay.classList.remove("is-open");
      setToggleState(false);
      resetZones();
      resetStatus();
      clearHoveredZone();
    }

    /* Re-clic sur MAP → ferme si ouvert */
    toggle.addEventListener("click", () => {
      overlay.classList.contains("is-open") ? closeMap() : openMap();
    });

    /* Clic backdrop → ferme */
    overlay.addEventListener("click", e => { if (e.target === overlay) closeMap(); });

    document.addEventListener("keydown", e => { if (e.key === "Escape") closeMap(); });

    document.addEventListener("ecart:panel-close-others", e => {
      if (e.detail?.panel !== "map") closeMap();
    });

    zones.forEach(zone => {
      zone.dataset.armed = "false";

      zone.addEventListener("mouseenter", () => {
        const id   = zone.dataset.miniZone;
        const name = zone.dataset.zoneName || `Zone ${id}`;
        if (id) setHoveredZone(id);
        if (status) typeText(status, `vers ${name}...`);
      });

      zone.addEventListener("mouseleave", () => {
        clearHoveredZone();
        if (!zones.some(z => z.dataset.armed === "true")) resetStatus();
      });

      zone.addEventListener("click", e => {
        const name    = zone.dataset.zoneName || "zone";
        const isArmed = zone.dataset.armed === "true";

        if (!isArmed) {
          e.preventDefault();
          zones.forEach(other => {
            if (other !== zone) { other.dataset.armed = "false"; other.classList.remove("is-armed"); }
          });
          zone.dataset.armed = "true";
          zone.classList.add("is-armed");
          if (status) typeText(status, `vers ${name}...`);
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
    initCluster();        /* 1. DOM reorganization + MENU toggle */
    initSoundDirect();    /* 2. Lecture directe + barre audio */
    initInfoPanel();      /* 3. Panneau INFO */
    initMapPanel();       /* 4. Panneau MAP */
  });

})();
