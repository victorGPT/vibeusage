import { createClient, type AuthSession } from "@insforge/sdk";
import { getInsforgeAnonKey, getInsforgeBaseUrl } from "./config";
import { createTimeoutFetch } from "./http-timeout";

// Storage key prefix for InsForge SDK session data
const INSFORGE_STORAGE_KEY = "vibeusage.insforge.session.v1";
const INSFORGE_TOKEN_KEY = "insforge-auth-token";
const INSFORGE_USER_KEY = "insforge-auth-user";
const TOKEN_ENVELOPE_VERSION = 1;
const FALLBACK_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;

type StoredTokenEnvelope = {
  v: number;
  token: string;
  expiresAt: number;
};

type InsforgeSessionLike = AuthSession | null;

type InsforgeTokenManagerLike = {
  saveSession?: (session: AuthSession) => void;
  getSession?: () => InsforgeSessionLike;
  getAccessToken?: () => string | null;
  clearSession?: () => void;
};

type InsforgeClientBridgeLike = {
  tokenManager?: unknown;
  database?: {
    from?: (...args: any[]) => unknown;
    rpc?: (...args: any[]) => unknown;
  };
};

function bindDatabaseMethods(client: InsforgeClientBridgeLike) {
  const database = client?.database;
  if (!database || typeof database !== "object") return;
  if (typeof database.from === "function") {
    database.from = database.from.bind(database);
  }
  if (typeof database.rpc === "function") {
    database.rpc = database.rpc.bind(database);
  }
}

function getTokenManager(client: unknown): InsforgeTokenManagerLike | null {
  if (!client || typeof client !== "object") return null;
  const candidate = (client as { tokenManager?: unknown }).tokenManager;
  if (!candidate || typeof candidate !== "object") return null;
  return candidate as InsforgeTokenManagerLike;
}

function decodeBase64Url(input: string): string | null {
  if (typeof input !== "string" || input.length === 0) return null;
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  try {
    if (typeof globalThis.atob === "function") {
      return globalThis.atob(padded);
    }
  } catch (_e) {
    // fall through
  }
  return null;
}

function decodeJwtExpiryMs(token: string): number | null {
  if (typeof token !== "string" || token.length === 0) return null;
  const segments = token.split(".");
  if (segments.length < 2) return null;
  const payloadRaw = decodeBase64Url(segments[1]);
  if (!payloadRaw) return null;
  try {
    const payload = JSON.parse(payloadRaw);
    const exp = payload?.exp;
    if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= 0) {
      return null;
    }
    return Math.floor(exp * 1000);
  } catch (_e) {
    return null;
  }
}

function wrapTokenForStorage(token: string): string {
  const now = Date.now();
  const expiresAt = decodeJwtExpiryMs(token) ?? now + FALLBACK_TOKEN_TTL_MS;
  const envelope: StoredTokenEnvelope = {
    v: TOKEN_ENVELOPE_VERSION,
    token,
    expiresAt,
  };
  return JSON.stringify(envelope);
}

function unwrapTokenFromStorage(raw: string | null): {
  token: string | null;
  shouldMigrate: boolean;
} {
  if (typeof raw !== "string" || raw.length === 0) {
    return { token: null, shouldMigrate: false };
  }
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.v === TOKEN_ENVELOPE_VERSION &&
      typeof parsed.token === "string" &&
      parsed.token.length > 0
    ) {
      return { token: parsed.token, shouldMigrate: false };
    }
  } catch (_e) {
    // fall through to legacy plain token format
  }
  return { token: raw, shouldMigrate: true };
}

function getNamespacedStorageKey(key: string): string {
  return `${INSFORGE_STORAGE_KEY}.${key}`;
}

function setStorageValue(storage: Storage | null, key: string, value: string): boolean {
  if (!storage) return false;
  try {
    storage.setItem(getNamespacedStorageKey(key), value);
    return true;
  } catch (_e) {
    return false;
  }
}

function removeStorageValue(storage: Storage | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(getNamespacedStorageKey(key));
  } catch (_e) {
    // ignore
  }
}

export function clearInsforgePersistentStorage() {
  if (typeof window === "undefined") return;
  const prefix = `${INSFORGE_STORAGE_KEY}.`;
  const clearFrom = (storage: Storage | null) => {
    if (!storage) return;
    try {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (typeof key === "string" && key.startsWith(prefix)) {
          keys.push(key);
        }
      }
      for (const key of keys) {
        storage.removeItem(key);
      }
    } catch (_e) {
      // ignore
    }
  };

  let localStorage: Storage | null = null;
  let sessionStorage: Storage | null = null;
  try {
    localStorage = window.localStorage;
  } catch (_e) {
    localStorage = null;
  }
  try {
    sessionStorage = window.sessionStorage;
  } catch (_e) {
    sessionStorage = null;
  }

  clearFrom(localStorage);
  clearFrom(sessionStorage);
}

