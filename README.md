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

For a supersampled render, set a larger internal render size than the final
WebP canvas. Frames are downscaled with a Lanczos filter before encoding:

```bash
pnpm artifact:preview \
  --file "/absolute/path/to/model.glb" \
  --slug "example-artifact" \
  --render-size 1200 \
  --size 800 \
  --quality 88 \
  --no-upload
```

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

`R2_PUBLIC_BASE_URL` is optional. If it is blank, the upload still succeeds and
the command reports the R2 object key with `publicUrl: null`. For development,
you can enable the bucket's Cloudflare-managed Public Development URL and use
its `https://<generated-subdomain>.r2.dev` value. Replace that with a custom
domain before production traffic.

The default R2 key is:

```text
previews/<slug>/v1/<sha256-prefix>.webp
```

The uploaded object uses:

```text
Content-Type: image/webp
Cache-Control: public, max-age=31536000, immutable
```

## Download directly from Sketchfab

Add `SKETCHFAB_API_TOKEN` to `.env.ingest.local`, then pass the model UID from
the end of its Sketchfab URL:

```bash
pnpm artifact:preview \
  --sketchfab-uid "9cd02b85b85d44bd906a3b79274b7654" \
  --slug "isis-serqet"
```

The command obtains and consumes the temporary archive URL internally so that
the signed URL does not appear in the command line or final report.

## Register uploads in the artifact catalog

Catalog registration is optional. Set both `CATALOG_API_BASE_URL` and
`CATALOG_INGEST_TOKEN` in `.env.ingest.local` to register a successful R2
upload in Postgres through the web app's authenticated endpoint. If both are
blank, the pipeline skips catalog registration. For upload runs, a partial
configuration fails before rendering so an expected registration is never
silently omitted. `--no-upload` never contacts or requires the catalog.

```bash
pnpm artifact:preview \
  --sketchfab-uid "9cd02b85b85d44bd906a3b79274b7654" \
  --slug "isis-serqet" \
  --name "Statue of Isis-Serqet" \
  --summary "A protective funerary deity from Tutankhamun's shrine." \
  --description "A gilded wooden figure associated with royal burial rites." \
  --earliest-year -1336 \
  --latest-year -1327 \
  --date-display "18th Dynasty, reign of Tutankhamun" \
  --origin "Thebes, Egypt" \
  --people-group "Ancient Egyptian" \
  --religious-significance "Associated with protection of the dead." \
  --source-url "https://example.org/artifact-record" \
  --model-url "https://sketchfab.com/3d-models/example" \
  --license "CC BY 4.0" \
  --publish
```

Uploads are cataloged as drafts by default. `--publish` makes the new artifact
visible immediately and therefore requires `--name`, `--model-url`, and
`--license`. This keeps incomplete or unattributed records out of public sites.

After R2 accepts the WebP, the pipeline sends `POST
${CATALOG_API_BASE_URL}/api/v1/ingest` with a bearer token. The request contains
the artifact metadata, the R2 bucket/key, dimensions, animation details, and
SHA-256. Its `Idempotency-Key` is derived from artifact slug and content hash,
so retrying after a network or database failure cannot create another asset
version. A registration failure fails the command and preserves working files;
the immutable R2 object can safely be uploaded again on retry.

No OpenAI, Anthropic, or other AI key is needed. Metadata is explicit CLI input
and can be enriched by a later catalog workflow.

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
- R2 uploads use conditional creation; an existing key is accepted only when
  its SHA-256, byte count, and MIME type match exactly.
- Temporary working files are removed after success and preserved after a
  failure for debugging.
- Upload happens only after the WebP passes validation.
- Catalog registration happens only after a successful R2 upload.
- Catalog credentials are sent only to the configured catalog origin.

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
