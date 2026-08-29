import { readFileSync } from "node:fs";

const packageMetadata = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const REVISION_PATTERN = /^[0-9A-Za-z._-]{1,64}$/;
const ISO_BUILD_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function optionalValue(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

export function getBuildInfo(environment = process.env) {
  const version = optionalValue(environment.APP_VERSION) || packageMetadata.version;
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error("APP_VERSION muss eine gültige semantische Version sein.");
  }

  const revision = optionalValue(environment.APP_REVISION) || "development";
  if (!REVISION_PATTERN.test(revision)) {
    throw new Error("APP_REVISION enthält ungültige Zeichen.");
  }

  const configuredBuildDate = optionalValue(environment.APP_BUILD_DATE);
  if (configuredBuildDate && !ISO_BUILD_DATE_PATTERN.test(configuredBuildDate)) {
    throw new Error("APP_BUILD_DATE muss ein gültiger ISO-Zeitpunkt in UTC sein.");
  }
  const buildDate = configuredBuildDate ? new Date(configuredBuildDate) : null;
  if (buildDate && Number.isNaN(buildDate.getTime())) {
    throw new Error("APP_BUILD_DATE muss ein gültiger ISO-Zeitpunkt sein.");
  }

  return Object.freeze({
    version,
    revision,
    builtAt: buildDate?.toISOString() || null,
    channel: "stable",
  });
}

export const BUILD_INFO = getBuildInfo();
