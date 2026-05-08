import { and, desc, eq } from 'drizzle-orm';

import type { OwnerId } from '@website-agent/core';

import { db } from '../client';
import { sessions as sessionsTable, streamCheckpoints as checkpointsTable } from '../schema';

export type StreamCheckpointRow = {
  id: string;
  phase: string;
  streamCursor: string;
  summary: string;
  clientVisibleSeq: string | null;
  createdAt: string;
};

/** Latest checkpoint scoped to `(session_id, owner_id)` via join — no `owner_id` on checkpoint table itself. */
export async function getLatestStreamCheckpoint(params: {
  sessionId: string;
  ownerId: OwnerId;
}): Promise<StreamCheckpointRow | null> {
  if (!db) {
    return null;
  }

  const rows = await db
    .select({
      id: checkpointsTable.id,
      phase: checkpointsTable.phase,
      streamCursor: checkpointsTable.streamCursor,
      summary: checkpointsTable.summary,
      clientVisibleSeq: checkpointsTable.clientVisibleSeq,
      createdAt: checkpointsTable.createdAt,
    })
    .from(checkpointsTable)
    .innerJoin(sessionsTable, eq(checkpointsTable.sessionId, sessionsTable.id))
    .where(
      and(eq(checkpointsTable.sessionId, params.sessionId), eq(sessionsTable.ownerId, params.ownerId)),
    )
    .orderBy(desc(checkpointsTable.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    phase: row.phase,
    streamCursor: String(row.streamCursor),
    summary: row.summary,
    clientVisibleSeq: row.clientVisibleSeq !== null ? String(row.clientVisibleSeq) : null,
    createdAt: row.createdAt.toISOString(),
  };
}
