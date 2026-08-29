import { appendFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const OFFICIAL_OWNER = "DerFlash";
export const OFFICIAL_REPOSITORY = "DerFlash/rossmann-tracker";

export function compareStableVersions(left, right) {
  if (!SEMVER_PATTERN.test(left) || !SEMVER_PATTERN.test(right)) {
    throw new Error("Es können nur stabile semantische Versionen verglichen werden.");
  }
  const leftParts = left.split(".").map(BigInt);
  const rightParts = right.split(".").map(BigInt);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
}

export function assertVersionIsNewer(version, releases) {
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error("Die neue Version muss eine stabile semantische Version sein.");
  }
  const stableVersions = releases
    .filter((release) => !release.draft && !release.prerelease)
    .map((release) => /^v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/.exec(release.tag_name)?.[1])
    .filter(Boolean)
    .sort(compareStableVersions);
  const newestVersion = stableVersions.at(-1);

  if (newestVersion && compareStableVersions(version, newestVersion) <= 0) {
    throw new Error(`Die neue Version ${version} muss größer als das letzte Stable-Release ${newestVersion} sein.`);
  }
}

export function prepareReleaseMetadata({
  packageVersion,
  lockVersion,
  ref,
  revision,
  repositoryOwner,
  repository,
  actor,
  triggeringActor,
  buildDate,
}) {
  if (!SEMVER_PATTERN.test(packageVersion)) {
    throw new Error("Die Paketversion muss eine stabile semantische Version ohne Suffix sein.");
  }
  if (lockVersion !== packageVersion) {
    throw new Error("package.json und package-lock.json enthalten unterschiedliche Versionen.");
  }
  if (ref !== "refs/heads/main") {
    throw new Error("Stable-Releases dürfen ausschließlich von main veröffentlicht werden.");
  }
  if (!SHA_PATTERN.test(revision)) {
    throw new Error("GITHUB_SHA muss eine vollständige Git-Revision sein.");
  }
  if (!OWNER_PATTERN.test(repositoryOwner)) {
    throw new Error("GITHUB_REPOSITORY_OWNER ist ungültig.");
  }
  if (repositoryOwner !== OFFICIAL_OWNER || repository !== OFFICIAL_REPOSITORY) {
    throw new Error("Stable-Releases sind nur im offiziellen DerFlash-Repository erlaubt.");
  }
  if (actor !== OFFICIAL_OWNER) {
    throw new Error("Stable-Releases dürfen ausschließlich durch DerFlash gestartet werden.");
  }
  if (triggeringActor !== OFFICIAL_OWNER) {
    throw new Error("Stable-Release-Läufe dürfen ausschließlich durch DerFlash gestartet oder erneut ausgeführt werden.");
  }

  const parsedBuildDate = new Date(buildDate);
  if (Number.isNaN(parsedBuildDate.getTime())) {
    throw new Error("RELEASE_BUILD_DATE ist ungültig.");
  }

  return Object.freeze({
    version: packageVersion,
    tag: `v${packageVersion}`,
    image: `ghcr.io/${repositoryOwner.toLowerCase()}/rossmann-tracker`,
    revision,
    builtAt: parsedBuildDate.toISOString(),
  });
}

async function main() {
  const packageMetadata = JSON.parse(
    await readFile(new URL("../tracker/package.json", import.meta.url), "utf8"),
  );
  const lockMetadata = JSON.parse(
    await readFile(new URL("../tracker/package-lock.json", import.meta.url), "utf8"),
  );
  const metadata = prepareReleaseMetadata({
    packageVersion: packageMetadata.version,
    lockVersion: lockMetadata.version,
    ref: process.env.GITHUB_REF || "",
    revision: process.env.GITHUB_SHA || "",
    repositoryOwner: process.env.GITHUB_REPOSITORY_OWNER || "",
    repository: process.env.GITHUB_REPOSITORY || "",
    actor: process.env.GITHUB_ACTOR || "",
    triggeringActor: process.env.RELEASE_TRIGGERING_ACTOR || "",
    buildDate: process.env.RELEASE_BUILD_DATE || "",
  });

  const output = [
    `version=${metadata.version}`,
    `tag=${metadata.tag}`,
    `image=${metadata.image}`,
    `built_at=${metadata.builtAt}`,
  ].join("\n") + "\n";

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, output, "utf8");
  } else {
    process.stdout.write(output);
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  await main();
}
