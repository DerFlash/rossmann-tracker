import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function repositoryFile(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function assertHardenedCompose(compose) {
  assert.match(compose, /read_only:\s*true/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /cap_drop:\s*\n\s*- ALL/);
  assert.match(compose, /127\.0\.0\.1:8787:8787/);
  assert.match(compose, /stop_grace_period:\s*45s/);
  assert.match(compose, /healthcheck:/);
  assert.match(compose, /process\.exit\(r\.ok\?0:1\)/);
  assert.match(compose, /\.\/data:\/app\/data/);
  assert.match(compose, /\.\/browser-data:\/app\/browser-data/);
  assert.match(compose, /profiles:\s*\["tools"\]/);
  assert.match(compose, /network_mode:\s*none/);
  assert.match(compose, /installation-backup\.js/);
  assert.match(compose, /\.\/backups:\/app\/backups/);
  assert.doesNotMatch(compose, /docker\.sock|privileged:\s*true/i);
}

test("Quell- und Release-Compose minimieren Rechte und bewahren Laufzeitdaten", async () => {
  const [sourceCompose, releaseCompose, dockerfile, ciWorkflow] = await Promise.all([
    repositoryFile("docker-compose.yml"),
    repositoryFile("release/docker-compose.yml"),
    repositoryFile("Dockerfile"),
    repositoryFile(".github/workflows/ci.yml"),
  ]);
  assertHardenedCompose(sourceCompose);
  assertHardenedCompose(releaseCompose);
  assert.match(dockerfile, /^STOPSIGNAL SIGTERM$/m);
  assert.match(ciWorkflow, /Gehärteten Container starten und sichern/);
  assert.match(ciWorkflow, /docker compose --file release\/docker-compose\.yml run --rm backup/);
});

test("Release-Artefakte dokumentieren Vorprüfung, Sicherung und Rollback", async () => {
  const [workflow, updateGuide] = await Promise.all([
    repositoryFile(".github/workflows/release.yml"),
    repositoryFile("release/UPDATE.md"),
  ]);
  assert.match(workflow, /release\/UPDATE\.md/);
  assert.match(updateGuide, /docker compose config --quiet/);
  assert.match(updateGuide, /docker compose run --rm backup/);
  assert.match(updateGuide, /ROSSMANN_TRACKER_IMAGE=.*:<vorherige-version>/);
  assert.match(updateGuide, /backups\/<sicherungskennung>\/data/);
});
