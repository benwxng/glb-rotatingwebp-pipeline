import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { runCommand } from "./command.js";
import { resolveExecutable } from "./executables.js";
import type { WebpInspection } from "./types.js";

export async function encodeWebp(options: {
  frameDirectory: string;
  frameDurationMs: number;
  frames: number;
  output: string;
  quality: number;
}): Promise<void> {
  const executable = await resolveExecutable(
    "IMG2WEBP_BIN",
    process.platform === "win32" ? "img2webp.exe" : "img2webp",
  );
  const framePaths = (await readdir(options.frameDirectory))
    .filter((name) => /^frame_\d{4}\.png$/i.test(name))
    .sort()
    .map((name) => resolve(options.frameDirectory, name));

  if (framePaths.length !== options.frames) {
    throw new Error(
      `Expected ${options.frames} rendered frames, found ${framePaths.length}.`,
    );
  }

  const args = ["-loop", "0", "-min_size", "-mixed"];
  for (const frame of framePaths) {
    args.push(
      "-d",
      String(options.frameDurationMs),
      "-lossy",
      "-q",
      String(options.quality),
      "-m",
      "6",
      "-exact",
      frame,
    );
  }
  args.push("-o", options.output);
  await runCommand(executable, args);
}

export function parseWebpmuxInfo(raw: string): WebpInspection {
  const canvas = raw.match(/Canvas size:\s*(\d+)\s*x\s*(\d+)/i);
  const frameCount = raw.match(/Number of frames:\s*(\d+)/i);
  const loopCount = raw.match(/Loop Count\s*:\s*(\d+)/i);

  if (!canvas || !frameCount || !loopCount) {
    throw new Error("Could not parse WebP inspection output.");
  }

  return {
    canvasHeight: Number(canvas[2]),
    canvasWidth: Number(canvas[1]),
    frames: Number(frameCount[1]),
    hasAnimation: /Features present:\s*[^\n]*animation/i.test(raw),
    hasTransparency: /Features present:\s*[^\n]*transparency/i.test(raw),
    loopCount: Number(loopCount[1]),
    raw,
  };
}

export async function inspectWebp(path: string): Promise<WebpInspection> {
  const executable = await resolveExecutable(
    "WEBPMUX_BIN",
    process.platform === "win32" ? "webpmux.exe" : "webpmux",
  );
  const result = await runCommand(executable, ["-info", path]);
  return parseWebpmuxInfo(`${result.stdout}\n${result.stderr}`);
}

export function assertWebpMatches(
  inspection: WebpInspection,
  expected: { frames: number; size: number },
): void {
  if (!inspection.hasAnimation) throw new Error("Output WebP is not animated.");
  if (!inspection.hasTransparency) {
    throw new Error("Output WebP does not advertise transparency.");
  }
  if (inspection.frames !== expected.frames) {
    throw new Error(
      `Output has ${inspection.frames} frames; expected ${expected.frames}.`,
    );
  }
  if (
    inspection.canvasWidth !== expected.size ||
    inspection.canvasHeight !== expected.size
  ) {
    throw new Error(
      `Output is ${inspection.canvasWidth}x${inspection.canvasHeight}; expected ${expected.size}x${expected.size}.`,
    );
  }
  if (inspection.loopCount !== 0) {
    throw new Error("Output WebP is not configured to loop indefinitely.");
  }
}
