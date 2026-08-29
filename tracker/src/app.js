import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { chmod, mkdir, mkdtemp, readFile, rename, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createSerializedTask } from "./async-queue.js";
import { matchesBaselineResetTarget, retainResultsAfterBaselineReset } from "./baseline-reset.js";
import { BUILD_INFO } from "./build-info.js";
import { classifyChange, changeLabel } from "./diff.js";
import { getHistoryView, normalizeState, recordHistory } from "./history.js";
import { escapeHtml, formatRunResults } from "./message-format.js";
import {
  MANUAL_CHECK_COOLDOWN_MS,
  createCooldownGate,
  createRequestPacer,
  normalizeRequestPolicy,
} from "./request-policy.js";
import { resolveRuntimePaths } from "./runtime-defaults.js";
import { createSettingsEnvelope, readSettingsEnvelope } from "./settings-schema.js";
import { buildStoreQueryScopes } from "./store-scope.js";
import { getSetupState } from "./setup-state.js";
import { createTelegramBot } from "./telegram.js";
import { createTelegramPairingManager } from "./telegram-pairing.js";
import { applyTelegramPairing } from "./telegram-pairing-transition.js";
import { createUpdateChecker, UPDATE_CHECK_INTERVAL_MS } from "./update-check.js";

const runtimePaths = resolveRuntimePaths(process.env, import.meta.url);
const CONFIG_PATH = runtimePaths.configPath;
const DATA_DIR = runtimePaths.dataDirectory;
const BROWSER_DATA_DIR = runtimePaths.browserDataDirectory;
const STATE_PATH = path.join(DATA_DIR, "state.json");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");
const UPDATE_CHECK_PATH = path.join(DATA_DIR, "update-check.json");
const TELEGRAM_OFFSET_PATH = path.join(DATA_DIR, "telegram-offset.json");
const WEB_UI_PATH = runtimePaths.webUiPath;
const CATALOG_PATH = runtimePaths.catalogPath;
const PORT = Number(process.env.PORT || 8787);
const CHROME_DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT || 9222);
const TELEGRAM_REQUEST_TIMEOUT_MS = 30_000;
const updateChecker = createUpdateChecker({ currentVersion: BUILD_INFO.version, cachePath: UPDATE_CHECK_PATH });

const runtime = {
  startedAt: new Date().toISOString(),
  running: false,
  lastRunStartedAt: null,
  lastRunFinishedAt: null,
  nextRunAt: null,
  lastError: null,
  results: [],
  resultsClearedByBaselineReset: false,
};
const logEntries = [];
let logSequence = 0;

function abortError(reason = "Vorgang abgebrochen") {
  const error = new Error(reason);
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError(String(signal.reason || "Vorgang abgebrochen"));
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

const sleep = (ms, signal = null) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(abortError(String(signal.reason || "Vorgang abgebrochen")));
    return;
  }
  const onAbort = () => {
    clearTimeout(timer);
    reject(abortError(String(signal.reason || "Vorgang abgebrochen")));
  };
  const timer = setTimeout(() => {
    signal?.removeEventListener("abort", onAbort);
    resolve();
  }, ms);
  if (signal) {
    signal.addEventListener("abort", onAbort, { once: true });
  }
});
const nowIso = () => new Date().toISOString();

function log(message, details, requestedLevel = null) {
  const level = requestedLevel
    || (/fehlgeschlagen|abgebrochen|fehler/i.test(message) ? "error" : null)
    || (/challenge|nicht konfiguriert|wartet/i.test(message) ? "warn" : "info");
  const timestamp = nowIso();
  const suffix = details === undefined ? "" : ` ${JSON.stringify(details)}`;
  logEntries.push({ id: ++logSequence, timestamp, level, message, details: details ?? null });
  if (logEntries.length > 500) logEntries.splice(0, logEntries.length - 500);
  const output = `[${timestamp}] [${level.toUpperCase()}] ${message}${suffix}`;
  (level === "error" ? console.error : console.log)(output);
}

function publicLogs(limit = 200) {
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 200));
  return logEntries.slice(-safeLimit);
}

function normalizeConfig(parsed, options = {}) {
  const headlessOverride = process.env.BROWSER_HEADLESS;
  const requestPolicy = normalizeRequestPolicy(parsed, options);
  const config = {
    ...requestPolicy,
    checkOnStart: parsed.checkOnStart !== false,
    updateCheckEnabled: parsed.updateCheckEnabled !== false,
    trackingPaused: Boolean(parsed.trackingPaused),
    headless: headlessOverride === undefined
      ? parsed.headless === true
      : headlessOverride === "true",
    searchAreas: Array.isArray(parsed.searchAreas) ? parsed.searchAreas : [],
    stores: Array.isArray(parsed.stores) ? parsed.stores : [],
    products: Array.isArray(parsed.products) ? parsed.products : [],
    notifications: {
      notifyOnInitialStock: false,
      notifyOnManualCheck: true,
      onRestock: true,
      onOutOfStock: true,
      onStockChange: true,
      onAvailabilityChange: false,
      ...(parsed.notifications ?? {}),
    },
  };

  config.searchAreas = config.searchAreas.map((area) => ({ postcode: String(area.postcode || "") }));
  for (const area of config.searchAreas) {
    if (!area.postcode.match(/^\d{5}$/)) throw new Error(`Ungültige Suchgebiets-PLZ: ${area.postcode}`);
  }
  config.searchAreas = [...new Map(config.searchAreas.map((area) => [area.postcode, area])).values()];
  for (const store of config.stores) {
    if (!String(store.id || "").match(/^\d+$/)) throw new Error(`Ungültige Filial-ID: ${store.id}`);
    if (!String(store.postcode || "").match(/^\d{5}$/)) throw new Error(`Ungültige PLZ: ${store.postcode}`);
  }
  for (const product of config.products) {
    if (!String(product.dan || "").match(/^\d{6}$/)) throw new Error(`Ungültige DAN: ${product.dan}`);
  }
  return config;
}

async function loadProductCatalog() {
  const source = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  return [
    ...(source.working || []).map((product) => ({ ...product, status: "working" })),
    ...(source.request_error || []).map((product) => ({ ...product, status: "request_error" })),
    ...(source.ean_only || []).map((product) => ({ ...product, status: "ean_only" })),
  ].map((product) => ({
    name: String(product.name || ""),
    dan: product.dan ? String(product.dan) : null,
    ean: product.ean ? String(product.ean) : null,
    status: product.status,
  }));
}

