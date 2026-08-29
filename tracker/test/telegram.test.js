import test from "node:test";
import assert from "node:assert/strict";
import { createBoundedTtlCache, createTelegramBot, truncateTelegramHtml } from "../src/telegram.js";

const waitFor = async (predicate, timeoutMs = 1_000) => {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("Test-Timeout");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

test("kürzt Telegram-HTML ohne Tags oder Entities zu beschädigen", () => {
  const shortened = truncateTelegramHtml(`<b>Titel</b>\n<code>${"&amp;&lt;&gt;".repeat(600)}</code>`);
  assert.ok(shortened.length <= 3_900);
  assert.match(shortened, /… gekürzt$/);
  assert.equal((shortened.match(/<code>/g) || []).length, (shortened.match(/<\/code>/g) || []).length);
  assert.equal((shortened.match(/<b>/g) || []).length, (shortened.match(/<\/b>/g) || []).length);
  assert.doesNotMatch(shortened.replaceAll(/&(?:amp|lt|gt);/g, ""), /&/);
});

test("begrenzt und verwirft temporäre Telegram-Filialkandidaten", () => {
  let timestamp = 1_000;
  const cache = createBoundedTtlCache({ maxSize: 2, ttlMs: 100, now: () => timestamp });
  cache.set("a", 1);
  cache.set("b", 2);
  assert.equal(cache.get("a"), 1);
  cache.set("c", 3);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.size, 2);
  timestamp += 101;
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("c"), undefined);
  assert.equal(cache.size, 0);
});

