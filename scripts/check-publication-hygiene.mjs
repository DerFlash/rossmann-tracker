import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  contentFindings,
  isForbiddenTrackedPath,
} from "./publication-hygiene-rules.mjs";

const repositoryRoot = new URL("..", import.meta.url);
const repositoryPath = fileURLToPath(repositoryRoot);
const result = spawnSync("git", ["ls-files", "-z"], {
  cwd: repositoryPath,
  encoding: "utf8",
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || "Git-Dateiliste konnte nicht gelesen werden.\n");
  process.exit(1);
}

const findings = [];

const trackedFiles = result.stdout.split("\0").filter(Boolean);
for (const path of trackedFiles) {
  const buffer = readFileSync(new URL(path, repositoryRoot));
  if (buffer.includes(0)) continue;

  const content = buffer.toString("utf8");
  for (const label of contentFindings(path, content)) {
    findings.push(`${path}: ${label}`);
  }
}

for (const path of trackedFiles) {
  if (isForbiddenTrackedPath(path)) {
    findings.push(`${path}: lokale Laufzeit- oder Exportdatei ist eingecheckt`);
  }
}

const requiredIgnoreEntries = {
  ".gitignore": [".env", ".env.*", "!.env.example", "config.json", "data/", "browser-data/", "upload/", "backups/", "exports/", "*.log", ".DS_Store"],
  ".dockerignore": [".git", ".github", ".env", ".env.*", "!.env.example", "config.json", "data", "browser-data", "upload", "backups", "exports", "*.log", "*.png", "*.jpg", "*.jpeg", "*.webp", ".DS_Store"],
};

for (const [path, requiredEntries] of Object.entries(requiredIgnoreEntries)) {
  const entries = new Set(
    readFileSync(new URL(path, repositoryRoot), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")),
  );

  for (const entry of requiredEntries) {
    if (!entries.has(entry)) findings.push(`${path}: fehlender Eintrag ${entry}`);
  }
}

const requiredPublicationFiles = {
  "LICENSE.md": ["PolyForm Strict License 1.0.0", "Project-Specific Additional Permission"],
  "CONTRIBUTING.md": ["Contributor Grant"],
  "CONTRIBUTOR_LICENSE_AGREEMENT.md": ["Copyright license", "Patent license"],
  "SECURITY.md": ["Private Vulnerability Reporting"],
  "CODE_OF_CONDUCT.md": ["Regeln für die Zusammenarbeit"],
  "THIRD_PARTY_NOTICES.md": ["Microsoft Playwright"],
  "docs/README.md": ["versionierten Quellstand", "GitHub-Wiki"],
  "docs/docker-tracker.md": ["Rossmann Store Tracker", "data/", "browser-data/"],
  "docs/telegram.md": ["BotFather", "data/settings.json"],
  "docs/bookmarklet.md": ["Local Storage", "Rossmann Store Tracker"],
  "docs/configuration-and-data.md": ["Auslieferungszustand", "data/settings.json"],
  "docs/troubleshooting.md": ["rossmann-debug.png", "Private Vulnerability Reporting"],
  "docs/product-catalog.md": ["request_error", "ean_only"],
  "docs/publication-boundary.md": ["Warum kein Force-Push?", "PUBLICATION_BASE.md"],
  "scripts/publication-hygiene-rules.mjs": ["contentFindings", "isForbiddenTrackedPath"],
  ".github/PULL_REQUEST_TEMPLATE.md": ["stimme dem Contributor Grant", "ausdrücklich zu"],
  ".github/workflows/contributor-grant.yml": ["Contributor Grant", "pull_request"],
};

for (const [path, markers] of Object.entries(requiredPublicationFiles)) {
  const url = new URL(path, repositoryRoot);
  if (!existsSync(url)) {
    findings.push(`${path}: erforderliche Veröffentlichungsdatei fehlt`);
    continue;
  }

  const content = readFileSync(url, "utf8");
  for (const marker of markers) {
    if (!content.includes(marker)) findings.push(`${path}: erforderlicher Inhalt fehlt (${marker})`);
  }
}

const packageMetadata = JSON.parse(readFileSync(new URL("tracker/package.json", repositoryRoot), "utf8"));
if (packageMetadata.license !== "SEE LICENSE IN ../LICENSE.md") {
  findings.push("tracker/package.json: Lizenzverweis fehlt oder ist unerwartet");
}
if (packageMetadata.name !== "rossmann-store-tracker") {
  findings.push("tracker/package.json: öffentlicher Paketname ist unerwartet");
}

const defaultConfig = JSON.parse(readFileSync(new URL("tracker/config.example.json", repositoryRoot), "utf8"));
for (const key of ["searchAreas", "stores", "products"]) {
  if (!Array.isArray(defaultConfig[key]) || defaultConfig[key].length !== 0) {
    findings.push(`tracker/config.example.json: ${key} muss für neue Installationen leer sein`);
  }
}

const readme = readFileSync(new URL("README.md", repositoryRoot), "utf8");
if (!readme.includes("github.com/DerFlash/rossmann-tracker.git")) {
  findings.push("README.md: öffentliche Clone-Zielkennung fehlt");
}
if (!readme.includes("docs/docker-tracker.md") || readme.includes("/wiki")) {
  findings.push("README.md: versionierte Dokumentation ist nicht vollständig verdrahtet");
}

const releasePreparation = readFileSync(new URL("scripts/prepare-release.mjs", repositoryRoot), "utf8");
if (!releasePreparation.includes('OFFICIAL_REPOSITORY = "DerFlash/rossmann-tracker"')) {
  findings.push("scripts/prepare-release.mjs: Stable-Release ist nicht auf das öffentliche Zielrepository begrenzt");
}

const license = readFileSync(new URL("LICENSE.md", repositoryRoot), "utf8").replace(/\r\n/g, "\n");
if (!license.endsWith("© PolyForm Project Inc.\n")) {
  findings.push("LICENSE.md: offizieller PolyForm-Text ist nicht vollständig");
}

if (findings.length > 0) {
  console.error("Veröffentlichungshygiene fehlgeschlagen:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Veröffentlichungshygiene geprüft: ${trackedFiles.length} eingecheckte Dateien ohne Befund.`);
