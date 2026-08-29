export function matchesBaselineResetTarget(entry, { dan = null, storeId = null } = {}) {
  return (!dan || String(entry.dan) === String(dan))
    && (!storeId || String(entry.storeId) === String(storeId));
}

export function retainResultsAfterBaselineReset(results, target = {}) {
  return results.filter((result) => !matchesBaselineResetTarget(result, target));
}
