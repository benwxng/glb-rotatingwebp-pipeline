# Artifact preview pipeline

- Treat download URLs as secrets because signed URLs can contain credentials.
  Never print their query strings.
- Use `pnpm artifact:preview` for turntable generation; do not reproduce the
  Blender or WebP command sequence manually.
- Run `pnpm check` after changing TypeScript code.
- Run a local `--no-upload` integration render after changing the Blender
  scene or encoding behavior.
- Do not upload to R2 unless the user explicitly asks for publication or the
  task explicitly includes an upload.
- Never commit `.env.ingest.local`, downloaded models, rendered frames, or
  generated previews.
