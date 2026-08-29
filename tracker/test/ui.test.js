import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const defaultConfig = JSON.parse(await readFile(new URL("../config.example.json", import.meta.url), "utf8"));

test("Inline-Skript der Weboberfläche ist syntaktisch gültig", () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "Inline-Skript fehlt");
  assert.doesNotThrow(() => new Function(script));
});

test("Weboberfläche verwendet ausschließlich den öffentlichen Projektnamen", () => {
  assert.match(html, /<title>Rossmann Store Tracker<\/title>/);
  assert.match(html, /<h1>Rossmann Store Tracker<\/h1>/);
  assert.doesNotMatch(html, /Rossmann DAN-(?:Tracker|Prüfer)/);
  assert.doesNotMatch(appSource, /Rossmann DAN-(?:Tracker|Prüfer)/);
});

test("alle direkten Telegram-Benachrichtigungen besitzen einen Request-Timeout", () => {
  const sendTelegram = appSource.match(/async function sendTelegram[\s\S]*?\n}\n\nasync function ensureRossmannSession/)?.[0];
  assert.ok(sendTelegram, "sendTelegram-Implementierung fehlt");
  assert.match(sendTelegram, /signal:\s*AbortSignal\.timeout\(TELEGRAM_REQUEST_TIMEOUT_MS\)/);
});

