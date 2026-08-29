import { escapeHtml, formatDateTime, formatRunResults } from "./message-format.js";
import { MIN_JITTER_MS, MIN_POLL_INTERVAL_MINUTES, MIN_REQUEST_DELAY_MS } from "./request-policy.js";

const MAX_MESSAGE_LENGTH = 3_900;
const TELEGRAM_REQUEST_TIMEOUT_MS = 30_000;
const STORE_CANDIDATE_TTL_MS = 15 * 60_000;
const STORE_CANDIDATE_CACHE_SIZE = 200;
const STORE_SEARCH_CACHE_SIZE = 50;

export function truncateTelegramHtml(value, maximum = MAX_MESSAGE_LENGTH) {
  const text = String(value);
  if (text.length <= maximum) return text;
  const suffix = "\n… gekürzt";
  const tokens = text.match(/<[^>]+>|&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);|[\s\S]/gi) || [];
  const openTags = [];
  let output = "";
  let consumed = 0;
  for (const token of tokens) {
    const nextTags = [...openTags];
    const closingTag = token.match(/^<\/([a-z][a-z0-9]*)>$/i);
    const openingTag = token.match(/^<([a-z][a-z0-9]*)(?:\s[^>]*)?>$/i);
    if (closingTag && nextTags.at(-1) === closingTag[1].toLowerCase()) nextTags.pop();
    else if (openingTag && !token.endsWith("/>")) nextTags.push(openingTag[1].toLowerCase());
    const closures = [...nextTags].reverse().map((tag) => `</${tag}>`).join("");
    if (output.length + token.length + closures.length + suffix.length > maximum) break;
    output += token;
    openTags.splice(0, openTags.length, ...nextTags);
    consumed += 1;
  }
  if (consumed === tokens.length) return text;
  return `${output}${[...openTags].reverse().map((tag) => `</${tag}>`).join("")}${suffix}`;
}

function parseSwitch(value) {
  const normalized = String(value || "").toLowerCase();
  if (["on", "an", "1", "true", "ja"].includes(normalized)) return true;
  if (["off", "aus", "0", "false", "nein"].includes(normalized)) return false;
  return null;
}

const isDan = (value) => /^\d{6}$/.test(String(value));
const isPostcode = (value) => /^\d{5}$/.test(String(value));
const isStoreId = (value) => /^\d+$/.test(String(value));

function telegramRequestSignal(...signals) {
  const timeoutSignal = AbortSignal.timeout(TELEGRAM_REQUEST_TIMEOUT_MS);
  return AbortSignal.any([...signals.filter(Boolean), timeoutSignal]);
}

export function createBoundedTtlCache({ maxSize, ttlMs, now = () => Date.now() }) {
  const entries = new Map();

  function pruneExpired(timestamp) {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= timestamp) entries.delete(key);
    }
  }

  return {
    set(key, value) {
      const timestamp = now();
      pruneExpired(timestamp);
      entries.delete(key);
      entries.set(key, { value, expiresAt: timestamp + ttlMs });
      while (entries.size > maxSize) entries.delete(entries.keys().next().value);
    },
    get(key) {
      const timestamp = now();
      const entry = entries.get(key);
      if (!entry || entry.expiresAt <= timestamp) {
        entries.delete(key);
        return undefined;
      }
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    get size() {
      pruneExpired(now());
      return entries.size;
    },
  };
}

function commandParts(text) {
  const [rawCommand = "", ...args] = String(text || "").trim().split(/\s+/);
  return {
    command: rawCommand.toLowerCase().split("@")[0],
    args,
  };
}

