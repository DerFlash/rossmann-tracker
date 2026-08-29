import test from "node:test";
import assert from "node:assert/strict";
import {
  matchesBaselineResetTarget,
  retainResultsAfterBaselineReset,
} from "../src/baseline-reset.js";

const entry = { storeId: "2374", dan: "228940" };

test("ein vollständiger Baseline-Reset erfasst jedes Ergebnis", () => {
  assert.equal(matchesBaselineResetTarget(entry), true);
});

test("ein DAN-Reset erfasst nur Ergebnisse des Produkts", () => {
  assert.equal(matchesBaselineResetTarget(entry, { dan: "228940" }), true);
  assert.equal(matchesBaselineResetTarget(entry, { dan: "150727" }), false);
});

test("ein Filial-Reset erfasst nur Ergebnisse der Filiale", () => {
  assert.equal(matchesBaselineResetTarget(entry, { storeId: "2374" }), true);
  assert.equal(matchesBaselineResetTarget(entry, { storeId: "465" }), false);
});

test("kombinierte Filter müssen beide Werte treffen", () => {
  assert.equal(matchesBaselineResetTarget(entry, { dan: "228940", storeId: "2374" }), true);
  assert.equal(matchesBaselineResetTarget(entry, { dan: "228940", storeId: "465" }), false);
});

test("ein vollständiger Reset leert die sichtbaren Ergebnisse", () => {
  assert.deepEqual(retainResultsAfterBaselineReset([entry]), []);
});

test("ein gezielter Reset erhält nicht betroffene Ergebnisse", () => {
  const otherProduct = { storeId: "2374", dan: "150727" };
  const otherStore = { storeId: "465", dan: "228940" };

  assert.deepEqual(
    retainResultsAfterBaselineReset([entry, otherProduct, otherStore], { dan: "228940", storeId: "2374" }),
    [otherProduct, otherStore],
  );
});
