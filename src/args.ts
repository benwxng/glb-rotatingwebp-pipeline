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

function integer(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${flag} must be an integer.`);
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
    artifact: {},
    frameDurationMs: 83,
    frames: 36,
    json: false,
    keepWork: false,
    maxDownloadBytes: DEFAULT_MAX_DOWNLOAD_BYTES,
    outputDir: resolve("output"),
    padding: 1.12,
    publish: false,
    quality: 82,
    renderSize: 600,
    size: 600,
    upload: true,
  };
  let hasExplicitRenderSize = false;

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
      case "--sketchfab-uid": {
        const uid = readValue(argv, index, flag);
        if (!/^[a-f0-9]{32}$/i.test(uid)) {
          throw new Error("--sketchfab-uid must be a 32-character model UID.");
        }
        options.sketchfabUid = uid.toLowerCase();
        index += 1;
        break;
      }
      case "--slug":
        options.slug = readValue(argv, index, flag);
        index += 1;
        break;
      case "--name":
        options.artifact.name = readValue(argv, index, flag);
        index += 1;
        break;
      case "--summary":
        options.artifact.summary = readValue(argv, index, flag);
        index += 1;
        break;
      case "--description":
        options.artifact.description = readValue(argv, index, flag);
        index += 1;
        break;
      case "--earliest-year":
        options.artifact.earliestYear = integer(readValue(argv, index, flag), flag);
        index += 1;
        break;
      case "--latest-year":
        options.artifact.latestYear = integer(readValue(argv, index, flag), flag);
        index += 1;
        break;
      case "--date-display":
        options.artifact.dateDisplay = readValue(argv, index, flag);
        index += 1;
        break;
      case "--origin":
        options.artifact.origin = readValue(argv, index, flag);
        index += 1;
        break;
      case "--people-group":
        options.artifact.peopleGroup = readValue(argv, index, flag);
        index += 1;
        break;
      case "--religious-significance":
        options.artifact.religiousSignificance = readValue(argv, index, flag);
        index += 1;
        break;
      case "--source-url":
        options.artifact.sourceUrl = readValue(argv, index, flag);
        index += 1;
        break;
      case "--model-url":
        options.artifact.modelUrl = readValue(argv, index, flag);
        index += 1;
        break;
      case "--license":
        options.artifact.license = readValue(argv, index, flag);
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
        if (!hasExplicitRenderSize) options.renderSize = options.size;
        index += 1;
        break;
      case "--render-size":
        options.renderSize = positiveInteger(readValue(argv, index, flag), flag);
        hasExplicitRenderSize = true;
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
      case "--publish":
        options.publish = true;
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

  const inputCount = [options.url, options.file, options.sketchfabUid].filter(Boolean).length;
  if (inputCount !== 1) {
    throw new Error("Provide exactly one of --url, --file, or --sketchfab-uid.");
  }
  if (options.renderSize < options.size) {
    throw new Error("--render-size must be greater than or equal to --size.");
  }
  if (
    options.artifact.earliestYear !== undefined &&
    options.artifact.latestYear !== undefined &&
    options.artifact.earliestYear > options.artifact.latestYear
  ) {
    throw new Error("--earliest-year must be less than or equal to --latest-year.");
  }
  if (
    options.publish &&
    (!options.artifact.name ||
      !options.artifact.modelUrl ||
      !options.artifact.license)
  ) {
    throw new Error(
      "--publish requires --name, --model-url, and --license.",
    );
  }

  return options;
}

export function usage(): string {
  return `Usage:
  pnpm artifact:preview --url <download-url> [options]
  pnpm artifact:preview --file <model.glb|archive.zip> [options]
  pnpm artifact:preview --sketchfab-uid <model-uid> [options]

Options:
  --slug <slug>                 Output slug; inferred when omitted
  --name <name>                 Canonical artifact name
  --summary <text>              Short artifact summary
  --description <text>          Full artifact description
  --earliest-year <year>        Earliest year (negative values represent BCE)
  --latest-year <year>          Latest year (negative values represent BCE)
  --date-display <text>         Human-readable date or period
  --origin <text>               Geographic origin
  --people-group <text>         Associated people or culture
  --religious-significance <text> Religious or biblical significance
  --source-url <url>            Research or museum source page
  --model-url <url>             Public model attribution/source page
  --license <text>              Asset license or rights statement
  --output-dir <directory>      Local output directory (default: output)
  --frames <count>              Animation frames (default: 36)
  --size <pixels>               Square canvas size (default: 600)
  --render-size <pixels>        Supersampled render size before downscaling
  --frame-duration-ms <ms>      Duration of each frame (default: 83)
  --quality <0-100>             Lossy WebP quality (default: 82)
  --padding <1-2>               Camera padding around the model (default: 1.12)
  --max-download-mb <mb>        Download limit (default: 750)
  --key <r2-key>                Override the generated R2 object key
  --publish                     Publish immediately (requires name, model URL, license)
  --no-upload                   Produce a local preview without R2
  --keep-work                   Preserve temporary files after success
  --json                        Print the final report as JSON
  --help                        Show this help
`;
}
