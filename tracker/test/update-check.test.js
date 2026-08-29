import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { compareStableVersions, createUpdateChecker, UPDATE_CHECK_INTERVAL_MS } from "../src/update-check.js";

async function fixture({ currentVersion = "0.4.0", response, now = Date.parse("2026-08-28T12:00:00Z") } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rossmann-update-"));
  const calls = [];
  const checker = createUpdateChecker({
    currentVersion,
    cachePath: path.join(directory, "update-check.json"),
    now: typeof now === "function" ? now : () => now,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response || {
        ok: true,
        async json() {
          return {
            tag_name: "v0.5.0",
            name: "Version 0.5.0",
            body: "## Sicherheit\nBehebt GHSA-abcd-1234-efgh.",
            html_url: "https://github.com/DerFlash/rossmann-tracker/releases/tag/v0.5.0",
            published_at: "2026-08-28T10:00:00Z",
            draft: false,
            prerelease: false,
          };
        },
      };
    },
  });
  return { checker, calls, directory };
}

test("Stable-Versionen werden numerisch verglichen und Vorabversionen abgewiesen", () => {
  assert.equal(compareStableVersions("0.10.0", "0.9.9"), 1);
  assert.equal(compareStableVersions("v1.0.0", "1.0.0"), 0);
  assert.equal(compareStableVersions("1.0.0", "2.0.0"), -1);
  assert.throws(() => compareStableVersions("1.0.0-beta.1", "1.0.0"), /ungültig/);
});

test("aktuelle SemVer-Suffixe werden akzeptiert und korrekt mit Stable verglichen", async () => {
  const buildMetadata = await fixture({ currentVersion: "0.5.0+build.7" });
  await buildMetadata.checker.initialize(true);
  assert.equal((await buildMetadata.checker.check()).state, "current");

  const prerelease = await fixture({ currentVersion: "0.5.0-rc.1" });
  await prerelease.checker.initialize(true);
  assert.equal((await prerelease.checker.check()).state, "available");
});

