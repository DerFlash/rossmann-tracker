import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolveRuntimePaths(env = process.env, sourceUrl = import.meta.url) {
  const trackerDirectory = path.resolve(path.dirname(fileURLToPath(sourceUrl)), "..");
  const projectDirectory = path.dirname(trackerDirectory);
  return {
    configPath: env.CONFIG_PATH || path.join(trackerDirectory, "config.example.json"),
    dataDirectory: env.DATA_DIR || path.join(projectDirectory, "data"),
    browserDataDirectory: env.BROWSER_DATA_DIR || path.join(projectDirectory, "browser-data"),
    webUiPath: env.WEB_UI_PATH || path.join(trackerDirectory, "public", "index.html"),
    catalogPath: env.CATALOG_PATH || path.join(projectDirectory, "products.json"),
  };
}

export function asPositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} muss eine positive Ganzzahl sein.`);
  }
  return parsed;
}

export function asNonNegativeInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} muss eine nichtnegative Ganzzahl sein.`);
  }
  return parsed;
}
