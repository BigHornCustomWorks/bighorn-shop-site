/** Inbox hide-stamp. Empty means the row is still in the inbox. */

export type ArchiveKind = "order" | "quote" | "payment";

export function isArchiveKind(value: unknown): value is ArchiveKind {
  return value === "order" || value === "quote" || value === "payment";
}

/**
 * Master Control saves the whole quote list. A tab that archived nothing, or
 * that never loaded a newer stamp, must not clear the server's archivedAt.
 * A quote the server does not have yet stays unarchived.
 */
/**
 * A Master Control tab opened before a new order or quote arrived must not
 * delete that row on its next save. Rows only the server has are kept.
 */
export function keepServerRows<T extends { id: string }>(incoming: unknown[], current: T[]): unknown[] {
  const seen = new Set<string>();
  const merged: unknown[] = [];
  for (const row of incoming) {
    merged.push(row);
    if (row && typeof row === "object") {
      const id = (row as { id?: unknown }).id;
      if (typeof id === "string") seen.add(id);
    }
  }
  for (const server of current) {
    if (!seen.has(server.id)) merged.push(server);
  }
  return merged;
}

export function keepIncomingArchive(
  incoming: unknown[],
  current: { id: string; archivedAt?: string }[],
): unknown[] {
  const stamps = new Map(current.map((row) => [row.id, (row.archivedAt || "").trim().slice(0, 40)]));
  return incoming.map((row) => {
    if (!row || typeof row !== "object") return row;
    const id = (row as { id?: unknown }).id;
    const stamp = typeof id === "string" && stamps.has(id) ? stamps.get(id) || "" : "";
    return { ...(row as object), archivedAt: stamp };
  });
}
