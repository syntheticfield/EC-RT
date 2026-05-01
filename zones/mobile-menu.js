(function () {
  const body = document.body;
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".zones-nav, .sections");

  if (!body || !toggle || !nav) return;

  function setMenu(open) {
    body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function toggleMenu(event) {
    event.preventDefault();
    setMenu(!body.classList.contains("menu-open"));
  }

  toggle.setAttribute("aria-expanded", "false");

  if (!nav.id) {
    nav.id = "ecart-zone-menu";
  }

  toggle.setAttribute("aria-controls", nav.id);

  toggle.addEventListener("click", toggleMenu);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      setMenu(false);
    }
  });

  document.addEventListener("click", function (event) {
    const insideSidebar = event.target.closest(".sidebar");
    const insideNav = event.target.closest(".zones-nav, .sections");

    if (!insideSidebar && !insideNav) {
      setMenu(false);
    }
  });
})();