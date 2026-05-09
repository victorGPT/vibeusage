export const AGENT_RESOURCE_ROUTES = {
  "/developers": {
    key: "developers",
    links: ["openapi", "api", "auth", "webhooks", "mcp", "comparison", "guide"],
  },
  "/docs/api": {
    key: "api",
    links: ["openapi", "auth", "mcp", "developers"],
  },
  "/docs/auth": {
    key: "auth",
    links: ["openapi", "api", "developers"],
  },
  "/docs/webhooks": {
    key: "webhooks",
    links: ["openapi", "api", "developers"],
  },
  "/mcp": {
    key: "mcp",
    links: ["mcpManifest", "openapi", "api", "developers"],
  },
  "/compare/ai-token-usage-tracking": {
    key: "comparison",
    links: ["guide", "developers", "openapi"],
  },
  "/guides/ai-token-usage-monitoring": {
    key: "guide",
    links: ["comparison", "developers", "openapi"],
  },
};

export function resolveAgentResourceRoute(pathname) {
  const normalizedPath = String(pathname || "/").replace(/\/+$/, "") || "/";
  return AGENT_RESOURCE_ROUTES[normalizedPath] || null;
}
