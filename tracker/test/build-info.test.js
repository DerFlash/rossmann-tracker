import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getBuildInfo } from "../src/build-info.js";

const packageMetadata = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

test("Build-Metadaten verwenden Paketversion und sichere Entwicklungswerte", () => {
  assert.deepEqual(getBuildInfo({}), {
    version: packageMetadata.version,
    revision: "development",
    builtAt: null,
    channel: "stable",
  });
});

test("Release-Builds übernehmen validierte Build-Argumente", () => {
  assert.deepEqual(getBuildInfo({
    APP_VERSION: "1.2.3",
    APP_REVISION: "0123456789abcdef",
    APP_BUILD_DATE: "2026-08-28T06:00:00Z",
  }), {
    version: "1.2.3",
    revision: "0123456789abcdef",
    builtAt: "2026-08-28T06:00:00.000Z",
    channel: "stable",
  });
});

test("ungültige Build-Metadaten werden beim Start abgewiesen", () => {
  assert.throws(() => getBuildInfo({ APP_VERSION: "latest" }), /semantische Version/);
  assert.throws(() => getBuildInfo({ APP_REVISION: "Leer zeichen" }), /APP_REVISION/);
  assert.throws(() => getBuildInfo({ APP_BUILD_DATE: "gestern" }), /APP_BUILD_DATE/);
});