/**
 * Create a persistent storage adapter using localStorage with session backup.
 * This ensures session survives page reloads and mobile browser backgrounding.
 *
 * Mobile-specific considerations:
 * - iOS Safari private mode: localStorage may throw, use memory fallback
 * - iOS WebView: sessionStorage may be cleared on background, use localStorage
 * - Safari ITP: third-party cookies blocked, rely on first-party storage
 */
export function createPersistentStorage() {
  // Memory fallback for environments where storage is unavailable
  const memoryStore = new Map<string, string>();

  function getStorage(): Storage | null {
    if (typeof window === "undefined") return null;
    try {
      const storage = window.localStorage;
      // Test if storage is actually available (iOS private mode quirk)
      const testKey = "__vibeusage_storage_test__";
      storage.setItem(testKey, "1");
      storage.removeItem(testKey);
      return storage;
    } catch (_e) {
      return null;
    }
  }

  function getSessionStorage(): Storage | null {
    if (typeof window === "undefined") return null;
    try {
      return window.sessionStorage;
    } catch (_e) {
      return null;
    }
  }

  return {
    getItem(key: string): string | null {
      const localStorage = getStorage();
      const sessionStorage = getSessionStorage();
      const localKey = getNamespacedStorageKey(key);
      const sessionKey = getNamespacedStorageKey(key);
      const tokenKey = key === INSFORGE_TOKEN_KEY;

      const migrateTokenIfNeeded = (token: string) => {
        if (!tokenKey) return;
        const wrapped = wrapTokenForStorage(token);
        setStorageValue(localStorage, key, wrapped);
        setStorageValue(sessionStorage, key, wrapped);
        memoryStore.set(key, wrapped);
      };

      const readStoredValue = (storage: Storage | null, rawKey: string): string | null => {
        if (!storage) return null;
        try {
          return storage.getItem(rawKey);
        } catch (_e) {
          return null;
        }
      };

      const fromLocal = readStoredValue(localStorage, localKey);
      if (fromLocal !== null) {
        memoryStore.set(key, fromLocal);
        if (!tokenKey) return fromLocal;
        const parsed = unwrapTokenFromStorage(fromLocal);
        if (!parsed.token) return null;
        if (parsed.shouldMigrate) migrateTokenIfNeeded(parsed.token);
        return parsed.token;
      }

      const fromSession = readStoredValue(sessionStorage, sessionKey);
      if (fromSession !== null) {
        memoryStore.set(key, fromSession);
        if (!tokenKey) {
          setStorageValue(localStorage, key, fromSession);
          return fromSession;
        }
        const parsed = unwrapTokenFromStorage(fromSession);
        if (!parsed.token) return null;
        if (parsed.shouldMigrate) {
          migrateTokenIfNeeded(parsed.token);
        } else {
          setStorageValue(localStorage, key, fromSession);
        }
        return parsed.token;
      }

      const fromMemory = memoryStore.get(key);
      if (fromMemory === undefined) return null;
      if (!tokenKey) return fromMemory;
      const parsed = unwrapTokenFromStorage(fromMemory);
      if (!parsed.token) return null;
      if (parsed.shouldMigrate) migrateTokenIfNeeded(parsed.token);
      return parsed.token;
    },

    setItem(key: string, value: string): void {
      const persistedValue = key === INSFORGE_TOKEN_KEY ? wrapTokenForStorage(value) : value;

      // Always update memory
      memoryStore.set(key, persistedValue);

      // Try to persist to localStorage
      const storage = getStorage();
      if (storage) {
        const ok = setStorageValue(storage, key, persistedValue);
        if (!ok && import.meta.env.DEV) {
          // Storage quota exceeded or private mode - keep in memory only
          // eslint-disable-next-line no-console
          console.warn("[Auth] Failed to persist session to storage");
        }
      }

      // Also try sessionStorage as secondary backup (for mobile context switching)
      const sessionStorage = getSessionStorage();
      if (sessionStorage) {
        setStorageValue(sessionStorage, key, persistedValue);
      }
    },

    removeItem(key: string): void {
      memoryStore.delete(key);

      const storage = getStorage();
      removeStorageValue(storage, key);

      const sessionStorage = getSessionStorage();
      removeStorageValue(sessionStorage, key);
    },
  };
}

export function createInsforgeClient({
  baseUrl,
  accessToken,
}: {
  baseUrl?: string;
  accessToken?: string;
} = {}) {
  if (!baseUrl) throw new Error("Missing baseUrl");
  const anonKey = getInsforgeAnonKey();
  const timeoutFetch = createTimeoutFetch(globalThis.fetch) as unknown as typeof fetch;
  const client = createClient({
    baseUrl,
    anonKey: anonKey || undefined,
    edgeFunctionToken: accessToken || undefined,
    fetch: timeoutFetch,
  });
  bindDatabaseMethods(client as unknown as InsforgeClientBridgeLike);
  return client;
}

