import test from "node:test";
import assert from "node:assert/strict";
import {
  getHistoryView,
  MAX_HISTORY_POINTS_PER_SERIES,
  MAX_STORE_MOVEMENTS,
  normalizeState,
  recordHistory,
} from "../src/history.js";

const store = { id: "1001", city: "Musterstadt", street: "Teststraße 1", postcode: "12345" };
const product = { dan: "228940", name: "Pokémon Pin-Kollektion" };

test("v1-Zustände werden ohne Verlust der Ausgangsbestände migriert", () => {
  const state = normalizeState({ version: 1, items: { "1001:228940": { stock: 2 } }, updatedAt: "2026-08-26T10:00:00.000Z" });
  assert.equal(state.version, 2);
  assert.equal(state.items["1001:228940"].stock, 2);
  assert.deepEqual(state.history, {});
});

test("History speichert Erstwert und echte Änderungen, aber keine Polling-Duplikate", () => {
  const state = normalizeState({});
  assert.equal(recordHistory(state, { store, product, current: { stock: 0, available: false, checkedAt: "2026-08-01T08:00:00.000Z" } }), true);
  assert.equal(recordHistory(state, { store, product, current: { stock: 0, available: false, checkedAt: "2026-08-01T08:10:00.000Z" } }), false);
  assert.equal(recordHistory(state, { store, product, current: { stock: 4, available: true, checkedAt: "2026-08-01T08:20:00.000Z" } }), true);
  assert.deepEqual(state.history["1001:228940"].points.map(({ stock }) => stock), [0, 4]);
  assert.equal(state.history["1001:228940"].storeName, "Musterstadt – Teststraße 1");
});

test("Zeitraumansicht enthält Anker und jüngsten erfolgreichen Check", () => {
  const state = normalizeState({
    items: { "1001:228940": { stock: 4, available: true, checkedAt: "2026-08-27T08:00:00.000Z" } },
    history: {
      "1001:228940": {
        storeId: "1001", storeName: "Musterstadt", storePostcode: "12345", dan: "228940", productName: "Pin-Kollektion",
        points: [
          { stock: 0, available: false, checkedAt: "2026-07-01T08:00:00.000Z" },
          { stock: 4, available: true, checkedAt: "2026-08-20T08:00:00.000Z" },
        ],
      },
    },
  });
  const view = getHistoryView(state, { period: "30", now: new Date("2026-08-27T10:00:00.000Z") });
  assert.equal(view.selection.currentStock, 4);
  assert.equal(view.changes, 1);
  assert.equal(view.points[0].anchor, true);
  assert.equal(view.points.at(-1).current, true);
  assert.deepEqual(view.points.map(({ stock }) => stock), [0, 4, 4]);
});

test("jüngste Änderung wird bei identischem Check-Zeitpunkt als aktuell markiert", () => {
  const checkedAt = "2026-08-27T08:00:00.000Z";
  const state = normalizeState({
    items: { "1001:228940": { stock: 4, available: true, checkedAt } },
    history: {
      "1001:228940": {
        storeId: "1001", storeName: "Musterstadt", dan: "228940", productName: "Pin-Kollektion",
        points: [{ stock: 4, available: true, checkedAt }],
      },
    },
  });
  const view = getHistoryView(state, { period: "all" });
  assert.equal(view.points.length, 1);
  assert.equal(view.points[0].current, true);
});

test("History-Filter validieren DAN, Filiale und Zeitraum", () => {
  const state = normalizeState({});
  assert.throws(() => getHistoryView(state, { dan: "abc" }), /Ungültige DAN/);
  assert.throws(() => getHistoryView(state, { storeId: "area:12345" }), /Ungültige Filial-ID/);
  assert.throws(() => getHistoryView(state, { period: "365" }), /Ungültiger Zeitraum/);
});

test("Serien ohne Datum sortieren stabil hinter zuletzt geprüfte Serien", () => {
  const state = normalizeState({
    items: { "1001:228940": { stock: 2, available: true, checkedAt: "2026-08-27T08:00:00.000Z" } },
    history: {
      "9999:228940": { storeId: "9999", storeName: "Ohne Datum", dan: "228940", productName: "Pin-Kollektion", points: [] },
      "1001:228940": { storeId: "1001", storeName: "Musterstadt", dan: "228940", productName: "Pin-Kollektion", points: [] },
    },
  });
  const view = getHistoryView(state);
  assert.equal(view.selection.storeId, "1001");
  assert.deepEqual(view.series.map(({ storeId }) => storeId), ["1001", "9999"]);
});

