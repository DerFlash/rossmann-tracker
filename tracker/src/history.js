const PERIOD_DAYS = new Map([
  ["7", 7],
  ["30", 30],
  ["90", 90],
  ["all", null],
]);
export const MAX_HISTORY_POINTS_PER_SERIES = 2_000;
export const MAX_STORE_MOVEMENTS = 500;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function timestampOrEpoch(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizePoint(point) {
  if (!isRecord(point)) return null;
  const stock = Number(point.stock);
  const checkedAt = String(point.checkedAt || "");
  if (!Number.isFinite(stock) || Number.isNaN(Date.parse(checkedAt))) return null;
  return {
    checkedAt,
    stock,
    available: Boolean(point.available),
  };
}

function normalizeSeries(key, series) {
  if (!isRecord(series)) return null;
  const [keyStoreId = "", keyDan = ""] = String(key).split(":");
  const storeId = String(series.storeId || keyStoreId);
  const dan = String(series.dan || keyDan);
  if (!/^\d+$/.test(storeId) || !/^\d{6}$/.test(dan)) return null;
  const points = (Array.isArray(series.points) ? series.points : [])
    .map(normalizePoint)
    .filter(Boolean)
    .sort((left, right) => Date.parse(left.checkedAt) - Date.parse(right.checkedAt))
    .slice(-MAX_HISTORY_POINTS_PER_SERIES);
  return {
    storeId,
    storeName: String(series.storeName || storeId),
    storePostcode: String(series.storePostcode || ""),
    dan,
    productName: String(series.productName || dan),
    points,
  };
}

export function normalizeState(parsed) {
  const source = isRecord(parsed) ? parsed : {};
  const history = {};
  if (isRecord(source.history)) {
    for (const [key, series] of Object.entries(source.history)) {
      const normalized = normalizeSeries(key, series);
      if (normalized) history[`${normalized.storeId}:${normalized.dan}`] = normalized;
    }
  }
  return {
    version: 2,
    items: isRecord(source.items) ? source.items : {},
    history,
    ...(source.updatedAt ? { updatedAt: String(source.updatedAt) } : {}),
  };
}

export function recordHistory(state, { store, product, current }) {
  const storeId = String(store.id);
  const dan = String(product.dan);
  const key = `${storeId}:${dan}`;
  state.history ||= {};
  const series = state.history[key] || {
    storeId,
    dan,
    points: [],
  };
  series.storeName = `${store.city} – ${store.street}`;
  series.storePostcode = String(store.postcode || "");
  series.productName = String(product.name || dan);
  series.points ||= [];
  const point = normalizePoint(current);
  if (!point) return false;
  const previous = series.points.at(-1);
  const changed = !previous
    || previous.stock !== point.stock
    || previous.available !== point.available;
  if (changed) {
    series.points.push(point);
    if (series.points.length > MAX_HISTORY_POINTS_PER_SERIES) {
      series.points.splice(0, series.points.length - MAX_HISTORY_POINTS_PER_SERIES);
    }
  }
  state.history[key] = series;
  return changed;
}

function seriesSummary(series, current) {
  const lastPoint = series.points.at(-1) || null;
  return {
    storeId: series.storeId,
    storeName: series.storeName,
    storePostcode: series.storePostcode,
    dan: series.dan,
    productName: series.productName,
    pointCount: series.points.length,
    firstCheckedAt: series.points[0]?.checkedAt || null,
    lastChangedAt: lastPoint?.checkedAt || null,
    currentCheckedAt: current?.checkedAt || lastPoint?.checkedAt || null,
    currentStock: current?.stock ?? lastPoint?.stock ?? null,
    currentAvailable: current?.available ?? lastPoint?.available ?? null,
  };
}

function currentItem(state, series) {
  return state.items?.[`${series.storeId}:${series.dan}`] || null;
}

function addCurrentEndpoint(points, current) {
  if (!current || !Number.isFinite(Number(current.stock)) || Number.isNaN(Date.parse(current.checkedAt))) {
    return points;
  }
  const last = points.at(-1);
  const currentTimestamp = Date.parse(current.checkedAt);
  const lastTimestamp = last ? Date.parse(last.checkedAt) : null;
  if (!last || currentTimestamp > lastTimestamp) {
    points.push({
      checkedAt: String(current.checkedAt),
      stock: Number(current.stock),
      available: Boolean(current.available),
      current: true,
    });
  } else if (currentTimestamp === lastTimestamp) {
    const { anchor: _anchor, ...lastPoint } = last;
    points[points.length - 1] = { ...lastPoint, current: true };
  }
  return points;
}

function filterPoints(points, days, now) {
  if (days === null || !points.length) return points.map((point) => ({ ...point }));
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  const within = points.filter((point) => Date.parse(point.checkedAt) >= cutoff).map((point) => ({ ...point }));
  const anchor = [...points].reverse().find((point) => Date.parse(point.checkedAt) < cutoff);
  if (anchor) within.unshift({ ...anchor, checkedAt: new Date(cutoff).toISOString(), anchor: true });
  return within;
}

function* seriesMovements(series, days, now) {
  const cutoff = days === null ? null : now.getTime() - days * 24 * 60 * 60 * 1000;
  for (let index = 1; index < series.points.length; index += 1) {
    const previous = series.points[index - 1];
    const current = series.points[index];
    if (cutoff !== null && Date.parse(current.checkedAt) < cutoff) continue;
    const delta = current.stock - previous.stock;
    const availabilityChanged = previous.available !== current.available;
    if (delta === 0 && !availabilityChanged) continue;
    yield {
      checkedAt: current.checkedAt,
      storeId: series.storeId,
      dan: series.dan,
      productName: series.productName,
      previousStock: previous.stock,
      stock: current.stock,
      delta,
      direction: delta > 0 ? "in" : delta < 0 ? "out" : "availability",
      previousAvailable: previous.available,
      available: current.available,
      availabilityChanged,
    };
  }
}

function compareMovements(left, right) {
  return timestampOrEpoch(left.checkedAt) - timestampOrEpoch(right.checkedAt)
    || left.dan.localeCompare(right.dan)
    || left.productName.localeCompare(right.productName, "de");
}

function addLatestMovement(heap, movement) {
  if (heap.length < MAX_STORE_MOVEMENTS) {
    heap.push(movement);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compareMovements(heap[parent], heap[index]) <= 0) break;
      [heap[parent], heap[index]] = [heap[index], heap[parent]];
      index = parent;
    }
    return;
  }
  if (compareMovements(movement, heap[0]) <= 0) return;
  heap[0] = movement;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    let smallest = index;
    if (left < heap.length && compareMovements(heap[left], heap[smallest]) < 0) smallest = left;
    if (right < heap.length && compareMovements(heap[right], heap[smallest]) < 0) smallest = right;
    if (smallest === index) break;
    [heap[index], heap[smallest]] = [heap[smallest], heap[index]];
    index = smallest;
  }
}

