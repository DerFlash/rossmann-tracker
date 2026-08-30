import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkReleaseState } from "../../scripts/check-release-state.mjs";
import {
  assertVersionIsNewer,
  prepareReleaseMetadata,
} from "../../scripts/prepare-release.mjs";

const packageMetadata = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const lockMetadata = JSON.parse(
  await readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
);
const releaseWorkflow = await readFile(
  new URL("../../.github/workflows/release.yml", import.meta.url),
  "utf8",
);
const ciWorkflow = await readFile(
  new URL("../../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);

test("Release-Metadaten sind stabil, validiert und registry-tauglich", () => {
  assert.deepEqual(prepareReleaseMetadata({
    packageVersion: "1.2.3",
    lockVersion: "1.2.3",
    ref: "refs/heads/main",
    revision: "0123456789abcdef0123456789abcdef01234567",
    repositoryOwner: "Level42-dev",
    repository: "Level42-dev/rossmann-tracker",
    actor: "DerFlash",
    triggeringActor: "DerFlash",
    buildDate: "2026-08-28T10:00:00+02:00",
  }), {
    version: "1.2.3",
    tag: "v1.2.3",
    image: "ghcr.io/level42-dev/rossmann-tracker",
    revision: "0123456789abcdef0123456789abcdef01234567",
    builtAt: "2026-08-28T08:00:00.000Z",
  });
});

test("Release-Metadaten weisen unsichere oder inkonsistente Eingaben ab", () => {
  const valid = {
    packageVersion: "1.2.3",
    lockVersion: "1.2.3",
    ref: "refs/heads/main",
    revision: "0123456789abcdef0123456789abcdef01234567",
    repositoryOwner: "Level42-dev",
    repository: "Level42-dev/rossmann-tracker",
    actor: "DerFlash",
    triggeringActor: "DerFlash",
    buildDate: "2026-08-28T08:00:00Z",
  };

  assert.throws(() => prepareReleaseMetadata({ ...valid, packageVersion: "1.2.3-beta.1" }), /stabile semantische Version/);
  assert.throws(() => prepareReleaseMetadata({ ...valid, lockVersion: "1.2.2" }), /unterschiedliche Versionen/);
  assert.throws(() => prepareReleaseMetadata({ ...valid, ref: "refs/heads/feature" }), /ausschließlich von main/);
  assert.throws(() => prepareReleaseMetadata({ ...valid, revision: "kurz" }), /vollständige Git-Revision/);
  assert.throws(() => prepareReleaseMetadata({ ...valid, repositoryOwner: "owner/name" }), /OWNER/);
  assert.throws(() => prepareReleaseMetadata({ ...valid, repositoryOwner: "ForkOwner", repository: "ForkOwner/tracker" }), /offiziellen/);
  assert.throws(() => prepareReleaseMetadata({ ...valid, repository: "Level42-dev/anderes-projekt" }), /offiziellen/);
  assert.throws(() => prepareReleaseMetadata({ ...valid, actor: "Contributor" }), /DerFlash gestartet/);
  assert.throws(() => prepareReleaseMetadata({ ...valid, triggeringActor: "Contributor" }), /erneut ausgeführt/);
  assert.throws(() => prepareReleaseMetadata({ ...valid, buildDate: "gestern" }), /BUILD_DATE/);
});

test("Stable-Versionen steigen strikt monoton", () => {
  const releases = [
    { tag_name: "v0.3.9", draft: false, prerelease: false },
    { tag_name: "v0.4.0-beta.1", draft: false, prerelease: true },
    { tag_name: "v0.4.0", draft: true, prerelease: false },
  ];
  assert.doesNotThrow(() => assertVersionIsNewer("0.4.0", releases));
  assert.doesNotThrow(() => assertVersionIsNewer("1.10.0", [
    { tag_name: "v1.9.99", draft: false, prerelease: false },
  ]));
  assert.throws(() => assertVersionIsNewer("0.3.9", releases), /größer als/);
  assert.throws(() => assertVersionIsNewer("0.3.8", releases), /größer als/);
  assert.throws(() => assertVersionIsNewer("latest", releases), /semantische Version/);
  assert.throws(() => assertVersionIsNewer("latest", []), /semantische Version/);
});

test("GitHub-Releasezustand wird vollständig und fehlersicher geprüft", async () => {
  const revision = "0123456789abcdef0123456789abcdef01234567";
  const responses = new Map([
    ["/repos/Level42-dev/rossmann-tracker", [200, { visibility: "public" }]],
    ["/repos/Level42-dev/rossmann-tracker/branches/main", [200, { commit: { sha: revision } }]],
    ["/repos/Level42-dev/rossmann-tracker/releases?per_page=100&page=1", [200, []]],
    ["/repos/Level42-dev/rossmann-tracker/releases/tags/v0.4.0", [404, { message: "Not Found" }]],
    ["/repos/Level42-dev/rossmann-tracker/git/ref/tags/v0.4.0", [404, { message: "Not Found" }]],
  ]);
  const fetchImpl = async (url) => {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname + parsedUrl.search;
    const response = responses.get(path);
    assert.ok(response, `Unerwarteter API-Aufruf: ${path}`);
    return new Response(JSON.stringify(response[1]), { status: response[0] });
  };
  const input = {
    token: "test-token",
    repository: "Level42-dev/rossmann-tracker",
    repositoryOwner: "Level42-dev",
    actor: "DerFlash",
    triggeringActor: "DerFlash",
    revision,
    releaseTag: "v0.4.0",
    releaseVersion: "0.4.0",
    fetchImpl,
  };

  assert.deepEqual(await checkReleaseState(input), { releasesChecked: 0 });
  await assert.rejects(
    checkReleaseState({ ...input, repository: "Level42-dev/anderes-projekt" }),
    /offiziellen/,
  );

  responses.set("/repos/Level42-dev/rossmann-tracker/releases/tags/v0.4.0", [500, { message: "API failure" }]);
  await assert.rejects(checkReleaseState(input), /API failure/);
});

test("Paket-, Lock- und Workflow-Versionierung bleiben gekoppelt", () => {
  assert.equal(packageMetadata.name, "rossmann-store-tracker");
  assert.equal(lockMetadata.name, packageMetadata.name);
  assert.equal(lockMetadata.packages[""].name, packageMetadata.name);
  assert.equal(packageMetadata.version, lockMetadata.version);
  assert.equal(lockMetadata.packages[""].version, packageMetadata.version);
  assert.match(releaseWorkflow, /^on:\n  workflow_dispatch:\n\npermissions:/m);
  assert.match(releaseWorkflow, /platforms:\s*linux\/amd64,linux\/arm64/);
  assert.match(releaseWorkflow, /packages:\s*write/);
  assert.match(releaseWorkflow, /attestations:\s*write/);
  assert.match(releaseWorkflow, /gh\s+release\s+create/);

  const buildIndex = releaseWorkflow.lastIndexOf("docker/build-push-action@");
  const attestationIndex = releaseWorkflow.indexOf("actions/attest@");
  const stableIndex = releaseWorkflow.indexOf("imagetools create --tag \"$IMAGE:stable\"");
  const githubReleaseIndex = releaseWorkflow.indexOf("gh release create");
  assert.ok(buildIndex < attestationIndex);
  assert.ok(attestationIndex < stableIndex);
  assert.ok(stableIndex < githubReleaseIndex);
  assert.match(releaseWorkflow, /tags: \$\{\{ needs\.validate\.outputs\.image \}\}:\$\{\{ needs\.validate\.outputs\.version \}\}/);
  assert.match(releaseWorkflow, /environment:\n\s+name: stable-release/);
  assert.match(releaseWorkflow, /persist-credentials: false/);
  assert.match(releaseWorkflow, /Anonymen Abruf des Release-Images prüfen/);
  assert.match(releaseWorkflow, /RELEASE_TRIGGERING_ACTOR: \$\{\{ github\.triggering_actor \}\}/);

  for (const workflow of [ciWorkflow, releaseWorkflow]) {
    for (const [, revision] of workflow.matchAll(/uses:\s+\S+@([^\s]+)/g)) {
      assert.match(revision, /^[0-9a-f]{40}$/);
    }
  }
});