export function createTelegramBot({
  getCredentials,
  getStatus,
  getLogs,
  getSettings,
  updateConfig,
  triggerCheck,
  lookupStores,
  resetBaseline,
  loadOffset,
  saveOffset,
  log,
}) {
  let stopped = true;
  let pollPromise = null;
  let currentRequestController = null;
  let registeredToken = null;
  let offset = 0;
  let suspended = false;
  let lifecycleController = new AbortController();
  let lifecycleGeneration = 0;
  const storeCandidates = createBoundedTtlCache({
    maxSize: STORE_CANDIDATE_CACHE_SIZE,
    ttlMs: STORE_CANDIDATE_TTL_MS,
  });
  const storeSearchCandidates = createBoundedTtlCache({
    maxSize: STORE_SEARCH_CACHE_SIZE,
    ttlMs: STORE_CANDIDATE_TTL_MS,
  });

  function abortActiveRequests({ renew = true } = {}) {
    lifecycleGeneration += 1;
    lifecycleController.abort();
    currentRequestController?.abort();
    if (renew) lifecycleController = new AbortController();
  }

  const commands = [
    { command: "status", description: "Kompakter Tracker-Status" },
    { command: "results", description: "Letzte Einzelergebnisse" },
    { command: "logs", description: "Letzte Logmeldungen" },
    { command: "check", description: "Prüflauf sofort starten" },
    { command: "pause", description: "Automatisches Tracking pausieren" },
    { command: "resume", description: "Automatisches Tracking fortsetzen" },
    { command: "settings", description: "Aktuelle Konfiguration anzeigen" },
    { command: "stores", description: "Aktive Filialen anzeigen" },
    { command: "store_add", description: "Filiale per PLZ hinzufügen" },
    { command: "store_remove", description: "Filiale entfernen" },
    { command: "products", description: "Aktive Produkte anzeigen" },
    { command: "catalog", description: "Mitgelieferten Produktkatalog anzeigen" },
    { command: "product_add", description: "Produkte hinzufügen" },
    { command: "product_remove", description: "Produkte entfernen" },
    { command: "interval", description: "Prüfintervall festlegen" },
    { command: "delay", description: "Request-Pausen festlegen" },
    { command: "startup", description: "Startprüfung an- oder ausschalten" },
    { command: "notify", description: "Benachrichtigungsregeln konfigurieren" },
    { command: "baseline_reset", description: "Gespeicherten Ausgangsbestand zurücksetzen" },
    { command: "help", description: "Befehlsübersicht anzeigen" },
  ];

  async function telegramApi(token, method, payload, signal = null) {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: telegramRequestSignal(signal, lifecycleController.signal),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      throw new Error(`Telegram ${method}: HTTP ${response.status}${data?.description ? ` – ${data.description}` : ""}`);
    }
    return data.result;
  }

  async function send(chatId, text, replyMarkup = null) {
    const { botToken } = getCredentials();
    if (!botToken) return;
    await telegramApi(botToken, "sendMessage", {
      chat_id: chatId,
      text: truncateTelegramHtml(text),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  }

  async function answerCallback(callbackQueryId, text = null) {
    const { botToken } = getCredentials();
    if (!botToken) return;
    await telegramApi(botToken, "answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {}),
    });
  }

  function authorized(chatId) {
    return String(chatId) === String(getCredentials().chatId);
  }

  function helpText() {
    return [
      "<b>Rossmann Store Tracker</b>",
      "",
      "/status – kompakter Laufstatus",
      "/results – letzte Einzelergebnisse",
      "/logs [Anzahl] – letzte 1–50 Logzeilen",
      "/check – sofort prüfen",
      "/pause · /resume – Automatik steuern",
      "/settings – Konfiguration anzeigen",
      "/interval &lt;Minuten&gt;",
      "/delay &lt;Mindest-ms&gt; [Jitter-ms]",
      "/startup &lt;on|off&gt;",
      "/notify [Regel] [on|off]",
      "/stores · /store_add &lt;PLZ&gt; · /store_remove [ID|area:PLZ]",
      "/products · /catalog",
      "/product_add [DAN …] · /product_remove [DAN …]",
      "/baseline_reset [all|DAN] [Filial-ID]",
      "",
      "Bot-Token und Chat-ID lassen sich absichtlich nur in der lokalen Weboberfläche ändern.",
    ].join("\n");
  }

  function statusText() {
    const status = getStatus();
    const paused = status.configuration.trackingPaused;
    const mode = paused
      ? "⏸ <b>Pausiert</b>"
      : status.running ? "🔄 <b>Prüfung läuft</b>" : "🟢 <b>Bereit</b>";
    const areaCount = (status.configuration.searchAreas || []).length;
    const storeCount = status.configuration.stores.length;
    const productCount = status.configuration.products.length;
    const coverage = [
      areaCount ? `${areaCount} ${areaCount === 1 ? "Suchgebiet" : "Suchgebiete"}` : null,
      storeCount ? `${storeCount} ${storeCount === 1 ? "einzelne Filiale" : "einzelne Filialen"}` : null,
      `${productCount} ${productCount === 1 ? "Produkt" : "Produkte"}`,
    ].filter(Boolean).join(" · ");
    const lines = [
      "<b>📡 Rossmann Store Tracker</b>",
      mode,
      `Letzter Check: ${escapeHtml(formatDateTime(status.lastRunFinishedAt))}`,
      `Nächster Check: ${paused ? "nach dem Fortsetzen" : escapeHtml(formatDateTime(status.nextRunAt))}`,
      `Überwacht: ${coverage}`,
    ];
    if (status.results.length) {
      lines.push("", formatRunResults({
        title: "<b>Letzter Prüflauf</b>",
        results: status.results,
        products: status.configuration.products,
        stores: status.configuration.stores,
      }));
    } else {
      lines.push("", "⏳ Noch kein Prüflauf abgeschlossen");
    }
    if (status.lastError) {
      lines.push("", "<b>⚠️ Letzter Systemfehler</b>", escapeHtml(status.lastError));
    }
    return lines.join("\n");
  }

  function resultsText() {
    const status = getStatus();
    if (!status.results.length) return "Noch keine Prüfergebnisse vorhanden.";
    return formatRunResults({
      title: "<b>📋 Letzte Einzelergebnisse</b>",
      results: status.results,
      products: status.configuration.products,
      stores: status.configuration.stores,
      detailed: true,
    });
  }

  function settingsText() {
    const { config } = getSettings();
    const notification = config.notifications || {};
    const yesNo = (value) => value ? "an" : "aus";
    return [
      "<b>Konfiguration</b>",
      `Tracking: <b>${config.trackingPaused ? "pausiert" : "aktiv"}</b>`,
      `Intervall: ${config.pollIntervalMinutes} min`,
      `Pause/Jitter: ${config.requestDelayMs}/${config.jitterMs} ms`,
      `Startprüfung: ${yesNo(config.checkOnStart)}`,
      "",
      "<b>Benachrichtigungen</b>",
      `initial: ${yesNo(notification.notifyOnInitialStock)}`,
      `manual: ${yesNo(notification.notifyOnManualCheck)}`,
      `restock: ${yesNo(notification.onRestock)}`,
      `out: ${yesNo(notification.onOutOfStock)}`,
      `stock: ${yesNo(notification.onStockChange)}`,
      `availability: ${yesNo(notification.onAvailabilityChange)}`,
    ].join("\n");
  }

  function storesText() {
    const { searchAreas = [], stores = [] } = getSettings().config;
    if (!searchAreas.length && !stores.length) return "Es sind keine Suchgebiete oder Filialen konfiguriert.";
    return [
      "<b>Suchgebiete &amp; Filialen</b>",
      ...searchAreas.map((area) => `• 🌐 PLZ <code>${escapeHtml(area.postcode)}</code> · alle Filialen im Umkreis`),
      ...stores.map((store) => `• 📍 ${escapeHtml(store.city)} – ${escapeHtml(store.street)} (${escapeHtml(store.postcode)}) · ID <code>${escapeHtml(store.id)}</code>`),
    ].join("\n");
  }

  function productsText() {
    const products = getSettings().config.products;
    return products.length
      ? ["<b>Aktive Produkte</b>", ...products.map((product) => `• ${escapeHtml(product.name)} · <code>${escapeHtml(product.dan)}</code>`)].join("\n")
      : "Es sind keine Produkte aktiv.";
  }

  function catalogText() {
    const labels = { working: "✅", request_error: "⚠️", ean_only: "ℹ️" };
    return [
      "<b>Produktkatalog</b>",
      ...getSettings().catalog.map((product) => `• ${labels[product.status] || "•"} ${escapeHtml(product.name)} · ${product.dan ? `<code>${escapeHtml(product.dan)}</code>` : `EAN <code>${escapeHtml(product.ean)}</code>`}`),
    ].join("\n");
  }

  async function changeConfig(mutator, reason) {
    await updateConfig(mutator, { reason, restartActiveRun: true });
  }

  async function addProducts(chatId, requestedDans) {
    const catalog = getSettings().catalog;
    const uniqueDans = [...new Set(requestedDans.flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean))];
    const matches = uniqueDans.map((dan) => catalog.find((product) => product.dan === dan));
    const invalid = uniqueDans.filter((dan, index) => !isDan(dan) || !matches[index]);
    if (!uniqueDans.length || invalid.length) {
      throw new Error(invalid.length ? `Unbekannte DAN: ${invalid.join(", ")}` : "Mindestens eine DAN fehlt.");
    }
    await changeConfig((config) => {
      const existing = new Set(config.products.map((product) => String(product.dan)));
      return {
        ...config,
        products: [...config.products, ...matches.filter((product) => !existing.has(product.dan)).map(({ name, dan }) => ({ name, dan }))],
      };
    }, "Produktauswahl per Telegram geändert");
    await send(chatId, `✅ ${matches.length} Produkt${matches.length === 1 ? "" : "e"} verarbeitet.`);
  }

  async function removeProducts(chatId, requestedDans) {
    const dans = new Set(requestedDans.flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean));
    if (!dans.size) throw new Error("Mindestens eine DAN fehlt.");
    const before = getSettings().config.products.length;
    await changeConfig((config) => ({
      ...config,
      products: config.products.filter((product) => !dans.has(String(product.dan))),
    }), "Produktauswahl per Telegram geändert");
    const removed = before - getSettings().config.products.length;
    await send(chatId, `✅ ${removed} Produkt${removed === 1 ? "" : "e"} entfernt.`);
  }

  async function handleCallback(query) {
    const chatId = query.message?.chat?.id;
    if (!authorized(chatId)) {
      log("Nicht autorisierte Telegram-Callback-Anfrage ignoriert.", { chatId }, "warn");
      await answerCallback(query.id, "Nicht autorisiert").catch(() => {});
      return;
    }
    await answerCallback(query.id);
    const callbackParts = String(query.data || "").split(":");
    const [scope, action, first, second] = callbackParts;
    if (scope === "product" && action === "add") {
      if (callbackParts.length !== 3 || !isDan(first)) throw new Error("Diese Telegram-Aktion ist nicht mehr gültig.");
      await addProducts(chatId, [first]);
      return;
    }
    if (scope === "product" && action === "remove") {
      if (callbackParts.length !== 3 || !isDan(first)) throw new Error("Diese Telegram-Aktion ist nicht mehr gültig.");
      await removeProducts(chatId, [first]);
      return;
    }
    if (scope === "store" && action === "add") {
      if (callbackParts.length !== 3 || !isStoreId(first)) throw new Error("Diese Telegram-Aktion ist nicht mehr gültig.");
      const store = storeCandidates.get(first);
      if (!store) throw new Error("Die Filialauswahl ist abgelaufen. Bitte /store_add erneut ausführen.");
      await changeConfig((config) => ({
        ...config,
        stores: config.stores.some((item) => String(item.id) === String(store.id))
          ? config.stores
          : [...config.stores, store],
      }), "Filialauswahl per Telegram geändert");
      await send(chatId, `✅ ${escapeHtml(store.city)} – ${escapeHtml(store.street)} hinzugefügt.`);
      return;
    }
    if (scope === "area" && action === "add") {
      if (callbackParts.length !== 3 || !isPostcode(first)) throw new Error("Diese Telegram-Aktion ist nicht mehr gültig.");
      const candidates = storeSearchCandidates.get(first);
      if (!candidates) throw new Error("Die Filialauswahl ist abgelaufen. Bitte /store_add erneut ausführen.");
      const coveredIds = new Set(candidates.map((store) => String(store.id)));
      await changeConfig((config) => ({
        ...config,
        searchAreas: (config.searchAreas || []).some((area) => area.postcode === first)
          ? config.searchAreas
          : [...(config.searchAreas || []), { postcode: first }],
        stores: config.stores.filter((store) => !coveredIds.has(String(store.id))),
      }), "PLZ-Suchgebiet per Telegram geändert");
      await send(chatId, `✅ PLZ ${escapeHtml(first)} überwacht jetzt alle von Rossmann zurückgegebenen Filialen im Umkreis.`);
      return;
    }
    if (scope === "store" && action === "remove") {
      if (callbackParts.length !== 3 || !isStoreId(first)) throw new Error("Diese Telegram-Aktion ist nicht mehr gültig.");
      await changeConfig((config) => ({
        ...config,
        stores: config.stores.filter((store) => String(store.id) !== String(first)),
      }), "Filialauswahl per Telegram geändert");
      await send(chatId, `✅ Filiale ${escapeHtml(first)} entfernt.`);
      return;
    }
    if (scope === "area" && action === "remove") {
      if (callbackParts.length !== 3 || !isPostcode(first)) throw new Error("Diese Telegram-Aktion ist nicht mehr gültig.");
      await changeConfig((config) => ({
        ...config,
        searchAreas: (config.searchAreas || []).filter((area) => area.postcode !== first),
      }), "PLZ-Suchgebiet per Telegram geändert");
      await send(chatId, `✅ Suchgebiet PLZ ${escapeHtml(first)} entfernt.`);
      return;
    }
    if (scope === "baseline" && action === "reset") {
      if (callbackParts.length !== 4 || (first !== "all" && !isDan(first))) throw new Error("Diese Telegram-Aktion ist nicht mehr gültig.");
      if (second !== "all" && !isStoreId(second)) throw new Error("Diese Telegram-Aktion ist nicht mehr gültig.");
      const result = await resetBaseline({
        dan: first === "all" ? null : first,
        storeId: second === "all" ? null : second,
      });
      await send(chatId, `✅ ${result.removed} gespeicherte${result.removed === 1 ? "r" : ""} Ausgangswert${result.removed === 1 ? "" : "e"} entfernt. Der nächste erfolgreiche Check gilt wieder als erster.`);
      return;
    }
    if (scope === "baseline" && action === "cancel") {
      await send(chatId, "Baseline-Reset abgebrochen.");
      return;
    }
    throw new Error("Diese Telegram-Aktion ist nicht mehr gültig.");
  }

  async function handleCommand(message) {
    const chatId = message.chat?.id;
    if (!authorized(chatId)) {
      log("Nicht autorisierter Telegram-Befehl ignoriert.", { chatId }, "warn");
      return;
    }
    const { command, args } = commandParts(message.text);
    log("Telegram-Befehl empfangen.", { command, chatId });

    if (["/start", "/help"].includes(command)) {
      await send(chatId, helpText());
      return;
    }
    if (command === "/status") {
      await send(chatId, statusText());
      return;
    }
    if (command === "/results") {
      await send(chatId, resultsText());
      return;
    }
    if (command === "/settings") {
      await send(chatId, settingsText());
      return;
    }
    if (command === "/logs") {
      const limit = Math.min(50, Math.max(1, Number.parseInt(args[0] || "15", 10) || 15));
      const entries = getLogs(limit);
      const text = entries.length
        ? ["<b>Letzte Logs</b>", ...entries.map((entry) => `<code>${escapeHtml(`${new Date(entry.timestamp).toLocaleTimeString("de-DE")} ${entry.level.toUpperCase()} ${entry.message}${entry.details ? ` ${JSON.stringify(entry.details)}` : ""}`)}</code>`)].join("\n")
        : "Noch keine Logmeldungen vorhanden.";
      await send(chatId, text);
      return;
    }
    if (command === "/check") {
      const result = triggerCheck();
      await send(chatId, result.accepted ? "✅ Bestandsprüfung gestartet." : `⚠️ ${escapeHtml(result.reason)}`);
      return;
    }
    if (["/pause", "/resume"].includes(command)) {
      const paused = command === "/pause";
      await updateConfig((config) => ({ ...config, trackingPaused: paused }), {
        reason: paused ? "Tracking per Telegram pausiert" : "Tracking per Telegram fortgesetzt",
        restartActiveRun: !paused,
      });
      await send(chatId, paused ? "⏸ Automatisches Tracking pausiert." : "▶️ Automatisches Tracking fortgesetzt.");
      return;
    }
    if (command === "/interval") {
      const minutes = Number(args[0]);
      if (!Number.isInteger(minutes) || minutes < MIN_POLL_INTERVAL_MINUTES) {
        throw new Error(`Verwendung: /interval <Minuten ab ${MIN_POLL_INTERVAL_MINUTES}>`);
      }
      await changeConfig((config) => ({ ...config, pollIntervalMinutes: minutes }), "Prüfintervall per Telegram geändert");
      await send(chatId, `✅ Prüfintervall auf ${minutes} Minuten gesetzt.`);
      return;
    }
    if (command === "/delay") {
      const requestDelayMs = Number(args[0]);
      const jitterMs = args[1] === undefined ? getSettings().config.jitterMs : Number(args[1]);
      if (!Number.isInteger(requestDelayMs) || requestDelayMs < MIN_REQUEST_DELAY_MS || !Number.isInteger(jitterMs) || jitterMs < MIN_JITTER_MS) {
        throw new Error(`Verwendung: /delay <Mindest-ms ab ${MIN_REQUEST_DELAY_MS}> [Jitter-ms ab ${MIN_JITTER_MS}]`);
      }
      await changeConfig((config) => ({ ...config, requestDelayMs, jitterMs }), "Request-Pausen per Telegram geändert");
      await send(chatId, `✅ Request-Pause/Jitter auf ${requestDelayMs}/${jitterMs} ms gesetzt.`);
      return;
    }
    if (command === "/startup") {
      const enabled = parseSwitch(args[0]);
      if (enabled === null) throw new Error("Verwendung: /startup <on|off>");
      await changeConfig((config) => ({ ...config, checkOnStart: enabled }), "Startprüfung per Telegram geändert");
      await send(chatId, `✅ Startprüfung ${enabled ? "aktiviert" : "deaktiviert"}.`);
      return;
    }
    if (command === "/notify") {
      const ruleMap = {
        initial: "notifyOnInitialStock",
        manual: "notifyOnManualCheck",
        restock: "onRestock",
        out: "onOutOfStock",
        stock: "onStockChange",
        availability: "onAvailabilityChange",
      };
      if (!args.length) {
        await send(chatId, `${settingsText()}\n\nRegeln: <code>${Object.keys(ruleMap).join(" · ")}</code>`);
        return;
      }
      const key = ruleMap[String(args[0]).toLowerCase()];
      const enabled = parseSwitch(args[1]);
      if (!key || enabled === null) throw new Error("Verwendung: /notify <initial|manual|restock|out|stock|availability> <on|off>");
      await changeConfig((config) => ({
        ...config,
        notifications: { ...config.notifications, [key]: enabled },
      }), "Benachrichtigungsregel per Telegram geändert");
      await send(chatId, `✅ Regel ${escapeHtml(args[0])} ${enabled ? "aktiviert" : "deaktiviert"}.`);
      return;
    }
    if (command === "/stores") {
      await send(chatId, storesText());
      return;
    }
    if (command === "/store_add") {
      const postcode = String(args[0] || "");
      if (!isPostcode(postcode)) throw new Error("Verwendung: /store_add <fünfstellige PLZ>");
      const stores = await lookupStores(postcode);
      const selectableStores = stores.filter((store) => isStoreId(store.id));
      for (const store of selectableStores) storeCandidates.set(String(store.id), store);
      storeSearchCandidates.set(postcode, selectableStores);
      const keyboard = [[{
        text: `🌐 Alle ${selectableStores.length} Filialen im Umkreis`,
        callback_data: `area:add:${postcode}`,
      }], ...selectableStores.slice(0, 12).map((store) => [{
        text: `${store.city} – ${store.street} (${store.postcode})`,
        callback_data: `store:add:${store.id}`,
      }])];
      await send(chatId, `<b>Überwachung für PLZ ${postcode}</b>\nStandardmäßig kannst du alle Treffer im Umkreis übernehmen oder gezielt nur eine Filiale auswählen.`, { inline_keyboard: keyboard });
      return;
    }
    if (command === "/store_remove") {
      if (args[0]) {
        const target = String(args[0]);
        if (target.startsWith("area:")) {
          const postcode = target.slice(5);
          if (!isPostcode(postcode)) throw new Error("Verwendung: /store_remove [Filial-ID|area:PLZ]");
          await changeConfig((config) => ({ ...config, searchAreas: (config.searchAreas || []).filter((area) => area.postcode !== postcode) }), "PLZ-Suchgebiet per Telegram geändert");
          await send(chatId, `✅ Suchgebiet PLZ ${escapeHtml(postcode)} entfernt.`);
        } else {
          if (!isStoreId(target)) throw new Error("Verwendung: /store_remove [Filial-ID|area:PLZ]");
          await changeConfig((config) => ({ ...config, stores: config.stores.filter((store) => String(store.id) !== target) }), "Filialauswahl per Telegram geändert");
          await send(chatId, `✅ Filiale ${escapeHtml(target)} entfernt.`);
        }
        return;
      }
      const { searchAreas = [], stores = [] } = getSettings().config;
      const keyboard = [
        ...searchAreas.filter((area) => isPostcode(area.postcode)).map((area) => [{ text: `❌ 🌐 Umkreis PLZ ${area.postcode}`, callback_data: `area:remove:${area.postcode}` }]),
        ...stores.filter((store) => isStoreId(store.id)).map((store) => [{ text: `❌ 📍 ${store.city} – ${store.street}`, callback_data: `store:remove:${store.id}` }]),
      ];
      await send(chatId, keyboard.length ? "<b>Zu entfernendes Suchgebiet oder Filiale auswählen</b>" : "Keine Suchgebiete oder Filialen konfiguriert.", keyboard.length ? { inline_keyboard: keyboard } : null);
      return;
    }
    if (command === "/products") {
      await send(chatId, productsText());
      return;
    }
    if (command === "/catalog") {
      await send(chatId, catalogText());
      return;
    }
    if (command === "/product_add") {
      if (args.length) {
        await addProducts(chatId, args);
        return;
      }
      const active = new Set(getSettings().config.products.map((product) => String(product.dan)));
      const available = getSettings().catalog.filter((product) => isDan(product.dan) && !active.has(String(product.dan)));
      const keyboard = available.map((product) => [{ text: `➕ ${product.name}`, callback_data: `product:add:${product.dan}` }]);
      await send(chatId, available.length ? "<b>Produkt hinzufügen</b>" : "Alle verfügbaren Katalogprodukte sind bereits aktiv.", available.length ? { inline_keyboard: keyboard } : null);
      return;
    }
    if (command === "/product_remove") {
      if (args.length) {
        await removeProducts(chatId, args);
        return;
      }
      const products = getSettings().config.products.filter((product) => isDan(product.dan));
      const keyboard = products.map((product) => [{ text: `❌ ${product.name}`, callback_data: `product:remove:${product.dan}` }]);
      await send(chatId, products.length ? "<b>Produkt entfernen</b>" : "Keine Produkte aktiv.", products.length ? { inline_keyboard: keyboard } : null);
      return;
    }
    if (command === "/baseline_reset") {
      const dan = args[0] && args[0] !== "all" ? args[0] : "all";
      const storeId = args[1] || "all";
      if (dan !== "all" && !isDan(dan)) throw new Error("Verwendung: /baseline_reset [all|DAN] [Filial-ID]");
      if (storeId !== "all" && !isStoreId(storeId)) throw new Error("Verwendung: /baseline_reset [all|DAN] [Filial-ID]");
      await send(chatId, `⚠️ Gespeicherte Ausgangswerte für DAN <code>${escapeHtml(dan)}</code> und Filiale <code>${escapeHtml(storeId)}</code> wirklich zurücksetzen?`, {
        inline_keyboard: [[
          { text: "Zurücksetzen", callback_data: `baseline:reset:${dan}:${storeId}` },
          { text: "Abbrechen", callback_data: "baseline:cancel:all:all" },
        ]],
      });
      return;
    }
    await send(chatId, `Unbekannter Befehl.\n\n${helpText()}`);
  }

  async function processUpdate(update) {
    try {
      if (update.callback_query) await handleCallback(update.callback_query);
      else if (update.message?.text?.startsWith("/")) await handleCommand(update.message);
    } catch (error) {
      if (error.name === "AbortError") return;
      const chatId = update.callback_query?.message?.chat?.id ?? update.message?.chat?.id;
      log("Telegram-Befehl fehlgeschlagen.", { error: error.message, chatId }, "error");
      if (authorized(chatId)) await send(chatId, `⚠️ ${escapeHtml(error.message)}`).catch(() => {});
    }
  }

  async function pollLoop() {
    let lastFailure = null;
    while (!stopped) {
      if (suspended) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      const credentials = getCredentials();
      if (!credentials.botToken || !credentials.chatId) {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        continue;
      }
      try {
        if (registeredToken !== credentials.botToken) {
          await telegramApi(credentials.botToken, "setMyCommands", { commands });
          registeredToken = credentials.botToken;
          log("Telegram-Slash-Commands registriert.", { commands: commands.length });
        }
        const controller = new AbortController();
        currentRequestController = controller;
        const batchGeneration = lifecycleGeneration;
        const timeout = setTimeout(() => controller.abort(), 35_000);
        let updates;
        try {
          updates = await telegramApi(credentials.botToken, "getUpdates", {
            offset,
            timeout: 25,
            allowed_updates: ["message", "callback_query"],
          }, controller.signal);
        } finally {
          clearTimeout(timeout);
          if (currentRequestController === controller) currentRequestController = null;
        }
        for (const update of updates || []) {
          if (stopped || suspended || lifecycleGeneration !== batchGeneration) break;
          await processUpdate(update);
          if (stopped || suspended || lifecycleGeneration !== batchGeneration) break;
          const nextOffset = Number(update.update_id) + 1;
          await saveOffset(nextOffset);
          if (stopped || suspended || lifecycleGeneration !== batchGeneration) break;
          offset = nextOffset;
        }
        lastFailure = null;
      } catch (error) {
        if (stopped) break;
        if (error.name !== "AbortError" && error.message !== lastFailure) {
          lastFailure = error.message;
          log("Telegram-Command-Polling fehlgeschlagen.", { error: error.message }, "error");
        }
        await new Promise((resolve) => setTimeout(resolve, error.name === "AbortError" ? 250 : 5_000));
      }
    }
  }

  return {
    async start() {
      if (!stopped) return;
      stopped = false;
      if (lifecycleController.signal.aborted) lifecycleController = new AbortController();
      offset = Math.max(0, Number(await loadOffset()) || 0);
      pollPromise = pollLoop();
    },
    async stop() {
      stopped = true;
      abortActiveRequests({ renew: false });
      await pollPromise?.catch(() => {});
      pollPromise = null;
    },
    wake(nextOffset = null) {
      if (nextOffset !== null && nextOffset !== undefined) {
        offset = Math.max(0, Number(nextOffset) || 0);
      }
      registeredToken = null;
      abortActiveRequests();
    },
    suspend(nextOffset = null) {
      const previousOffset = offset;
      suspended = true;
      if (nextOffset !== null && nextOffset !== undefined) {
        offset = Math.max(0, Number(nextOffset) || 0);
      }
      abortActiveRequests();
      return previousOffset;
    },
    resume(nextOffset = null) {
      if (nextOffset !== null && nextOffset !== undefined) {
        offset = Math.max(0, Number(nextOffset) || 0);
      }
      suspended = false;
      registeredToken = null;
      abortActiveRequests();
    },
  };
}
