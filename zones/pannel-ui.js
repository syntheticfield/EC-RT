/* =========================
   EC@RT — INTERFACE UNIFIÉE
   SOUND / INFO / MAP
   Desktop + mobile
   ========================= */

(function () {
  const STORAGE_KEY = "ecart_visited_zones";

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function emitPanelOpen(panelName) {
    document.dispatchEvent(
      new CustomEvent("ecart:panel-open", {
        detail: { panel: panelName }
      })
    );
  }

  function getVisitedZones() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function addVisitedZone(zoneId) {
    if (!zoneId) return;

    const visited = getVisitedZones();

    if (!visited.includes(zoneId)) {
      visited.push(zoneId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visited));
    }
  }

  function applyVisitedZones(zones, currentZone) {
    const visitedZones = getVisitedZones();

    zones.forEach((zone) => {
      const id = zone.dataset.miniZone;
      const isVisited = visitedZones.includes(id);
      const isCurrent = id === currentZone;

      zone.classList.toggle("is-current", isCurrent);
      zone.classList.toggle("active", isCurrent);
      zone.classList.toggle("is-visited", isVisited && !isCurrent);
    });
  }

  function closeAllPanelsExcept(panelName) {
    document.dispatchEvent(
      new CustomEvent("ecart:panel-close-others", {
        detail: { panel: panelName }
      })
    );
  }

  function initInfoPanel() {
    const btn = qs("#infoToggle");
    const panel = qs("#infoPanel");
    if (!btn || !panel) return;

    const close = qs(".info-close", panel);
    const data = window.ECART_INFO || {};
    const title = qs(".info-title", panel);
    const description = qs(".info-description", panel);
    const refBox = qs(".info-ref", panel);

    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "infoPanel");

    if (title) title.textContent = data.title || "Information";

    if (description) {
      const text = data.description || "";
      description.innerHTML = `<p>${text.replace(/\n/g, "<br><br>")}</p>`;
    }

    if (refBox && Array.isArray(data.references) && data.references.length) {
      refBox.innerHTML =
        "<h3>Références</h3>" +
        data.references
          .map((item) => `<div class="info-ref-item">${item}</div>`)
          .join("");
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

    if (close) close.addEventListener("click", closePanel);

    panel.addEventListener("click", (event) => {
      if (event.target === panel) closePanel();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePanel();
    });

    document.addEventListener("ecart:panel-close-others", (event) => {
      if (event.detail?.panel !== "info") closePanel();
    });
  }

  function initSoundPanel() {
    const btn = qs("#soundToggle");
    const panel = qs("#soundPanel");
    if (!btn || !panel) return;

    const close = qs(".sound-close", panel);
    const container = qs(".sound-panel-inner", panel);
    const sounds = window.ECART_SOUND || [];

    let currentAudio = null;
    let currentButton = null;

    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "soundPanel");

    function formatTime(sec) {
      if (!Number.isFinite(sec)) return "00:00";
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    function stopCurrentAudio() {
      if (!currentAudio) return;
      currentAudio.pause();
      if (currentButton) currentButton.textContent = "Play";
      currentAudio = null;
      currentButton = null;
    }

    function openPanel() {
      closeAllPanelsExcept("sound");
      panel.classList.add("is-open");
      btn.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      btn.setAttribute("aria-expanded", "true");
      emitPanelOpen("sound");
    }

    function closePanel() {
      panel.classList.remove("is-open");
      btn.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      btn.setAttribute("aria-expanded", "false");
    }

    if (container && sounds.length && !container.dataset.rendered) {
      container.dataset.rendered = "true";

      sounds.forEach((sound, index) => {
        const block = document.createElement("div");
        block.className = "sound-item";

        block.innerHTML = `
          <div class="sound-title">${sound.title || `Son ${index + 1}`}</div>

          <div class="sound-time">
            <span class="sound-current">00:00</span>
            <span class="sound-duration">--:--</span>
          </div>

          <div class="sound-progress">
            <div class="sound-progress-fill"></div>
          </div>

          <div class="sound-controls">
            <button class="play-btn" type="button">Play</button>
          </div>

          <audio preload="metadata" src="${sound.file}"></audio>
        `;

        container.appendChild(block);

        const audio = qs("audio", block);
        const play = qs(".play-btn", block);
        const fill = qs(".sound-progress-fill", block);
        const current = qs(".sound-current", block);
        const duration = qs(".sound-duration", block);

        audio.addEventListener("loadedmetadata", () => {
          duration.textContent = formatTime(audio.duration);
        });

        play.addEventListener("click", async () => {
          if (audio.paused) {
            if (currentAudio && currentAudio !== audio) stopCurrentAudio();

            try {
              await audio.play();
              play.textContent = "Pause";
              currentAudio = audio;
              currentButton = play;
            } catch (error) {
              console.warn("Audio playback blocked or failed:", error);
            }
          } else {
            audio.pause();
            play.textContent = "Play";
            currentAudio = null;
            currentButton = null;
          }
        });

        audio.addEventListener("timeupdate", () => {
          if (!audio.duration) return;
          const pct = (audio.currentTime / audio.duration) * 100;
          fill.style.width = `${pct}%`;
          current.textContent = formatTime(audio.currentTime);
        });

        audio.addEventListener("ended", () => {
          play.textContent = "Play";
          fill.style.width = "0%";
          current.textContent = "00:00";
          currentAudio = null;
          currentButton = null;
        });
      });
    }

    btn.addEventListener("click", () => {
      panel.classList.contains("is-open") ? closePanel() : openPanel();
    });

    if (close) close.addEventListener("click", closePanel);

    panel.addEventListener("click", (event) => {
      if (event.target === panel) closePanel();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePanel();
    });

    document.addEventListener("ecart:panel-close-others", (event) => {
      if (event.detail?.panel !== "sound") closePanel();
    });
  }

  function initMapPanel() {
    const toggle = qs("#mobileMapToggle");
    const overlay = qs("#mobileMapOverlay");
    const panel = qs("#mobileMapPanel");
    const status = qs("#mobileMapStatus");

    if (!toggle || !overlay || !panel) return;

    const zones = qsa(".mini-zone", overlay);
    const currentZone = document.body.dataset.zone || "";
    const zoneLinks = qsa(".zone-link, .section-link");
    let typingTimer = null;

    if (currentZone) addVisitedZone(currentZone);

    function setToggleState(isOpen) {
      toggle.classList.toggle("is-open", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      toggle.setAttribute("aria-label", isOpen ? "Fermer la carte" : "Ouvrir la carte");
      overlay.setAttribute("aria-hidden", isOpen ? "false" : "true");
    }

    function stopTyping() {
      if (typingTimer) {
        clearInterval(typingTimer);
        typingTimer = null;
      }
    }

    function resetZoneHints() {
      stopTyping();

      zones.forEach((zone) => {
        zone.classList.remove("is-armed", "is-hovered");
        zone.dataset.armed = "false";

        const hint = qs(".mobile-zone-hint", zone);
        if (hint) hint.textContent = "";
      });
    }

    function resetStatus() {
      if (status) status.textContent = "Sélectionne une zone.";
    }

    function typeText(element, text, speed = 22) {
      if (!element) return;

      stopTyping();
      element.textContent = "";

      let i = 0;
      typingTimer = setInterval(() => {
        element.textContent = text.slice(0, i + 1);
        i += 1;
        if (i >= text.length) stopTyping();
      }, speed);
    }

    function setHoveredZone(zoneId) {
      zoneLinks.forEach((link) => link.classList.remove("is-hovered"));
      zones.forEach((zone) => zone.classList.remove("is-hovered"));

      qsa(`[data-zone-link="${zoneId}"], [data-section="${zoneId}"]`).forEach((link) => {
        link.classList.add("is-hovered");
      });

      qsa(`.mini-zone[data-mini-zone="${zoneId}"]`, overlay).forEach((zone) => {
        zone.classList.add("is-hovered");
      });
    }

    function clearHoveredZone() {
      zoneLinks.forEach((link) => link.classList.remove("is-hovered"));
      zones.forEach((zone) => zone.classList.remove("is-hovered"));
    }

    function openMap() {
      closeAllPanelsExcept("map");
      overlay.classList.add("is-open");
      setToggleState(true);
      resetZoneHints();
      applyVisitedZones(zones, currentZone);
      emitPanelOpen("map");
    }

    function closeMap() {
      overlay.classList.remove("is-open");
      setToggleState(false);
      resetZoneHints();
      resetStatus();
      clearHoveredZone();
    }

    toggle.addEventListener("click", () => {
      overlay.classList.contains("is-open") ? closeMap() : openMap();
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeMap();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMap();
    });

    document.addEventListener("ecart:panel-close-others", (event) => {
      if (event.detail?.panel !== "map") closeMap();
    });

    zones.forEach((zone) => {
      zone.dataset.armed = "false";

      zone.addEventListener("mouseenter", () => {
        const zoneId = zone.dataset.miniZone;
        const name = zone.dataset.zoneName || `Zone ${zoneId}`;
        const hint = qs(".mobile-zone-hint", zone);

        if (zoneId) setHoveredZone(zoneId);
        if (status) status.textContent = `Zone sélectionnée : ${name}`;
        if (hint && !hint.textContent) hint.textContent = `vers ${name}...`;
      });

      zone.addEventListener("mouseleave", () => {
        clearHoveredZone();
        if (status) resetStatus();
      });

      zone.addEventListener("click", (event) => {
        const name = zone.dataset.zoneName || "zone";
        const hint = qs(".mobile-zone-hint", zone);
        const isArmed = zone.dataset.armed === "true";

        if (!isArmed) {
          event.preventDefault();

          zones.forEach((otherZone) => {
            if (otherZone !== zone) {
              otherZone.dataset.armed = "false";
              otherZone.classList.remove("is-armed");

              const otherHint = qs(".mobile-zone-hint", otherZone);
              if (otherHint) otherHint.textContent = "";
            }
          });

          zone.dataset.armed = "true";
          zone.classList.add("is-armed");

          if (status) status.textContent = `Zone sélectionnée : ${name}`;
          typeText(hint, `vers ${name}...`);
          return;
        }

        addVisitedZone(zone.dataset.miniZone);
      });
    });

    zoneLinks.forEach((link) => {
      const zoneId = link.dataset.zoneLink || link.dataset.section;
      if (!zoneId) return;

      link.classList.toggle("active", zoneId === currentZone);

      link.addEventListener("mouseenter", () => setHoveredZone(zoneId));
      link.addEventListener("mouseleave", clearHoveredZone);
    });

    applyVisitedZones(zones, currentZone);
    setToggleState(false);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initInfoPanel();
    initSoundPanel();
    initMapPanel();
  });
})();