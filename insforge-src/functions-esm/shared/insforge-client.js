export async function getCreateClient() {
  const injected = globalThis.createClient;
  if (typeof injected === "function") return injected;
  const sdk = await import("npm:@insforge/sdk");
  return sdk.createClient;
}

export async function createEdgeClient(options) {
  const createClient = await getCreateClient();
  return createClient(options);
}
