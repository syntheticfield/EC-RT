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

  const buildPath = "12_MAD/Build";
  const loaderUrl = buildPath + "/12_MAD.loader.js";

  const config = {
    dataUrl: buildPath + "/12_MAD.data.unityweb",
    frameworkUrl: buildPath + "/12_MAD.framework.js.unityweb",
    codeUrl: buildPath + "/12_MAD.wasm.unityweb",
    streamingAssetsUrl: "StreamingAssets",
    companyName: "DefaultCompany",
    productName: "MAMCO",
    productVersion: "1.0"
  };

  function showWarning(message) {
    if (!warningBox) return;
    warningBox.textContent = message;
    warningBox.classList.add("show");
  }

  function updateLoading(progress) {
    const percent = Math.round(progress * 100);

    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressValue) progressValue.textContent = `${percent}%`;

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

  function hideLoading() {
    if (loading) loading.classList.add("is-hidden");
  }

  function ensureCanvasSizing() {
    canvas.style.width = "100%";
    canvas.style.height = "100%";
  }

  ensureCanvasSizing();
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
        hideLoading();
        ensureCanvasSizing();

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