async function loadSettings() {
  const defaults = normalizeConfig(JSON.parse(await readFile(CONFIG_PATH, "utf8")));
  const fallbackTelegram = {
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    chatId: process.env.TELEGRAM_CHAT_ID || "",
    botName: "",
    botUsername: "",
    notifyStartup: process.env.TELEGRAM_NOTIFY_STARTUP === "true",
  };
  try {
    const stored = readSettingsEnvelope(JSON.parse(await readFile(SETTINGS_PATH, "utf8")));
    return {
      config: normalizeConfig(stored.config || defaults, { migrateLegacyLimits: true }),
      telegram: {
        botToken: String(stored.telegram?.botToken || fallbackTelegram.botToken),
        chatId: String(stored.telegram?.chatId || fallbackTelegram.chatId),
        botName: String(stored.telegram?.botName || fallbackTelegram.botName),
        botUsername: String(stored.telegram?.botUsername || fallbackTelegram.botUsername),
        notifyStartup: stored.telegram?.notifyStartup ?? fallbackTelegram.notifyStartup,
      },
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { config: defaults, telegram: fallbackTelegram };
  }
}

async function saveSettings(nextConfig = config, nextTelegram = telegramSettings) {
  await mkdir(DATA_DIR, { recursive: true });
  const temporaryPath = `${SETTINGS_PATH}.tmp`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify(createSettingsEnvelope(nextConfig, nextTelegram), null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, SETTINGS_PATH);
}

async function loadState() {
  try {
    return normalizeState(JSON.parse(await readFile(STATE_PATH, "utf8")));
  } catch (error) {
    if (error.code === "ENOENT") return normalizeState({});
    throw error;
  }
}

async function saveState(state) {
  await mkdir(DATA_DIR, { recursive: true });
  const temporaryPath = `${STATE_PATH}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(temporaryPath, STATE_PATH);
}

async function loadTelegramOffset() {
  try {
    const stored = JSON.parse(await readFile(TELEGRAM_OFFSET_PATH, "utf8"));
    return Math.max(0, Number(stored.offset) || 0);
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

const saveTelegramOffset = createSerializedTask(async (offset) => {
  await mkdir(DATA_DIR, { recursive: true });
  const temporaryPath = `${TELEGRAM_OFFSET_PATH}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify({ offset, updatedAt: nowIso() }, null, 2)}\n`, "utf8");
  await rename(temporaryPath, TELEGRAM_OFFSET_PATH);
});

async function sendTelegram(text, override = null) {
  const telegram = override || telegramSettings;
  if (!telegram.botToken || !telegram.chatId) {
    log("Telegram ist nicht konfiguriert; Benachrichtigung wird nur protokolliert.", { text });
    return;
  }
  const response = await fetch(`https://api.telegram.org/bot${telegram.botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: telegram.chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(TELEGRAM_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram HTTP ${response.status}: ${body.slice(0, 200)}`);
  }
}

async function ensureRossmannSession(page, signal = null) {
  throwIfAborted(signal);
  const navigation = await runRossmannRequest(
    () => page.goto("https://www.rossmann.de/de/", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    }),
    signal,
  );
  await sleep(8_000, signal);
  log("Rossmann-Browser bereit.", {
    status: navigation?.status() ?? null,
    title: await page.title(),
    url: page.url(),
    headless: config.headless,
    webdriver: await page.evaluate(() => navigator.webdriver),
  });
  if ((await page.title()).toLowerCase().includes("client challenge")) {
    log("Rossmann Client Challenge erkannt; Browser wartet auf Freigabe.");
    await sleep(25_000, signal);
    await runRossmannRequest(
      () => page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 }),
      signal,
    );
    await sleep(8_000, signal);
  }
  throwIfAborted(signal);
}

async function saveDiagnostics(page, response) {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await page.screenshot({ path: path.join(DATA_DIR, "rossmann-debug.png"), fullPage: false });
    await writeFile(
      path.join(DATA_DIR, "rossmann-debug.json"),
      `${JSON.stringify({
        capturedAt: nowIso(),
        pageTitle: await page.title(),
        pageUrl: page.url(),
        responseStatus: response.status,
        responseContentType: response.contentType,
        responseBodyPrefix: response.body.slice(0, 500),
      }, null, 2)}\n`,
      "utf8",
    );
  } catch (error) {
    log("Diagnosedateien konnten nicht geschrieben werden.", { error: error.message });
  }
}

function hasExpectedRossmannPayload(response, expected) {
  if (response.status !== 200) return false;
  const trimmed = response.body.trimStart().toLowerCase();
  if (expected === "json") return trimmed.startsWith("{") || trimmed.startsWith("[");
  return trimmed.startsWith("{")
    || trimmed.startsWith("[")
    || trimmed.startsWith("<?xml")
    || trimmed.startsWith("<storefinderinfo");
}

async function requestRossmannEndpoint(page, requestUrl, { accept = null, expected = "json", signal = null } = {}) {
  throwIfAborted(signal);
  const fetched = await runRossmannRequest(
    () => page.evaluate(async ({ url, acceptHeader }) => {
      const options = { credentials: "include", cache: "no-store" };
      if (acceptHeader) options.headers = { Accept: acceptHeader };
      const response = await fetch(url, options);
      return {
        status: response.status,
        contentType: response.headers.get("content-type") || "",
        body: await response.text(),
        transport: "fetch",
      };
    }, { url: requestUrl, acceptHeader: accept }),
    signal,
  );

  if (hasExpectedRossmannPayload(fetched, expected)) return fetched;

  log("Rossmann-Fetch abgewiesen; versuche direkte Browsernavigation.", {
    status: fetched.status,
    contentType: fetched.contentType,
    endpoint: requestUrl,
  }, "warn");

  const absoluteUrl = new URL(requestUrl, "https://www.rossmann.de").href;
  const navigationPage = await page.context().newPage();
  const abortNavigation = () => { void navigationPage.close().catch(() => {}); };
  signal?.addEventListener("abort", abortNavigation, { once: true });
  let navigation;
  try {
    await navigationPage.setExtraHTTPHeaders({ "Accept-Language": "de-DE,de;q=0.9,en;q=0.8" });
    throwIfAborted(signal);
    navigation = await runRossmannRequest(
      () => navigationPage.goto(absoluteUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      }),
      signal,
    );
  } catch (error) {
    await navigationPage.close().catch(() => {});
    if (signal?.aborted) throw abortError(String(signal.reason || error.message));
    log("Direkte Rossmann-Browsernavigation fehlgeschlagen.", {
      endpoint: absoluteUrl,
      error: String(error.message || error).split("\n")[0],
    }, "warn");
    return { ...fetched, transport: "navigation", navigationError: error.message };
  } finally {
    signal?.removeEventListener("abort", abortNavigation);
  }
  try {
    if (!navigation) {
      return { ...fetched, transport: "fetch", navigationError: "Keine Navigationsantwort" };
    }

    const headers = await navigation.allHeaders();
    let body;
    try {
      body = await navigation.text();
    } catch {
      body = await navigationPage.locator("body").innerText().catch(() => "");
    }
    return {
      status: navigation.status(),
      contentType: headers["content-type"] || "",
      body,
      transport: "navigation",
    };
  } finally {
    await navigationPage.close().catch(() => {});
  }
}

