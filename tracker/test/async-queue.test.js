import test from "node:test";
import assert from "node:assert/strict";
import { createSerializedTask } from "../src/async-queue.js";

test("serialisiert Offset-Schreibvorgänge und persistiert den jüngsten zuletzt", async () => {
  let releaseFirst;
  let firstStarted;
  const firstStartedPromise = new Promise((resolve) => { firstStarted = resolve; });
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const events = [];
  let persistedOffset = null;
  const saveOffset = createSerializedTask(async (offset) => {
    events.push(`start:${offset}`);
    if (offset === 41) {
      firstStarted();
      await firstGate;
    }
    persistedOffset = offset;
    events.push(`end:${offset}`);
  });

  const staleWrite = saveOffset(41);
  await firstStartedPromise;
  const currentWrite = saveOffset(99);
  await Promise.resolve();
  assert.deepEqual(events, ["start:41"]);

  releaseFirst();
  await Promise.all([staleWrite, currentWrite]);
  assert.deepEqual(events, ["start:41", "end:41", "start:99", "end:99"]);
  assert.equal(persistedOffset, 99);
});

test("setzt die Schreibwarteschlange nach einem Fehler fort", async () => {
  const values = [];
  const write = createSerializedTask(async (value) => {
    if (value === "defekt") throw new Error("Schreibfehler");
    values.push(value);
  });

  await assert.rejects(write("defekt"), /Schreibfehler/);
  await write("aktuell");
  assert.deepEqual(values, ["aktuell"]);
});
