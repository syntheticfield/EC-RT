/* ==========================================================
   EC@RT — INTERFACE UNIFIÉE v7
   SOUND panel = overlay identique à MAP / INFO
   MAP — flèches 2 temps (arm → navigate)
   MENU — ferme les panels sans couper le son
   ========================================================== */

(function () {
  const STORAGE_KEY = "ecart_visited_zones";

  function qs(sel, root)  { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function emitPanelOpen(name) {
    document.dispatchEvent(
      new CustomEvent("ecart:panel-open", { detail: { panel: name } })
    );
  }

  /* Ferme tous les panels SAUF `name`.
     Passer "__none__" ferme tout sans exception. */
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
     CLUSTER — MENU / SOUND / MAP / INFO
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
    menuBtn.type = "button";
    menuBtn.className = "ecart-ui-menu-btn";
    menuBtn.setAttribute("aria-label", "Ouvrir les contrôles");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.innerHTML =
      '<span class="ecart-menu-label ecart-menu-label--closed">MENU</span>' +
      '<span class="ecart-menu-label ecart-menu-label--open">✕</span>';

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
      menuBtn.setAttribute("aria-label", "Fermer les contrôles");
    }

    function closeCluster() {
      isOpen = false;
      cluster.classList.remove("is-open");
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute("aria-label", "Ouvrir les contrôles");
      /*
       * ▼ Ferme les panels (cache les UI) SANS couper le son.
       *   Les handlers sound/map/info écoutent cet event et appellent
       *   setPanelVisible(false) / closeMap() / closePanel() qui
       *   cachent l'interface mais ne touchent pas à l'audio.
       */
      closeAllPanelsExcept("__none__");
    }

    menuBtn.addEventListener("click", e => {
      e.stopPropagation();
      isOpen ? closeCluster() : openCluster();
    });

    /* Escape ferme le cluster + les panels */
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeCluster();
    });

    /* ▼ Le bouton sidebar (EC@RT) ferme aussi les panels et le cluster */
    const sidebarToggle = qs(".menu-toggle");
    if (sidebarToggle) {
      sidebarToggle.addEventListener("click", () => {
        closeAllPanelsExcept("__sidebar__");
        if (isOpen) {
          isOpen = false;
          cluster.classList.remove("is-open");
          menuBtn.setAttribute("aria-expanded", "false");
          menuBtn.setAttribute("aria-label", "Ouvrir les contrôles");
        }
      });
    }

    window._ecartCluster = { open: openCluster, close: closeCluster };
  }

  /* ──────────────────────────────────────────────────────
     SOUND — overlay identique à MAP / INFO
     ────────────────────────────────────────────────────── */

  function initSoundDirect() {
    const btn = qs("#soundToggle");
    if (!btn) return;

    let sounds = Array.isArray(window.ECART_SOUND) ? [...window.ECART_SOUND] : [];

    const hasVoiceAlready = sounds.some(s => s.type === "voice");
    if (!hasVoiceAlready) {
      sounds.push({ title: "Voix de l'écran", type: "voice" });
    }

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

    /*
     * ▼ Panel = overlay fullscreen (même structure que #infoPanel)
     *   .ecart-audio-panel-inner = la card centrée
     */
    const panel = document.createElement("div");
    panel.id = "ecartAudioPanel";
    panel.setAttribute("aria-hidden", "true");

    panel.innerHTML = `
      <div class="ecart-audio-panel-inner">
        <h2 class="ecart-audio-panel-title">SOUND</h2>

        <div class="ecart-audio-main">
          <button
            class="ecart-audio-playpause"
            id="ecartAudioPP"
            type="button"
            aria-label="Lecture / Pause"
          >▶</button>

          <div class="ecart-audio-info">
            <div class="ecart-audio-now" id="ecartAudioNow">Audio</div>
            <div
              class="ecart-audio-progress-strip"
              id="ecartAudioStrip"
              role="progressbar"
              aria-valuenow="0"
            >
              <div class="ecart-audio-progress-fill" id="ecartAudioFill"></div>
            </div>
          </div>
        </div>

        <div class="ecart-audio-tracklist" id="ecartAudioTracklist"></div>
      </div>
    `;

    document.body.appendChild(panel);

    const tracklist = qs("#ecartAudioTracklist", panel);
    const nowEl     = qs("#ecartAudioNow",        panel);
    const fill      = qs("#ecartAudioFill",        panel);
    const strip     = qs("#ecartAudioStrip",       panel);
    const ppBtn     = qs("#ecartAudioPP",          panel);

    /* ── Visibilité panel (NE TOUCHE PAS À L'AUDIO) ────── */
    function setPanelVisible(on) {
      panel.classList.toggle("is-visible", on);
      panel.setAttribute("aria-hidden", on ? "false" : "true");
      btn.classList.toggle("is-open", on);
    }

    function setPlaying(on) {
      btn.classList.toggle("is-playing", on);
      panel.classList.toggle("is-playing", on);
      ppBtn.textContent = on ? "⏸" : "▶";
    }

    function resetProgress() {
      fill.style.width = "0%";
      strip.setAttribute("aria-valuenow", "0");
    }

    /* Arrête le son et la voix */
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

    function collectScreenText() {
      const info  = window.ECART_INFO || {};
      const texts = [];
      if (info.title)       texts.push(info.title);
      if (info.subtitle)    texts.push(info.subtitle);
      if (info.description) texts.push(info.description);
      if (info.gameplay)    texts.push(info.gameplay);
      if (Array.isArray(info.references)) texts.push(...info.references);
      const clean = texts.map(t => String(t).replace(/\s+/g, " ").trim()).filter(Boolean);
      return clean.length ? clean.join(". ") : "Aucune information disponible pour cette zone.";
    }

    function speakText(text) {
      const content = text?.trim() || "Aucun texte lisible détecté dans cette zone.";
      const utterance = new SpeechSynthesisUtterance(content);
      utterance.lang   = "fr-FR";
      utterance.rate   = 0.88;
      utterance.pitch  = 0.92;
      utterance.volume = 1;
      utterance.onstart = () => {
        currentMode = "voice";
        setPlaying(true);
        fill.style.width = "100%";
        strip.setAttribute("aria-valuenow", "100");
      };
      utterance.onend   = () => { setPlaying(false); resetProgress(); };
      utterance.onerror = () => { setPlaying(false); resetProgress(); };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }

    function loadTrack(index, autoplay = false) {
      currentIndex = index;
      const sound = sounds[currentIndex];
      stopAll();
      resetProgress();
      nowEl.textContent = sound.title || `Piste ${currentIndex + 1}`;
      updateActiveTrack();
      setPanelVisible(true);

      if (sound.type === "voice") {
        currentMode = "voice";
        audio.removeAttribute("src");
        if (autoplay) speakText(collectScreenText());
        return;
      }

      currentMode = "audio";
      if (!sound.file) { console.warn("[EC@RT] Piste sans fichier :", sound); setPlaying(false); return; }
      audio.src = sound.file;
      audio.currentTime = 0;
      audio.load();
      if (autoplay) play();
      else setPlaying(false);
    }

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
      if (sound?.type === "voice") { panel.classList.contains("is-playing") ? pause() : play(); return; }
      audio.paused ? play() : pause();
    }

    /* Tracklist */
    sounds.forEach((sound, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "ecart-audio-track";
      item.innerHTML = `
        <span class="ecart-audio-track-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="ecart-audio-track-title">${sound.title || `Piste ${index + 1}`}</span>
        <span class="ecart-audio-track-meta">${sound.date || sound.year || ""}</span>
      `;
      item.addEventListener("click", () => loadTrack(index, true));
      tracklist.appendChild(item);
    });

    /* Progression audio */
    audio.addEventListener("loadedmetadata", resetProgress);

    audio.addEventListener("timeupdate", () => {
      if (!audio.duration) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      fill.style.width = `${pct}%`;
      strip.setAttribute("aria-valuenow", Math.round(pct));
    });

    audio.addEventListener("ended",  () => { setPlaying(false); resetProgress(); audio.currentTime = 0; });
    audio.addEventListener("error",  () => { console.warn("[EC@RT] Erreur audio :", audio.src); setPlaying(false); resetProgress(); });

    strip.addEventListener("click", e => {
      if (currentMode === "voice" || !audio.duration) return;
      const rect = strip.getBoundingClientRect();
      audio.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * audio.duration;
    });

    strip.addEventListener("touchend", e => {
      if (currentMode === "voice" || !audio.duration) return;
      const rect  = strip.getBoundingClientRect();
      const touch = e.changedTouches[0];
      audio.currentTime = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width)) * audio.duration;
    }, { passive: true });

    /* Bouton SOUND dans le cluster */
    btn.addEventListener("click", () => {
      const isOpen = panel.classList.contains("is-visible");
      if (isOpen) {
        setPanelVisible(false);
      } else {
        closeAllPanelsExcept("sound");
        setPanelVisible(true);
        updateActiveTrack();
        emitPanelOpen("sound");
      }
    });

    ppBtn.addEventListener("click", togglePlay);

    /* Clic sur l'overlay (hors card) → ferme le panel (pas le son) */
    panel.addEventListener("click", e => {
      if (e.target === panel) setPanelVisible(false);
    });

    /* ▼ Ferme le panel quand un autre ouvre — NE COUPE PAS LE SON */
    document.addEventListener("ecart:panel-close-others", e => {
      if (e.detail?.panel !== "sound") setPanelVisible(false);
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") setPanelVisible(false);
    });

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

    btn.addEventListener("click", () => {
      panel.classList.contains("is-open") ? closePanel() : openPanel();
    });

    panel.addEventListener("click", e => { if (e.target === panel) closePanel(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closePanel(); });
    document.addEventListener("ecart:panel-close-others", e => {
      if (e.detail?.panel !== "info") closePanel();
    });
  }

  /* ──────────────────────────────────────────────────────
     MAP — flèches 2 temps (arm → navigate)
     Corrections : e.stopPropagation() sur les zones,
                   z-index géré en CSS pour les overlaps
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

    /* ── Liste triée des zones depuis les mini-zones ─────── */
    const zoneList = [...zones]
      .map(z => ({
        id:   z.dataset.miniZone,
        name: z.dataset.zoneName || `Zone ${z.dataset.miniZone}`,
        href: z.getAttribute("href")
      }))
      .filter(z => z.id && z.href)
      .sort((a, b) => parseInt(a.id) - parseInt(b.id));

    const curIdx     = zoneList.findIndex(z => z.id === currentZone);
    const defaultLabel = curIdx >= 0 ? zoneList[curIdx].name : "Sélectionne une zone.";

    /* ── Construction de la barre nav ────────────────────── */
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

    /*
     * ── Système flèches 2 temps ──────────────────────────
     *
     * armedByArrow = null                → aucune zone armée par flèche
     * armedByArrow = { idx, dir, el }    → zone armée, en attente 2e tap
     *
     * 1er tap flèche → arm la zone cible sur la minimap + affiche son nom
     * 2e tap MÊME flèche → navigue vers cette zone
     * Tap flèche opposée → désarme et re-arm l'autre côté
     */
    let armedByArrow = null;

    function clearArrow() {
      if (armedByArrow?.el) {
        armedByArrow.el.classList.remove("is-armed");
        armedByArrow.el.dataset.armed = "false";
      }
      if (navPrev) navPrev.classList.remove("is-armed");
      if (navNext) navNext.classList.remove("is-armed");
      armedByArrow = null;
    }

    function armByArrow(idx, dir) {
      /* Désarme les zones armées manuellement */
      zones.forEach(z => { z.dataset.armed = "false"; z.classList.remove("is-armed"); });
      clearArrow();

      const target = zoneList[idx];
      if (!target) return;

      /* Trouve l'élément minizone correspondant */
      const el = qs(`.mini-zone[data-mini-zone="${target.id}"]`, overlay);

      if (el) {
        el.dataset.armed = "true";
        el.classList.add("is-armed");
      }

      /* Met en valeur la flèche active */
      const btn = dir === "prev" ? navPrev : navNext;
      if (btn) btn.classList.add("is-armed");

      /* Écrit le nom */
      if (status) typeText(status, `vers ${target.name}…`);

      armedByArrow = { idx, dir, el: el || null };
    }

    function navigateArmed() {
      if (!armedByArrow) return;
      addVisitedZone(zoneList[armedByArrow.idx].id);
      window.location.href = zoneList[armedByArrow.idx].href;
    }

    /* Flèche gauche */
    if (navPrev && zoneList.length > 1) {
      navPrev.addEventListener("click", e => {
        e.stopPropagation();
        const idx = (curIdx - 1 + zoneList.length) % zoneList.length;
        if (armedByArrow && armedByArrow.dir === "prev" && armedByArrow.idx === idx) {
          navigateArmed();
        } else {
          armByArrow(idx, "prev");
        }
      });
    }

    /* Flèche droite */
    if (navNext && zoneList.length > 1) {
      navNext.addEventListener("click", e => {
        e.stopPropagation();
        const idx = (curIdx + 1) % zoneList.length;
        if (armedByArrow && armedByArrow.dir === "next" && armedByArrow.idx === idx) {
          navigateArmed();
        } else {
          armByArrow(idx, "next");
        }
      });
    }

    let typingTimer = null;

    function setToggleState(isMapOpen) {
      toggle.classList.toggle("is-open", isMapOpen);
      toggle.setAttribute("aria-expanded",  isMapOpen ? "true"           : "false");
      toggle.setAttribute("aria-label",     isMapOpen ? "Fermer la carte" : "Ouvrir la carte");
      overlay.setAttribute("aria-hidden",   isMapOpen ? "false"          : "true");
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

    /* Remet le label au nom de la zone courante */
    function resetStatus() {
      stopTyping();
      if (status) status.textContent = defaultLabel;
    }

    function resetZones() {
      stopTyping();
      clearArrow(); /* ← réinitialise l'état des flèches */
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

    toggle.addEventListener("click", () => {
      overlay.classList.contains("is-open") ? closeMap() : openMap();
    });

    overlay.addEventListener("click", e => { if (e.target === overlay) closeMap(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeMap(); });
    document.addEventListener("ecart:panel-close-others", e => {
      if (e.detail?.panel !== "map") closeMap();
    });

    /* ── Interactions zones minimap ─────────────────────── */

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
        if (!zones.some(z => z.dataset.armed === "true") && !armedByArrow) resetStatus();
      });

      zone.addEventListener("click", e => {
        /*
         * ▼ stopPropagation corrige le problème de récursivité :
         *   zone-11 est positionnée DANS zone-10 dans la map.
         *   Sans stopPropagation, le clic pourrait atteindre une zone parente.
         */
        e.stopPropagation();

        const name    = zone.dataset.zoneName || "zone";
        const isArmed = zone.dataset.armed === "true";

        if (!isArmed) {
          /* 1er tap → arm */
          zones.forEach(other => {
            if (other !== zone) { other.dataset.armed = "false"; other.classList.remove("is-armed"); }
          });
          clearArrow(); /* désarme les flèches si une zone armée manuellement */

          zone.dataset.armed = "true";
          zone.classList.add("is-armed");
          if (status) typeText(status, `vers ${name}…`);
          return;
        }

        /* 2e tap → navigue */
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
    initSoundDirect();
    initInfoPanel();
    initMapPanel();
  });
})();
