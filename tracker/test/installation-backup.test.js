import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createInstallationBackup } from "../src/installation-backup.js";
import {
  createSettingsEnvelope,
  CURRENT_SETTINGS_SCHEMA_VERSION,
  readSettingsEnvelope,
} from "../src/settings-schema.js";

test("Installation wird vollständig und mit prüfbarem Manifest gesichert", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rossmann-backup-"));
  const dataDirectory = path.join(root, "data");
  const browserDataDirectory = path.join(root, "browser-data");
  const backupDirectory = path.join(root, "backups");
  await Promise.all([mkdir(dataDirectory), mkdir(browserDataDirectory)]);
  await Promise.all([
    writeFile(path.join(dataDirectory, "settings.json"), "geheim"),
    writeFile(path.join(browserDataDirectory, "Preferences"), "browser"),
  ]);

  const result = await createInstallationBackup({
    dataDirectory,
    browserDataDirectory,
    backupDirectory,
    now: () => new Date("2026-08-29T01:02:03.000Z"),
    nonce: () => "a1b2c3d4",
    build: { version: "0.4.0", revision: "abc123" },
  });

  assert.equal(result.id, "20260829T010203Z-a1b2c3d4");
  assert.equal(await readFile(path.join(result.path, "data", "settings.json"), "utf8"), "geheim");
  assert.equal(await readFile(path.join(result.path, "browser-data", "Preferences"), "utf8"), "browser");
  const manifest = JSON.parse(await readFile(path.join(result.path, "manifest.json"), "utf8"));
  assert.deepEqual(manifest, {
    schemaVersion: 1,
    id: result.id,
    createdAt: "2026-08-29T01:02:03.000Z",
    application: { version: "0.4.0", revision: "abc123" },
    settingsSchemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
    contents: ["data", "browser-data"],
  });
  assert.deepEqual(await readdir(backupDirectory), [result.id]);
  assert.equal((await stat(backupDirectory)).mode & 0o777, 0o700);
  assert.equal((await stat(result.path)).mode & 0o777, 0o700);
});

test("fehlende Quelldaten hinterlassen keine unvollständige Sicherung", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rossmann-backup-"));
  await assert.rejects(createInstallationBackup({
    dataDirectory: path.join(root, "data"),
    browserDataDirectory: path.join(root, "browser-data"),
    backupDirectory: path.join(root, "backups"),
  }), /Datenverzeichnis fehlt/);
});

test("Backup-Cleanup bleibt best-effort und erhält den ursprünglichen Fehler", async () => {
  const source = await readFile(new URL("../src/installation-backup.js", import.meta.url), "utf8");
  assert.match(source, /rm\(temporaryDirectory,[\s\S]*?\.catch\(\(\) => \{\}\)/);
  assert.match(source, /throw error/);
});

test("Einstellungen werden versioniert und zukünftige Formate fail-closed abgewiesen", () => {
  const legacy = readSettingsEnvelope({ config: { pollIntervalMinutes: 15 }, telegram: {} });
  assert.equal(legacy.migratedFrom, 0);
  assert.equal(legacy.config.pollIntervalMinutes, 15);

  const envelope = createSettingsEnvelope({ enabled: true }, { chatId: "synthetic" });
  assert.equal(envelope.version, CURRENT_SETTINGS_SCHEMA_VERSION);
  assert.equal(readSettingsEnvelope(envelope).migratedFrom, null);
  assert.throws(
    () => readSettingsEnvelope({ ...envelope, version: CURRENT_SETTINGS_SCHEMA_VERSION + 1 }),
    /neueren Version/,
  );
  assert.throws(
    () => readSettingsEnvelope({ ...envelope, version: null }),
    /Version der gespeicherten Einstellungen ist ungültig/,
  );
});
