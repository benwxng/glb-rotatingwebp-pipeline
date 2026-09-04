import assert from "node:assert/strict";
import test from "node:test";

import { parseArgs } from "../src/args.js";

test("uses the 36-frame production defaults", () => {
  const options = parseArgs(["--url", "https://example.com/model.glb"]);
  assert.equal(options.frames, 36);
  assert.equal(options.size, 600);
  assert.equal(options.renderSize, 600);
  assert.equal(options.frameDurationMs, 83);
  assert.equal(options.upload, true);
  assert.equal(options.publish, false);
});

test("supports supersampled rendering", () => {
  const options = parseArgs([
    "--file",
    "model.glb",
    "--size",
    "800",
    "--render-size",
    "1200",
  ]);
  assert.equal(options.size, 800);
  assert.equal(options.renderSize, 1200);
});

test("keeps render size aligned when only output size changes", () => {
  const options = parseArgs(["--file", "model.glb", "--size", "800"]);
  assert.equal(options.renderSize, 800);
});

test("rejects a render smaller than the output", () => {
  assert.throws(
    () =>
      parseArgs([
        "--file",
        "model.glb",
        "--size",
        "800",
        "--render-size",
        "600",
      ]),
    /greater than or equal/,
  );
});

test("supports local-only rendering", () => {
  const options = parseArgs(["--file", "model.glb", "--no-upload"]);
  assert.equal(options.upload, false);
  assert.match(options.file!, /model\.glb$/);
});

test("parses artifact catalog metadata including BCE year ranges", () => {
  const options = parseArgs([
    "--file",
    "model.glb",
    "--name",
    "Artifact Name",
    "--summary",
    "Short summary",
    "--description",
    "Long description",
    "--earliest-year",
    "-700",
    "--latest-year",
    "-600",
    "--date-display",
    "7th century BCE",
    "--origin",
    "Judah",
    "--people-group",
    "Israelite",
    "--religious-significance",
    "Context for the biblical period",
    "--source-url",
    "https://museum.example/artifact",
    "--model-url",
    "https://models.example/artifact",
    "--license",
    "CC BY 4.0",
  ]);

  assert.deepEqual(options.artifact, {
    dateDisplay: "7th century BCE",
    description: "Long description",
    earliestYear: -700,
    latestYear: -600,
    license: "CC BY 4.0",
    modelUrl: "https://models.example/artifact",
    name: "Artifact Name",
    origin: "Judah",
    peopleGroup: "Israelite",
    religiousSignificance: "Context for the biblical period",
    sourceUrl: "https://museum.example/artifact",
    summary: "Short summary",
  });
});

test("rejects reversed artifact year ranges", () => {
  assert.throws(
    () =>
      parseArgs([
        "--file",
        "model.glb",
        "--earliest-year",
        "100",
        "--latest-year",
        "-100",
      ]),
    /earliest-year/,
  );
});

test("publishing requires attribution metadata", () => {
  assert.throws(
    () => parseArgs(["--file", "model.glb", "--publish"]),
    /requires --name, --model-url, and --license/,
  );
  const options = parseArgs([
    "--file",
    "model.glb",
    "--publish",
    "--name",
    "Artifact",
    "--model-url",
    "https://models.example/artifact",
    "--license",
    "CC BY 4.0",
  ]);
  assert.equal(options.publish, true);
});

test("accepts a Sketchfab model UID", () => {
  const options = parseArgs([
    "--sketchfab-uid",
    "9cd02b85b85d44bd906a3b79274b7654",
  ]);
  assert.equal(options.sketchfabUid, "9cd02b85b85d44bd906a3b79274b7654");
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
  assert.throws(
    () => parseArgs(["--sketchfab-uid", "not-a-uid"]),
    /32-character/,
  );
});
