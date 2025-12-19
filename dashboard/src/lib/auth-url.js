export function buildAuthUrl({ baseUrl, path, redirectUrl }) {
  const u = new URL(path, baseUrl);
  u.searchParams.set("redirect", redirectUrl);
  return u.toString();
}

