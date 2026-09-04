import assert from "node:assert/strict";
import test from "node:test";

import { defaultR2Key, inferSlug, sanitizeSlug } from "../src/naming.js";

test("sanitizes artifact names", () => {
  assert.equal(sanitizeSlug("The Rosetta Stone!"), "the-rosetta-stone");
});

test("infers a slug without retaining signed URL parameters", () => {
  assert.equal(
    inferSlug({ url: "https://cdn.example.com/models/Duck.glb?token=secret" }),
    "duck",
  );
});

test("builds an immutable content-addressed R2 key", () => {
  assert.equal(
    defaultR2Key("duck", "1234567890abcdefcafebabedeadbeef"),
    "previews/duck/v1/1234567890abcdef.webp",
  );
});
