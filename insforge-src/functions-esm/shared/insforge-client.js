export async function getCreateClient() {
  const injected = globalThis.createClient;
  if (typeof injected === "function") return injected;
  throw new Error("Missing createClient");
}

export async function createEdgeClient(options) {
  const createClient = await getCreateClient();
  return createClient(options);
}
