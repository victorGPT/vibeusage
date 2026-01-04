const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadModule() {
  const modulePath = path.join(
    __dirname,
    "..",
    "dashboard",
    "src",
    "lib",
    "http-timeout.js"
  );
  return import(pathToFileURL(modulePath).href);
}

function createAbortableFetch(label) {
  return (_input, init = {}) =>
    new Promise((_, reject) => {
      const signal = init.signal;
      if (!signal) {
        reject(new Error("Missing signal"));
        return;
      }
      if (signal.aborted) {
        reject(new Error(label));
        return;
      }
      signal.addEventListener(
        "abort",
        () => reject(new Error(label)),
        { once: true }
      );
    });
}

test("getHttpTimeoutMs returns defaults and clamps", async () => {
  const { getHttpTimeoutMs } = await loadModule();

  assert.equal(getHttpTimeoutMs({ env: {} }), 15000);
  assert.equal(
    getHttpTimeoutMs({ env: { VITE_VIBEUSAGE_HTTP_TIMEOUT_MS: "" } }),
    15000
  );
  assert.equal(
    getHttpTimeoutMs({ env: { VITE_VIBEUSAGE_HTTP_TIMEOUT_MS: "nope" } }),
    15000
  );
  assert.equal(
    getHttpTimeoutMs({ env: { VITE_VIBEUSAGE_HTTP_TIMEOUT_MS: "999" } }),
    1000
  );
  assert.equal(
    getHttpTimeoutMs({ env: { VITE_VIBEUSAGE_HTTP_TIMEOUT_MS: "30001" } }),
    30000
  );
  assert.equal(
    getHttpTimeoutMs({
      env: {
        VITE_VIBEUSAGE_HTTP_TIMEOUT_MS: "",
        VITE_VIBESCORE_HTTP_TIMEOUT_MS: "5000",
      },
    }),
    5000
  );
  assert.equal(
    getHttpTimeoutMs({
      env: {
        VITE_VIBEUSAGE_HTTP_TIMEOUT_MS: undefined,
        VITE_VIBESCORE_HTTP_TIMEOUT_MS: "5000",
      },
    }),
    5000
  );
});

test("getHttpTimeoutMs disables timeout for non-positive values", async () => {
  const { getHttpTimeoutMs } = await loadModule();

  assert.equal(
    getHttpTimeoutMs({ env: { VITE_VIBEUSAGE_HTTP_TIMEOUT_MS: "0" } }),
    0
  );
  assert.equal(
    getHttpTimeoutMs({ env: { VITE_VIBEUSAGE_HTTP_TIMEOUT_MS: "-5" } }),
    0
  );
});

test("createTimeoutFetch throws timeout error when timer aborts", async () => {
  const { createTimeoutFetch } = await loadModule();
  const baseFetch = createAbortableFetch("Base aborted");

  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;

  globalThis.setTimeout = (fn, _ms, ...args) => {
    fn(...args);
    return 1;
  };
  globalThis.clearTimeout = () => {};

  try {
    const fetcher = createTimeoutFetch(baseFetch, {
      env: { VITE_VIBEUSAGE_HTTP_TIMEOUT_MS: "1000" }
    });

    await assert.rejects(
      () => fetcher("http://example.com", {}),
      (err) => {
        assert.equal(err.message, "Client timeout after 1000ms");
        assert.ok(err.cause);
        return true;
      }
    );
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("createTimeoutFetch preserves caller abort errors", async () => {
  const { createTimeoutFetch } = await loadModule();
  const baseFetch = createAbortableFetch("Caller aborted");
  const caller = new AbortController();

  const fetcher = createTimeoutFetch(baseFetch, {
    env: { VITE_VIBEUSAGE_HTTP_TIMEOUT_MS: "5000" }
  });

  const pending = fetcher("http://example.com", { signal: caller.signal });
  caller.abort();

  await assert.rejects(pending, /Caller aborted/);
});

test("createTimeoutFetch respects Request.signal", async () => {
  const { createTimeoutFetch } = await loadModule();
  const baseFetch = createAbortableFetch("Request aborted");
  const caller = new AbortController();

  const fetcher = createTimeoutFetch(baseFetch, {
    env: { VITE_VIBEUSAGE_HTTP_TIMEOUT_MS: "5000" }
  });

  const req = new Request("http://example.com", { signal: caller.signal });
  const pending = fetcher(req);
  caller.abort();

  await assert.rejects(pending, /Request aborted/);
});

test("createTimeoutFetch passes through when timeout disabled", async () => {
  const { createTimeoutFetch } = await loadModule();
  const baseFetch = async (_input, init = {}) => init.signal;
  const fetcher = createTimeoutFetch(baseFetch, {
    env: { VITE_VIBEUSAGE_HTTP_TIMEOUT_MS: "0" }
  });

  const signal = new AbortController().signal;
  const result = await fetcher("http://example.com", { signal });

  assert.equal(result, signal);
});
