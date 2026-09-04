import { lookup } from "node:dns/promises";
import { createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { isIP } from "node:net";

import type { DownloadResult } from "./types.js";

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) {
    return true;
  }
  const [first = 0, second = 0] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

export function redactUrl(value: string): string {
  const url = new URL(value);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function assertPublicHttps(value: string): Promise<URL> {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("Download URLs must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("Credentials are not allowed in the download URL.");
  }

  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("The download host resolves to a private or unsupported address.");
  }
  return url;
}

export async function downloadToFile(
  inputUrl: string,
  destination: string,
  maxBytes: number,
): Promise<DownloadResult> {
  let current = await assertPublicHttps(inputUrl);

  for (let redirect = 0; redirect <= 5; redirect += 1) {
    const response = await fetch(current, {
      headers: { "user-agent": "rotating-artifacts-pipeline/0.1" },
      redirect: "manual",
      signal: AbortSignal.timeout(10 * 60 * 1000),
    });

    if (REDIRECT_CODES.has(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Download redirect did not include a location.");
      current = await assertPublicHttps(new URL(location, current).toString());
      continue;
    }

    if (!response.ok || !response.body) {
      throw new Error(`Download failed with HTTP ${response.status}.`);
    }

    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength > maxBytes) {
      throw new Error("Download exceeds the configured size limit.");
    }

    let received = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;
        if (received > maxBytes) {
          callback(new Error("Download exceeds the configured size limit."));
          return;
        }
        callback(null, chunk);
      },
    });

    await pipeline(
      Readable.fromWeb(response.body as never),
      limiter,
      createWriteStream(destination, { flags: "wx" }),
    );

    return {
      contentType: response.headers.get("content-type"),
      path: destination,
      sourceLabel: redactUrl(inputUrl),
    };
  }

  throw new Error("Download exceeded the redirect limit.");
}
