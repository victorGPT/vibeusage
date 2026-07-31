declare module "*.cjs" {
  const cjsModule: any;
  export default cjsModule;
}

declare module "../../../src/shared/runtime-defaults.cjs" {
  export const DEFAULT_INSFORGE_BASE_URL: string;
  export const DEFAULT_DASHBOARD_URL: string;
  export const DEFAULT_HTTP_TIMEOUT_MS: number;

  const runtimeDefaults: {
    DEFAULT_INSFORGE_BASE_URL: string;
    DEFAULT_DASHBOARD_URL: string;
    DEFAULT_HTTP_TIMEOUT_MS: number;
  };

  export default runtimeDefaults;
}

declare module "../../../src/shared/copy-registry.cjs" {
  export const REQUIRED_COPY_COLUMNS: string[];

  export function parseCsvRows(raw: string): string[][];

  export function buildCopyRegistry(raw: string): {
    header: string[];
    rows: Array<{
      key: string;
      module: string;
      page: string;
      component: string;
      slot: string;
      text: string;
      row: number;
    }>;
    map: Map<
      string,
      {
        key: string;
        module: string;
        page: string;
        component: string;
        slot: string;
        text: string;
        row: number;
      }
    >;
    duplicates: Map<string, number[]>;
    missingColumns: string[];
  };

  export function normalizeCopyText(text: unknown): string;
  export function interpolateCopyText(text: string, params?: Record<string, unknown>): string;

  const copyRegistryModule: {
    REQUIRED_COPY_COLUMNS: string[];
    parseCsvRows: typeof parseCsvRows;
    buildCopyRegistry: typeof buildCopyRegistry;
    normalizeCopyText: typeof normalizeCopyText;
    interpolateCopyText: typeof interpolateCopyText;
  };

  export default copyRegistryModule;
}

declare module "../../../src/shared/vibeusage-function-contract.cjs" {
  export const FUNCTION_PREFIX: string;
  export const BACKEND_RUNTIME_UNAVAILABLE_MESSAGE: string;
  export const FUNCTION_SLUGS: Record<string, string>;

  const vibeusageFunctionContract: {
    FUNCTION_PREFIX: string;
    BACKEND_RUNTIME_UNAVAILABLE_MESSAGE: string;
    FUNCTION_SLUGS: Record<string, string>;
  };

  export default vibeusageFunctionContract;
}
