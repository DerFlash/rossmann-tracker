import { randomBytes } from "node:crypto";
import { chmod, cp, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BUILD_INFO } from "./build-info.js";
import { CURRENT_SETTINGS_SCHEMA_VERSION } from "./settings-schema.js";

function compactTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function requireDirectory(directory, label) {
  const metadata = await stat(directory).catch((error) => {
    if (error.code === "ENOENT") throw new Error(`${label} fehlt: ${directory}`);
    throw error;
  });
  if (!metadata.isDirectory()) throw new Error(`${label} ist kein Verzeichnis: ${directory}`);
}

export async function createInstallationBackup({
  dataDirectory,
  browserDataDirectory,
  backupDirectory,
  now = () => new Date(),
  nonce = () => randomBytes(4).toString("hex"),
  build = BUILD_INFO,
} = {}) {
  if (!dataDirectory || !browserDataDirectory || !backupDirectory) {
    throw new Error("Daten-, Browser- und Sicherungsverzeichnis müssen angegeben werden.");
  }
  await requireDirectory(dataDirectory, "Datenverzeichnis");
  await requireDirectory(browserDataDirectory, "Browserprofil");
  await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
  await chmod(backupDirectory, 0o700);

  const createdAt = now();
  if (!(createdAt instanceof Date) || Number.isNaN(createdAt.getTime())) {
    throw new Error("Sicherungszeitpunkt ist ungültig.");
  }
  const id = `${compactTimestamp(createdAt)}-${nonce()}`;
  if (!/^\d{8}T\d{6}Z-[0-9a-f]{8}$/.test(id)) throw new Error("Sicherungskennung ist ungültig.");
  const temporaryDirectory = path.join(backupDirectory, `.${id}.tmp`);
  const destinationDirectory = path.join(backupDirectory, id);

  try {
    await mkdir(temporaryDirectory, { recursive: false, mode: 0o700 });
    await cp(dataDirectory, path.join(temporaryDirectory, "data"), { recursive: true, force: false, errorOnExist: true });
    await cp(browserDataDirectory, path.join(temporaryDirectory, "browser-data"), { recursive: true, force: false, errorOnExist: true });
    const manifest = {
      schemaVersion: 1,
      id,
      createdAt: createdAt.toISOString(),
      application: {
        version: build.version,
        revision: build.revision,
      },
      settingsSchemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
      contents: ["data", "browser-data"],
    };
    await writeFile(
      path.join(temporaryDirectory, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    await rename(temporaryDirectory, destinationDirectory);
    return { id, path: destinationDirectory, manifest };
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function main() {
  if (process.argv[2] !== "create" || process.argv.length !== 3) {
    throw new Error("Aufruf: node src/installation-backup.js create");
  }
  const result = await createInstallationBackup({
    dataDirectory: process.env.DATA_DIR || "/app/data",
    browserDataDirectory: process.env.BROWSER_DATA_DIR || "/app/browser-data",
    backupDirectory: process.env.BACKUP_DIR || "/app/backups",
  });
  console.log(`Sicherung ${result.id} wurde vollständig erstellt.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
