export const CURRENT_SETTINGS_SCHEMA_VERSION = 1;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readSettingsEnvelope(stored) {
  if (!isRecord(stored)) throw new Error("Gespeicherte Einstellungen sind ungültig.");
  const version = stored.version === undefined ? 0 : stored.version;
  if (!Number.isInteger(version) || version < 0) {
    throw new Error("Version der gespeicherten Einstellungen ist ungültig.");
  }
  if (version > CURRENT_SETTINGS_SCHEMA_VERSION) {
    throw new Error(`Einstellungen aus einer neueren Version (${version}) können nicht sicher geladen werden.`);
  }
  return {
    config: isRecord(stored.config) ? stored.config : null,
    telegram: isRecord(stored.telegram) ? stored.telegram : null,
    migratedFrom: version < CURRENT_SETTINGS_SCHEMA_VERSION ? version : null,
  };
}

export function createSettingsEnvelope(config, telegram) {
  return {
    version: CURRENT_SETTINGS_SCHEMA_VERSION,
    config,
    telegram,
  };
}
