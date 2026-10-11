let counter = 0;

/** Short unique id; uses crypto.randomUUID when available. */
export function newId(prefix = "id"): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return `${prefix}_${c.randomUUID().slice(0, 8)}${(counter++).toString(36)}`;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}${(counter++).toString(36)}`;
}
