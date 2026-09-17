import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const base = new URL("../module/webroot/", import.meta.url);
const index = await readFile(new URL("index.html", base), "utf8");

test("core leaves focused-control scrolling to the browser", async () => {
  assert.doesNotMatch(index, /mobile-input-viewport\.js/);
  await assert.rejects(stat(new URL("mobile-input-viewport.js", base)), error => error?.code === "ENOENT");
  for (const name of ["app.js", "observability.js", "v03.js", "v04.js"]) {
    const source = await readFile(new URL(name, base), "utf8");
    assert.doesNotMatch(source, /addEventListener\(["']focusin["']/);
    assert.doesNotMatch(source, /visualViewport/);
  }
});
