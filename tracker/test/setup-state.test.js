import test from "node:test";
import assert from "node:assert/strict";
import { getSetupState } from "../src/setup-state.js";

test("führt eine leere Installation zuerst zu Telegram", () => {
  assert.deepEqual(getSetupState({ searchAreas: [], stores: [], products: [] }, {}), {
    complete: false,
    step: "telegram",
    telegramConnected: false,
    locationConfigured: false,
    productConfigured: false,
  });
});

test("fordert nach Telegram erst Standort und dann Produkt", () => {
  const telegram = { botToken: "token", chatId: "123" };
  assert.equal(getSetupState({ searchAreas: [], stores: [], products: [] }, telegram).step, "location");
  assert.equal(getSetupState({ searchAreas: [{ postcode: "12345" }], stores: [], products: [] }, telegram).step, "product");
  assert.equal(getSetupState({ searchAreas: [], stores: [{ id: "1" }], products: [{ dan: "228940" }] }, telegram).step, "complete");
});