async function parseStorefinderStores(page, response) {
  return page.evaluate(({ contentType, body }) => {
    let stores = [];
    const asArray = (value) => Array.isArray(value) ? value : value ? [value] : [];
    try {
      if (contentType.includes("json") || body.trimStart().startsWith("{")) {
        const data = JSON.parse(body);
        stores = asArray(data.store ?? data.stores?.store ?? data.stores);
      } else if (contentType.includes("xml") || body.trimStart().startsWith("<")) {
        const xml = new DOMParser().parseFromString(body, "application/xml");
        if (!xml.getElementsByTagName("parsererror").length) {
          const value = (node, name) => node.getElementsByTagName(name)[0]?.textContent?.trim() || "";
          stores = Array.from(xml.getElementsByTagName("store")).map((node) => ({
            id: value(node, "id"),
            city: value(node, "city"),
            postcode: value(node, "postcode"),
            street: value(node, "street"),
            productInfo: Array.from(node.getElementsByTagName("productInfo")).map((productNode) => ({
              available: value(productNode, "available"),
              dan: value(productNode, "dan"),
              stock: value(productNode, "stock"),
            })),
          }));
        }
      }
    } catch {
      stores = [];
    }
    return stores.map((store) => ({
      id: String(store.id || ""),
      city: String(store.city || ""),
      postcode: String(store.postcode || ""),
      street: String(store.street || ""),
      productInfo: asArray(store.productInfo ?? store.productInfos?.productInfo ?? store.productInfos).map((product) => ({
        available: product.available === true || String(product.available).toLowerCase() === "true",
        dan: String(product.dan || ""),
        stock: String(product.stock ?? ""),
      })),
    })).filter((store) => store.id);
  }, response);
}

async function queryProductArea(page, product, postcode, signal = null) {
  const url = `/storefinder/.rest/store?dan=${encodeURIComponent(product.dan)}&q=${encodeURIComponent(postcode)}`;
  let lastFailure;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    throwIfAborted(signal);
    const response = await requestRossmannEndpoint(page, url, {
      expected: "store",
      signal,
    });
    throwIfAborted(signal);

    if (response.status === 200 && hasExpectedRossmannPayload(response, "store")) {
      const stores = await parseStorefinderStores(page, response);
      const matches = [];
      for (const store of stores) {
        const productInfo = store.productInfo.find((candidate) => candidate.dan === String(product.dan));
        if (!productInfo) continue;
        const stock = Number.parseInt(productInfo.stock, 10);
        if (!Number.isFinite(stock)) {
          throw new Error(`Ungültiger Bestand für DAN ${product.dan} in Filiale ${store.id}.`);
        }
        matches.push({
          store: { id: store.id, city: store.city, postcode: store.postcode, street: store.street },
          current: { stock, available: productInfo.available, checkedAt: nowIso() },
        });
      }
      if (matches.length) return matches;
      lastFailure = `Rossmann liefert für DAN ${product.dan} im Suchgebiet ${postcode} keine Filialbestände`;
      break;
    }

    const challenge = response.body.toLowerCase().includes("client challenge");
    lastFailure = response.status === 406 && !challenge
      ? "HTTP 406 – Rossmann liefert für diese DAN keine Bestandsantwort"
      : `HTTP ${response.status}, ${response.contentType || "unbekannter Content-Type"}, ${response.transport}${challenge ? ", Client Challenge" : ""}`;
    if (attempt === 1) await saveDiagnostics(page, response);
    if (attempt < 3 && (challenge || [429, 500, 502, 503, 504].includes(response.status))) {
      await ensureRossmannSession(page, signal);
      await sleep(attempt * 5_000, signal);
      continue;
    }
    break;
  }
  throw new Error(`Rossmann-Abfrage fehlgeschlagen: ${lastFailure}`);
}

function compactErrorMessage(error) {
  const message = String(error?.message || error || "Unbekannter Fehler");
  if (/HTTP 406/i.test(message)) return "HTTP 406 – keine Bestandsantwort für diese DAN.";
  if (/client challenge/i.test(message)) return "Rossmann Client Challenge – Anfrage vorübergehend abgewiesen.";
  if (/chrome-error|ERR_HTTP_RESPONSE_CODE_FAILURE|navigation.+interrupted/i.test(message)) {
    return "Rossmann hat die Bestandsnavigation abgewiesen.";
  }
  return message.split("\n")[0].slice(0, 240);
}

async function fetchStoreCandidates(page, requestUrl) {
  const response = await requestRossmannEndpoint(page, requestUrl, { expected: "store" });
  const stores = await parseStorefinderStores(page, response);
  return {
    status: response.status,
    contentType: response.contentType,
    transport: response.transport,
    bodyPrefix: response.body.slice(0, 250),
    stores: stores.map(({ productInfo: _productInfo, ...store }) => store),
  };
}

async function lookupStores(lookupPage, postcode) {
  if (!/^\d{5}$/.test(postcode)) throw new Error("Bitte eine gültige fünfstellige PLZ eingeben.");
  await ensureRossmannSession(lookupPage);
  const urls = [`/storefinder/.rest/store?q=${encodeURIComponent(postcode)}`];
  const fallbackDans = [
    ...config.products.map((product) => String(product.dan)),
    ...productCatalog.filter((product) => product.dan).map((product) => product.dan),
  ];
  for (const dan of [...new Set(fallbackDans)].slice(0, 3)) {
    urls.push(`/storefinder/.rest/store?dan=${encodeURIComponent(dan)}&q=${encodeURIComponent(postcode)}`);
  }

  const failures = [];
  for (const url of urls) {
    const result = await fetchStoreCandidates(lookupPage, url);
    if (result.status === 200 && result.stores.length) {
      const unique = [...new Map(result.stores.map((store) => [store.id, store])).values()];
      log("Filialsuche erfolgreich.", { postcode, stores: unique.length });
      return unique;
    }
    failures.push(`HTTP ${result.status}${result.contentType ? ` (${result.contentType})` : ""} via ${result.transport}`);
  }
  throw new Error(`Filialsuche für ${postcode} scheiterte auch per direkter Browsernavigation: ${failures.join(", ")}`);
}

