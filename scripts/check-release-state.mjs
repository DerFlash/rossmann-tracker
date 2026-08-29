import { pathToFileURL } from "node:url";
import {
  assertVersionIsNewer,
  OFFICIAL_REPOSITORY,
} from "./prepare-release.mjs";

const API_BASE_URL = "https://api.github.com";

function repositoryPath(repository) {
  const parts = repository.split("/");
  if (parts.length !== 2 || parts.some((part) => !part)) {
    throw new Error("GITHUB_REPOSITORY ist ungültig.");
  }
  return parts.map(encodeURIComponent).join("/");
}

async function requestJson(path, { token, fetchImpl }) {
  let response;
  try {
    response = await fetchImpl(`${API_BASE_URL}${path}`, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
      },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new Error(`GitHub API nicht erreichbar: ${error.message}`);
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`GitHub API lieferte für ${path} keine gültige JSON-Antwort.`);
    }
  }
  return { status: response.status, data };
}

function requireStatus(result, expected, label) {
  if (result.status !== expected) {
    const message = result.data?.message || `HTTP ${result.status}`;
    throw new Error(`${label} konnte nicht geprüft werden: ${message}`);
  }
  return result.data;
}

export async function checkReleaseState({
  token,
  repository,
  repositoryOwner,
  actor,
  triggeringActor,
  revision,
  releaseTag,
  releaseVersion,
  fetchImpl = fetch,
}) {
  if (!token) throw new Error("GH_TOKEN fehlt.");
  if (repositoryOwner !== "DerFlash" || actor !== "DerFlash" || triggeringActor !== "DerFlash") {
    throw new Error("Nur DerFlash darf aus dem offiziellen Repository veröffentlichen.");
  }

  const repoPath = repositoryPath(repository);
  if (repoPath !== OFFICIAL_REPOSITORY) {
    throw new Error("Stable-Releases sind nur im offiziellen DerFlash-Repository erlaubt.");
  }

  const repositoryData = requireStatus(
    await requestJson(`/repos/${repoPath}`, { token, fetchImpl }),
    200,
    "Repository-Zustand",
  );
  if (repositoryData.visibility !== "public") {
    throw new Error("Stable-Releases sind erst nach der öffentlichen Freigabe des Repositorys erlaubt.");
  }

  const branchData = requireStatus(
    await requestJson(`/repos/${repoPath}/branches/main`, { token, fetchImpl }),
    200,
    "main-Branch",
  );
  if (branchData.commit?.sha !== revision) {
    throw new Error("Der Workflow-Commit ist nicht mehr der aktuelle Stand von main.");
  }

  const releases = [];
  for (let page = 1; page <= 100; page += 1) {
    const pageData = requireStatus(
      await requestJson(`/repos/${repoPath}/releases?per_page=100&page=${page}`, { token, fetchImpl }),
      200,
      "Release-Historie",
    );
    if (!Array.isArray(pageData)) throw new Error("Die Release-Historie hat ein ungültiges Format.");
    releases.push(...pageData);
    if (pageData.length < 100) break;
    if (page === 100) throw new Error("Die Release-Historie überschreitet das sichere Prüflimit.");
  }
  if (releases.some((release) => release.tag_name === releaseTag)) {
    throw new Error(`Das GitHub Release ${releaseTag} existiert bereits.`);
  }
  assertVersionIsNewer(releaseVersion, releases);

  const releaseResult = await requestJson(
    `/repos/${repoPath}/releases/tags/${encodeURIComponent(releaseTag)}`,
    { token, fetchImpl },
  );
  if (releaseResult.status === 200) throw new Error(`Das GitHub Release ${releaseTag} existiert bereits.`);
  if (releaseResult.status !== 404) requireStatus(releaseResult, 404, "Release-Tag");

  const tagResult = await requestJson(
    `/repos/${repoPath}/git/ref/tags/${encodeURIComponent(releaseTag)}`,
    { token, fetchImpl },
  );
  if (tagResult.status === 200) throw new Error(`Der Git-Tag ${releaseTag} existiert bereits.`);
  if (tagResult.status !== 404) requireStatus(tagResult, 404, "Git-Tag");

  return Object.freeze({ releasesChecked: releases.length });
}

async function main() {
  const result = await checkReleaseState({
    token: process.env.GH_TOKEN || "",
    repository: process.env.GITHUB_REPOSITORY || "",
    repositoryOwner: process.env.GITHUB_REPOSITORY_OWNER || "",
    actor: process.env.GITHUB_ACTOR || "",
    triggeringActor: process.env.RELEASE_TRIGGERING_ACTOR || "",
    revision: process.env.GITHUB_SHA || "",
    releaseTag: process.env.RELEASE_TAG || "",
    releaseVersion: process.env.RELEASE_VERSION || "",
  });
  console.log(`GitHub-Releasezustand geprüft: ${result.releasesChecked} vorhandene Releases.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) await main();
