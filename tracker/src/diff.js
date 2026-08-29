export function classifyChange(previous, current, notifications = {}) {
  const options = {
    notifyOnInitialStock: false,
    onRestock: true,
    onOutOfStock: true,
    onStockChange: true,
    onAvailabilityChange: false,
    ...notifications,
  };

  if (!previous) {
    return options.notifyOnInitialStock ? "initial_stock" : null;
  }

  if (previous.stock === 0 && current.stock > 0 && options.onRestock) {
    return "restock";
  }
  if (previous.stock > 0 && current.stock === 0 && options.onOutOfStock) {
    return "out_of_stock";
  }
  if (previous.stock !== current.stock && options.onStockChange) {
    return "stock_change";
  }
  if (previous.available !== current.available && options.onAvailabilityChange) {
    return "availability_change";
  }
  return null;
}

export function changeLabel(type) {
  return {
    initial_stock: "Erstes Prüfergebnis",
    restock: "Wieder verfügbar",
    out_of_stock: "Ausverkauft",
    stock_change: "Bestand geändert",
    availability_change: "Filialstatus geändert",
  }[type] ?? "Änderung";
}