function formatNotification(change) {
  const { type, product, store, previous, current } = change;
  const oldStock = previous ? previous.stock : "–";
  return [
    `<b>Pokémon-Bestand: ${escapeHtml(changeLabel(type))}</b>`,
    escapeHtml(product.name),
    `${escapeHtml(store.city)} – ${escapeHtml(store.street)} (${escapeHtml(store.postcode)})`,
    `Bestand: <b>${escapeHtml(oldStock)} → ${escapeHtml(current.stock)} Stück</b>`,
    `DAN ${escapeHtml(product.dan)} · ${escapeHtml(new Date(current.checkedAt).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }))}`,
  ].join("\n");
}

function formatManualSummary(results, runConfig) {
  return formatRunResults({
    title: "<b>🔎 Manueller Prüflauf abgeschlossen</b>",
    results,
    products: runConfig.products,
    stores: runConfig.stores,
    detailed: true,
  });
}

let config;
let telegramSettings;
let productCatalog;
let state;
let browser;
let browserProcess;
let context;
let page;
let webUi;
let scheduleTimer;
let updateCheckTimer;
let activeRun = null;
let restartAfterCurrentRun = false;
let runSequence = 0;
let settingsCommitQueue = Promise.resolve();
let stateMutationQueue = Promise.resolve();
let stateMutationInProgress = false;
let shuttingDown = false;
let browserStderr = "";
let browserSpawnError = null;
let telegramBot = null;
let telegramPairing = null;
const rossmannRequestPacer = createRequestPacer({ sleep });
const manualCheckCooldown = createCooldownGate({ cooldownMs: MANUAL_CHECK_COOLDOWN_MS });

function runRossmannRequest(task, signal = null) {
  return rossmannRequestPacer.run(task, {
    delayMs: config.requestDelayMs,
    jitterMs: config.jitterMs,
    signal,
  });
}

function currentSetupState() {
  return getSetupState(config, telegramSettings);
}

async function runCheck(trigger = "schedule") {
  if (stateMutationInProgress) {
    log("Prüfung wegen laufender Zustandsänderung übersprungen.", { trigger }, "warn");
    return false;
  }
  if (config.trackingPaused && trigger !== "manual") {
    log("Automatische Prüfung ist pausiert.", { trigger }, "warn");
    return false;
  }
  const setup = currentSetupState();
  if (!setup.telegramConnected) {
    log("Prüfung übersprungen: Telegram ist noch nicht verbunden.", { trigger }, "warn");
    return false;
  }
  if (!setup.locationConfigured) {
    log("Prüfung übersprungen: Es ist noch kein Suchgebiet oder keine Filiale ausgewählt.", { trigger }, "warn");
    return false;
  }
  if (!config.products.length) {
    log("Prüfung übersprungen: Es sind keine Produkte ausgewählt.", { trigger }, "warn");
    return false;
  }
  if (activeRun) return false;
  const controller = new AbortController();
  const runId = ++runSequence;
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  activeRun = { id: runId, controller, trigger, page: null, done, resolveDone };
  runtime.running = true;
  runtime.lastRunStartedAt = nowIso();
  runtime.lastError = null;
  const results = [];
  const changes = [];
  const runConfig = structuredClone(config);
  const queryScopes = buildStoreQueryScopes(runConfig);
  const nextState = structuredClone(state);
  const processedKeys = new Set();
  let queryCount = 0;
  let runPage = null;
  log("Bestandsprüfung gestartet.", { trigger, runId });

  try {
    runPage = await context.newPage();
    activeRun.page = runPage;
    await runPage.setViewportSize({ width: 1280, height: 900 });
    await runPage.setExtraHTTPHeaders({ "Accept-Language": "de-DE,de;q=0.9,en;q=0.8" });
    throwIfAborted(controller.signal);
    await ensureRossmannSession(runPage, controller.signal);
    for (const product of runConfig.products) {
      for (const scope of queryScopes) {
        throwIfAborted(controller.signal);
        try {
          queryCount += 1;
          const returned = await queryProductArea(runPage, product, scope.postcode, controller.signal);
          const selectedIds = new Set(scope.stores.map((store) => String(store.id)));
          const selected = scope.mode === "all"
            ? returned
            : returned.filter(({ store }) => selectedIds.has(String(store.id)));

          if (scope.mode === "selected") {
            const returnedIds = new Set(selected.map(({ store }) => String(store.id)));
            for (const store of scope.stores.filter((candidate) => !returnedIds.has(String(candidate.id)))) {
              const error = `Filiale ${store.id} wurde im Suchgebiet ${scope.postcode} nicht zurückgegeben.`;
              results.push({
                status: "error",
                storeId: String(store.id),
                storeName: `${store.city} – ${store.street}`,
                dan: String(product.dan),
                error,
              });
              log("Einzelabfrage fehlgeschlagen.", { storeId: store.id, dan: product.dan, error, publicError: error });
            }
          }

          for (const { store, current } of selected) {
            const key = `${store.id}:${product.dan}`;
            if (processedKeys.has(key)) continue;
            processedKeys.add(key);
            const previous = nextState.items[key] || null;
            const type = classifyChange(previous, current, runConfig.notifications);
            const storeName = `${store.city} – ${store.street}`;
            nextState.items[key] = { ...current, productName: product.name, storeName };
            recordHistory(nextState, { store, product, current });
            results.push({
              status: "ok",
              storeId: String(store.id),
              storeName,
              storePostcode: String(store.postcode),
              dan: String(product.dan),
              ...current,
            });
            if (type) changes.push({ type, product, store, previous, current });
            else if (!previous) {
              log("Ausgangsbestand ohne Telegram-Meldung gespeichert.", {
                storeId: store.id,
                dan: product.dan,
                stock: current.stock,
                initialNotificationEnabled: runConfig.notifications.notifyOnInitialStock,
              });
            }
          }
        } catch (error) {
          if (controller.signal.aborted) throw abortError(String(controller.signal.reason || error.message));
          if (isAbortError(error)) throw error;
          const publicError = compactErrorMessage(error);
          const targets = scope.mode === "selected"
            ? scope.stores
            : [{ id: `area:${scope.postcode}`, city: "Umkreis", street: `PLZ ${scope.postcode}` }];
          for (const store of targets) {
            results.push({
              status: "error",
              storeId: String(store.id),
              storeName: `${store.city} – ${store.street}`,
              dan: String(product.dan),
              error: publicError,
            });
            log("Einzelabfrage fehlgeschlagen.", {
              storeId: store.id,
              postcode: scope.postcode,
              dan: product.dan,
              error: error.message,
              publicError,
            });
          }
        }
      }
    }
    throwIfAborted(controller.signal);
    nextState.updatedAt = nowIso();
    await saveState(nextState);
    throwIfAborted(controller.signal);
    state = nextState;
    const initialChanges = changes.filter((change) => change.type === "initial_stock");
    const individualChanges = changes.filter((change) => change.type !== "initial_stock");
    if (initialChanges.length) {
      const initialResults = initialChanges.map(({ product, store, current }) => ({
        status: "ok",
        storeId: String(store.id),
        storeName: `${store.city} – ${store.street}`,
        dan: String(product.dan),
        ...current,
      }));
      try {
        await sendTelegram(formatRunResults({
          title: "<b>🆕 Erste Prüfergebnisse</b>",
          results: initialResults,
          products: runConfig.products,
          stores: runConfig.stores,
        }));
      } catch (error) {
        log("Telegram-Benachrichtigung fehlgeschlagen.", { error: error.message });
      }
    }
    for (const change of individualChanges) {
      throwIfAborted(controller.signal);
      try {
        await sendTelegram(formatNotification(change));
      } catch (error) {
        log("Telegram-Benachrichtigung fehlgeschlagen.", { error: error.message });
      }
    }
    if (trigger === "manual" && runConfig.notifications.notifyOnManualCheck) {
      try {
        await sendTelegram(formatManualSummary(results, runConfig));
      } catch (error) {
        log("Telegram-Zusammenfassung fehlgeschlagen.", { error: error.message });
      }
    }
    runtime.results = results;
    runtime.resultsClearedByBaselineReset = false;
    runtime.lastRunFinishedAt = nowIso();
    log("Bestandsprüfung abgeschlossen.", {
      runId,
      successful: results.filter((result) => result.status === "ok").length,
      failed: results.filter((result) => result.status === "error").length,
      changes: changes.length,
      queries: queryCount,
    });
    return true;
  } catch (error) {
    runtime.lastRunFinishedAt = nowIso();
    if (controller.signal.aborted || isAbortError(error)) {
      log("Prüflauf verworfen; aktiver Zustand wurde geändert.", { runId, reason: error.message }, "warn");
    } else {
      runtime.lastError = error.message;
      log("Prüflauf abgebrochen.", { runId, error: error.message });
    }
    return false;
  } finally {
    await runPage?.close().catch(() => {});
    const finishedRun = activeRun?.id === runId ? activeRun : null;
    if (finishedRun) activeRun = null;
    runtime.running = Boolean(activeRun);
    finishedRun?.resolveDone();
    if (!stateMutationInProgress) {
      const restart = restartAfterCurrentRun;
      restartAfterCurrentRun = false;
      if (restart && !config.trackingPaused && currentSetupState().complete) {
        runtime.nextRunAt = nowIso();
        setTimeout(() => void runCheck("configuration"), 0).unref();
      } else {
        scheduleNext();
      }
    }
  }
}