test("History begrenzt jede Serie auf die letzten 2.000 Änderungen", () => {
  const state = normalizeState({});
  for (let index = 0; index < MAX_HISTORY_POINTS_PER_SERIES + 5; index += 1) {
    recordHistory(state, {
      store,
      product,
      current: {
        stock: index % 2,
        available: true,
        checkedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      },
    });
  }
  const points = state.history["1001:228940"].points;
  assert.equal(points.length, MAX_HISTORY_POINTS_PER_SERIES);
  assert.equal(points[0].stock, 1);
  assert.equal(points.at(-1).stock, 0);

  const normalized = normalizeState({ history: state.history });
  assert.equal(normalized.history["1001:228940"].points.length, MAX_HISTORY_POINTS_PER_SERIES);
});

test("Filialansicht bündelt echte Warenbewegungen über alle Produkte", () => {
  const state = normalizeState({
    history: {
      "1001:228940": {
        storeId: "1001", storeName: "Musterstadt", storePostcode: "12345", dan: "228940", productName: "Pin-Kollektion",
        points: [
          { stock: 0, available: true, checkedAt: "2026-08-01T08:00:00.000Z" },
          { stock: 4, available: true, checkedAt: "2026-08-20T08:00:00.000Z" },
          { stock: 1, available: true, checkedAt: "2026-08-25T08:00:00.000Z" },
        ],
      },
      "1001:150727": {
        storeId: "1001", storeName: "Musterstadt", storePostcode: "12345", dan: "150727", productName: "ex-Kampfdeck",
        points: [
          { stock: 2, available: true, checkedAt: "2026-08-22T08:00:00.000Z" },
          { stock: 2, available: true, checkedAt: "2026-08-24T08:00:00.000Z" },
          { stock: 2, available: false, checkedAt: "2026-08-26T08:00:00.000Z" },
        ],
      },
      "9999:228940": {
        storeId: "9999", storeName: "Beispielstadt", dan: "228940", productName: "Pin-Kollektion",
        points: [
          { stock: 1, available: true, checkedAt: "2026-08-20T08:00:00.000Z" },
          { stock: 9, available: true, checkedAt: "2026-08-26T08:00:00.000Z" },
        ],
      },
    },
  });

  const view = getHistoryView(state, {
    storeId: "1001",
    period: "30",
    now: new Date("2026-08-27T08:00:00.000Z"),
  });

  assert.equal(view.mode, "store");
  assert.equal(view.selection.storeId, "1001");
  assert.deepEqual(view.movements.map(({ dan, delta, direction }) => ({ dan, delta, direction })), [
    { dan: "150727", delta: 0, direction: "availability" },
    { dan: "228940", delta: -3, direction: "out" },
    { dan: "228940", delta: 4, direction: "in" },
  ]);
  assert.equal(view.incomingUnits, 4);
  assert.equal(view.outgoingUnits, 3);
  assert.equal(view.productsChanged, 2);
  assert.equal(view.changes, 3);
});

test("Filialansicht zählt Erstwerte nicht als Bewegung und beachtet den Zeitraum", () => {
  const state = normalizeState({
    history: {
      "1001:228940": {
        storeId: "1001", storeName: "Musterstadt", dan: "228940", productName: "Pin-Kollektion",
        points: [
          { stock: 0, available: true, checkedAt: "2026-06-01T08:00:00.000Z" },
          { stock: 5, available: true, checkedAt: "2026-07-01T08:00:00.000Z" },
          { stock: 2, available: true, checkedAt: "2026-08-25T08:00:00.000Z" },
        ],
      },
      "1001:150727": {
        storeId: "1001", storeName: "Musterstadt", dan: "150727", productName: "ex-Kampfdeck",
        points: [{ stock: 7, available: true, checkedAt: "2026-08-26T08:00:00.000Z" }],
      },
    },
  });

  const view = getHistoryView(state, {
    storeId: "1001",
    period: "30",
    now: new Date("2026-08-27T08:00:00.000Z"),
  });

  assert.deepEqual(view.movements.map(({ previousStock, stock }) => [previousStock, stock]), [[5, 2]]);
  assert.equal(view.changes, 1);
  assert.equal(view.productsChanged, 1);
});

test("Filialansicht hält nur die neuesten 500 Bewegungen im Speicher", () => {
  const points = Array.from({ length: MAX_STORE_MOVEMENTS + 102 }, (_, index) => ({
    stock: index % 2,
    available: true,
    checkedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
  }));
  const state = normalizeState({
    history: {
      "1001:228940": {
        storeId: "1001", storeName: "Musterstadt", dan: "228940", productName: "Pin-Kollektion", points,
      },
    },
  });

  const view = getHistoryView(state, { storeId: "1001", period: "all" });

  assert.equal(view.movements.length, MAX_STORE_MOVEMENTS);
  assert.equal(view.changes, points.length - 1);
  assert.equal(view.truncated, true);
  assert.equal(view.movements[0].checkedAt, points.at(-1).checkedAt);
  assert.equal(view.movements.at(-1).checkedAt, points[102].checkedAt);
});
