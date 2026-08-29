import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1_000;
const RELEASES_API_URL = "https://api.github.com/repos/DerFlash/rossmann-tracker/releases/latest";
const RELEASES_WEB_PREFIX = "https://github.com/DerFlash/rossmann-tracker/releases/tag/";
const STABLE_VERSION_PATTERN = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function parseStableVersion(value) {
  const match = String(value || "").trim().match(STABLE_VERSION_PATTERN);
  return match ? match.slice(1).map(Number) : null;
}

export function compareStableVersions(left, right) {
  const leftParts = parseStableVersion(left);
  const rightParts = parseStableVersion(right);
  if (!leftParts || !rightParts) throw new Error("Stable-Version ist ungültig.");
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return Math.sign(leftParts[index] - rightParts[index]);
  }
  return 0;
}

function stableReleaseIsNewer(releaseVersion, currentVersion) {
  const releaseParts = parseStableVersion(releaseVersion);
  const currentMatch = String(currentVersion || "").trim().match(SEMVER_PATTERN);
  if (!releaseParts || !currentMatch) throw new Error("Version ist ungültig.");
  const currentParts = currentMatch.slice(1, 4).map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (releaseParts[index] !== currentParts[index]) return releaseParts[index] > currentParts[index];
  }
  return Boolean(currentMatch[4]);
}

function securityRelevant(notes) {
  return /(?:^|\n)#{1,6}\s*(?:sicherheit|security)\b|\b(?:CVE-\d{4}-\d+|GHSA-[0-9a-z-]+)\b|\b(?:sicherheitsupdate|security (?:update|fix|patch))\b/iu.test(notes);
}

function normalizeRelease(payload) {
  if (!payload || payload.draft || payload.prerelease) return null;
  const tag = String(payload.tag_name || "").trim();
  const versionParts = parseStableVersion(tag);
  if (!versionParts) return null;
  const version = versionParts.join(".");
  const expectedUrl = `${RELEASES_WEB_PREFIX}${tag}`;
  if (payload.html_url !== expectedUrl) return null;
  const notes = String(payload.body || "").trim().slice(0, 4_000);
  const publishedAt = new Date(payload.published_at || "");
  return {
    version,
    name: String(payload.name || `Version ${version}`).trim().slice(0, 200),
    notes,
    url: expectedUrl,
    publishedAt: Number.isNaN(publishedAt.getTime()) ? null : publishedAt.toISOString(),
    securityRelevant: securityRelevant(notes),
  };
}

function checkedAtMillis(cache) {
  const value = Date.parse(cache?.checkedAt || "");
  return Number.isFinite(value) ? value : null;
}

function normalizeCache(parsed) {
  if (parsed?.version !== 1 || checkedAtMillis(parsed) === null) return null;
  if (parsed.result === "unavailable") {
    return { version: 1, checkedAt: new Date(checkedAtMillis(parsed)).toISOString(), result: "unavailable", release: null };
  }
  if (parsed.result !== "ok" || !parsed.release) return null;
  const cachedVersion = String(parsed.release.version || "").trim();
  const cachedTag = parsed.release.url === `${RELEASES_WEB_PREFIX}${cachedVersion}`
    ? cachedVersion
    : `v${cachedVersion}`;
  const release = normalizeRelease({
    tag_name: cachedTag,
    name: parsed.release.name,
    body: parsed.release.notes,
    html_url: parsed.release.url,
    published_at: parsed.release.publishedAt,
    draft: false,
    prerelease: false,
  });
  return release
    ? { version: 1, checkedAt: new Date(checkedAtMillis(parsed)).toISOString(), result: "ok", release }
    : null;
}

export function createUpdateChecker({
  currentVersion,
  cachePath,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
} = {}) {
  if (!SEMVER_PATTERN.test(String(currentVersion || "").trim())) throw new Error("Aktuelle Version ist ungültig.");
  if (!cachePath) throw new Error("Pfad für den Update-Cache fehlt.");
  let cache = null;
  let enabled = true;
  let pending = false;
  let activeCheck = null;

  async function load() {
    try {
      const parsed = JSON.parse(await readFile(cachePath, "utf8"));
      cache = normalizeCache(parsed);
    } catch (error) {
      if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
  }

  async function save(nextCache) {
    await mkdir(path.dirname(cachePath), { recursive: true });
    const temporaryPath = `${cachePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(nextCache, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, cachePath);
    cache = nextCache;
  }

  function status() {
    if (!enabled) return { enabled: false, state: "disabled", currentVersion };
    const checkedAt = cache?.checkedAt || null;
    const checkedAtMs = checkedAtMillis(cache);
    const nextCheckAt = checkedAtMs === null
      ? null
      : new Date(checkedAtMs + UPDATE_CHECK_INTERVAL_MS).toISOString();
    const release = cache?.release || null;
    const available = Boolean(release && stableReleaseIsNewer(release.version, currentVersion));
    return {
      enabled: true,
      state: pending ? "checking" : available ? "available" : cache?.result === "ok" ? "current" : "unavailable",
      currentVersion,
      checkedAt,
      nextCheckAt,
      release: available ? release : null,
    };
  }

  async function check() {
    if (!enabled) return { ...status(), fetched: false };
    if (activeCheck) return activeCheck;
    const lastCheck = checkedAtMillis(cache);
    const elapsed = lastCheck === null ? null : now() - lastCheck;
    if (elapsed !== null && elapsed < UPDATE_CHECK_INTERVAL_MS) {
      return { ...status(), fetched: false };
    }

    activeCheck = (async () => {
      pending = true;
      let failure = null;
      try {
        const response = await fetchImpl(RELEASES_API_URL, {
          headers: {
            accept: "application/vnd.github+json",
            "user-agent": "Rossmann-Store-Tracker",
            "x-github-api-version": "2022-11-28",
          },
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
        const release = normalizeRelease(await response.json());
        if (!release) throw new Error("GitHub lieferte kein gültiges Stable-Release.");
        await save({ version: 1, checkedAt: new Date(now()).toISOString(), result: "ok", release });
      } catch (error) {
        await save({ version: 1, checkedAt: new Date(now()).toISOString(), result: "unavailable", release: null });
        failure = error instanceof Error ? error.message : String(error);
      } finally {
        pending = false;
      }
      return { ...status(), fetched: true, ...(failure ? { error: failure } : {}) };
    })().finally(() => { activeCheck = null; });
    return activeCheck;
  }

  return {
    async initialize(initialEnabled = true) {
      enabled = Boolean(initialEnabled);
      await load();
      return status();
    },
    setEnabled(nextEnabled) {
      enabled = Boolean(nextEnabled);
      return status();
    },
    check,
    status,
  };
}
