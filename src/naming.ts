import { basename, extname } from "node:path";

export function sanitizeSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  if (!slug) {
    throw new Error("Could not derive a safe slug. Pass --slug explicitly.");
  }
  return slug;
}

export function inferSlug(input: { file?: string; slug?: string; url?: string }): string {
  if (input.slug) return sanitizeSlug(input.slug);

  if (input.file) {
    const filename = basename(input.file);
    return sanitizeSlug(filename.slice(0, -extname(filename).length));
  }

  if (input.url) {
    const parsed = new URL(input.url);
    const filename = basename(parsed.pathname) || parsed.hostname;
    const extension = extname(filename);
    return sanitizeSlug(extension ? filename.slice(0, -extension.length) : filename);
  }

  throw new Error("No input was provided.");
}

export function defaultR2Key(slug: string, sha256: string): string {
  return `previews/${slug}/v1/${sha256.slice(0, 16)}.webp`;
}
