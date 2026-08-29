export function getSetupState(config = {}, telegram = {}) {
  const telegramConnected = Boolean(
    String(telegram.botToken || "").trim()
    && String(telegram.chatId || "").trim(),
  );
  const locationConfigured = Boolean(
    (Array.isArray(config.searchAreas) && config.searchAreas.length)
    || (Array.isArray(config.stores) && config.stores.length),
  );
  const productConfigured = Boolean(Array.isArray(config.products) && config.products.length);
  const complete = telegramConnected && locationConfigured && productConfigured;
  const step = !telegramConnected
    ? "telegram"
    : !locationConfigured
      ? "location"
      : !productConfigured
        ? "product"
        : "complete";

  return {
    complete,
    step,
    telegramConnected,
    locationConfigured,
    productConfigured,
  };
}

