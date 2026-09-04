import assert from "node:assert/strict";
import test from "node:test";

import { assertWebpMatches, parseWebpmuxInfo } from "../src/webp.js";

const fixture = `Canvas size: 600 x 600
Features present: animation transparency
Background color : 0x00000000  Loop Count : 0
Number of frames: 36`;

test("parses animated WebP metadata", () => {
  const inspection = parseWebpmuxInfo(fixture);
  assert.equal(inspection.canvasWidth, 600);
  assert.equal(inspection.canvasHeight, 600);
  assert.equal(inspection.frames, 36);
  assert.equal(inspection.hasAnimation, true);
  assert.equal(inspection.hasTransparency, true);
  assert.equal(inspection.loopCount, 0);
});

test("accepts a matching WebP", () => {
  assert.doesNotThrow(() =>
    assertWebpMatches(parseWebpmuxInfo(fixture), { frames: 36, size: 600 }),
  );
});
