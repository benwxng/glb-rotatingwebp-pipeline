# Rotating Artifacts Pipeline

A standalone command-line pipeline that accepts a direct downloadable ZIP or
GLB URL, renders a normalized 360-degree turntable, encodes the frames as one
transparent animated WebP, and optionally uploads the result to Cloudflare R2.

This repository is intentionally independent of the Next.js website. The
website consumes the published files; it does not perform rendering work.

## Output contract

The production defaults are:

- 600 × 600 transparent canvas
- 36 frames
- 83 ms per frame (approximately 12 fps and 3 seconds per rotation)
- infinite looping
- lossy WebP quality 82
- a content-addressed R2 object key

The finished local file is written to `output/<slug>/preview.webp`.

## Requirements

- Node.js 20 or newer
- pnpm
- Blender 4.5 LTS or compatible
- `img2webp`
- `webpmux`

On macOS, the pipeline automatically detects Blender at
`/Applications/Blender.app/Contents/MacOS/Blender`. Other locations can be set
with `BLENDER_BIN`.

## Install

```bash
pnpm install
cp .env.example .env.ingest.local
```

R2 credentials are unnecessary when using `--no-upload`.

## Render without uploading

```bash
pnpm artifact:preview \
  --url "https://example.com/download/model.glb" \
  --slug "example-artifact" \
  --no-upload
```

Local files can be used during development:

```bash
pnpm artifact:preview \
  --file "/absolute/path/to/model.glb" \
  --slug "example-artifact" \
  --no-upload
```

## Render and upload to R2

Populate `.env.ingest.local`, then omit `--no-upload`:

```bash
pnpm artifact:preview \
  --url "https://example.com/download/model.zip" \
  --slug "example-artifact"
```

The default R2 key is:

```text
previews/<slug>/v1/<sha256-prefix>.webp
```

The uploaded object uses:

```text
Content-Type: image/webp
Cache-Control: public, max-age=31536000, immutable
```

## Accepted inputs

- A direct HTTPS URL returning a GLB file
- A direct HTTPS URL returning a ZIP containing `.gltf` or `.glb`
- A local GLB, glTF, or ZIP with `--file`

A Sketchfab model page URL is not a download URL. The current command expects
the temporary archive URL returned by Sketchfab's authenticated Download API.
Sketchfab authentication and catalog selection can be added as a separate
front-end stage without changing this renderer's contract.

Direct remote `.gltf` files are rejected because their buffers and textures
are normally separate relative resources. Bundle them in a ZIP or provide a
GLB instead.

## Security and failure behavior

- Only HTTPS downloads are accepted.
- Hosts resolving to private or local addresses are rejected.
- Redirect destinations are checked again.
- Downloads and extracted archives have size limits.
- Archive traversal paths and symlinks are rejected.
- Signed URL query parameters are never included in reports.
- R2 credentials are read only from the local environment.
- Temporary working files are removed after success and preserved after a
  failure for debugging.
- Upload happens only after the WebP passes validation.

## Verification

```bash
pnpm check
```

For a small integration test, use a public GLB and disable upload:

```bash
pnpm artifact:preview \
  --url "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb" \
  --slug "duck" \
  --frames 8 \
  --size 256 \
  --no-upload
```
