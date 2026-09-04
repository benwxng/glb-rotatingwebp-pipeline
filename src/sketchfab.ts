import type { SketchfabDownload } from "./types.js";

function requiredToken(): string {
  const token = process.env.SKETCHFAB_API_TOKEN;
  if (!token) {
    throw new Error(
      "SKETCHFAB_API_TOKEN is required for --sketchfab-uid downloads.",
    );
  }
  return token;
}

async function sketchfabRequest(url: string, token?: string): Promise<Response> {
  const headers = new Headers();
  if (token) headers.set("authorization", `Token ${token}`);
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Sketchfab API request failed with HTTP ${response.status}.`);
  }
  return response;
}

export async function getSketchfabDownload(
  uid: string,
  maxBytes: number,
): Promise<SketchfabDownload> {
  const modelResponse = await sketchfabRequest(
    `https://api.sketchfab.com/v3/models/${uid}`,
  );
  const model = (await modelResponse.json()) as {
    isDownloadable?: boolean;
    viewerUrl?: string;
  };
  if (!model.isDownloadable) {
    throw new Error("This Sketchfab model is not downloadable.");
  }

  const downloadResponse = await sketchfabRequest(
    `https://api.sketchfab.com/v3/models/${uid}/download`,
    requiredToken(),
  );
  const download = (await downloadResponse.json()) as {
    gltf?: { expires?: number; size?: number; url?: string };
  };
  if (!download.gltf?.url) {
    throw new Error("Sketchfab did not return a glTF archive URL.");
  }
  if (download.gltf.size && download.gltf.size > maxBytes) {
    throw new Error("Sketchfab archive exceeds the configured download limit.");
  }

  return {
    archiveUrl: download.gltf.url,
    sourceLabel:
      model.viewerUrl ?? `https://sketchfab.com/3d-models/${uid}`,
  };
}
