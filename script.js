/* =========================
   EC@RT — HOME SCRIPT
   Plan interactif : hover zones ↔ sidebar links ↔ locators
   Compatible zone-link / data-zone-link (même structure que les zones)
   ========================= */

const links    = document.querySelectorAll('.zone-link[data-zone-link]');
const zones    = document.querySelectorAll('.hover-zone[data-section]');
const locators = document.querySelectorAll('.locator[data-section]');
const glow     = document.getElementById('zoneGlow');

/* ── Active state ───────────────────────────────────── */

function clearActive() {
  links.forEach(l    => l.classList.remove('active', 'is-hovered'));
  zones.forEach(z    => z.classList.remove('active'));
  locators.forEach(l => l.classList.remove('active'));
  if (glow) glow.classList.remove('active');
}

function setActive(sectionId) {
  clearActive();

  /* sidebar : data-zone-link */
  const link = document.querySelector(`.zone-link[data-zone-link="${sectionId}"]`);
  if (link) link.classList.add('active');

  /* hover-zone + locator : data-section */
  const zone    = document.querySelector(`.hover-zone[data-section="${sectionId}"]`);
  const locator = document.querySelector(`.locator[data-section="${sectionId}"]`);
  if (zone)    zone.classList.add('active');
  if (locator) locator.classList.add('active');

  /* glow positionné sur la hover-zone */
  if (glow && zone) {
    const z = zone;
    glow.style.left   = z.style.left   || '';
    glow.style.top    = z.style.top    || '';
    glow.style.width  = z.style.width  || '';
    glow.style.height = z.style.height || '';
    glow.classList.add('active');
  }
}

/* ── Navigation vers une zone ───────────────────────── */

function goToZone(sectionId) {
  const link = document.querySelector(`.zone-link[data-zone-link="${sectionId}"]`);
  if (link && link.getAttribute('href')) {
    window.location.href = link.getAttribute('href');
  }
}

/* ── Bind hover — sidebar links ─────────────────────── */

links.forEach(link => {
  const id = link.dataset.zoneLink;
  if (!id) return;
  link.addEventListener('mouseenter', () => setActive(id));
  link.addEventListener('focus',      () => setActive(id));
  link.addEventListener('mouseleave', clearActive);
  link.addEventListener('blur',       clearActive);
});

/* ── Bind hover + click — hover-zones ──────────────── */

zones.forEach(zone => {
  const id = zone.dataset.section;
  if (!id) return;

  zone.addEventListener('mouseenter', () => setActive(id));
  zone.addEventListener('focus',      () => setActive(id));
  zone.addEventListener('mouseleave', clearActive);
  zone.addEventListener('blur',       clearActive);

  zone.addEventListener('click', e => {
    e.preventDefault();
    goToZone(id);
  });
});
