import test from "node:test";
import assert from "node:assert/strict";
import { buildStoreQueryScopes } from "../src/store-scope.js";

test("bündelt konkrete Filialen mit derselben PLZ in eine Abfrage", () => {
  const scopes = buildStoreQueryScopes({
    searchAreas: [],
    stores: [
      { id: "1", postcode: "12345" },
      { id: "2", postcode: "12345" },
      { id: "3", postcode: "54321" },
    ],
  });
  assert.equal(scopes.length, 2);
  assert.deepEqual(scopes.find((scope) => scope.postcode === "12345").stores.map((store) => store.id), ["1", "2"]);
});

test("ein Suchgebiet deckt konkrete Filialen derselben PLZ bereits ab", () => {
  const scopes = buildStoreQueryScopes({
    searchAreas: [{ postcode: "12345" }],
    stores: [{ id: "1001", postcode: "12345" }, { id: "1002", postcode: "54321" }],
  });
  assert.deepEqual(scopes, [
    { postcode: "12345", mode: "all", stores: [] },
    { postcode: "54321", mode: "selected", stores: [{ id: "1002", postcode: "54321" }] },
  ]);
});
