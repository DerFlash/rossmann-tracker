export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function formatDateTime(value) {
  if (!value) return "–";
  const formatted = new Date(value).toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatted} Uhr`;
}

function resultContext(result, products, stores, includeStore) {
  const product = products.get(String(result.dan)) || result.dan;
  if (!includeStore) return escapeHtml(product);
  const store = stores.get(String(result.storeId)) || result.storeName || result.storeId;
  return `${escapeHtml(product)} · ${escapeHtml(store)}`;
}

function appendLimited(lines, entries, limit, formatter, overflowText) {
  for (const entry of entries.slice(0, limit)) lines.push(formatter(entry));
  if (entries.length > limit) lines.push(`… ${entries.length - limit} ${overflowText}`);
}

function appendErrors(lines, entries, limit, products, stores, includeStore, overflowText) {
  const visible = entries.slice(0, limit);
  const groups = new Map();
  for (const entry of visible) {
    const key = String(entry.error || "Unbekannter Fehler");
    groups.set(key, [...(groups.get(key) || []), entry]);
  }
  for (const [error, group] of groups) {
    if (group.length === 1) {
      lines.push(`• ${resultContext(group[0], products, stores, includeStore)}: ${escapeHtml(error)}`);
      continue;
    }
    lines.push(`• ${escapeHtml(error)}`);
    for (const result of group) {
      lines.push(`↳ ${resultContext(result, products, stores, includeStore)}`);
    }
  }
  if (entries.length > limit) lines.push(`… ${entries.length - limit} ${overflowText}`);
}

export function formatRunResults({
  title,
  results,
  products: configuredProducts,
  stores: configuredStores,
  detailed = false,
  compactPositiveLimit = 10,
  compactErrorLimit = 5,
  detailedSectionLimit = 30,
}) {
  const products = new Map(configuredProducts.map((item) => [String(item.dan), item.name]));
  const stores = new Map(configuredStores.map((item) => [String(item.id), `${item.city} – ${item.street}`]));
  const includeStore = new Set(results.map((result) => String(result.storeId))).size > 1;
  const successful = results.filter((result) => result.status === "ok");
  const failed = results.filter((result) => result.status === "error");
  const positive = successful.filter((result) => result.stock > 0);
  const empty = successful.filter((result) => result.stock === 0);
  const total = results.length;
  const checkLabel = total === 1 ? "Filialprüfung" : "Filialprüfungen";
  const lines = [
    title,
    failed.length
      ? `✅ ${successful.length} erfolgreich · ⚠️ ${failed.length} fehlgeschlagen`
      : `✅ ${successful.length} von ${total} ${checkLabel} erfolgreich`,
  ];

  if (positive.length) {
    lines.push("", `<b>📦 Auf Lager (${positive.length})</b>`);
    appendLimited(
      lines,
      positive,
      detailed ? detailedSectionLimit : compactPositiveLimit,
      (result) => `• ${resultContext(result, products, stores, includeStore)}: <b>${result.stock} Stück</b>`,
      detailed ? "weitere Treffer" : "weitere unter /results",
    );
  }

  if (empty.length) {
    if (detailed) {
      lines.push("", `<b>📭 Nicht auf Lager (${empty.length})</b>`);
      appendLimited(
        lines,
        empty,
        detailedSectionLimit,
        (result) => `• ${resultContext(result, products, stores, includeStore)}${result.available ? "" : " · nicht geführt"}`,
        "weitere Ergebnisse",
      );
    } else {
      const emptyCheckLabel = empty.length === 1 ? "Filialprüfung" : "Filialprüfungen";
      lines.push("", `📭 Kein Bestand in ${empty.length} ${emptyCheckLabel}`);
    }
  }

  if (!successful.length && !failed.length) {
    lines.push("", "⏳ Noch keine Ergebnisse vorhanden");
  }

  if (failed.length) {
    lines.push("", `<b>⚠️ Fehler (${failed.length})</b>`);
    appendErrors(
      lines,
      failed,
      detailed ? detailedSectionLimit : compactErrorLimit,
      products,
      stores,
      includeStore,
      detailed ? "weitere Fehler" : "weitere unter /results",
    );
  }

  return lines.join("\n");
}
