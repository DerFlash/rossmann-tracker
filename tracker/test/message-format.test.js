import test from "node:test";
import assert from "node:assert/strict";
import { formatRunResults } from "../src/message-format.js";

const products = [
  { dan: "111111", name: "Boosterbundle" },
  { dan: "222222", name: "Top-Trainer-Box" },
  { dan: "333333", name: "Sticker-Kollektion" },
];
const stores = [{ id: "1001", city: "Musterstadt", street: "Teststraße 1" }];

test("kompakter Laufstatus gruppiert Bestand und trennt Fehler optisch", () => {
  const text = formatRunResults({
    title: "<b>Letzter Prüflauf</b>",
    products,
    stores,
    results: [
      { status: "ok", storeId: "1001", dan: "111111", stock: 0, available: true },
      { status: "ok", storeId: "1001", dan: "222222", stock: 0, available: true },
      { status: "error", storeId: "1001", dan: "333333", error: "HTTP 406" },
    ],
  });

  assert.match(text, /✅ 2 erfolgreich · ⚠️ 1 fehlgeschlagen/);
  assert.match(text, /📭 Kein Bestand in 2 Filialprüfungen/);
  assert.match(text, /Filialprüfungen\n\n<b>⚠️ Fehler \(1\)<\/b>/);
  assert.doesNotMatch(text, /0 Stück: 2 Produkte/);
});

test("detaillierte Ergebnisse nennen Filialen nur bei echter Mehrdeutigkeit", () => {
  const results = [{ status: "ok", storeId: "1001", dan: "111111", stock: 3, available: true }];
  const singleStore = formatRunResults({
    title: "<b>Ergebnisse</b>", products, stores, results, detailed: true,
  });
  const multipleStores = formatRunResults({
    title: "<b>Ergebnisse</b>",
    products,
    stores: [...stores, { id: "9999", city: "Beispielstadt", street: "Hauptstraße 1" }],
    results: [...results, { status: "ok", storeId: "9999", dan: "222222", stock: 0, available: true }],
    detailed: true,
  });

  assert.doesNotMatch(singleStore, /Musterstadt – Teststraße 1/);
  assert.match(multipleStores, /Boosterbundle · Musterstadt – Teststraße 1: <b>3 Stück<\/b>/);
});

test("identische Fehlertexte werden nur einmal ausgegeben", () => {
  const text = formatRunResults({
    title: "<b>Ergebnisse</b>",
    products,
    stores,
    results: [
      { status: "error", storeId: "1001", dan: "111111", error: "HTTP 406 – keine Bestandsantwort" },
      { status: "error", storeId: "1001", dan: "222222", error: "HTTP 406 – keine Bestandsantwort" },
    ],
  });

  assert.equal(text.match(/HTTP 406/g)?.length, 1);
  assert.match(text, /↳ Boosterbundle/);
  assert.match(text, /↳ Top-Trainer-Box/);
});