test("Version und Build-Metadaten erscheinen in API und Weboberfläche", () => {
  assert.match(appSource, /import\s*\{\s*BUILD_INFO\s*\}\s*from\s*["']\.\/build-info\.js["']/);
  assert.match(appSource, /\bbuild\s*:\s*BUILD_INFO\b/);
  assert.match(html, /id=["']buildInfo["'][^>]*>\s*Version wird geladen/);
  assert.match(html, /const\s+build\s*=\s*data\.build\s*\|\|\s*\{\s*\}/);
  assert.match(html, /build\.revision\.slice\(\s*0\s*,\s*12\s*\)/);
});

test("Stable-Updates werden nur als manueller, datensparsamer Hinweis angeboten", () => {
  assert.match(appSource, /createUpdateChecker/);
  assert.match(appSource, /update:\s*updateChecker\.status\(\)/);
  assert.match(html, /id="updateCheckEnabled"/);
  assert.match(html, /höchstens einmal in 24 Stunden/);
  assert.match(html, /id="updateNotice"[^>]+hidden/);
  assert.match(html, /docker compose pull\s*\n\s*docker compose up -d/);
  assert.match(html, /renderUpdate\(data\.update\)/);
  assert.doesNotMatch(html, /docker\.sock|watchtower/i);
});
test("Konfigurationsdialoge pausieren den Tracker nicht", () => {
  assert.doesNotMatch(html, /\/api\/tracking\/editing/);
  assert.doesNotMatch(appSource, /temporarilyPaused|beginTemporaryPause/);
});

test("Produktauswahl unterstützt mehrere Checkboxen und eine Sammelauswahl", () => {
  assert.match(html, /role="group" aria-label="Katalogprodukte"/);
  assert.match(html, /checkbox\.type='checkbox'/);
  assert.match(html, /id="selectAllProducts"[^>]+aria-controls="productSelect"/);
  assert.match(html, /input\[type="checkbox"\]:not\(:disabled\)/);
  assert.match(html, /selectAll\.indeterminate=checked\.length>0&&checked\.length<available\.length/);
});

test("frische Installationen starten leer und führen zuerst durch Telegram", () => {
  assert.deepEqual(defaultConfig.searchAreas, []);
  assert.deepEqual(defaultConfig.stores, []);
  assert.deepEqual(defaultConfig.products, []);
  assert.match(html, /id="setupTelegram"/);
  assert.match(html, /@BotFather öffnen/);
  assert.match(html, /Bot in Telegram öffnen/);
  assert.match(html, /id="setupLocation"/);
  assert.match(html, /id="setupProduct"/);
  assert.doesNotMatch(html, /id="chatId"/);
  assert.match(appSource, /!currentSetupState\(\)\.complete/);
});

test("Abfragegrenzen gelten in Standardkonfiguration, Oberfläche und Laufzeit", () => {
  assert.equal(defaultConfig.pollIntervalMinutes, 15);
  assert.equal(defaultConfig.requestDelayMs, 2_000);
  assert.ok(defaultConfig.jitterMs >= 500);
  assert.match(html, /id="pollInterval"[^>]+min="5"/);
  assert.match(html, /id="requestDelay"[^>]+min="2000"/);
  assert.match(html, /id="jitter"[^>]+min="500"/);
  assert.match(appSource, /const fetched = await runRossmannRequest\([\s\S]*?page\.evaluate/);
  assert.match(appSource, /manualCheckCooldown\.tryAcquire\(\)/);
  assert.doesNotMatch(appSource, /runConfig\.requestDelayMs \+ Math\.floor/);
});

test("Filialsuche verwendet eine neutrale Beispiel-PLZ", () => {
  assert.match(html, /id="storePostcode"[^>]+placeholder="01234"/);
});

test("Dialoge unterstützen Enter und zeigen den laufenden Filialabruf", () => {
  assert.match(html, /function triggerOnEnter\(event,button\)/);
  assert.match(html, /storeDialog'\)\.addEventListener\('keydown'/);
  assert.match(html, /id="storeLoading"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(html, /function setStoreLookupBusy\(busy\)/);
  assert.match(html, /finally\{setStoreLookupBusy\(false\)\}/);
});

test("Filialsuche unterstützt die Auswahl mehrerer konkreter Filialen", () => {
  assert.match(html, /id="selectAllStores"[^>]+aria-controls="storeSelect"/);
  assert.match(html, /id="storeSelect"[^>]+role="group"/);
  assert.match(html, /checkbox\.dataset\.storeId=String\(store\.id\)/);
  assert.match(html, /querySelectorAll\('input\[type="checkbox"\]:checked'\)/);
});

test("Hinweise erscheinen temporär als überlagernde Toasts", () => {
  assert.match(html, /\.notice,\.dialog-notice\{display:none;position:fixed/);
  assert.match(html, /function dismissMessages\(\)/);
  assert.match(html, /setTimeout\(dismissMessages,error\?8000:4500\)/);
  assert.match(html, /target\.setAttribute\('role',error\?'alert':'status'\)/);
});

test("Weboberfläche bietet Erstcheck-Ergebnis, manuelle Zusammenfassung und Baseline-Reset", () => {
  assert.match(html, /Ergebnis beim ersten erfolgreichen Check/);
  assert.match(html, /id="notifyOnManualCheck"/);
  assert.match(html, /\/api\/state\/reset/);
  assert.match(appSource, /runtime\.results = retainResultsAfterBaselineReset/);
  assert.match(appSource, /resultsClearedByBaselineReset = runtime\.results\.length === 0/);
  assert.match(html, /data\.resultsClearedByBaselineReset/);
  assert.match(html, /Ausgangsbestand zurückgesetzt\. Noch kein neuer Prüflauf\./);
});

test("Tracker-Status zeigt standardmäßig nur tatsächlich verfügbare Bestände", () => {
  assert.match(html, /id="resultFilter"[^>]+aria-label="Filter für Tracker-Status"/);
  assert.match(html, /<option value="available" selected>Nur verfügbare<\/option><option value="all">Alle Ergebnisse<\/option>/);
  assert.match(html, /data\.results\.filter\(result=>result\.status==='ok'&&Number\(result\.stock\)>0\)/);
  assert.match(html, /\$\('resultFilter'\)\.onchange=.*loadStatus/);
  assert.match(html, /Keine verfügbaren Bestände\. Über den Filter kannst du alle Prüfergebnisse anzeigen\./);
});

test("Bestandsverlauf ist persistent, filterbar und ohne externe Chart-Abhängigkeit", () => {
  assert.match(html, /id="historyProduct"/);
  assert.match(html, /id="historyStore"/);
  assert.match(html, /id="historyPeriod"/);
  assert.match(html, /id="historyChart"/);
  assert.match(html, /\/api\/history/);
  assert.match(html, /createElementNS\('http:\/\/www\.w3\.org\/2000\/svg'/);
  assert.match(html, /stats\.hidden=!data\.selection\|\|!data\.points\.length/);
  assert.match(html, /if\(historyRequest\?\.url===url\)return historyRequest\.promise/);
  assert.match(html, /if\(result\.rendered\)lastHistoryRunAt=data\.lastRunFinishedAt/);
  assert.doesNotMatch(html, /lastHistoryRunAt=data\.lastRunFinishedAt;void loadHistory/);
  assert.match(html, /Alle Produkte – Bewegungen/);
  assert.match(html, /function renderStoreMovements\(data,chart,stats\)/);
  assert.match(html, /if\(data\.mode==='store'\)\{renderStoreMovements/);
  assert.match(html, /historyStore'\)\.onchange=.*dan:null/);
  assert.match(html, /function preferredHistoryStoreId\(series\).*previousStore=.*stores\.find\(store=>store\.value===previousStore\)\?\.value\|\|stores\[0\]\?\.value\|\|null/);
  assert.match(html, /fallbackStoreId=requestId===historyRequestSequence&&data\.mode==='store'&&!data\.selection\?preferredHistoryStoreId\(data\.series\):null/);
  assert.doesNotMatch(html, /data\.series\?\.\[0\]\?\.storeId/);
  assert.match(html, /return loadHistory\(\{dan:null,storeId:fallbackStoreId\}\)/);
  assert.match(appSource, /recordHistory\(nextState/);
  assert.match(appSource, /getHistoryView\(state/);
  assert.doesNotMatch(html, /chart\.js|highcharts|plotly/i);
});

test("Chromium wird extern gestartet und per CDP angebunden", () => {
  assert.match(appSource, /spawn\(chromium\.executablePath\(\)/);
  assert.match(appSource, /chromium\.connectOverCDP/);
  assert.doesNotMatch(appSource, /launchPersistentContext/);
  assert.match(appSource, /XDG_RUNTIME_DIR/);
  assert.match(appSource, /--disable-breakpad/);
  assert.match(appSource, /mkdtemp\(path\.join\(os\.tmpdir\(\),\s*["']rossmann-store-tracker-chromium-["']\)\)/);
  assert.match(appSource, /chmod\(temporaryBrowserHome,\s*0o700\)/);
});

test("Rossmann-Navigationsfallback ist isoliert und HTTP 406 wird nicht wiederholt", () => {
  assert.match(appSource, /const navigationPage = await page\.context\(\)\.newPage\(\)/);
  assert.match(appSource, /await navigationPage\.close\(\)\.catch/);
  assert.doesNotMatch(appSource, /\[406,\s*429/);
  assert.match(appSource, /HTTP 406 – keine Bestandsantwort für diese DAN/);
});

test("Produktabrufe akzeptieren XML und werten ein PLZ-Suchgebiet gemeinsam aus", () => {
  assert.match(appSource, /expected: "store"/);
  assert.match(appSource, /new DOMParser\(\)\.parseFromString\(body, "application\/xml"\)/);
  assert.doesNotMatch(appSource, /accept: "application\/json"/);
  assert.match(appSource, /queryProductArea/);
  assert.match(html, /Alle .* Filialen im Umkreis/);
  assert.match(html, /searchAreas:collectRows\('\.area-row'\)/);
});
