const STORAGE_KEY = "vibescore.dashboard.auth.v1";

export function loadAuthFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.accessToken !== "string" ||
      parsed.accessToken.length === 0
    )
      return null;
    return parsed;
  } catch (_e) {
    return null;
  }
}

export function saveAuthToStorage(auth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearAuthStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

