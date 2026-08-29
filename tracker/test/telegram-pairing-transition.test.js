import test from "node:test";
import assert from "node:assert/strict";
import { applyTelegramPairing } from "../src/telegram-pairing-transition.js";

function botFixture(previousOffset = 41) {
  const events = [];
  return {
    events,
    bot: {
      suspend() {
        events.push("suspend");
        return previousOffset;
      },
      resume(offset) {
        events.push(`resume:${offset}`);
      },
    },
  };
}

test("übernimmt Zugangsdaten und neuen Offset gemeinsam", async () => {
  const { bot, events } = botFixture();
  const saved = [];
  await applyTelegramPairing({
    bot,
    nextOffset: 99,
    saveOffset: async (offset) => { saved.push(offset); },
    commitCredentials: async () => { events.push("commit"); },
  });
  assert.deepEqual(saved, [99]);
  assert.deepEqual(events, ["suspend", "commit", "resume:99"]);
});

test("stellt bei fehlgeschlagenen Zugangsdaten den alten Offset wieder her", async () => {
  const { bot, events } = botFixture();
  const saved = [];
  await assert.rejects(applyTelegramPairing({
    bot,
    nextOffset: 99,
    saveOffset: async (offset) => { saved.push(offset); },
    commitCredentials: async () => { throw new Error("Settings fehlgeschlagen"); },
  }), /Settings fehlgeschlagen/);
  assert.deepEqual(saved, [99, 41]);
  assert.deepEqual(events, ["suspend", "resume:41"]);
});

test("setzt den alten Bot auch nach einem Offset-Schreibfehler korrekt fort", async () => {
  const { bot, events } = botFixture();
  const saved = [];
  let attempt = 0;
  await assert.rejects(applyTelegramPairing({
    bot,
    nextOffset: 99,
    saveOffset: async (offset) => {
      saved.push(offset);
      attempt += 1;
      if (attempt === 1) throw new Error("Offset fehlgeschlagen");
    },
    commitCredentials: async () => { throw new Error("darf nicht laufen"); },
  }), /Offset fehlgeschlagen/);
  assert.deepEqual(saved, [99, 41]);
  assert.deepEqual(events, ["suspend", "resume:41"]);
});

test("rollt Zugangsdaten und Offset bei Abbruch während der Übernahme zurück", async () => {
  const { bot, events } = botFixture();
  const controller = new AbortController();
  const saved = [];
  let releaseCommit;
  let commitStarted;
  const commitStartedPromise = new Promise((resolve) => { commitStarted = resolve; });
  const commitGate = new Promise((resolve) => { releaseCommit = resolve; });

  const transition = applyTelegramPairing({
    bot,
    nextOffset: 99,
    signal: controller.signal,
    saveOffset: async (offset) => { saved.push(offset); },
    commitCredentials: async () => {
      events.push("commit:new");
      commitStarted();
      await commitGate;
      return async () => { events.push("commit:rollback"); };
    },
  });
  await commitStartedPromise;
  controller.abort();
  releaseCommit();

  await assert.rejects(transition, { name: "AbortError" });
  assert.deepEqual(saved, [99, 41]);
  assert.deepEqual(events, ["suspend", "commit:new", "commit:rollback", "resume:41"]);
});

test("bewahrt einen textuellen Abbruchgrund", async () => {
  const { bot } = botFixture();
  const controller = new AbortController();
  controller.abort("manuell beendet");

  await assert.rejects(applyTelegramPairing({
    bot,
    nextOffset: 99,
    signal: controller.signal,
    saveOffset: async () => {},
    commitCredentials: async () => {},
  }), (error) => error.name === "AbortError" && error.message === "manuell beendet");
});
