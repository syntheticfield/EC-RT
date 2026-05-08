/* ==========================================================
   EC@RT — INTERFACE UNIFIÉE v5
   SOUND minimal multi-pistes + voix écran
   ========================================================== */

(function () {
  const STORAGE_KEY = "ecart_visited_zones";

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function emitPanelOpen(name) {
    document.dispatchEvent(
      new CustomEvent("ecart:panel-open", {
        detail: { panel: name }
      })
    );
  }

  function closeAllPanelsExcept(name) {
    document.dispatchEvent(
      new CustomEvent("ecart:panel-close-others", {
        detail: { panel: name }
      })
    );
  }

  /* ──────────────────────────────────────────────────────
     ZONES VISITÉES
     ────────────────────────────────────────────────────── */

  function getVisitedZones() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
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
      zone.classList.toggle("active", isCurrent);
      zone.classList.toggle("is-visited", visited.includes(id) && !isCurrent);
    });
  }

  /* ──────────────────────────────────────────────────────
     CLUSTER MENU / SOUND / MAP / INFO
     ────────────────────────────────────────────────────── */

  function initCluster() {
    const soundBtn = qs("#soundToggle");
    const mapBtn = qs("#mobileMapToggle");
    const infoBtn = qs("#infoToggle");

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
    if (mapBtn) cluster.appendChild(mapBtn);
    if (infoBtn) cluster.appendChild(infoBtn);

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
    }

    menuBtn.addEventListener("click", e => {
      e.stopPropagation();
      isOpen ? closeCluster() : openCluster();
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeCluster();
    });

    window._ecartCluster = {
      open: openCluster,
      close: closeCluster
    };
  }

  /* ──────────────────────────────────────────────────────
     SOUND — PANEL MINIMAL MULTI-PISTES + VOIX ÉCRAN
     ────────────────────────────────────────────────────── */

  function initSoundDirect() {
    const btn = qs("#soundToggle");
    if (!btn) return;

    let sounds = Array.isArray(window.ECART_SOUND)
      ? [...window.ECART_SOUND]
      : [];

    const hasVoiceAlready = sounds.some(sound => sound.type === "voice");

    if (!hasVoiceAlready) {
      sounds.push({
        title: "Voix de l’écran",
        type: "voice"
      });
    }

    if (!sounds.length) {
      btn.disabled = true;
      btn.style.opacity = "0.28";
      btn.title = "Aucun audio disponible";
      return;
    }

    let currentIndex = 0;
    let currentMode = "audio";

    const audio = new Audio();
    audio.preload = "metadata";

    const panel = document.createElement("div");
    panel.id = "ecartAudioPanel";
    panel.setAttribute("aria-hidden", "true");

    panel.innerHTML = `
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
    `;

    document.body.appendChild(panel);

    const tracklist = qs("#ecartAudioTracklist", panel);
    const nowEl = qs("#ecartAudioNow", panel);
    const fill = qs("#ecartAudioFill", panel);
    const strip = qs("#ecartAudioStrip", panel);
    const ppBtn = qs("#ecartAudioPP", panel);

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
  const info = window.ECART_INFO || {};
  const texts = [];

  if (info.title) texts.push(info.title);
  if (info.subtitle) texts.push(info.subtitle);
  if (info.description) texts.push(info.description);
  if (info.gameplay) texts.push(info.gameplay);

  if (Array.isArray(info.references)) {
    texts.push(...info.references);
  }

  const clean = texts
    .map(t => String(t).replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return clean.length
    ? clean.join(". ")
    : "Aucune information disponible pour cette zone.";
}

    function speakText(text) {
      const content =
        text && text.trim()
          ? text.trim()
          : "Aucun texte lisible détecté dans cette zone.";

      const utterance = new SpeechSynthesisUtterance(content);

      utterance.lang = "fr-FR";
      utterance.rate = 0.88;
      utterance.pitch = 0.92;
      utterance.volume = 1;

      utterance.onstart = () => {
        currentMode = "voice";
        setPlaying(true);
        fill.style.width = "100%";
        strip.setAttribute("aria-valuenow", "100");
      };

      utterance.onend = () => {
        setPlaying(false);
        resetProgress();
      };

      utterance.onerror = () => {
        setPlaying(false);
        resetProgress();
      };

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

        if (autoplay) {
          const text = collectScreenText();
          speakText(text);
        }

        return;
      }

      currentMode = "audio";

      if (!sound.file) {
        console.warn("[EC@RT] Piste sans fichier :", sound);
        setPlaying(false);
        return;
      }

      audio.src = sound.file;
      audio.currentTime = 0;
      audio.load();

      if (autoplay) play();
      else setPlaying(false);
    }

    function play() {
      const sound = sounds[currentIndex];

      if (sound && sound.type === "voice") {
        const text = collectScreenText();
        speakText(text);
        return;
      }

      if (!audio.src) {
        loadTrack(currentIndex, true);
        return;
      }

      window.speechSynthesis.cancel();

      audio
        .play()
        .then(() => {
          currentMode = "audio";
          setPanelVisible(true);
          setPlaying(true);
        })
        .catch(err => {
          console.warn("[EC@RT] Lecture bloquée :", err);
          setPlaying(false);
        });
    }

    function pause() {
      if (currentMode === "voice") {
        window.speechSynthesis.cancel();
      } else {
        audio.pause();
      }

      setPlaying(false);
    }

    function togglePlay() {
      const sound = sounds[currentIndex];

      if (sound && sound.type === "voice") {
        if (panel.classList.contains("is-playing")) pause();
        else play();
        return;
      }

      audio.paused ? play() : pause();
    }

    sounds.forEach((sound, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "ecart-audio-track";

      item.innerHTML = `
        <span class="ecart-audio-track-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="ecart-audio-track-title">${sound.title || `Piste ${index + 1}`}</span>
        <span class="ecart-audio-track-meta">${sound.date || sound.year || ""}</span>
      `;

      item.addEventListener("click", () => {
        loadTrack(index, true);
      });

      tracklist.appendChild(item);
    });

    audio.addEventListener("loadedmetadata", () => {
      resetProgress();
    });

    audio.addEventListener("timeupdate", () => {
      if (!audio.duration) return;

      const pct = (audio.currentTime / audio.duration) * 100;

      fill.style.width = `${pct}%`;
      strip.setAttribute("aria-valuenow", Math.round(pct));
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

    strip.addEventListener("click", e => {
      if (currentMode === "voice") return;
      if (!audio.duration) return;

      const rect = strip.getBoundingClientRect();
      const pct = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width)
      );

      audio.currentTime = pct * audio.duration;
    });

    strip.addEventListener(
      "touchend",
      e => {
        if (currentMode === "voice") return;
        if (!audio.duration) return;

        const rect = strip.getBoundingClientRect();
        const touch = e.changedTouches[0];

        const pct = Math.max(
          0,
          Math.min(1, (touch.clientX - rect.left) / rect.width)
        );

        audio.currentTime = pct * audio.duration;
      },
      { passive: true }
    );

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

    document.addEventListener("ecart:panel-close-others", e => {
      if (e.detail?.panel !== "sound") {
        setPanelVisible(false);
      }
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        setPanelVisible(false);
      }
    });

    loadTrack(0, false);
    setPanelVisible(false);
  }

  /* ──────────────────────────────────────────────────────
     INFO
     ────────────────────────────────────────────────────── */

  function initInfoPanel() {
    const btn = qs("#infoToggle");
    const panel = qs("#infoPanel");

    if (!btn || !panel) return;

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
        data.references
          .map(r => `<div class="info-ref-item">${r}</div>`)
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

    panel.addEventListener("click", e => {
      if (e.target === panel) closePanel();
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closePanel();
    });

    document.addEventListener("ecart:panel-close-others", e => {
      if (e.detail?.panel !== "info") closePanel();
    });
  }

  /* ──────────────────────────────────────────────────────
     MAP
     ────────────────────────────────────────────────────── */

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
      toggle.setAttribute(
        "aria-label",
        isOpen ? "Fermer la carte" : "Ouvrir la carte"
      );
      overlay.setAttribute("aria-hidden", isOpen ? "false" : "true");
    }

    function stopTyping() {
      if (typingTimer) {
        clearInterval(typingTimer);
        typingTimer = null;
      }
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
      zoneLinks.forEach(link => link.classList.remove("is-hovered"));
      zones.forEach(zone => zone.classList.remove("is-hovered"));

      qsa(`[data-zone-link="${id}"], [data-section="${id}"]`).forEach(link => {
        link.classList.add("is-hovered");
      });

      qsa(`.mini-zone[data-mini-zone="${id}"]`, overlay).forEach(zone => {
        zone.classList.add("is-hovered");
      });
    }

    function clearHoveredZone() {
      zoneLinks.forEach(link => link.classList.remove("is-hovered"));
      zones.forEach(zone => zone.classList.remove("is-hovered"));
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

    overlay.addEventListener("click", e => {
      if (e.target === overlay) closeMap();
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeMap();
    });

    document.addEventListener("ecart:panel-close-others", e => {
      if (e.detail?.panel !== "map") closeMap();
    });

    zones.forEach(zone => {
      zone.dataset.armed = "false";

      zone.addEventListener("mouseenter", () => {
        const id = zone.dataset.miniZone;
        const name = zone.dataset.zoneName || `Zone ${id}`;

        if (id) setHoveredZone(id);
        if (status) typeText(status, `vers ${name}...`);
      });

      zone.addEventListener("mouseleave", () => {
        clearHoveredZone();

        if (!zones.some(z => z.dataset.armed === "true")) {
          resetStatus();
        }
      });

      zone.addEventListener("click", e => {
        const name = zone.dataset.zoneName || "zone";
        const isArmed = zone.dataset.armed === "true";

        if (!isArmed) {
          e.preventDefault();

          zones.forEach(other => {
            if (other !== zone) {
              other.dataset.armed = "false";
              other.classList.remove("is-armed");
            }
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
    initCluster();
    initSoundDirect();
    initInfoPanel();
    initMapPanel();
  });
})();