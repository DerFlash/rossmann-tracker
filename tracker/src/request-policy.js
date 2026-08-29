export const DEFAULT_POLL_INTERVAL_MINUTES = 15;
export const MIN_POLL_INTERVAL_MINUTES = 5;
export const DEFAULT_REQUEST_DELAY_MS = 2_000;
export const MIN_REQUEST_DELAY_MS = 2_000;
export const DEFAULT_JITTER_MS = 2_500;
export const MIN_JITTER_MS = 500;
export const MANUAL_CHECK_COOLDOWN_MS = 60_000;

function integerAtLeast(value, name, minimum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} muss eine Ganzzahl von mindestens ${minimum} sein.`);
  }
  return parsed;
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  const error = new Error(String(signal.reason ?? "Vorgang abgebrochen"));
  error.name = "AbortError";
  throw error;
}

export function normalizeRequestPolicy(config, { migrateLegacyLimits = false } = {}) {
  const pollIntervalMinutes = integerAtLeast(
    config.pollIntervalMinutes ?? DEFAULT_POLL_INTERVAL_MINUTES,
    "pollIntervalMinutes",
    migrateLegacyLimits ? 1 : MIN_POLL_INTERVAL_MINUTES,
  );
  const requestDelayMs = integerAtLeast(
    config.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS,
    "requestDelayMs",
    migrateLegacyLimits ? 1 : MIN_REQUEST_DELAY_MS,
  );
  const jitterMs = integerAtLeast(
    config.jitterMs ?? DEFAULT_JITTER_MS,
    "jitterMs",
    migrateLegacyLimits ? 0 : MIN_JITTER_MS,
  );

  return {
    pollIntervalMinutes: Math.max(MIN_POLL_INTERVAL_MINUTES, pollIntervalMinutes),
    requestDelayMs: Math.max(MIN_REQUEST_DELAY_MS, requestDelayMs),
    jitterMs: Math.max(MIN_JITTER_MS, jitterMs),
  };
}

export function createRequestPacer({ now = Date.now, sleep, random = Math.random } = {}) {
  if (typeof sleep !== "function") throw new Error("createRequestPacer benötigt eine sleep-Funktion.");
  let nextAllowedAt = 0;
  let queue = Promise.resolve();

  function run(task, { delayMs, jitterMs, signal = null }) {
    if (typeof task !== "function") throw new Error("createRequestPacer.run benötigt eine Task-Funktion.");
    const policy = normalizeRequestPolicy({
      pollIntervalMinutes: DEFAULT_POLL_INTERVAL_MINUTES,
      requestDelayMs: delayMs,
      jitterMs,
    });
    const operation = queue.then(async () => {
      throwIfAborted(signal);
      const waitMs = Math.max(0, nextAllowedAt - now());
      if (waitMs > 0) await sleep(waitMs, signal);
      throwIfAborted(signal);
      try {
        return await task();
      } finally {
        const jitter = Math.floor(random() * (policy.jitterMs + 1));
        nextAllowedAt = now() + policy.requestDelayMs + jitter;
      }
    });
    queue = operation.catch(() => {});
    return operation;
  }

  return { run };
}

export function createCooldownGate({ cooldownMs, now = Date.now }) {
  const duration = integerAtLeast(cooldownMs, "cooldownMs", 1);
  let lastAcceptedAt = null;

  return {
    tryAcquire() {
      const timestamp = now();
      const retryAfterMs = lastAcceptedAt === null
        ? 0
        : Math.max(0, lastAcceptedAt + duration - timestamp);
      if (retryAfterMs > 0) return { accepted: false, retryAfterMs };
      lastAcceptedAt = timestamp;
      return { accepted: true, retryAfterMs: 0 };
    },
    status() {
      const retryAfterMs = lastAcceptedAt === null
        ? 0
        : Math.max(0, lastAcceptedAt + duration - now());
      return {
        cooldownMs: duration,
        retryAfterMs,
        nextAllowedAt: retryAfterMs > 0 ? new Date(now() + retryAfterMs).toISOString() : null,
      };
    },
  };
}
