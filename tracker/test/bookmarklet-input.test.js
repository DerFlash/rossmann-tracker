import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bookmarklet = await readFile(
  new URL("../../rossmann-dan-bookmarklet.html", import.meta.url),
  "utf8",
);

test("bookmarklet verwendet den öffentlichen Projektnamen und neutrale Startwerte", () => {
  assert.match(bookmarklet, /<title>Rossmann Store Tracker – Bookmarklet installieren<\/title>/);
  assert.doesNotMatch(bookmarklet, /Rossmann DAN-(?:Tracker|Prüfer)/);
  assert.match(bookmarklet, /postcode:""/);
  assert.match(bookmarklet, /recentStores:\[\]/);
  assert.match(bookmarklet, /ROOT_ID="rossmann-store-tracker-root"/);
  assert.match(bookmarklet, /STORE_KEY="rossmann-store-tracker-v1"/);
  assert.match(bookmarklet, /LEGACY_STORE_KEY="rossmann-dan-pruefer-v1"/);
  assert.match(bookmarklet, /try\{\s*const currentSaved=localStorage\.getItem\(STORE_KEY\);\s*const legacySaved=currentSaved===null\?localStorage\.getItem\(LEGACY_STORE_KEY\):null;/);
  assert.match(bookmarklet, /currentSaved===null&&legacySaved!==null[\s\S]*localStorage\.setItem\(STORE_KEY[\s\S]*localStorage\.removeItem\(LEGACY_STORE_KEY\)/);
});

function inlineParserFor(value) {
  const match = bookmarklet.match(/const parseItems=\(\)=>([\s\S]*?);\n  const createCard=/);
  assert.ok(match, "inline parseItems expression should be present");

  const items = { value };
  return Function("items", `"use strict"; return () => ${match[1]};`)(items);
}

test("bookmarklet keeps commas inside product names", () => {
  const parseItems = inlineParserFor(
    "Pokémon Enhanced 2-Pack 2026 – Myrapla, Duflor & Giflor | 228928\n" +
      "Pokémon Tin (Rossmann-Sammelartikel) | 015382",
  );

  assert.deepEqual(parseItems(), [
    {
      name: "Pokémon Enhanced 2-Pack 2026 – Myrapla, Duflor & Giflor",
      dan: "228928",
    },
    {
      name: "Pokémon Tin (Rossmann-Sammelartikel)",
      dan: "015382",
    },
  ]);
});

function inlinePostcodeResolver() {
  const match = bookmarklet.match(
    /const resolvePostcode=\(enteredPostcode,selectedStoreId,stores\)=>\{([\s\S]*?)\n  \};\n  const persist=/,
  );
  assert.ok(match, "inline resolvePostcode function should be present");

  const normalizeStore = (store) => ({
    ...store,
    id: String(store.id || ""),
    postcode: String(store.postcode || ""),
  });
  return Function(
    "normalizeStore",
    `"use strict"; return (enteredPostcode,selectedStoreId,stores)=>{${match[1]}\n};`,
  )(normalizeStore);
}

test("selected concrete store determines the effective postcode", () => {
  const resolvePostcode = inlinePostcodeResolver();
  const recentStores = [
    { id: 1001, city: "Musterstadt", postcode: "12345", street: "Teststraße 1" },
  ];

  assert.equal(resolvePostcode("04299", "1001", recentStores), "12345");
  assert.equal(resolvePostcode("04299", "all", recentStores), "04299");
  assert.match(
    bookmarklet,
    /const zip=resolvePostcode\(postcode\.value\.trim\(\),target,state\.recentStores\);/,
  );
  assert.match(
    bookmarklet,
    /storeSelect\.addEventListener\("change",\(\)=>\{\n\s+const zip=resolvePostcode/,
  );
});
