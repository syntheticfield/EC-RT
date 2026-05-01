(function () {
  const body = document.body;
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".zones-nav, .sections");

  if (!body || !toggle || !nav) return;
  if (!body.classList.contains("has-mobile-menu")) return;

 function isMobile() {
  return true;
}

  function closeMenu() {
    body.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    body.classList.add("menu-open");
    toggle.setAttribute("aria-expanded", "true");
  }

  function onToggleClick(event) {
    if (!isMobile()) return;
    event.preventDefault();

    if (body.classList.contains("menu-open")) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  toggle.setAttribute("aria-expanded", "false");

  if (!nav.id) {
    nav.id = "mobile-nav";
  }
  toggle.setAttribute("aria-controls", nav.id);

  toggle.addEventListener("click", onToggleClick);

 window.addEventListener("resize", closeMenu);

  nav.querySelectorAll(".zone-link, .section-link").forEach((link) => {
    link.addEventListener("click", () => {
      closeMenu();
    });
  });
})();