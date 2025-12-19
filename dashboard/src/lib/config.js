export function getInsforgeBaseUrl() {
  return (
    import.meta.env.VITE_VIBESCORE_INSFORGE_BASE_URL ||
    "https://5tmappuk.us-east.insforge.app"
  );
}

