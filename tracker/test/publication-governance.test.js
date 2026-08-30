import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function repositoryFile(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function normalizeNewlines(value) {
  return value.replace(/\r\n/g, "\n");
}

test("Lizenz- und Beitragsunterlagen bleiben vollständig gekoppelt", async () => {
  const [license, polyform, contributing, grant, template, contributorWorkflow, security, conduct, notices, readme, documentationIndex, publicationBoundary, dockerfile, packageJson, releasePreparation, gitignore, dockerignore] = await Promise.all([
    repositoryFile("LICENSE.md"),
    repositoryFile("tracker/test/fixtures/polyform-strict-1.0.0.txt"),
    repositoryFile("CONTRIBUTING.md"),
    repositoryFile("CONTRIBUTOR_LICENSE_AGREEMENT.md"),
    repositoryFile(".github/PULL_REQUEST_TEMPLATE.md"),
    repositoryFile(".github/workflows/contributor-grant.yml"),
    repositoryFile("SECURITY.md"),
    repositoryFile("CODE_OF_CONDUCT.md"),
    repositoryFile("THIRD_PARTY_NOTICES.md"),
    repositoryFile("README.md"),
    repositoryFile("docs/README.md"),
    repositoryFile("docs/publication-boundary.md"),
    repositoryFile("Dockerfile"),
    repositoryFile("tracker/package.json"),
    repositoryFile("scripts/prepare-release.mjs"),
    repositoryFile(".gitignore"),
    repositoryFile(".dockerignore"),
  ]);

  const normalizedLicense = normalizeNewlines(license);
  const normalizedPolyform = normalizeNewlines(polyform);
  const polyformStart = normalizedLicense.indexOf("# PolyForm Strict License 1.0.0");
  assert.notEqual(polyformStart, -1, "PolyForm-Originaltext fehlt in LICENSE.md");
  assert.equal(normalizedLicense.slice(polyformStart), normalizedPolyform);
  assert.match(license, /Project-Specific Additional Permission/);
  assert.match(license, /code, documentation, data, catalog content, assets/);
  assert.match(license, /private, noncommercial use/);
  assert.match(license, /do not publish releases, packages, container images/);
  assert.match(contributing, /Contributor Grant/);
  assert.match(grant, /relicense the contribution/);
  assert.match(template, /stimme dem Contributor Grant[\s\S]*ausdrücklich zu/);
  assert.match(contributorWorkflow, /pull_request:/);
  assert.doesNotMatch(contributorWorkflow, /pull_request_target/);
  assert.doesNotMatch(contributorWorkflow, /author_association/);
  assert.match(contributorWorkflow, /pullRequest\.user\?\.login\?\.toLowerCase\(\) === "derflash"/);
  assert.match(security, /Private Vulnerability Reporting/);
  assert.match(conduct, /Regeln für die Zusammenarbeit/);
  assert.match(notices, /code, documentation, data, catalog content, assets/);
  assert.match(notices, /Microsoft Playwright/);
  assert.match(readme, /cd tracker[\s\S]*node \.\.\/scripts\/check-publication-hygiene\.mjs/);
  assert.match(readme, /github\.com\/Level42-dev\/rossmann-tracker\.git/);
  assert.doesNotMatch(readme, /\/wiki/);
  assert.match(documentationIndex, /frühere GitHub-Wiki[\s\S]*nicht mehr als maßgebliche Dokumentationsquelle/);
  assert.match(publicationBoundary, /neutralen Root-Commit[\s\S]*PUBLICATION_BASE\.md/);
  assert.match(publicationBoundary, /vollständigen geprüften Snapshot/);
  assert.match(publicationBoundary, /Git-basierte Veröffentlichungshygiene muss vor dem Export laufen[\s\S]*git ls-files/);
  assert.match(dockerfile, /COPY LICENSE\.md THIRD_PARTY_NOTICES\.md \/app\//);
  assert.match(dockerfile, /COPY LICENSE\.md \/LICENSE\.md/);
  assert.match(dockerfile, /github\.com\/Level42-dev\/rossmann-tracker/);
  assert.equal(JSON.parse(packageJson).name, "rossmann-store-tracker");
  assert.equal(JSON.parse(packageJson).license, "SEE LICENSE IN ../LICENSE.md");
  assert.match(releasePreparation, /OFFICIAL_REPOSITORY = "Level42-dev\/rossmann-tracker"/);
  assert.match(releasePreparation, /OFFICIAL_RELEASE_ACTOR = "DerFlash"/);
  for (const [path, ignoreFile] of [[".gitignore", gitignore], [".dockerignore", dockerignore]]) {
    assert.match(ignoreFile, /^\.env$/m, `${path}: .env fehlt`);
    assert.match(ignoreFile, /^\.env\.\*$/m, `${path}: .env.* fehlt`);
    assert.match(ignoreFile, /^!\.env\.example$/m, `${path}: !.env.example fehlt`);
  }
});
