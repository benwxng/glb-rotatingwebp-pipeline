import assert from "node:assert/strict";
import test from "node:test";

import {
  readCatalogConfig,
  registerCatalogIngest,
  type CatalogIngestPayload,
} from "../src/catalog.js";

const payload: CatalogIngestPayload = {
  artifact: { name: "Test Artifact", slug: "test-artifact" },
  publish: false,
  asset: {
    bytes: 123,
    durationMs: 2_988,
    frameCount: 36,
    height: 600,
    kind: "preview_webp",
    mimeType: "image/webp",
    r2Bucket: "artifact-previews",
    r2Key: "previews/test-artifact/v1/abc.webp",
    sha256: "a".repeat(64),
    width: 600,
  },
  source: { label: "test.glb", role: "model" },
};

test("catalog configuration is optional when entirely absent", () => {
  assert.equal(readCatalogConfig({}), null);
  assert.deepEqual(
    readCatalogConfig({
      CATALOG_API_BASE_URL: "http://localhost:3000",
      CATALOG_INGEST_TOKEN: "secret",
    }),
    {
      endpoint: "http://localhost:3000/api/v1/ingest",
      token: "secret",
    },
  );
});

test("catalog configuration rejects partial and insecure remote settings", () => {
  assert.throws(
    () => readCatalogConfig({ CATALOG_API_BASE_URL: "https://catalog.example" }),
    /CATALOG_INGEST_TOKEN/,
  );
  assert.throws(
    () =>
      readCatalogConfig({
        CATALOG_API_BASE_URL: "http://catalog.example",
        CATALOG_INGEST_TOKEN: "secret",
      }),
    /must use HTTPS/,
  );
});

test("catalog registration sends the authenticated idempotent contract", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const fakeFetch: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return Response.json({
      artifactId: "artifact-id",
      assetId: "asset-id",
      created: true,
    });
  };

  const result = await registerCatalogIngest(
    {
      endpoint: "https://catalog.example/api/v1/ingest",
      token: "top-secret",
    },
    payload,
    fakeFetch,
  );

  assert.equal(requestUrl, "https://catalog.example/api/v1/ingest");
  assert.equal(requestInit?.method, "POST");
  const headers = new Headers(requestInit?.headers);
  assert.equal(headers.get("authorization"), "Bearer top-secret");
  assert.equal(
    headers.get("idempotency-key"),
    `preview_webp:test-artifact:${"a".repeat(64)}`,
  );
  assert.deepEqual(JSON.parse(String(requestInit?.body)), payload);
  assert.deepEqual(result, {
    artifactId: "artifact-id",
    assetId: "asset-id",
    created: true,
  });
});

test("catalog registration rejects errors and malformed responses", async () => {
  await assert.rejects(
    registerCatalogIngest(
      { endpoint: "https://catalog.example/api/v1/ingest", token: "secret" },
      payload,
      async () => new Response(null, { status: 503 }),
    ),
    /HTTP 503/,
  );
  await assert.rejects(
    registerCatalogIngest(
      { endpoint: "https://catalog.example/api/v1/ingest", token: "secret" },
      payload,
      async () => Response.json({ ok: true }),
    ),
    /invalid response/,
  );
});