export function createInsforgeAuthClient() {
  // The SDK refreshes via an httpOnly cookie. Served from our own origin (vercel.json /
  // vite proxy forward /api/auth/*), that cookie is first-party and survives 3P-cookie blocking.
  const baseUrl = typeof window !== "undefined" ? window.location.origin : getInsforgeBaseUrl();
  if (!baseUrl) throw new Error("Missing baseUrl");
  const anonKey = getInsforgeAnonKey();
  const timeoutFetch = createTimeoutFetch(globalThis.fetch) as unknown as typeof fetch;
  const client = createClient({
    baseUrl,
    anonKey: anonKey || undefined,
    fetch: timeoutFetch,
    autoRefreshToken: true,
  });
  const bridgedClient = client as unknown as InsforgeClientBridgeLike;
  bindDatabaseMethods(bridgedClient);
  forceStorageMode(bridgedClient);
  installSessionPersistenceBridge(bridgedClient);
  return client;
}

export function persistInsforgeSession(
  client: InsforgeClientBridgeLike,
  session: InsforgeSessionLike,
) {
  if (!session?.accessToken || !session.user) return;
  const tokenManager = getTokenManager(client);
  if (!tokenManager || typeof tokenManager.saveSession !== "function") return;
  tokenManager.saveSession(session);
}

function parsePersistedUser(raw: string | null): AuthSession["user"] | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof (parsed as { id?: unknown }).id !== "string") return null;
    return parsed as AuthSession["user"];
  } catch (_e) {
    return null;
  }
}

function persistSessionToStorage(
  storage: ReturnType<typeof createPersistentStorage>,
  session: InsforgeSessionLike,
) {
  if (!session?.accessToken || !session.user) {
    storage.removeItem(INSFORGE_TOKEN_KEY);
    storage.removeItem(INSFORGE_USER_KEY);
    return;
  }
  storage.setItem(INSFORGE_TOKEN_KEY, session.accessToken);
  storage.setItem(INSFORGE_USER_KEY, JSON.stringify(session.user));
}

function loadPersistedSession(
  storage: ReturnType<typeof createPersistentStorage>,
): InsforgeSessionLike {
  const accessToken = storage.getItem(INSFORGE_TOKEN_KEY);
  if (!accessToken) return null;
  const user = parsePersistedUser(storage.getItem(INSFORGE_USER_KEY));
  if (!user) {
    storage.removeItem(INSFORGE_TOKEN_KEY);
    storage.removeItem(INSFORGE_USER_KEY);
    return null;
  }
  return { accessToken, user };
}

export function installSessionPersistenceBridge(client: InsforgeClientBridgeLike) {
  const tokenManager = getTokenManager(client);
  if (!tokenManager) return;

  const marker = "__vibeusage_session_bridge_installed_v2__";
  const bridgeState = client as Record<string, unknown>;
  if (bridgeState[marker]) return;

  const storage = createPersistentStorage();
  const originalSaveSession =
    typeof tokenManager.saveSession === "function" ? tokenManager.saveSession.bind(tokenManager) : null;
  const originalGetSession =
    typeof tokenManager.getSession === "function" ? tokenManager.getSession.bind(tokenManager) : null;
  const originalClearSession =
    typeof tokenManager.clearSession === "function" ? tokenManager.clearSession.bind(tokenManager) : null;

  if (originalSaveSession) {
    tokenManager.saveSession = (session: AuthSession) => {
      originalSaveSession(session);
      persistSessionToStorage(storage, session);
    };
  }

  if (originalGetSession) {
    tokenManager.getSession = () => {
      const inMemorySession = originalGetSession();
      if (inMemorySession?.accessToken && inMemorySession.user) {
        persistSessionToStorage(storage, inMemorySession);
        return inMemorySession;
      }
      const persistedSession = loadPersistedSession(storage);
      if (persistedSession && originalSaveSession) {
        originalSaveSession(persistedSession);
      }
      return persistedSession;
    };
  }

  if (originalClearSession) {
    tokenManager.clearSession = () => {
      originalClearSession();
      persistSessionToStorage(storage, null);
    };
  }

  bridgeState[marker] = true;
  tokenManager.getSession?.();
}

export function forceStorageMode(client: InsforgeClientBridgeLike) {
  try {
    const tokenManager = getTokenManager(client);
    if (!tokenManager || typeof tokenManager.getSession !== "function") {
      return;
    }
    tokenManager.getSession();
  } catch (_e) {
    // ignore SDK internals mismatch
  }
}
