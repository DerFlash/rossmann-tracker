function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("aborted", "AbortError");
}

export async function applyTelegramPairing({ bot, nextOffset, saveOffset, commitCredentials, signal = null }) {
  const previousOffset = bot.suspend();
  let offsetWriteAttempted = false;
  let rollbackCredentials = null;

  try {
    offsetWriteAttempted = true;
    await saveOffset(nextOffset);
    throwIfAborted(signal);
    rollbackCredentials = await commitCredentials();
    throwIfAborted(signal);
    bot.resume(nextOffset);
  } catch (error) {
    const rollbackErrors = [];
    if (rollbackCredentials) {
      try {
        await rollbackCredentials();
      } catch (failure) {
        rollbackErrors.push(failure);
      }
    }
    if (offsetWriteAttempted) {
      try {
        await saveOffset(previousOffset);
      } catch (failure) {
        rollbackErrors.push(failure);
      }
    }
    bot.resume(previousOffset);
    if (rollbackErrors.length) {
      throw new AggregateError([error, ...rollbackErrors], "Telegram-Pairing und Rollback fehlgeschlagen.");
    }
    throw error;
  }
}
