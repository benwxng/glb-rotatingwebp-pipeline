import assert from "node:assert/strict";
import test from "node:test";

import { safeArchivePath } from "../src/archive.js";

test("resolves a normal archive path within the extraction directory", () => {
  assert.equal(
    safeArchivePath("/tmp/artifact", "textures/base-color.png"),
    "/tmp/artifact/textures/base-color.png",
  );
  assert.equal(
    safeArchivePath("/tmp/artifact", "textures/"),
    "/tmp/artifact/textures",
  );
});

test("rejects traversal and absolute archive paths", () => {
  assert.throws(() => safeArchivePath("/tmp/artifact", "../secret"), /unsafe/);
  assert.throws(() => safeArchivePath("/tmp/artifact", "/etc/passwd"), /unsafe/);
  assert.throws(
    () => safeArchivePath("/tmp/artifact", "C:\\Windows\\system.ini"),
    /unsafe/,
  );
  assert.throws(() => safeArchivePath("/tmp/artifact", "textures//file.png"), /unsafe/);
});
