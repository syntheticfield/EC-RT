/* ==========================================================
   EC@RT — MENU GLOBAL
   Sidebar fermée par défaut, ouvrable au clic
   ========================================================== */

(() => {
  const toggle = document.querySelector(".menu-toggle");
  if (!toggle) return;

  function closeMenu() {
    document.body.classList.remove("menu-open");
    document.body.classList.remove("ecart-menu-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    document.body.classList.add("menu-open");
    document.body.classList.add("ecart-menu-open");
    toggle.setAttribute("aria-expanded", "true");
  }

  function toggleMenu(event) {
    event.preventDefault();
    event.stopPropagation();

    if (document.body.classList.contains("ecart-menu-open")) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  closeMenu();

  toggle.addEventListener("click", toggleMenu);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
  });
})();