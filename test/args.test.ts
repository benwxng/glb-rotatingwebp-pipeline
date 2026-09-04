import assert from "node:assert/strict";
import test from "node:test";

import { parseArgs } from "../src/args.js";

test("uses the 36-frame production defaults", () => {
  const options = parseArgs(["--url", "https://example.com/model.glb"]);
  assert.equal(options.frames, 36);
  assert.equal(options.size, 600);
  assert.equal(options.frameDurationMs, 83);
  assert.equal(options.upload, true);
});

test("supports local-only rendering", () => {
  const options = parseArgs(["--file", "model.glb", "--no-upload"]);
  assert.equal(options.upload, false);
  assert.match(options.file!, /model\.glb$/);
});

test("requires exactly one input", () => {
  assert.throws(() => parseArgs([]), /exactly one/);
  assert.throws(
    () =>
      parseArgs([
        "--url",
        "https://example.com/model.glb",
        "--file",
        "model.glb",
      ]),
    /exactly one/,
  );
});
