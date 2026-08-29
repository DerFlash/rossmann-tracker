import { randomBytes } from "node:crypto";

const DEFAULT_EXPIRY_MS = 5 * 60_000;
const TELEGRAM_REQUEST_TIMEOUT_MS = 30_000;

function telegramRequestSignal(signal) {
  const timeoutSignal = AbortSignal.timeout(TELEGRAM_REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

function startCommandMatches(text, nonce) {
  const match = String(text || "").trim().match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+([A-Za-z0-9_-]+))?$/);
  return match?.[1] === nonce;
}

export function createTelegramPairingManager({
  onPaired,
  log = () => {},
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  expiryMs = DEFAULT_EXPIRY_MS,
}) {
  let session = null;
  let controller = null;
  let generation = 0;
  let pairingTransitionQueue = Promise.resolve();

  async function telegramApi(token, method, payload = {}, signal = null) {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: telegramRequestSignal(signal),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      throw new Error(`Telegram ${method}: ${data?.description || `HTTP ${response.status}`}`);
    }
    return data.result;
  }

  function publicSession() {
    if (!session) return { status: "idle" };
    return {
      status: session.status,
      bot: session.bot,
      telegramUrl: session.telegramUrl,
      expiresAt: session.expiresAt,
      error: session.error || null,
    };
  }

  function cancel() {
    generation += 1;
    controller?.abort();
    controller = null;
    if (["waiting", "connecting"].includes(session?.status)) session = { ...session, status: "cancelled" };
  }

  async function poll(pairingId, token, nonce, initialOffset) {
    let offset = initialOffset;
    const localController = new AbortController();
    controller = localController;
    try {
      while (session?.id === pairingId && session.status === "waiting") {
        if (now() >= session.expiresAtMs) {
          session = { ...session, status: "expired", error: "Die Verbindung ist abgelaufen. Bitte erneut starten." };
          return;
        }
        const updates = await telegramApi(token, "getUpdates", {
          offset,
          timeout: 10,
          allowed_updates: ["message"],
        }, localController.signal);
        if (session?.id !== pairingId || localController.signal.aborted) return;
        for (const update of updates || []) {
          if (session?.id !== pairingId || localController.signal.aborted) return;
          offset = Number(update.update_id) + 1;
          const message = update.message;
          if (!startCommandMatches(message?.text, nonce)) continue;
          const chatId = message?.chat?.id;
          if (chatId === undefined || chatId === null) continue;
          const bot = session.bot;
          session = { ...session, status: "connecting" };
          const transition = pairingTransitionQueue.then(async () => {
            if (session?.id !== pairingId || localController.signal.aborted) return false;
            await onPaired({
              botToken: token,
              chatId: String(chatId),
              botName: bot.name,
              botUsername: bot.username,
              offset,
              signal: localController.signal,
            });
            return true;
          });
          pairingTransitionQueue = transition.catch(() => {});
          if (!await transition || session?.id !== pairingId || localController.signal.aborted) return;
          await telegramApi(token, "sendMessage", {
            chat_id: chatId,
            text: "✅ Rossmann Store Tracker verbunden. Die Einrichtung wird in der Weboberfläche fortgesetzt.",
          }, localController.signal);
          if (session?.id !== pairingId || localController.signal.aborted) return;
          session = { ...session, status: "connected", error: null };
          log("Telegram-Verbindung über das Web-Onboarding hergestellt.", {
            botUsername: bot.username,
          });
          return;
        }
      }
    } catch (error) {
      if (localController.signal.aborted) return;
      if (session?.id === pairingId) {
        session = { ...session, status: "error", error: error.message };
      }
      log("Telegram-Verbindung im Web-Onboarding fehlgeschlagen.", { error: error.message }, "error");
    } finally {
      if (controller === localController) controller = null;
    }
  }

  async function start(rawToken) {
    const token = String(rawToken || "").trim();
    if (!token) throw new Error("Bitte füge den Bot-Token von @BotFather ein.");
    cancel();
    const startGeneration = generation;
    await pairingTransitionQueue;
    const assertCurrent = () => {
      if (generation !== startGeneration) throw new Error("Diese Telegram-Kopplung wurde durch einen neueren Vorgang ersetzt.");
    };
    assertCurrent();

    const me = await telegramApi(token, "getMe");
    assertCurrent();
    if (!me?.is_bot || !me?.username) throw new Error("Der Token gehört nicht zu einem verwendbaren Telegram-Bot.");
    const webhook = await telegramApi(token, "getWebhookInfo");
    assertCurrent();
    if (webhook?.url) {
      throw new Error("Für diesen Bot ist bereits ein Webhook eingerichtet. Bitte verwende einen neuen Bot oder entferne den Webhook zuerst.");
    }
    const pending = await telegramApi(token, "getUpdates", {
      timeout: 0,
      allowed_updates: ["message"],
    });
    assertCurrent();
    const initialOffset = (pending || []).reduce(
      (maximum, update) => Math.max(maximum, Number(update.update_id) + 1),
      0,
    );
    const nonce = randomBytes(18).toString("base64url");
    const pairingId = randomBytes(12).toString("hex");
    const expiresAtMs = now() + expiryMs;
    const bot = {
      id: String(me.id),
      name: String(me.first_name || me.username),
      username: String(me.username),
    };
    session = {
      id: pairingId,
      status: "waiting",
      bot,
      telegramUrl: `https://t.me/${encodeURIComponent(bot.username)}?start=${encodeURIComponent(nonce)}`,
      expiresAtMs,
      expiresAt: new Date(expiresAtMs).toISOString(),
      error: null,
    };
    void poll(pairingId, token, nonce, initialOffset);
    return publicSession();
  }

  return {
    start,
    cancel,
    status: publicSession,
  };
}
