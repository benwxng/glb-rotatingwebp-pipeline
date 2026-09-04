import type { ArtifactMetadata } from "./types.js";

export interface CatalogConfig {
  endpoint: string;
  token: string;
}

export interface CatalogIngestPayload {
  artifact: ArtifactMetadata & { slug: string };
  publish: boolean;
  asset: {
    bytes: number;
    durationMs: number;
    frameCount: number;
    height: number;
    kind: "preview_webp";
    mimeType: "image/webp";
    publicUrl?: string;
    r2Bucket: string;
    r2Key: string;
    sha256: string;
    width: number;
  };
  source: {
    label: string;
    license?: string;
    role: "model";
    url?: string;
  };
}

export interface CatalogIngestResult {
  artifactId: string;
  assetId: string;
  created: boolean;
}

function catalogEndpoint(baseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("CATALOG_API_BASE_URL must be a valid absolute URL.");
  }

  const isLocalDevelopment =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  if (parsed.protocol !== "https:" && !isLocalDevelopment) {
    throw new Error(
      "CATALOG_API_BASE_URL must use HTTPS (HTTP is allowed only for localhost).",
    );
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(
      "CATALOG_API_BASE_URL must not include credentials, a query, or a fragment.",
    );
  }

  parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/api/v1/ingest`;
  return parsed.toString();
}

export function readCatalogConfig(
  environment: NodeJS.ProcessEnv = process.env,
): CatalogConfig | null {
  const baseUrl = environment.CATALOG_API_BASE_URL?.trim();
  const token = environment.CATALOG_INGEST_TOKEN?.trim();

  if (!baseUrl && !token) return null;
  if (!baseUrl) {
    throw new Error(
      "CATALOG_API_BASE_URL is required when CATALOG_INGEST_TOKEN is set.",
    );
  }
  if (!token) {
    throw new Error(
      "CATALOG_INGEST_TOKEN is required when CATALOG_API_BASE_URL is set.",
    );
  }

  return { endpoint: catalogEndpoint(baseUrl), token };
}

function isCatalogResult(value: unknown): value is CatalogIngestResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.artifactId === "string" &&
    result.artifactId.length > 0 &&
    typeof result.assetId === "string" &&
    result.assetId.length > 0 &&
    typeof result.created === "boolean"
  );
}

export async function registerCatalogIngest(
  config: CatalogConfig,
  payload: CatalogIngestPayload,
  fetcher: typeof fetch = fetch,
): Promise<CatalogIngestResult> {
  const response = await fetcher(config.endpoint, {
    body: JSON.stringify(payload),
    headers: {
      accept: "application/json",
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
      "idempotency-key": `preview_webp:${payload.artifact.slug}:${payload.asset.sha256}`,
      "user-agent": "rotating-artifacts-pipeline/0.1",
    },
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Catalog registration failed with HTTP ${response.status}.`);
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error("Catalog registration returned invalid JSON.");
  }
  if (!isCatalogResult(result)) {
    throw new Error("Catalog registration returned an invalid response.");
  }
  return result;
}
