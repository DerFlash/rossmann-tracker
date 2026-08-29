import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_POLL_INTERVAL_MINUTES,
  DEFAULT_REQUEST_DELAY_MS,
  MANUAL_CHECK_COOLDOWN_MS,
  createCooldownGate,
  createRequestPacer,
  normalizeRequestPolicy,
} from "../src/request-policy.js";

test("setzt veröffentlichungstaugliche Standard- und Mindestwerte durch", () => {
  assert.deepEqual(normalizeRequestPolicy({}), {
    pollIntervalMinutes: DEFAULT_POLL_INTERVAL_MINUTES,
    requestDelayMs: DEFAULT_REQUEST_DELAY_MS,
    jitterMs: 2_500,
  });
  assert.throws(
    () => normalizeRequestPolicy({ pollIntervalMinutes: 4, requestDelayMs: 2_000, jitterMs: 500 }),
    /pollIntervalMinutes.*mindestens 5/,
  );
  assert.throws(
    () => normalizeRequestPolicy({ pollIntervalMinutes: 5, requestDelayMs: 1_999, jitterMs: 500 }),
    /requestDelayMs.*mindestens 2000/,
  );
  assert.throws(
    () => normalizeRequestPolicy({ pollIntervalMinutes: 5, requestDelayMs: 2_000, jitterMs: 499 }),
    /jitterMs.*mindestens 500/,
  );
});

test("hebt nur beim Laden bestehender Einstellungen alte Grenzwerte an", () => {
  assert.deepEqual(normalizeRequestPolicy({
    pollIntervalMinutes: 1,
    requestDelayMs: 1_500,
    jitterMs: 0,
  }, { migrateLegacyLimits: true }), {
    pollIntervalMinutes: 5,
    requestDelayMs: 2_000,
    jitterMs: 500,
  });
});

test("serialisiert Rossmann-Abfragen mit Mindestpause und Jitter", async () => {
  let timestamp = 1_000;
  const sleeps = [];
  const starts = [];
  const pacer = createRequestPacer({
    now: () => timestamp,
    random: () => 0.5,
    sleep: async (ms) => {
      sleeps.push(ms);
      timestamp += ms;
    },
  });
  const request = async () => {
    starts.push(timestamp);
    timestamp += 100;
  };

  await Promise.all([
    pacer.run(request, { delayMs: 2_000, jitterMs: 1_000 }),
    pacer.run(request, { delayMs: 2_000, jitterMs: 1_000 }),
    pacer.run(request, { delayMs: 2_000, jitterMs: 1_000 }),
  ]);
  assert.deepEqual(sleeps, [2_500, 2_500]);
  assert.deepEqual(starts, [1_000, 3_600, 6_200]);
});

test("bricht auch mit einem minimalen AbortSignal ohne throwIfAborted sauber ab", async () => {
  const pacer = createRequestPacer({ sleep: async () => {} });
  let executed = false;

  await assert.rejects(
    pacer.run(
      async () => { executed = true; },
      {
        delayMs: 2_000,
        jitterMs: 500,
        signal: { aborted: true, reason: "Testabbruch" },
      },
    ),
    (error) => error.name === "AbortError" && error.message === "Testabbruch",
  );
  assert.equal(executed, false);
});

test("bewahrt explizite falsy Abort-Reasons", async () => {
  for (const reason of ["", 0, false]) {
    const pacer = createRequestPacer({ sleep: async () => {} });
    await assert.rejects(
      pacer.run(async () => {}, {
        delayMs: 2_000,
        jitterMs: 500,
        signal: { aborted: true, reason },
      }),
      (error) => error.name === "AbortError" && error.message === String(reason),
    );
  }
});

test("begrenzt manuelle Prüfungen auf eine Annahme pro Cooldown", () => {
  let timestamp = 10_000;
  const gate = createCooldownGate({
    cooldownMs: MANUAL_CHECK_COOLDOWN_MS,
    now: () => timestamp,
  });

  assert.deepEqual(gate.tryAcquire(), { accepted: true, retryAfterMs: 0 });
  timestamp += 1_000;
  assert.deepEqual(gate.tryAcquire(), { accepted: false, retryAfterMs: 59_000 });
  timestamp += 59_000;
  assert.deepEqual(gate.tryAcquire(), { accepted: true, retryAfterMs: 0 });
});
