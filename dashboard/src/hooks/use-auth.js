import { useCallback, useEffect, useState } from "react";

import {
  clearAuthStorage,
  loadAuthFromStorage,
  saveAuthToStorage,
} from "../lib/auth-storage.js";

export function useAuth() {
  const [auth, setAuth] = useState(() => loadAuthFromStorage());

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

    saveAuthToStorage(next);
    setAuth(next);
    window.history.replaceState({}, "", "/");
  }, []);

  const signOut = useCallback(() => {
    clearAuthStorage();
    setAuth(null);
  }, []);

  return {
    auth,
    signedIn: Boolean(auth?.accessToken),
    signOut,
  };
}

