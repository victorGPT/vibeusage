import { useState, useEffect } from "react";

const STORAGE_KEY = "vibescore.dashboard.auth.v1";

function loadAuth() {
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

function saveAuth(auth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

function clearAuthData() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useAuth() {
  const [auth, setAuth] = useState(() => loadAuth());

  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, "");
    if (path !== "/auth/callback") return;

    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("access_token") || "";
    if (!accessToken) return;

    const next = {
      accessToken,
      userId: params.get("user_id") || null,
      email: params.get("email") || null,
      name: params.get("name") || null,
      savedAt: new Date().toISOString(),
    };
    saveAuth(next);
    setAuth(next);
    window.history.replaceState({}, "", "/");
  }, []);

  const logout = () => {
    clearAuthData();
    setAuth(null);
  };

  return {
    auth,
    setAuth,
    logout,
    signedIn: Boolean(auth?.accessToken),
  };
}
