export function getInsforgeBaseUrl() {
  const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
  return (
    env?.VITE_VIBEUSAGE_INSFORGE_BASE_URL ||
    env?.VITE_VIBESCORE_INSFORGE_BASE_URL ||
    "https://5tmappuk.us-east.insforge.app"
  );
}

export function getInsforgeAnonKey() {
  const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
  return (
    env?.VITE_VIBEUSAGE_INSFORGE_ANON_KEY ||
    env?.VITE_VIBESCORE_INSFORGE_ANON_KEY ||
    env?.VITE_INSFORGE_ANON_KEY ||
    ""
  );
}