function publicStatus() {
  const setup = currentSetupState();
  return {
    ...runtime,
    build: BUILD_INFO,
    update: updateChecker.status(),
    configuration: {
      pollIntervalMinutes: config.pollIntervalMinutes,
      searchAreas: config.searchAreas,
      stores: config.stores,
      products: config.products,
      telegramConfigured: Boolean(telegramSettings.botToken && telegramSettings.chatId),
      trackingPaused: config.trackingPaused,
      manualCheck: manualCheckCooldown.status(),
    },
    setup,
    state: {
      version: state.version,
      items: state.items,
      updatedAt: state.updatedAt || null,
    },
  };
}

function publicHistory(searchParams) {
  return getHistoryView(state, {
    dan: searchParams.get("dan") || null,
    storeId: searchParams.get("storeId") || null,
    period: searchParams.get("period") || "30",
  });
}

function publicSettings() {
  const setup = currentSetupState();
  return {
    config,
    catalog: productCatalog,
    setup,
    telegram: {
      chatId: telegramSettings.chatId,
      botName: telegramSettings.botName,
      botUsername: telegramSettings.botUsername,
      connected: setup.telegramConnected,
      notifyStartup: telegramSettings.notifyStartup,
      botTokenConfigured: Boolean(telegramSettings.botToken),
    },
  };
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(payload, null, 2));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Anfrage ist zu groß.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function mutationAllowed(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function scheduleNext() {
  if (scheduleTimer) clearTimeout(scheduleTimer);
  scheduleTimer = null;
  if (config.trackingPaused || stateMutationInProgress || !currentSetupState().complete) {
    runtime.nextRunAt = null;
    return;
  }
  const delay = config.pollIntervalMinutes * 60_000;
  runtime.nextRunAt = new Date(Date.now() + delay).toISOString();
  scheduleTimer = setTimeout(async () => {
    await runCheck("schedule");
  }, delay);
  scheduleTimer.unref();
}

function clearSchedule() {
  if (scheduleTimer) clearTimeout(scheduleTimer);
  scheduleTimer = null;
  runtime.nextRunAt = null;
}

function clearUpdateCheckSchedule() {
  if (updateCheckTimer) clearTimeout(updateCheckTimer);
  updateCheckTimer = null;
}

function scheduleUpdateCheck() {
  clearUpdateCheckSchedule();
  if (!config.updateCheckEnabled) return;
  const nextCheck = Date.parse(updateChecker.status().nextCheckAt || "");
  const delay = Number.isFinite(nextCheck) ? Math.max(1_000, nextCheck - Date.now()) : 0;
  updateCheckTimer = setTimeout(() => void refreshUpdateInfo(), delay);
  updateCheckTimer.unref();
}

async function refreshUpdateInfo() {
  clearUpdateCheckSchedule();
  updateChecker.setEnabled(config.updateCheckEnabled);
  if (!config.updateCheckEnabled) return;
  try {
    const result = await updateChecker.check();
    if (result.fetched && result.error) {
      log("Stable-Updateprüfung derzeit nicht verfügbar.", { error: result.error }, "warn");
    } else if (result.fetched && result.state === "available") {
      log("Neues Stable-Release gefunden.", { version: result.release.version });
    } else if (result.fetched) {
      log("Stable-Updateprüfung abgeschlossen; installierte Version ist aktuell.", { version: BUILD_INFO.version });
    }
    scheduleUpdateCheck();
  } catch (error) {
    log("Update-Cache konnte nicht verarbeitet werden.", { error: error.message }, "warn");
    updateCheckTimer = setTimeout(() => void refreshUpdateInfo(), UPDATE_CHECK_INTERVAL_MS);
    updateCheckTimer.unref();
  }
}

async function commitSettings(buildNext, {
  restartActiveRun = false,
  reason = "Konfiguration geändert",
  wakeTelegram = true,
} = {}) {
  const operation = settingsCommitQueue.then(async () => {
    const setupWasComplete = currentSetupState().complete;
    const updateCheckWasEnabled = config.updateCheckEnabled;
    const next = buildNext(config, telegramSettings);
    await saveSettings(next.config, next.telegram);
    const telegramCredentialsChanged = next.telegram.botToken !== telegramSettings.botToken
      || next.telegram.chatId !== telegramSettings.chatId;
    config = next.config;
    telegramSettings = next.telegram;
    updateChecker.setEnabled(config.updateCheckEnabled);
    if (updateCheckWasEnabled !== config.updateCheckEnabled) {
      if (config.updateCheckEnabled) void refreshUpdateInfo();
      else clearUpdateCheckSchedule();
    }
    if (telegramCredentialsChanged && wakeTelegram) telegramBot?.wake();
    clearSchedule();
    if (activeRun) {
      restartAfterCurrentRun = restartActiveRun
        && !config.trackingPaused
        && currentSetupState().complete;
      const runToCancel = activeRun;
      runToCancel.controller.abort(reason);
      void runToCancel.page?.close().catch(() => {});
    } else if (!setupWasComplete && currentSetupState().complete && config.checkOnStart && !config.trackingPaused) {
      runtime.nextRunAt = nowIso();
      setTimeout(() => void runCheck("configuration"), 0).unref();
    } else {
      scheduleNext();
    }
    return next;
  });
  settingsCommitQueue = operation.catch(() => {});
  return operation;
}

async function updateRuntimeConfig(mutator, options = {}) {
  return commitSettings((currentConfig, currentTelegram) => ({
    config: normalizeConfig(mutator(structuredClone(currentConfig))),
    telegram: currentTelegram,
  }), options);
}

async function resetBaseline({ dan = null, storeId = null } = {}) {
  const operation = stateMutationQueue.then(async () => {
    stateMutationInProgress = true;
    clearSchedule();
    try {
      const runToCancel = activeRun;
      if (runToCancel) {
        restartAfterCurrentRun = false;
        runToCancel.controller.abort("Ausgangsbestand wird zurückgesetzt");
        void runToCancel.page?.close().catch(() => {});
        await runToCancel.done;
      }
      const nextState = structuredClone(state);
      const entries = Object.entries(nextState.items || {});
      const retained = entries.filter(([key]) => {
        const [keyStoreId, keyDan] = key.split(":");
        return !matchesBaselineResetTarget(
          { dan: keyDan, storeId: keyStoreId },
          { dan, storeId },
        );
      });
      const removed = entries.length - retained.length;
      nextState.items = Object.fromEntries(retained);
      nextState.updatedAt = nowIso();
      await saveState(nextState);
      state = nextState;
      runtime.results = retainResultsAfterBaselineReset(runtime.results, { dan, storeId });
      runtime.resultsClearedByBaselineReset = runtime.results.length === 0;
      log("Gespeicherter Ausgangsbestand zurückgesetzt.", { dan, storeId, removed });
      return { removed };
    } finally {
      stateMutationInProgress = false;
      restartAfterCurrentRun = false;
      scheduleNext();
    }
  });
  stateMutationQueue = operation.catch(() => {});
  return operation;
}

function triggerManualCheck() {
  if (activeRun) return { accepted: false, reason: "Eine Prüfung läuft bereits." };
  if (stateMutationInProgress) return { accepted: false, reason: "Der Ausgangsbestand wird gerade geändert." };
  const setup = currentSetupState();
  if (!setup.telegramConnected) return { accepted: false, reason: "Verbinde zuerst Telegram." };
  if (!setup.locationConfigured) return { accepted: false, reason: "Wähle zuerst ein Suchgebiet oder eine Filiale aus." };
  if (!setup.productConfigured) return { accepted: false, reason: "Wähle zuerst mindestens ein Produkt aus." };
  const cooldown = manualCheckCooldown.tryAcquire();
  if (!cooldown.accepted) {
    const seconds = Math.ceil(cooldown.retryAfterMs / 1_000);
    return {
      accepted: false,
      retryAfterMs: cooldown.retryAfterMs,
      reason: `Bitte warte noch ${seconds} Sekunden bis zur nächsten manuellen Prüfung.`,
    };
  }
  void runCheck("manual");
  return { accepted: true };
}

async function lookupStoreCandidates(postcode) {
  const lookupPage = await context.newPage();
  await lookupPage.setExtraHTTPHeaders({ "Accept-Language": "de-DE,de;q=0.9,en;q=0.8" });
  try {
    return await lookupStores(lookupPage, postcode);
  } finally {
    await lookupPage.close().catch(() => {});
  }
}

function startHttpServer() {
  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, "http://localhost");
      const { pathname } = requestUrl;
      if (request.method === "GET" && pathname === "/") {
        response.statusCode = 200;
        response.setHeader("content-type", "text/html; charset=utf-8");
        response.setHeader("cache-control", "no-store");
        response.end(webUi);
        return;
      }
      if (request.method === "GET" && ["/health", "/api/health"].includes(pathname)) {
        sendJson(response, 200, { status: "ok", running: runtime.running, build: BUILD_INFO });
        return;
      }
      if (request.method === "GET" && ["/status", "/api/status"].includes(pathname)) {
        sendJson(response, 200, publicStatus());
        return;
      }
      if (request.method === "GET" && pathname === "/api/logs") {
        const limit = requestUrl.searchParams.get("limit");
        sendJson(response, 200, { logs: publicLogs(limit) });
        return;
      }
      if (request.method === "GET" && pathname === "/api/history") {
        sendJson(response, 200, publicHistory(requestUrl.searchParams));
        return;
      }
      if (request.method === "GET" && pathname === "/api/settings") {
        sendJson(response, 200, publicSettings());
        return;
      }
      if (request.method === "GET" && pathname === "/api/telegram/pairing") {
        sendJson(response, 200, telegramPairing?.status() || { status: "idle" });
        return;
      }
      if (["POST", "PUT", "DELETE"].includes(request.method) && !mutationAllowed(request)) {
        sendJson(response, 403, { error: "Diese Änderung ist nur von der lokalen Oberfläche erlaubt." });
        return;
      }
      if (request.method === "POST" && pathname === "/api/telegram/pairing/start") {
        const incoming = await readJsonBody(request);
        const pairing = await telegramPairing.start(incoming.botToken);
        sendJson(response, 202, pairing);
        return;
      }
      if (request.method === "DELETE" && pathname === "/api/telegram/pairing") {
        telegramPairing.cancel();
        sendJson(response, 200, { cancelled: true });
        return;
      }
      if (request.method === "PUT" && pathname === "/api/settings") {
        if (!String(request.headers["content-type"] || "").startsWith("application/json")) {
          sendJson(response, 415, { error: "Content-Type application/json ist erforderlich." });
          return;
        }
        const incoming = await readJsonBody(request);
        await commitSettings((_currentConfig, currentTelegram) => {
          const suppliedToken = String(incoming.telegram?.botToken || "").trim();
          return {
            config: normalizeConfig(incoming.config || {}),
            telegram: {
              ...currentTelegram,
              botToken: suppliedToken || currentTelegram.botToken,
              chatId: String(incoming.telegram?.chatId ?? currentTelegram.chatId).trim(),
              notifyStartup: Boolean(incoming.telegram?.notifyStartup),
            },
          };
        }, { restartActiveRun: true });
        log("Konfiguration atomar gespeichert.", {
          searchAreas: config.searchAreas.length,
          stores: config.stores.length,
          products: config.products.length,
          runRestarted: runtime.running && restartAfterCurrentRun,
        });
        sendJson(response, 200, { saved: true, settings: publicSettings() });
        return;
      }
      if (request.method === "POST" && pathname === "/api/tracking/pause") {
        const incoming = await readJsonBody(request);
        const paused = Boolean(incoming.paused);
        await commitSettings((currentConfig, currentTelegram) => ({
          config: { ...currentConfig, trackingPaused: paused },
          telegram: currentTelegram,
        }), { restartActiveRun: !paused, reason: paused ? "Tracking pausiert" : "Tracking fortgesetzt" });
        log(config.trackingPaused ? "Automatisches Tracking pausiert." : "Automatisches Tracking fortgesetzt.");
        sendJson(response, 200, { paused: config.trackingPaused, running: runtime.running });
        return;
      }
      if (request.method === "POST" && pathname === "/api/stores/lookup") {
        const incoming = await readJsonBody(request);
        const postcode = String(incoming.postcode || "").trim();
        const stores = await lookupStoreCandidates(postcode);
        sendJson(response, 200, { stores });
        return;
      }
      if (request.method === "POST" && pathname === "/api/state/reset") {
        const incoming = await readJsonBody(request);
        const dan = incoming.dan ? String(incoming.dan).trim() : null;
        const storeId = incoming.storeId ? String(incoming.storeId).trim() : null;
        if (dan && !/^\d{6}$/.test(dan)) throw new Error("Ungültige DAN für den Baseline-Reset.");
        if (storeId && !/^\d+$/.test(storeId)) throw new Error("Ungültige Filial-ID für den Baseline-Reset.");
        const result = await resetBaseline({ dan, storeId });
        sendJson(response, 200, { reset: true, ...result });
        return;
      }
      if (request.method === "POST" && pathname === "/api/telegram/test") {
        const incoming = String(request.headers["content-type"] || "").startsWith("application/json")
          ? await readJsonBody(request)
          : {};
        const candidate = {
          botToken: String(incoming.botToken || telegramSettings.botToken).trim(),
          chatId: String(incoming.chatId || telegramSettings.chatId).trim(),
        };
        if (!candidate.botToken || !candidate.chatId) {
          sendJson(response, 400, { error: "Bot-Token und Chat-ID werden für den Test benötigt." });
          return;
        }
        await sendTelegram(
          "<b>Rossmann Store Tracker</b>\nTelegram-Test erfolgreich. ✅",
          candidate,
        );
        sendJson(response, 200, { sent: true });
        return;
      }
      if (request.method === "POST" && ["/check", "/api/check"].includes(pathname)) {
        const result = triggerManualCheck();
        if (!result.accepted) {
          sendJson(response, 409, { error: result.reason });
          return;
        }
        sendJson(response, 202, { accepted: true });
        return;
      }
      sendJson(response, 404, { error: "Nicht gefunden" });
    } catch (error) {
      log("HTTP-Anfrage fehlgeschlagen.", { error: error.message });
      sendJson(response, 400, { error: error.message });
    }
  }).listen(PORT, "0.0.0.0", () => log(`Status-API lauscht auf Port ${PORT}.`));
}

