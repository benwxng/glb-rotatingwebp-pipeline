import { resolve } from "node:path";

import type { CliOptions } from "./types.js";

const DEFAULT_MAX_DOWNLOAD_BYTES = 750 * 1024 * 1024;

function readValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function positiveInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function boundedNumber(
  value: string,
  flag: string,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${flag} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    frameDurationMs: 83,
    frames: 36,
    json: false,
    keepWork: false,
    maxDownloadBytes: DEFAULT_MAX_DOWNLOAD_BYTES,
    outputDir: resolve("output"),
    padding: 1.12,
    quality: 82,
    size: 600,
    upload: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    switch (flag) {
      case "--url":
        options.url = readValue(argv, index, flag);
        index += 1;
        break;
      case "--file":
        options.file = resolve(readValue(argv, index, flag));
        index += 1;
        break;
      case "--slug":
        options.slug = readValue(argv, index, flag);
        index += 1;
        break;
      case "--output-dir":
        options.outputDir = resolve(readValue(argv, index, flag));
        index += 1;
        break;
      case "--frames":
        options.frames = positiveInteger(readValue(argv, index, flag), flag);
        index += 1;
        break;
      case "--size":
        options.size = positiveInteger(readValue(argv, index, flag), flag);
        index += 1;
        break;
      case "--frame-duration-ms":
        options.frameDurationMs = positiveInteger(
          readValue(argv, index, flag),
          flag,
        );
        index += 1;
        break;
      case "--quality":
        options.quality = boundedNumber(
          readValue(argv, index, flag),
          flag,
          0,
          100,
        );
        index += 1;
        break;
      case "--padding":
        options.padding = boundedNumber(
          readValue(argv, index, flag),
          flag,
          1,
          2,
        );
        index += 1;
        break;
      case "--max-download-mb":
        options.maxDownloadBytes =
          positiveInteger(readValue(argv, index, flag), flag) * 1024 * 1024;
        index += 1;
        break;
      case "--key":
        options.r2Key = readValue(argv, index, flag);
        index += 1;
        break;
      case "--no-upload":
        options.upload = false;
        break;
      case "--keep-work":
        options.keepWork = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
      case "-h":
        throw new Error("HELP");
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }

  if (Boolean(options.url) === Boolean(options.file)) {
    throw new Error("Provide exactly one of --url or --file.");
  }

  return options;
}

export function usage(): string {
  return `Usage:
  pnpm artifact:preview --url <download-url> [options]
  pnpm artifact:preview --file <model.glb|archive.zip> [options]

Options:
  --slug <slug>                 Output slug; inferred when omitted
  --output-dir <directory>      Local output directory (default: output)
  --frames <count>              Animation frames (default: 36)
  --size <pixels>               Square canvas size (default: 600)
  --frame-duration-ms <ms>      Duration of each frame (default: 83)
  --quality <0-100>             Lossy WebP quality (default: 82)
  --padding <1-2>               Camera padding around the model (default: 1.12)
  --max-download-mb <mb>        Download limit (default: 750)
  --key <r2-key>                Override the generated R2 object key
  --no-upload                   Produce a local preview without R2
  --keep-work                   Preserve temporary files after success
  --json                        Print the final report as JSON
  --help                        Show this help
`;
}
