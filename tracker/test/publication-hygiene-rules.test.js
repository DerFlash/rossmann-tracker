import assert from "node:assert/strict";
import test from "node:test";
import {
  contentFindings,
  isForbiddenTrackedPath,
} from "../../scripts/publication-hygiene-rules.mjs";

test("Veröffentlichungshygiene blockiert Laufzeitdaten in jeder Verzeichnistiefe", () => {
  for (const path of [
    "data/state.json",
    "nested/data/state.json",
    "example/browser-data/Profile",
    "nested/.env.local",
    "nested/config.json",
    "reports/debug.log",
  ]) {
    assert.equal(isForbiddenTrackedPath(path), true, path);
  }
  assert.equal(isForbiddenTrackedPath(".env.example"), false);
  assert.equal(isForbiddenTrackedPath("release/.env.example"), false);
  assert.equal(isForbiddenTrackedPath("tracker/config.example.json"), false);
});

test("Veröffentlichungshygiene erkennt persönliche und sensible Literalwerte", () => {
  const chatId = String(-1_001_234_567_890);
  const apiKey = "A1".repeat(20);
  const userPath = ["", "Users", "alice", "project"].join("/");
  const email = ["alice", "example.invalid"].join("@");

  assert.ok(contentFindings("fixture.txt", `"chatId": "${chatId}"`).includes("Telegram-Chat-ID"));
  assert.ok(contentFindings("fixture.txt", `"chat_id": "${chatId}"`).includes("Telegram-Chat-ID"));
  assert.ok(contentFindings("fixture.txt", `apiKey: "${apiKey}"`).includes("fest eingetragener sensibler Wert"));
  assert.ok(contentFindings("fixture.yml", `api_key: ${apiKey}`).includes("fest eingetragener sensibler Wert"));
  assert.ok(contentFindings("fixture.env", `API_KEY=${apiKey}`).includes("sensibler Umgebungswert"));
  assert.ok(contentFindings("fixture.txt", userPath).includes("absoluter Benutzerpfad"));
  assert.ok(contentFindings("fixture.txt", email).includes("Mailadresse"));
});

test("Veröffentlichungshygiene erlaubt dokumentierte und neutrale Werte", () => {
  const privateArchive = ["DerFlash/rossmann", "dan-pruefer"].join("-");
  assert.deepEqual(contentFindings("docs/publication-boundary.md", privateArchive), []);
  assert.deepEqual(contentFindings("fixture.txt", "http://127.0.0.1:8787"), []);
  assert.deepEqual(contentFindings("fixture.txt", "Musterstadt 12345, Beispielstraße 1"), []);
  assert.deepEqual(contentFindings("fixture.txt", 'botToken: process.env.TELEGRAM_BOT_TOKEN || ""'), []);
  assert.deepEqual(contentFindings("fixture.js", "apiKey: process.env.OPENAI_API_KEY_V2"), []);
  assert.deepEqual(contentFindings("fixture.js", "clientSecret: credentials.oauth2ClientSecret"), []);
  assert.deepEqual(contentFindings("fixture.js", "accessToken: response.accessTokenV2"), []);
  assert.ok(contentFindings("fixture.txt", ["Rossmann", "DAN-Tracker"].join(" ")).includes("veralteter sichtbarer Projektname"));
});