async function removeStaleChromiumLocks() {
  const removed = [];
  for (const filename of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    try {
      await unlink(path.join(BROWSER_DATA_DIR, filename));
      removed.push(filename);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  if (removed.length) {
    log("Zurückgebliebene Chromium-Profilsperren bereinigt.", { count: removed.length }, "info");
  }
}

async function waitForChromiumCdp() {
  const endpoint = `http://127.0.0.1:${CHROME_DEBUG_PORT}`;
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    if (browserSpawnError) throw browserSpawnError;
    if (browserProcess?.exitCode !== null) {
      throw new Error(`Chromium wurde vorzeitig beendet (Exit ${browserProcess?.exitCode}). ${browserStderr.slice(-800)}`);
    }
    try {
      const response = await fetch(`${endpoint}/json/version`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return endpoint;
    } catch {
      // Chromium startet noch.
    }
    await sleep(500);
  }
  throw new Error(`Chromium-CDP auf Port ${CHROME_DEBUG_PORT} wurde nicht rechtzeitig erreichbar. ${browserStderr.slice(-800)}`);
}

async function startContainerBrowser() {
  if (!Number.isInteger(CHROME_DEBUG_PORT) || CHROME_DEBUG_PORT < 1024 || CHROME_DEBUG_PORT > 65535) {
    throw new Error("CHROME_DEBUG_PORT muss zwischen 1024 und 65535 liegen.");
  }
  await mkdir(BROWSER_DATA_DIR, { recursive: true });
  await removeStaleChromiumLocks();
  const temporaryBrowserHome = await mkdtemp(path.join(os.tmpdir(), "rossmann-store-tracker-chromium-"));
  const browserEnvironment = {
    ...process.env,
    HOME: temporaryBrowserHome,
    XDG_CACHE_HOME: path.join(temporaryBrowserHome, "cache"),
    XDG_CONFIG_HOME: path.join(temporaryBrowserHome, "config"),
    XDG_RUNTIME_DIR: path.join(temporaryBrowserHome, "runtime"),
  };
  await chmod(temporaryBrowserHome, 0o700);
  await Promise.all([
    mkdir(browserEnvironment.XDG_CACHE_HOME, { recursive: true, mode: 0o700 }),
    mkdir(browserEnvironment.XDG_CONFIG_HOME, { recursive: true, mode: 0o700 }),
    mkdir(browserEnvironment.XDG_RUNTIME_DIR, { recursive: true, mode: 0o700 }),
  ]);
  await Promise.all([
    chmod(browserEnvironment.XDG_CACHE_HOME, 0o700),
    chmod(browserEnvironment.XDG_CONFIG_HOME, 0o700),
    chmod(browserEnvironment.XDG_RUNTIME_DIR, 0o700),
  ]);

  const args = [
    `--remote-debugging-address=127.0.0.1`,
    `--remote-debugging-port=${CHROME_DEBUG_PORT}`,
    `--user-data-dir=${BROWSER_DATA_DIR}`,
    "--no-sandbox",
    "--disable-breakpad",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--lang=de-DE",
    "--window-size=1280,900",
    "about:blank",
  ];
  if (config.headless) args.unshift("--headless=new");

  browserProcess = spawn(chromium.executablePath(), args, {
    env: browserEnvironment,
    stdio: ["ignore", "ignore", "pipe"],
  });
  browserProcess.stderr?.on("data", (chunk) => {
    browserStderr = `${browserStderr}${chunk}`.slice(-8_000);
  });
  browserProcess.once("error", (error) => {
    browserSpawnError = new Error(`Chromium konnte nicht gestartet werden: ${error.message}`);
  });
  browserProcess.once("exit", (code, signal) => {
    if (shuttingDown) return;
    log("Chromium-Prozess wurde unerwartet beendet.", { code, signal, stderr: browserStderr.slice(-800) }, "error");
    setTimeout(() => process.exit(1), 250).unref();
  });

  const cdpEndpoint = await waitForChromiumCdp();
  browser = await chromium.connectOverCDP(cdpEndpoint, { timeout: 30_000 });
  context = browser.contexts()[0];
  if (!context) throw new Error("Chromium stellte keinen Standard-Browserkontext bereit.");
  page = context.pages()[0] || (await context.newPage());
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "de-DE,de;q=0.9,en;q=0.8" });
  log("Chromium als eigenständiger Containerprozess gestartet; Playwright ist nur per CDP verbunden.", {
    pid: browserProcess.pid,
    cdpPort: CHROME_DEBUG_PORT,
    headless: config.headless,
    webdriver: await page.evaluate(() => navigator.webdriver),
  });
}

