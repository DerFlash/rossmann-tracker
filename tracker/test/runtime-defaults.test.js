import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { asNonNegativeInteger, resolveRuntimePaths } from "../src/runtime-defaults.js";

test("verwendet außerhalb des Containers repo-relative Laufzeitpfade", () => {
  const trackerDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const projectDirectory = path.dirname(trackerDirectory);
  const paths = resolveRuntimePaths({}, pathToFileURL(path.join(trackerDirectory, "src", "app.js")).href);
  assert.deepEqual(paths, {
    configPath: path.join(trackerDirectory, "config.example.json"),
    dataDirectory: path.join(projectDirectory, "data"),
    browserDataDirectory: path.join(projectDirectory, "browser-data"),
    webUiPath: path.join(trackerDirectory, "public", "index.html"),
    catalogPath: path.join(projectDirectory, "products.json"),
  });
});

test("lässt Containerpfade vollständig per Umgebung überschreiben", () => {
  const paths = resolveRuntimePaths({
    CONFIG_PATH: "/app/config/default.json",
    DATA_DIR: "/app/data",
    BROWSER_DATA_DIR: "/app/browser-data",
    WEB_UI_PATH: "/app/public/index.html",
    CATALOG_PATH: "/app/config/products.json",
  });
  assert.deepEqual(paths, {
    configPath: "/app/config/default.json",
    dataDirectory: "/app/data",
    browserDataDirectory: "/app/browser-data",
    webUiPath: "/app/public/index.html",
    catalogPath: "/app/config/products.json",
  });
});

test("akzeptiert nur nichtnegative ganzzahlige Jitterwerte", () => {
  assert.equal(asNonNegativeInteger(0, "jitterMs"), 0);
  assert.equal(asNonNegativeInteger("2500", "jitterMs"), 2500);
  for (const value of ["abc", -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => asNonNegativeInteger(value, "jitterMs"), /nichtnegative Ganzzahl/);
  }
});
