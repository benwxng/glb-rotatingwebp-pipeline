import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  copyFile,
  mkdir,
  mkdtemp,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { detectInputType, extractZip, findModelFile } from "./archive.js";
import { readCatalogConfig, registerCatalogIngest } from "./catalog.js";
import { runCommand } from "./command.js";
import { downloadToFile } from "./download.js";
import { resolveBlender } from "./executables.js";
import { defaultR2Key, inferSlug } from "./naming.js";
import { uploadPreview } from "./r2.js";
import { getSketchfabDownload } from "./sketchfab.js";
import type { CliOptions, PipelineResult } from "./types.js";
import {
  assertWebpMatches,
  encodeWebp,
  inspectWebp,
  resizeFrames,
} from "./webp.js";

export type Logger = (message: string) => void;

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function blenderScriptPath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../blender/render_turntable.py");
}

async function copyInput(source: string, destination: string): Promise<void> {
  const inputStat = await stat(source);
  if (!inputStat.isFile()) throw new Error("--file must point to a regular file.");
  await copyFile(source, destination);
}

export async function runPipeline(
  options: CliOptions,
  log: Logger,
): Promise<PipelineResult> {
  const catalogConfig = options.upload ? readCatalogConfig() : null;
  const slug = inferSlug(options);
  const workParent = resolve(".work");
  await mkdir(workParent, { recursive: true });
  const workDirectory = await mkdtemp(resolve(workParent, `${slug}-`));
  let succeeded = false;

  try {
    const downloadedPath = resolve(workDirectory, "download");
    let sourceLabel: string;

    if (options.sketchfabUid) {
      log("Requesting a temporary Sketchfab download");
      const sketchfab = await getSketchfabDownload(
        options.sketchfabUid,
        options.maxDownloadBytes,
      );
      log("Downloading Sketchfab model archive");
      await downloadToFile(
        sketchfab.archiveUrl,
        downloadedPath,
        options.maxDownloadBytes,
      );
      sourceLabel = sketchfab.sourceLabel;
    } else if (options.url) {
      log("Downloading source model");
      const result = await downloadToFile(
        options.url,
        downloadedPath,
        options.maxDownloadBytes,
      );
      sourceLabel = result.sourceLabel;
    } else {
      log("Copying local source model");
      await copyInput(options.file!, downloadedPath);
      sourceLabel = basename(options.file!);
    }

    const inputType = await detectInputType(downloadedPath);
    let modelPath: string;
    if (inputType === "zip") {
      log("Extracting model archive");
      const extractedDirectory = resolve(workDirectory, "source");
      await mkdir(extractedDirectory, { recursive: true });
      await extractZip(downloadedPath, extractedDirectory);
      modelPath = await findModelFile(extractedDirectory);
    } else {
      if (inputType === "gltf" && (options.url || options.sketchfabUid)) {
        throw new Error(
          "Direct remote .gltf files are not supported because their dependent files are not bundled. Use a ZIP archive or GLB URL.",
        );
      }
      const extension = inputType === "glb" ? ".glb" : ".gltf";
      modelPath = resolve(workDirectory, `model${extension}`);
      await rename(downloadedPath, modelPath);
    }

    const frameDirectory = resolve(workDirectory, "frames");
    await mkdir(frameDirectory, { recursive: true });
    const blender = await resolveBlender();
    log(`Rendering ${options.frames} transparent frames`);
    await runCommand(blender, [
      "--background",
      "--factory-startup",
      "--python",
      blenderScriptPath(),
      "--",
      "--input",
      modelPath,
      "--output",
      frameDirectory,
      "--frames",
      String(options.frames),
      "--size",
      String(options.renderSize),
      "--padding",
      String(options.padding),
    ]);

    if (options.renderSize !== options.size) {
      log(`Downscaling frames to ${options.size}x${options.size}`);
      await resizeFrames({
        frameDirectory,
        frames: options.frames,
        size: options.size,
      });
    }

    const temporaryWebp = resolve(workDirectory, "preview.webp");
    log("Encoding animated WebP");
    await encodeWebp({
      frameDirectory,
      frameDurationMs: options.frameDurationMs,
      frames: options.frames,
      output: temporaryWebp,
      quality: options.quality,
    });

    log("Validating animated WebP");
    const inspection = await inspectWebp(temporaryWebp);
    assertWebpMatches(inspection, { frames: options.frames, size: options.size });

    const destinationDirectory = resolve(options.outputDir, slug);
    await mkdir(destinationDirectory, { recursive: true });
    const localPath = resolve(destinationDirectory, "preview.webp");
    await copyFile(temporaryWebp, localPath);

    const fileStat = await stat(localPath);
    const sha256 = await sha256File(localPath);
    let r2Key: string | null = null;
    let publicUrl: string | null = null;
    let catalogArtifactId: string | null = null;
    let catalogAssetId: string | null = null;
    let catalogCreated: boolean | null = null;
    let catalogRegistered = false;

    if (options.upload) {
      log("Uploading preview to Cloudflare R2");
      const uploaded = await uploadPreview({
        bytes: fileStat.size,
        key: options.r2Key ?? defaultR2Key(slug, sha256),
        path: localPath,
        sha256,
      });
      r2Key = uploaded.key;
      publicUrl = uploaded.publicUrl;

      if (catalogConfig) {
        log("Registering artifact and preview in the catalog");
        const registration = await registerCatalogIngest(catalogConfig, {
          artifact: { slug, ...options.artifact },
          asset: {
            bytes: fileStat.size,
            durationMs: options.frames * options.frameDurationMs,
            frameCount: inspection.frames,
            height: inspection.canvasHeight,
            kind: "preview_webp",
            mimeType: "image/webp",
            ...(publicUrl ? { publicUrl } : {}),
            r2Bucket: uploaded.bucket,
            r2Key: uploaded.key,
            sha256,
            width: inspection.canvasWidth,
          },
          publish: options.publish,
          source: {
            label: sourceLabel,
            ...(options.artifact.license
              ? { license: options.artifact.license }
              : {}),
            role: "model",
            ...(options.artifact.modelUrl
              ? { url: options.artifact.modelUrl }
              : sourceLabel.startsWith("http://") ||
                  sourceLabel.startsWith("https://")
                ? { url: sourceLabel }
                : {}),
          },
        });
        catalogArtifactId = registration.artifactId;
        catalogAssetId = registration.assetId;
        catalogCreated = registration.created;
        catalogRegistered = true;
      }
    }

    succeeded = true;
    return {
      bytes: fileStat.size,
      catalogArtifactId,
      catalogAssetId,
      catalogCreated,
      catalogRegistered,
      durationMs: options.frames * options.frameDurationMs,
      frames: inspection.frames,
      height: inspection.canvasHeight,
      localPath,
      publicUrl,
      r2Key,
      sha256,
      slug,
      source: sourceLabel,
      uploaded: options.upload,
      width: inspection.canvasWidth,
    };
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nWorking files were preserved at ${workDirectory}`,
      { cause: error },
    );
  } finally {
    if (succeeded && !options.keepWork) {
      await rm(workDirectory, { force: true, recursive: true });
    }
  }
}
