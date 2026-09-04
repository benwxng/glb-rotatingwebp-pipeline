import { createWriteStream } from "node:fs";
import { mkdir, open, readdir } from "node:fs/promises";
import { basename, dirname, extname, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";

import unzipper from "unzipper";

const MAX_EXTRACTED_BYTES = 2 * 1024 * 1024 * 1024;

export async function detectInputType(
  path: string,
): Promise<"glb" | "gltf" | "zip"> {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(4);
    await handle.read(buffer, 0, buffer.length, 0);
    if (buffer.toString("ascii") === "glTF") return "glb";
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) return "zip";
    if (buffer.toString("utf8").trimStart().startsWith("{")) return "gltf";
    throw new Error("Input is not a recognized ZIP, GLB, or glTF file.");
  } finally {
    await handle.close();
  }
}

export function safeArchivePath(root: string, entryPath: string): string {
  const normalized = entryPath.replaceAll("\\", "/").replace(/\/+$/, "");
  const segments = normalized.split("/");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    /^[a-zA-Z]:/.test(normalized) ||
    segments.some(
      (segment) => segment === ".." || segment === "." || segment === "",
    )
  ) {
    throw new Error("Archive contains an unsafe path.");
  }

  const target = resolve(root, ...segments);
  const rootPrefix = `${resolve(root)}${sep}`;
  if (!target.startsWith(rootPrefix)) {
    throw new Error("Archive contains a path outside the extraction directory.");
  }
  return target;
}

export async function extractZip(zipPath: string, destination: string): Promise<void> {
  const archive = await unzipper.Open.file(zipPath);
  let totalBytes = 0;

  for (const entry of archive.files) {
    const target = safeArchivePath(destination, entry.path);
    const unixMode = (entry.externalFileAttributes >>> 16) & 0o170000;
    if (unixMode === 0o120000) {
      throw new Error("Archive symlinks are not supported.");
    }

    if (entry.type === "Directory") {
      await mkdir(target, { recursive: true });
      continue;
    }

    totalBytes += entry.uncompressedSize;
    if (totalBytes > MAX_EXTRACTED_BYTES) {
      throw new Error("Extracted archive exceeds the configured safety limit.");
    }

    await mkdir(dirname(target), { recursive: true });
    await pipeline(entry.stream(), createWriteStream(target, { flags: "wx" }));
  }
}

async function walk(root: string): Promise<string[]> {
  const results: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === "__MACOSX") continue;
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) results.push(...(await walk(path)));
    if (entry.isFile()) results.push(path);
  }
  return results;
}

export async function findModelFile(root: string): Promise<string> {
  const models = (await walk(root)).filter((path) => {
    const extension = extname(path).toLowerCase();
    return extension === ".gltf" || extension === ".glb";
  });

  if (models.length === 0) {
    throw new Error("Archive does not contain a .gltf or .glb model.");
  }

  models.sort((left, right) => {
    const leftScene = basename(left).toLowerCase() === "scene.gltf" ? 0 : 1;
    const rightScene = basename(right).toLowerCase() === "scene.gltf" ? 0 : 1;
    return leftScene - rightScene || left.length - right.length;
  });
  return models[0]!;
}