test("ein neueres Stable-Release wird datensparsam erkannt und lokal gecacht", async () => {
  const { checker, calls, directory } = await fixture();
  await checker.initialize(true);
  const result = await checker.check();
  assert.equal(result.state, "available");
  assert.equal(result.release.version, "0.5.0");
  assert.equal(result.release.securityRelevant, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(Object.keys(calls[0].options.headers).sort(), ["accept", "user-agent", "x-github-api-version"]);
  assert.equal(calls[0].options.redirect, "error");
  const cache = JSON.parse(await readFile(path.join(directory, "update-check.json"), "utf8"));
  assert.equal(cache.release.version, "0.5.0");
  assert.equal(cache.installationId, undefined);
});

test("Stable-Releases ohne v-Präfix werden erkannt und aus dem Cache geladen", async () => {
  const { checker, directory } = await fixture({ response: {
    ok: true,
    async json() {
      return {
        tag_name: "0.5.0",
        name: "Version 0.5.0",
        body: "",
        html_url: "https://github.com/DerFlash/rossmann-tracker/releases/tag/0.5.0",
        published_at: "2026-08-28T10:00:00Z",
        draft: false,
        prerelease: false,
      };
    },
  } });
  await checker.initialize(true);
  assert.equal((await checker.check()).state, "available");

  const reloaded = createUpdateChecker({
    currentVersion: "0.4.0",
    cachePath: path.join(directory, "update-check.json"),
  });
  await reloaded.initialize(true);
  assert.equal(reloaded.status().release.url, "https://github.com/DerFlash/rossmann-tracker/releases/tag/0.5.0");
});

test("innerhalb von 24 Stunden erfolgt auch nach einem Fehler kein weiterer Abruf", async () => {
  let now = Date.parse("2026-08-28T12:00:00Z");
  const directory = await mkdtemp(path.join(os.tmpdir(), "rossmann-update-"));
  let calls = 0;
  const checker = createUpdateChecker({
    currentVersion: "0.4.0",
    cachePath: path.join(directory, "update-check.json"),
    now: () => now,
    fetchImpl: async () => { calls += 1; return { ok: false, status: 404 }; },
  });
  await checker.initialize(true);
  assert.equal((await checker.check()).state, "unavailable");
  now += UPDATE_CHECK_INTERVAL_MS - 1;
  assert.equal((await checker.check()).fetched, false);
  assert.equal(calls, 1);
  now += 1;
  assert.equal((await checker.check()).fetched, true);
  assert.equal(calls, 2);
});

test("eine zurückgestellte Systemuhr löst keine zusätzlichen Abrufe aus", async () => {
  let now = Date.parse("2026-08-28T12:00:00Z");
  const { checker, calls } = await fixture({ now: () => now });
  await checker.initialize(true);
  await checker.check();
  now -= 60 * 60 * 1_000;
  const result = await checker.check();
  assert.equal(result.fetched, false);
  assert.equal(
    result.nextCheckAt,
    new Date(Date.parse("2026-08-28T12:00:00Z") + UPDATE_CHECK_INTERVAL_MS).toISOString(),
  );
  assert.equal(calls.length, 1);
});

test("deaktivierte Updateprüfung führt keinen Netzwerkabruf aus", async () => {
  const { checker, calls } = await fixture();
  await checker.initialize(false);
  assert.deepEqual(await checker.check(), {
    enabled: false,
    state: "disabled",
    currentVersion: "0.4.0",
    fetched: false,
  });
  assert.equal(calls.length, 0);
});

test("Prereleases und fremde Release-URLs werden nicht angeboten", async () => {
  for (const override of [
    { prerelease: true },
    { html_url: "https://example.test/releases/tag/v0.5.0" },
    { tag_name: "v0.5.0-beta.1", html_url: "https://github.com/DerFlash/rossmann-tracker/releases/tag/v0.5.0-beta.1" },
  ]) {
    const { checker } = await fixture({ response: {
      ok: true,
      async json() {
        return {
          tag_name: "v0.5.0",
          html_url: "https://github.com/DerFlash/rossmann-tracker/releases/tag/v0.5.0",
          published_at: "2026-08-28T10:00:00Z",
          draft: false,
          prerelease: false,
          ...override,
        };
      },
    } });
    await checker.initialize(true);
    assert.equal((await checker.check()).state, "unavailable");
  }
});

test("manipulierte Cache-Links gelangen nicht in den öffentlichen Status", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rossmann-update-"));
  const cachePath = path.join(directory, "update-check.json");
  await writeFile(cachePath, JSON.stringify({
    version: 1,
    checkedAt: "2026-08-28T11:00:00.000Z",
    result: "ok",
    release: {
      version: "9.9.9",
      name: "Fremdes Release",
      notes: "",
      url: "https://example.test/download",
      publishedAt: "2026-08-28T10:00:00.000Z",
      securityRelevant: false,
    },
  }));
  let calls = 0;
  const checker = createUpdateChecker({
    currentVersion: "0.4.0",
    cachePath,
    now: () => Date.parse("2026-08-28T12:00:00Z"),
    fetchImpl: async () => { calls += 1; return { ok: false, status: 404 }; },
  });
  await checker.initialize(true);
  assert.equal(checker.status().release, null);
  assert.equal((await checker.check()).state, "unavailable");
  assert.equal(calls, 1);
});

test("Cache-Schreibfehler lassen den Checker nicht dauerhaft auf checking stehen", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rossmann-update-"));
  const cachePath = path.join(directory, "cache");
  const checker = createUpdateChecker({
    currentVersion: "0.4.0",
    cachePath,
    fetchImpl: async () => { throw "Netzwerkfehler"; },
  });
  await checker.initialize(true);
  await mkdir(cachePath);
  await assert.rejects(checker.check());
  assert.notEqual(checker.status().state, "checking");
});

test("nicht unterstütztes chmod verhindert den atomaren Cache-Austausch nicht", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rossmann-update-"));
  const cachePath = path.join(directory, "update-check.json");
  const checker = createUpdateChecker({
    currentVersion: "0.4.0",
    cachePath,
    chmodImpl: async () => {
      const error = new Error("chmod nicht unterstützt");
      error.code = "EPERM";
      throw error;
    },
    fetchImpl: async () => ({ ok: false, status: 404 }),
  });

  await checker.initialize(true);
  const result = await checker.check();
  assert.equal(result.state, "unavailable");
  assert.equal(JSON.parse(await readFile(cachePath, "utf8")).result, "unavailable");
});
