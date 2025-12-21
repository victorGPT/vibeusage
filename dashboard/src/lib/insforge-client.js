import { createClient } from "@insforge/sdk";

import { getInsforgeAnonKey } from "./config.js";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

export function createInsforgeClient({ baseUrl, accessToken } = {}) {
  if (!baseUrl) throw new Error("Missing baseUrl");
  const anonKey = getInsforgeAnonKey();
  return createClient({
    baseUrl,
    anonKey: anonKey || undefined,
    edgeFunctionToken: accessToken || undefined,
    storage: createMemoryStorage(),
  });
}
