function initZone02() {
  const canvas = document.getElementById("unity-canvas");
  const container = document.getElementById("unity-container");

  const loading = document.getElementById("unity-loading");
  const loadingText = document.getElementById("unity-loading-text");
  const progressBar = document.getElementById("unity-progress-bar");
  const progressValue = document.getElementById("unity-progress-value");
  const warningBox = document.getElementById("unity-warning");

  if (!canvas || !container) {
    console.warn("Zone 02 : canvas ou container Unity introuvable.");
    return;
  }

  const buildPath = "../../unity/zone02-V2/Build";
  const loaderUrl = buildPath + "/build-mamco_compress.loader.js";

  const config = {
    dataUrl: buildPath + "/build-mamco_compress.data.unityweb",
    frameworkUrl: buildPath + "/build-mamco_compress.framework.js.unityweb",
    codeUrl: buildPath + "/build-mamco_compress.wasm.unityweb",
    streamingAssetsUrl: "StreamingAssets",
    companyName: "DefaultCompany",
    productName: "MAMCO",
    productVersion: "1.0"
  };

  let realProgress = 0;
  let visualProgress = 0;
  let loaderReady = false;
  let progressLoop = null;

  function showWarning(message) {
    if (!warningBox) return;
    warningBox.textContent = message;
    warningBox.classList.add("show");
  }

  function updateLoading(progress) {
    realProgress = progress;

    const percent = Math.round(progress * 100);

    if (loadingText) {
      if (percent < 20) {
        loadingText.textContent = "Initialisation de l'environnement numérique.";
      } else if (percent < 60) {
        loadingText.textContent = "Chargement des ressources de la scène.";
      } else if (percent < 95) {
        loadingText.textContent = "Assemblage de l'espace interactif.";
      } else {
        loadingText.textContent = "Presque prêt.";
      }
    }
  }

  function startVisualProgress() {
  if (progressLoop) return;

  progressLoop = window.setInterval(() => {
    let target;

    if (loaderReady) {
      target = 1;
    } else {
      // 👇 limite la progression réelle pour éviter le blocage
      const capped = Math.min(realProgress, 0.92);

      // 👇 drift doux vers 98% même si Unity est bloqué
      const drift = 0.98;

      target = capped + (drift - capped) * 0.15;
    }

    // interpolation douce
    visualProgress += (target - visualProgress) * 0.06;

    if (progressBar) {
      progressBar.style.width = `${visualProgress * 100}%`;
    }

    if (progressValue) {
      progressValue.textContent = `${Math.round(visualProgress * 100)}%`;
    }

    if (loaderReady && visualProgress > 0.995) {
      clearInterval(progressLoop);
      progressLoop = null;
    }
  }, 40);
}

  function hideLoading() {
    if (!loading) return;

    loading.classList.add("is-hidden");

    setTimeout(() => {
      if (loading.parentNode) {
        loading.remove();
      }
    }, 950);
  }

  function ensureCanvasSizing() {
    canvas.style.width = "100%";
    canvas.style.height = "100%";
  }

  ensureCanvasSizing();
  startVisualProgress();

  window.addEventListener("resize", ensureCanvasSizing);
  window.addEventListener("orientationchange", ensureCanvasSizing);

  console.log("Loader Unity recherché ici :", loaderUrl);

  const script = document.createElement("script");
  script.src = loaderUrl;

  script.onload = () => {
    if (typeof createUnityInstance !== "function") {
      showWarning("Le loader Unity a été chargé, mais createUnityInstance est introuvable.");
      return;
    }

    createUnityInstance(canvas, config, updateLoading)
      .then((unityInstance) => {
        window.unityInstance = unityInstance;

        loaderReady = true;
        realProgress = 1;

        if (progressBar) {
          progressBar.style.width = "100%";
        }

        if (progressValue) {
          progressValue.textContent = "100%";
        }

        if (loadingText) {
          loadingText.textContent = "Scène prête.";
        }

        ensureCanvasSizing();

        setTimeout(() => {
          hideLoading();
        }, 500);

        if (typeof initUnityMobileFix === "function") {
          initUnityMobileFix();
        }
      })
      .catch((error) => {
        console.error(error);

        showWarning("Impossible de charger la scène Unity.");

        if (loadingText) {
          loadingText.textContent = "Le chargement a échoué.";
        }
      });
  };

  script.onerror = () => {
    console.error("Loader Unity introuvable :", loaderUrl);

    showWarning("Impossible de charger le fichier loader Unity.");

    if (loadingText) {
      loadingText.textContent = "Le loader Unity est introuvable.";
    }
  };

  document.body.appendChild(script);
}

window.addEventListener("load", initZone02);