function getStoreHistoryView(state, allSeries, storeId, period, days, now) {
  const storeSeries = Object.values(state.history || {})
    .filter((series) => series.storeId === storeId);
  if (!storeSeries.length) {
    return {
      mode: "store", period, series: allSeries, selection: null, points: [], movements: [], changes: 0,
    };
  }
  const latestMovements = [];
  const changedProducts = new Set();
  let changes = 0;
  let incomingUnits = 0;
  let outgoingUnits = 0;
  for (const series of storeSeries) {
    for (const movement of seriesMovements(series, days, now)) {
      changes += 1;
      incomingUnits += Math.max(0, movement.delta);
      outgoingUnits += Math.max(0, -movement.delta);
      changedProducts.add(movement.dan);
      addLatestMovement(latestMovements, movement);
    }
  }
  latestMovements.sort((left, right) => compareMovements(right, left));
  const latestSeries = [...storeSeries].sort((left, right) => timestampOrEpoch(
    currentItem(state, right)?.checkedAt || right.points.at(-1)?.checkedAt,
  ) - timestampOrEpoch(
    currentItem(state, left)?.checkedAt || left.points.at(-1)?.checkedAt,
  ))[0];
  return {
    mode: "store",
    period,
    series: allSeries,
    selection: {
      storeId,
      storeName: latestSeries.storeName,
      storePostcode: latestSeries.storePostcode,
    },
    points: [],
    movements: latestMovements,
    changes,
    incomingUnits,
    outgoingUnits,
    productsChanged: changedProducts.size,
    truncated: changes > MAX_STORE_MOVEMENTS,
  };
}

export function getHistoryView(state, { dan = null, storeId = null, period = "30", now = new Date() } = {}) {
  if (!PERIOD_DAYS.has(period)) throw new Error("Ungültiger Zeitraum für den Bestandsverlauf.");
  if (dan && !/^\d{6}$/.test(dan)) throw new Error("Ungültige DAN für den Bestandsverlauf.");
  if (storeId && !/^\d+$/.test(storeId)) throw new Error("Ungültige Filial-ID für den Bestandsverlauf.");
  const allSeries = Object.values(state.history || {})
    .map((series) => seriesSummary(series, currentItem(state, series)))
    .sort((left, right) => timestampOrEpoch(right.currentCheckedAt) - timestampOrEpoch(left.currentCheckedAt));
  const days = PERIOD_DAYS.get(period);
  if (storeId && !dan) return getStoreHistoryView(state, allSeries, storeId, period, days, now);
  const candidates = Object.values(state.history || {})
    .filter((series) => (!dan || series.dan === dan) && (!storeId || series.storeId === storeId))
    .map((series) => ({ series, current: currentItem(state, series) }))
    .sort((left, right) => timestampOrEpoch(right.current?.checkedAt || right.series.points.at(-1)?.checkedAt)
      - timestampOrEpoch(left.current?.checkedAt || left.series.points.at(-1)?.checkedAt));
  const selected = candidates[0] || null;
  if (!selected) return {
    mode: "series", period, series: allSeries, selection: null, points: [], movements: [], changes: 0,
  };
  const points = addCurrentEndpoint(filterPoints(selected.series.points, days, now), selected.current);
  return {
    mode: "series",
    period,
    series: allSeries,
    selection: seriesSummary(selected.series, selected.current),
    points,
    movements: [],
    changes: [...seriesMovements(selected.series, days, now)].length,
  };
}
