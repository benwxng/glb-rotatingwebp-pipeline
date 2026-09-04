#!/usr/bin/env node

import { config as loadEnv } from "dotenv";

import { parseArgs, usage } from "./args.js";
import { runPipeline } from "./pipeline.js";

loadEnv({ path: ".env.ingest.local", quiet: true });

async function main(): Promise<void> {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof Error && error.message === "HELP") {
      process.stdout.write(usage());
      return;
    }
    throw error;
  }

  const log = (message: string): void => {
    const line = `[artifact-preview] ${message}\n`;
    if (options.json) process.stderr.write(line);
    else process.stdout.write(line);
  };

  const result = await runPipeline(options, log);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(`\nPreview complete\n`);
  process.stdout.write(`Local file: ${result.localPath}\n`);
  process.stdout.write(`Dimensions: ${result.width}x${result.height}\n`);
  process.stdout.write(`Frames: ${result.frames}\n`);
  process.stdout.write(`Duration: ${(result.durationMs / 1000).toFixed(2)}s\n`);
  process.stdout.write(`Size: ${(result.bytes / 1024).toFixed(1)} KiB\n`);
  process.stdout.write(`SHA-256: ${result.sha256}\n`);
  if (result.r2Key) process.stdout.write(`R2 key: ${result.r2Key}\n`);
  if (result.publicUrl) process.stdout.write(`Public URL: ${result.publicUrl}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `artifact-preview failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
