(function () {
  const body   = document.body;
  const toggle = document.querySelector(".menu-toggle");
  const nav    = document.querySelector(".zones-nav, .sections");

  if (!body || !toggle || !nav) return;

  /* Détection du type de pointeur (réévalue à chaque appel) */
  const isDesktop = () => window.matchMedia("(pointer: fine)").matches;

  /* ── Mobile / tablette ───────────────────────────────── */

  function setMobileMenu(open) {
    body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  /* ── Desktop — toggle sidebar ouverte / repliée ─────── */

  function setDesktopSidebar(open) {
    body.classList.toggle("desktop-sidebar-closed", !open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function isDesktopSidebarOpen() {
    return !body.classList.contains("desktop-sidebar-closed");
  }

  /* ── Toggle principal ───────────────────────────────── */

  function handleToggle(event) {
    event.preventDefault();
    event.stopPropagation();

    if (isDesktop()) {
      setDesktopSidebar(!isDesktopSidebarOpen());
    } else {
      setMobileMenu(!body.classList.contains("menu-open"));
    }
  }

  /* ── Init ────────────────────────────────────────────── */

  toggle.setAttribute("aria-expanded", "false");

  if (!nav.id) nav.id = "ecart-zone-menu";
  toggle.setAttribute("aria-controls", nav.id);

  toggle.addEventListener("click", handleToggle);

  /* Escape : ferme seulement le menu mobile (pas la sidebar desktop) */
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !isDesktop()) {
      setMobileMenu(false);
    }
  });

  /* Clic hors sidebar : ferme seulement sur mobile */
  document.addEventListener("click", function (event) {
    if (isDesktop()) return;

    const insideSidebar = event.target.closest(".sidebar");
    const insideNav     = event.target.closest(".zones-nav, .sections");

    if (!insideSidebar && !insideNav) {
      setMobileMenu(false);
    }
  });

})();