async function main() {
  productCatalog = await loadProductCatalog();
  const settings = await loadSettings();
  config = settings.config;
  telegramSettings = settings.telegram;
  await updateChecker.initialize(config.updateCheckEnabled);
  state = await loadState();
  webUi = await readFile(WEB_UI_PATH, "utf8");
  log("Build-Metadaten geladen.", BUILD_INFO);
  await startContainerBrowser();
  telegramBot = createTelegramBot({
    getCredentials: () => ({
      botToken: telegramSettings.botToken,
      chatId: telegramSettings.chatId,
    }),
    getStatus: publicStatus,
    getLogs: publicLogs,
    getSettings: () => ({ config, catalog: productCatalog }),
    updateConfig: updateRuntimeConfig,
    triggerCheck: triggerManualCheck,
    lookupStores: lookupStoreCandidates,
    resetBaseline,
    loadOffset: loadTelegramOffset,
    saveOffset: saveTelegramOffset,
    log,
  });
  telegramPairing = createTelegramPairingManager({
    log,
    onPaired: async ({ botToken, chatId, botName, botUsername, offset, signal }) => {
      const previousTelegram = structuredClone(telegramSettings);
      await applyTelegramPairing({
        bot: telegramBot,
        nextOffset: offset,
        saveOffset: saveTelegramOffset,
        signal,
        commitCredentials: async () => {
          await commitSettings((currentConfig, currentTelegram) => ({
            config: currentConfig,
            telegram: {
              ...currentTelegram,
              botToken,
              chatId,
              botName,
              botUsername,
            },
          }), { wakeTelegram: false });
          return () => commitSettings((currentConfig) => ({
            config: currentConfig,
            telegram: previousTelegram,
          }), { wakeTelegram: false });
        },
      });
    },
  });
  startHttpServer();
  void refreshUpdateInfo();
  await telegramBot.start();

  if (telegramSettings.notifyStartup && currentSetupState().telegramConnected) {
    try {
      await sendTelegram("<b>Rossmann Store Tracker gestartet</b>\nDie Bestandsüberwachung ist aktiv.");
    } catch (error) {
      log("Telegram-Startnachricht fehlgeschlagen.", { error: error.message });
    }
  }
  if (!currentSetupState().complete) {
    log("Einrichtung in der Weboberfläche erforderlich; Überwachung ist noch nicht aktiv.", currentSetupState(), "warn");
    scheduleNext();
  } else if (config.checkOnStart) await runCheck("startup");
  else scheduleNext();
}

async function shutdown(signal) {
  shuttingDown = true;
  log(`Beende Tracker (${signal}).`);
  clearSchedule();
  clearUpdateCheckSchedule();
  activeRun?.controller.abort(`Container wird beendet (${signal})`);
  telegramPairing?.cancel();
  await telegramBot?.stop();
  await browser?.close().catch(() => {});
  if (browserProcess && browserProcess.exitCode === null) browserProcess.kill("SIGTERM");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
