const STORAGE_KEY = "ecart_zone13_state";

export function getZone13State() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
      visits: 0,
      activated: false
    };
  } catch {
    return { visits: 0, activated: false };
  }
}

export function saveZone13State(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}