export function buildStoreQueryScopes(config) {
  const areas = [...new Set((config.searchAreas || []).map((area) => String(area.postcode)))];
  const coveredPostcodes = new Set(areas);
  const scopes = areas.map((postcode) => ({ postcode, mode: "all", stores: [] }));
  const selectedByPostcode = new Map();

  for (const store of config.stores || []) {
    const postcode = String(store.postcode);
    if (coveredPostcodes.has(postcode)) continue;
    selectedByPostcode.set(postcode, [...(selectedByPostcode.get(postcode) || []), store]);
  }
  for (const [postcode, stores] of selectedByPostcode) {
    scopes.push({ postcode, mode: "selected", stores });
  }
  return scopes;
}
