const http = require('node:http');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const DEFAULT_BASE_URL = 'https://5tmappuk.us-east.insforge.app';

async function beginBrowserAuth({ baseUrl, dashboardUrl, timeoutMs, open }) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const callbackPath = `/vibescore/callback/${nonce}`;
  const authUrl = dashboardUrl ? new URL('/', dashboardUrl) : new URL('/auth/sign-up', baseUrl);
  const postAuthRedirect = resolvePostAuthRedirect({ dashboardUrl, authUrl });
  const { callbackUrl, waitForCallback } = await startLocalCallbackServer({
    callbackPath,
    timeoutMs,
    redirectUrl: postAuthRedirect
  });
  authUrl.searchParams.set('redirect', callbackUrl);
  if (dashboardUrl && baseUrl && baseUrl !== DEFAULT_BASE_URL) authUrl.searchParams.set('base_url', baseUrl);

  if (open !== false) openInBrowser(authUrl.toString());

  return { authUrl: authUrl.toString(), waitForCallback };
}

async function startLocalCallbackServer({ callbackPath, timeoutMs, redirectUrl }) {
  let resolved = false;
  let resolveResult;
  let rejectResult;

  const resultPromise = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  const server = http.createServer((req, res) => {
    if (resolved) {
      res.writeHead(409, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Already authenticated.\n');
      return;
    }

    const method = req.method || 'GET';
    if (method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method not allowed.\n');
      return;
    }

    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname !== callbackPath) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found.\n');
      return;
    }

    const accessToken = url.searchParams.get('access_token') || '';
    if (!accessToken) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Missing access_token.\n');
      return;
    }

    resolved = true;
    if (redirectUrl) {
      res.writeHead(302, {
        Location: redirectUrl,
        'Content-Type': 'text/html; charset=utf-8'
      });
      res.end(
        [
          '<!doctype html>',
          '<html><head><meta charset="utf-8"><title>VibeScore</title></head>',
          '<body>',
          '<h2>Login succeeded</h2>',
          `<p>Redirecting to <a href="${redirectUrl}">dashboard</a>...</p>`,
          '</body></html>'
        ].join('')
      );
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        [
          '<!doctype html>',
          '<html><head><meta charset="utf-8"><title>VibeScore</title></head>',
          '<body>',
          '<h2>Login succeeded</h2>',
          '<p>You can close this tab and return to the CLI.</p>',
          '</body></html>'
        ].join('')
      );
    }

    resolveResult({
      accessToken,
      userId: url.searchParams.get('user_id') || null,
      email: url.searchParams.get('email') || null,
      name: url.searchParams.get('name') || null
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : null;
  if (!port) {
    server.close();
    throw new Error('Failed to bind local callback server');
  }

  const callbackUrl = `http://127.0.0.1:${port}${callbackPath}`;

  const timer = setTimeout(() => {
    if (resolved) return;
    resolved = true;
    rejectResult(new Error('Authentication timed out'));
    server.close();
  }, timeoutMs);

  async function waitForCallback() {
    try {
      return await resultPromise;
    } finally {
      clearTimeout(timer);
      server.close();
    }
  }

  return { callbackUrl, waitForCallback };
}

function openInBrowser(url) {
  const platform = process.platform;

  let cmd = null;
  let args = [];

  if (platform === 'darwin') {
    cmd = 'open';
    args = [url];
  } else if (platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    cmd = 'xdg-open';
    args = [url];
  }

  try {
    const child = cp.spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.unref();
  } catch (_e) {}
}

function resolvePostAuthRedirect({ dashboardUrl, authUrl }) {
  try {
    if (dashboardUrl) {
      const target = new URL('/', dashboardUrl);
      if (target.protocol === 'http:' || target.protocol === 'https:') {
        return target.toString();
      }
      return null;
    }
  } catch (_e) {
    return null;
  }
  return null;
}

module.exports = {
  beginBrowserAuth,
  openInBrowser
};
