import test from "node:test";
import assert from "node:assert/strict";
import { classifyChange } from "../src/diff.js";

const current = (stock, available = true) => ({ stock, available });

test("initialisiert still mit einem Basisbestand", () => {
  assert.equal(classifyChange(null, current(4)), null);
});

test("meldet auf Wunsch auch einen initialen Nullbestand", () => {
  assert.equal(
    classifyChange(null, current(0), { notifyOnInitialStock: true }),
    "initial_stock",
  );
});

test("meldet auf Wunsch einen initialen positiven Bestand", () => {
  assert.equal(
    classifyChange(null, current(4), { notifyOnInitialStock: true }),
    "initial_stock",
  );
});

test("meldet 0 auf positiven Bestand als Restock", () => {
  assert.equal(classifyChange(current(0), current(3)), "restock");
});

test("meldet positiven Bestand auf 0 als ausverkauft", () => {
  assert.equal(classifyChange(current(2), current(0)), "out_of_stock");
});

test("available true und Bestand 0 bleibt ohne Änderung still", () => {
  assert.equal(classifyChange(current(0, true), current(0, true)), null);
});

test("überspringt deaktivierte Bestandsänderungen", () => {
  assert.equal(
    classifyChange(current(2), current(5), { onStockChange: false }),
    null,
  );
});
