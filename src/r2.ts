import { createReadStream } from "node:fs";

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for R2 uploads.`);
  return value;
}

function publicUrl(baseUrl: string | undefined, key: string): string | null {
  if (!baseUrl) return null;
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/+$/, "")}/${encodedKey}`;
}

function isPreconditionFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const status =
    "$metadata" in error &&
    typeof error.$metadata === "object" &&
    error.$metadata !== null &&
    "httpStatusCode" in error.$metadata
      ? error.$metadata.httpStatusCode
      : null;
  return status === 412 || ("name" in error && error.name === "PreconditionFailed");
}

export async function uploadPreview(options: {
  bytes: number;
  key: string;
  path: string;
  sha256: string;
}): Promise<{ bucket: string; key: string; publicUrl: string | null }> {
  const accountId = required("R2_ACCOUNT_ID");
  const bucket = required("R2_PUBLIC_BUCKET");
  const client = new S3Client({
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: "auto",
  });

  try {
    await client.send(
      new PutObjectCommand({
        Body: createReadStream(options.path),
        Bucket: bucket,
        CacheControl: "public, max-age=31536000, immutable",
        ContentLength: options.bytes,
        ContentType: "image/webp",
        IfNoneMatch: "*",
        Key: options.key,
        Metadata: {
          sha256: options.sha256,
        },
      }),
    );
  } catch (error) {
    if (!isPreconditionFailure(error)) throw error;

    const existing = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: options.key }),
    );
    const existingHash = existing.Metadata?.sha256?.toLowerCase();
    if (
      existingHash !== options.sha256.toLowerCase() ||
      existing.ContentLength !== options.bytes ||
      existing.ContentType !== "image/webp"
    ) {
      throw new Error(
        `Refusing to overwrite immutable R2 object ${options.key}; existing content does not match this preview.`,
      );
    }
  }

  return {
    bucket,
    key: options.key,
    publicUrl: publicUrl(process.env.R2_PUBLIC_BASE_URL, options.key),
  };
}
