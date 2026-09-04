import { createReadStream } from "node:fs";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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

export async function uploadPreview(options: {
  bytes: number;
  key: string;
  path: string;
  sha256: string;
}): Promise<{ key: string; publicUrl: string | null }> {
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

  await client.send(
    new PutObjectCommand({
      Body: createReadStream(options.path),
      Bucket: bucket,
      CacheControl: "public, max-age=31536000, immutable",
      ContentLength: options.bytes,
      ContentType: "image/webp",
      Key: options.key,
      Metadata: {
        sha256: options.sha256,
      },
    }),
  );

  return {
    key: options.key,
    publicUrl: publicUrl(process.env.R2_PUBLIC_BASE_URL, options.key),
  };
}
