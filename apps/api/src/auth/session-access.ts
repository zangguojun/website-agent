import type { OwnerId } from '@website-agent/core';
import type { SessionRecord } from '../db/repositories/sessions.repo';

export type SessionAccessResult =
  | { ok: true; session: SessionRecord }
  | { ok: false; response: Response };

/** 404 if missing session; **403** if it exists under another owner. */
export function requireSessionOwnedBy(
  row: SessionRecord | null,
  ownerId: OwnerId,
): SessionAccessResult {
  if (!row) {
    return {
      ok: false,
      response: Response.json({ error: 'Session not found' }, { status: 404 }),
    };
  }

  if (row.ownerId !== ownerId) {
    return {
      ok: false,
      response: Response.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, session: row };
}