test("bricht ausgehende Telegram-Aufrufe beim Stoppen sofort ab", async () => {
  const originalFetch = globalThis.fetch;
  let updateDelivered = false;
  let sendSignal = null;
  let checksTriggered = 0;
  const savedOffsets = [];
  globalThis.fetch = async (url, options) => {
    const method = new URL(url).pathname.split("/").at(-1);
    if (method === "getUpdates" && !updateDelivered) {
      updateDelivered = true;
      return new Response(JSON.stringify({
        ok: true,
        result: [
          { update_id: 1, message: { chat: { id: 123 }, text: "/status" } },
          { update_id: 2, message: { chat: { id: 123 }, text: "/check" } },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (method === "sendMessage") {
      sendSignal = options.signal;
      return new Promise((_resolve, reject) => {
        const abort = () => reject(new DOMException("aborted", "AbortError"));
        if (options.signal?.aborted) abort();
        else options.signal?.addEventListener("abort", abort, { once: true });
      });
    }
    return new Response(JSON.stringify({ ok: true, result: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const bot = createTelegramBot({
    getCredentials: () => ({ botToken: "token", chatId: "123" }),
    getStatus: () => ({
      running: false,
      lastRunFinishedAt: null,
      nextRunAt: null,
      lastError: null,
      results: [],
      configuration: { trackingPaused: false, searchAreas: [], stores: [], products: [] },
    }),
    getLogs: () => [],
    getSettings: () => ({ config: { stores: [], products: [] }, catalog: [] }),
    updateConfig: async () => {},
    triggerCheck: () => { checksTriggered += 1; return { accepted: true }; },
    lookupStores: async () => [],
    resetBaseline: async () => ({ removed: 0 }),
    loadOffset: async () => 0,
    saveOffset: async (value) => { savedOffsets.push(value); },
    log: () => {},
  });

  try {
    await bot.start();
    await waitFor(() => sendSignal !== null);
    await Promise.race([
      bot.stop(),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error("Stop-Timeout")), 250)),
    ]);
    assert.equal(sendSignal.aborted, true);
    assert.equal(checksTriggered, 0);
    assert.deepEqual(savedOffsets, []);
  } finally {
    await bot.stop();
    globalThis.fetch = originalFetch;
  }
});

test("verarbeitet autorisierte Slash-Commands und registriert die Befehlsliste", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let updateDelivered = false;
  globalThis.fetch = async (url, options) => {
    const method = new URL(url).pathname.split("/").at(-1);
    const body = JSON.parse(options.body);
    calls.push({ method, body, signal: options.signal });
    if (method === "getUpdates" && !updateDelivered) {
      updateDelivered = true;
      return new Response(JSON.stringify({
        ok: true,
        result: [{ update_id: 41, message: { chat: { id: 123 }, text: "/status" } }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (method === "getUpdates") {
      return new Promise((_resolve, reject) => {
        const abort = () => reject(new DOMException("aborted", "AbortError"));
        if (options.signal?.aborted) abort();
        else options.signal?.addEventListener("abort", abort, { once: true });
      });
    }
    return new Response(JSON.stringify({ ok: true, result: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  let savedOffset = 0;
  const bot = createTelegramBot({
    getCredentials: () => ({ botToken: "token", chatId: "123" }),
    getStatus: () => ({
      running: false,
      lastRunFinishedAt: null,
      nextRunAt: null,
      lastError: null,
      results: [
        { status: "ok", storeId: "1001", dan: "228940", stock: 0, available: true },
        { status: "ok", storeId: "1001", dan: "150727", stock: 2, available: true },
        { status: "error", storeId: "1001", dan: "213986", error: "HTTP 406 – keine Bestandsantwort für diese DAN." },
      ],
      configuration: {
        trackingPaused: false,
        searchAreas: [{ postcode: "12345" }],
        stores: [{ id: "1001", city: "Musterstadt", street: "Teststraße 1" }],
        products: [
          { dan: "228940", name: "Pin-Kollektion" },
          { dan: "150727", name: "Pokémon ex-Kampfdeck" },
          { dan: "213986", name: "Prismatische Entwicklungen Boosterbundle" },
        ],
      },
    }),
    getLogs: () => [],
    getSettings: () => ({ config: { stores: [], products: [], notifications: {} }, catalog: [] }),
    updateConfig: async () => {},
    triggerCheck: () => ({ accepted: true }),
    lookupStores: async () => [],
    resetBaseline: async () => ({ removed: 0 }),
    loadOffset: async () => 0,
    saveOffset: async (value) => { savedOffset = value; },
    log: () => {},
  });

  try {
    await bot.start();
    await waitFor(() => calls.some((call) => call.method === "sendMessage") && savedOffset === 42);
    const registration = calls.find((call) => call.method === "setMyCommands");
    assert.ok(registration);
    assert.ok(calls.every((call) => call.signal instanceof AbortSignal));
    assert.ok(registration.body.commands.some((item) => item.command === "baseline_reset"));
    assert.ok(registration.body.commands.some((item) => item.command === "results"));
    assert.ok(!registration.body.commands.some((item) => item.command.includes("token")));
    const sent = calls.find((call) => call.method === "sendMessage");
    assert.match(sent.body.text, /📡 Rossmann Store Tracker/);
    assert.match(sent.body.text, /1 Suchgebiet · 1 einzelne Filiale · 3 Produkte/);
    assert.match(sent.body.text, /✅ 2 erfolgreich · ⚠️ 1 fehlgeschlagen/);
    assert.match(sent.body.text, /📭 Kein Bestand in 1 Filialprüfung/);
    assert.match(sent.body.text, /Pokémon ex-Kampfdeck: <b>2 Stück<\/b>/);
    assert.doesNotMatch(sent.body.text, /Pin-Kollektion · Musterstadt/);
    assert.match(sent.body.text, /Filialprüfung\n\n<b>⚠️ Fehler \(1\)<\/b>/);
    assert.equal(savedOffset, 42);
  } finally {
    await bot.stop();
    globalThis.fetch = originalFetch;
  }
});

test("ignoriert Befehle aus einer fremden Chat-ID", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let updateDelivered = false;
  globalThis.fetch = async (url, options) => {
    const method = new URL(url).pathname.split("/").at(-1);
    calls.push(method);
    if (method === "getUpdates" && !updateDelivered) {
      updateDelivered = true;
      return new Response(JSON.stringify({
        ok: true,
        result: [{ update_id: 7, message: { chat: { id: 999 }, text: "/status" } }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (method === "getUpdates") {
      return new Promise((_resolve, reject) => {
        const abort = () => reject(new DOMException("aborted", "AbortError"));
        if (options.signal?.aborted) abort();
        else options.signal?.addEventListener("abort", abort, { once: true });
      });
    }
    return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 });
  };

  let offset = 0;
  const bot = createTelegramBot({
    getCredentials: () => ({ botToken: "token", chatId: "123" }),
    getStatus: () => ({}),
    getLogs: () => [],
    getSettings: () => ({ config: { stores: [], products: [] }, catalog: [] }),
    updateConfig: async () => {},
    triggerCheck: () => ({ accepted: true }),
    lookupStores: async () => [],
    resetBaseline: async () => ({ removed: 0 }),
    loadOffset: async () => 0,
    saveOffset: async (value) => { offset = value; },
    log: () => {},
  });

  try {
    await bot.start();
    await waitFor(() => offset === 8);
    assert.equal(calls.filter((method) => method === "sendMessage").length, 0);
  } finally {
    await bot.stop();
    globalThis.fetch = originalFetch;
  }
});

test("validiert Filial-IDs vor dem Aufbau eines Baseline-Reset-Callbacks", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let updateDelivered = false;
  globalThis.fetch = async (url, options) => {
    const method = new URL(url).pathname.split("/").at(-1);
    const body = JSON.parse(options.body);
    calls.push({ method, body });
    if (method === "getUpdates" && !updateDelivered) {
      updateDelivered = true;
      return new Response(JSON.stringify({
        ok: true,
        result: [
          { update_id: 100, message: { chat: { id: 123 }, text: "/baseline_reset all :" } },
          { update_id: 101, message: { chat: { id: 123 }, text: "/baseline_reset 228940 1001" } },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (method === "getUpdates") {
      return new Promise((_resolve, reject) => {
        const abort = () => reject(new DOMException("aborted", "AbortError"));
        if (options.signal?.aborted) abort();
        else options.signal?.addEventListener("abort", abort, { once: true });
      });
    }
    return new Response(JSON.stringify({ ok: true, result: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  let offset = 0;
  const bot = createTelegramBot({
    getCredentials: () => ({ botToken: "token", chatId: "123" }),
    getStatus: () => ({}),
    getLogs: () => [],
    getSettings: () => ({ config: { stores: [], products: [] }, catalog: [] }),
    updateConfig: async () => {},
    triggerCheck: () => ({ accepted: true }),
    lookupStores: async () => [],
    resetBaseline: async () => ({ removed: 0 }),
    loadOffset: async () => 0,
    saveOffset: async (value) => { offset = value; },
    log: () => {},
  });

  try {
    await bot.start();
    await waitFor(() => offset === 102);
    const messages = calls.filter((call) => call.method === "sendMessage").map((call) => call.body);
    assert.equal(messages.length, 2);
    assert.match(messages[0].text, /Verwendung: \/baseline_reset/);
    assert.equal(messages[0].reply_markup, undefined);
    assert.equal(messages[1].reply_markup.inline_keyboard[0][0].callback_data, "baseline:reset:228940:1001");
  } finally {
    await bot.stop();
    globalThis.fetch = originalFetch;
  }
});

test("escaped gespeicherte Werte und erzeugt nur validierte Callback-Daten", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let updateDelivered = false;
  globalThis.fetch = async (url, options) => {
    const method = new URL(url).pathname.split("/").at(-1);
    const body = JSON.parse(options.body);
    calls.push({ method, body });
    if (method === "getUpdates" && !updateDelivered) {
      updateDelivered = true;
      return new Response(JSON.stringify({
        ok: true,
        result: [
          { update_id: 200, message: { chat: { id: 123 }, text: "/stores" } },
          { update_id: 201, message: { chat: { id: 123 }, text: "/products" } },
          { update_id: 202, message: { chat: { id: 123 }, text: "/catalog" } },
          { update_id: 203, message: { chat: { id: 123 }, text: "/product_add" } },
          { update_id: 204, message: { chat: { id: 123 }, text: "/store_remove" } },
          { update_id: 205, callback_query: { id: "invalid", data: "product:add:228940:extra", message: { chat: { id: 123 } } } },
          { update_id: 206, message: { chat: { id: 123 }, text: "/store_remove area:" } },
          { update_id: 207, message: { chat: { id: 123 }, text: "/store_remove keine-id" } },
          { update_id: 208, callback_query: { id: "expired-area", data: "area:add:54321", message: { chat: { id: 123 } } } },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (method === "getUpdates") {
      return new Promise((_resolve, reject) => {
        const abort = () => reject(new DOMException("aborted", "AbortError"));
        if (options.signal?.aborted) abort();
        else options.signal?.addEventListener("abort", abort, { once: true });
      });
    }
    return new Response(JSON.stringify({ ok: true, result: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  let offset = 0;
  const settings = {
    config: {
      searchAreas: [{ postcode: "12345" }, { postcode: "<zip>" }],
      stores: [
        { id: "1001", city: "Musterstadt", street: "Teststraße 1", postcode: "12345" },
        { id: "<id>", city: "<City>", street: "A&B", postcode: "<zip>" },
      ],
      products: [{ dan: "<dan>", name: "<Produkt>" }],
    },
    catalog: [
      { dan: "228940", name: "Gültig", status: "working" },
      { dan: "<bad>", name: "Ungültige DAN", status: "working" },
      { ean: "<ean>", name: "Nur EAN", status: "ean_only" },
    ],
  };
  const bot = createTelegramBot({
    getCredentials: () => ({ botToken: "token", chatId: "123" }),
    getStatus: () => ({}),
    getLogs: () => [],
    getSettings: () => settings,
    updateConfig: async () => {},
    triggerCheck: () => ({ accepted: true }),
    lookupStores: async () => [],
    resetBaseline: async () => ({ removed: 0 }),
    loadOffset: async () => 0,
    saveOffset: async (value) => { offset = value; },
    log: () => {},
  });

  try {
    await bot.start();
    await waitFor(() => offset === 209);
    const messages = calls.filter((call) => call.method === "sendMessage").map((call) => call.body);
    assert.equal(messages.length, 9);
    assert.match(messages[0].text, /&lt;City&gt;.*A&amp;B.*&lt;zip&gt;.*&lt;id&gt;/);
    assert.match(messages[1].text, /&lt;Produkt&gt;.*<code>&lt;dan&gt;<\/code>/);
    assert.match(messages[2].text, /<code>&lt;bad&gt;<\/code>.*<code>&lt;ean&gt;<\/code>/s);
    assert.deepEqual(messages[3].reply_markup.inline_keyboard.flat().map((item) => item.callback_data), ["product:add:228940"]);
    assert.deepEqual(messages[4].reply_markup.inline_keyboard.flat().map((item) => item.callback_data), ["area:remove:12345", "store:remove:1001"]);
    assert.match(messages[5].text, /Diese Telegram-Aktion ist nicht mehr gültig/);
    assert.match(messages[6].text, /Verwendung: \/store_remove/);
    assert.match(messages[7].text, /Verwendung: \/store_remove/);
    assert.match(messages[8].text, /Filialauswahl ist abgelaufen/);
  } finally {
    await bot.stop();
    globalThis.fetch = originalFetch;
  }
});
