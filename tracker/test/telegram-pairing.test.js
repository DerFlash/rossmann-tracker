import test from "node:test";
import assert from "node:assert/strict";
import { createTelegramPairingManager } from "../src/telegram-pairing.js";

const waitFor = async (predicate, timeoutMs = 1_000) => {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("Test-Timeout");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

test("validiert den Bot und übernimmt die Chat-ID aus dem einmaligen Start-Link", async () => {
  const calls = [];
  let pairingNonce = null;
  let delivered = false;
  let paired = null;
  const fetchImpl = async (url, options) => {
    const method = new URL(url).pathname.split("/").at(-1);
    const body = JSON.parse(options.body);
    calls.push({ method, body, signal: options.signal });
    if (method === "getMe") return Response.json({ ok: true, result: { id: 5, is_bot: true, first_name: "DAN Bot", username: "dan_test_bot" } });
    if (method === "getWebhookInfo") return Response.json({ ok: true, result: { url: "" } });
    if (method === "getUpdates" && body.timeout === 0) return Response.json({ ok: true, result: [] });
    if (method === "getUpdates" && !pairingNonce) return Response.json({ ok: true, result: [] });
    if (method === "getUpdates" && !delivered && pairingNonce) {
      delivered = true;
      return Response.json({ ok: true, result: [{ update_id: 8, message: { chat: { id: 123 }, text: `/start ${pairingNonce}` } }] });
    }
    if (method === "getUpdates") {
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    }
    return Response.json({ ok: true, result: true });
  };
  const manager = createTelegramPairingManager({
    fetchImpl,
    onPaired: async (value) => { paired = value; },
  });

  const started = await manager.start("secret-token");
  pairingNonce = new URL(started.telegramUrl).searchParams.get("start");
  await waitFor(() => manager.status().status === "connected");

  assert.equal(paired.chatId, "123");
  assert.equal(paired.botUsername, "dan_test_bot");
  assert.equal(paired.offset, 9);
  assert.ok(calls.some((call) => call.method === "sendMessage"));
  assert.ok(calls.every((call) => call.signal instanceof AbortSignal));
  assert.doesNotMatch(JSON.stringify(manager.status()), /secret-token/);
});

test("lehnt Bots mit bestehendem Webhook verständlich ab", async () => {
  const manager = createTelegramPairingManager({
    fetchImpl: async (url) => {
      const method = new URL(url).pathname.split("/").at(-1);
      if (method === "getMe") return Response.json({ ok: true, result: { id: 5, is_bot: true, first_name: "Bot", username: "used_bot" } });
      return Response.json({ ok: true, result: { url: "https://example.test/hook" } });
    },
    onPaired: async () => {},
  });
  await assert.rejects(() => manager.start("secret-token"), /Webhook/);
});

test("serialisiert überlappende Kopplungen und lässt alte Polls nicht die neue Session abschließen", async () => {
  let firstNonce = null;
  let secondNonce = null;
  let firstDelivered = false;
  let secondDelivered = false;
  let releaseFirstTransition;
  let firstTransitionStarted;
  let firstTransitionSignal = null;
  const firstTransitionStartedPromise = new Promise((resolve) => { firstTransitionStarted = resolve; });
  const firstTransitionGate = new Promise((resolve) => { releaseFirstTransition = resolve; });
  const pairedTokens = [];
  const sentByTokens = [];
  const validationTokens = [];

  const fetchImpl = async (url, options) => {
    const parsed = new URL(url);
    const token = parsed.pathname.match(/^\/bot([^/]+)\//)?.[1];
    const method = parsed.pathname.split("/").at(-1);
    const body = JSON.parse(options.body);
    if (method === "getMe") {
      validationTokens.push(token);
      return Response.json({ ok: true, result: {
        id: token === "token-one" ? 1 : 2,
        is_bot: true,
        first_name: token,
        username: `${token.replace("-", "_")}_bot`,
      } });
    }
    if (method === "getWebhookInfo") return Response.json({ ok: true, result: { url: "" } });
    if (method === "getUpdates" && body.timeout === 0) return Response.json({ ok: true, result: [] });
    if (method === "getUpdates" && token === "token-one" && firstNonce && !firstDelivered) {
      firstDelivered = true;
      return Response.json({ ok: true, result: [{ update_id: 10, message: { chat: { id: 111 }, text: `/start ${firstNonce}` } }] });
    }
    if (method === "getUpdates" && token === "token-two" && secondNonce && !secondDelivered) {
      secondDelivered = true;
      return Response.json({ ok: true, result: [{ update_id: 20, message: { chat: { id: 222 }, text: `/start ${secondNonce}` } }] });
    }
    if (method === "getUpdates") {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return Response.json({ ok: true, result: [] });
    }
    if (method === "sendMessage") {
      sentByTokens.push(token);
      return Response.json({ ok: true, result: true });
    }
    throw new Error(`Unerwarteter Telegram-Aufruf: ${method}`);
  };

  const manager = createTelegramPairingManager({
    fetchImpl,
    onPaired: async ({ botToken, signal }) => {
      pairedTokens.push(botToken);
      if (botToken === "token-one") {
        firstTransitionSignal = signal;
        firstTransitionStarted();
        await firstTransitionGate;
      }
    },
  });

  const first = await manager.start("token-one");
  firstNonce = new URL(first.telegramUrl).searchParams.get("start");
  await firstTransitionStartedPromise;

  const secondStart = manager.start("token-two");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(validationTokens, ["token-one"]);
  assert.equal(firstTransitionSignal.aborted, true);

  releaseFirstTransition();
  const second = await secondStart;
  secondNonce = new URL(second.telegramUrl).searchParams.get("start");
  await waitFor(() => manager.status().status === "connected");

  assert.deepEqual(pairedTokens, ["token-one", "token-two"]);
  assert.deepEqual(sentByTokens, ["token-two"]);
  assert.equal(manager.status().bot.username, "token_two_bot");
  manager.cancel();
});

test("ignoriert eine alte Long-Poll-Antwort nach dem Start einer neuen Kopplung", async () => {
  let firstNonce = null;
  let resolveFirstPoll;
  let firstPollStarted;
  const firstPollStartedPromise = new Promise((resolve) => { firstPollStarted = resolve; });
  const firstPollResponse = new Promise((resolve) => { resolveFirstPoll = resolve; });
  const pairedTokens = [];

  const fetchImpl = async (url, options) => {
    const parsed = new URL(url);
    const token = parsed.pathname.match(/^\/bot([^/]+)\//)?.[1];
    const method = parsed.pathname.split("/").at(-1);
    const body = JSON.parse(options.body);
    if (method === "getMe") return Response.json({ ok: true, result: {
      id: token === "token-one" ? 1 : 2,
      is_bot: true,
      first_name: token,
      username: `${token.replace("-", "_")}_bot`,
    } });
    if (method === "getWebhookInfo") return Response.json({ ok: true, result: { url: "" } });
    if (method === "getUpdates" && body.timeout === 0) return Response.json({ ok: true, result: [] });
    if (method === "getUpdates" && token === "token-one") {
      firstPollStarted();
      return firstPollResponse;
    }
    if (method === "getUpdates") {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return Response.json({ ok: true, result: [] });
    }
    return Response.json({ ok: true, result: true });
  };

  const manager = createTelegramPairingManager({
    fetchImpl,
    onPaired: async ({ botToken }) => { pairedTokens.push(botToken); },
  });
  const first = await manager.start("token-one");
  firstNonce = new URL(first.telegramUrl).searchParams.get("start");
  await firstPollStartedPromise;

  const second = await manager.start("token-two");
  resolveFirstPoll(Response.json({ ok: true, result: [{
    update_id: 30,
    message: { chat: { id: 111 }, text: `/start ${firstNonce}` },
  }] }));
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(manager.status().status, "waiting");
  assert.equal(manager.status().bot.username, "token_two_bot");
  assert.equal(manager.status().telegramUrl, second.telegramUrl);
  assert.deepEqual(pairedTokens, []);
  manager.cancel();
});
