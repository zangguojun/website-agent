import type { InferSelectModel } from 'drizzle-orm';

import type { OwnerId } from '@website-agent/core';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../client';
import { sessions as sessionsTable } from '../schema';

export type SessionRow = InferSelectModel<typeof sessionsTable>;

export type SessionRecord = {
  id: string;
  ownerId: OwnerId;
  status: string;
  workflowPhase: string;
  /** JSON-safe string for BIGINT */
  lastSequence: string;
  rawTopic: string;
  refinedTopic: string | null;
  dimensions: SessionRow['dimensions'];
  totalQuestions: number | null;
  createdAt: string;
  updatedAt: string;
};

/** In-memory store when `DATABASE_URL` is absent (tests / local demos). */

type MemoryPayload = Omit<SessionRecord, 'lastSequence'> & { lastSequenceBig: bigint };

const inMemorySessions = new Map<string, MemoryPayload>();

function rowToRecord(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    ownerId: row.ownerId as OwnerId,
    status: row.status,
    workflowPhase: row.workflowPhase,
    lastSequence: String(row.lastSequence),
    rawTopic: row.rawTopic,
    refinedTopic: row.refinedTopic,
    dimensions: row.dimensions,
    totalQuestions: row.totalQuestions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function resetInMemorySessions(): void {
  inMemorySessions.clear();
}

/** Advance `last_sequence` for in-memory sessions (pairs with `appendAgentStep` when `DATABASE_URL` is unset). */
export function bumpMemoryAgentSequence(sessionId: string, ownerId: OwnerId): bigint | null {
  const s = inMemorySessions.get(sessionId);
  if (!s || s.ownerId !== ownerId) return null;
  const next = s.lastSequenceBig + 1n;
  inMemorySessions.set(sessionId, {
    ...s,
    lastSequenceBig: next,
    updatedAt: new Date().toISOString(),
  });
  return next;
}

export type SessionMutationPatch = Partial<
  Pick<SessionRecord, 'workflowPhase' | 'status' | 'refinedTopic' | 'dimensions' | 'totalQuestions'>
>;

export async function updateSessionForOwner(
  ownerId: OwnerId,
  sessionId: string,
  patch: SessionMutationPatch,
): Promise<SessionRecord | null> {
  if (db) {
    const [row] = await db
      .update(sessionsTable)
      .set({
        ...(patch.workflowPhase !== undefined ? { workflowPhase: patch.workflowPhase } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.refinedTopic !== undefined ? { refinedTopic: patch.refinedTopic } : {}),
        ...(patch.dimensions !== undefined ? { dimensions: patch.dimensions } : {}),
        ...(patch.totalQuestions !== undefined ? { totalQuestions: patch.totalQuestions } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(sessionsTable.id, sessionId), eq(sessionsTable.ownerId, ownerId)))
      .returning();

    return row ? rowToRecord(row) : null;
  }

  const s = inMemorySessions.get(sessionId);
  if (!s || s.ownerId !== ownerId) return null;

  const merged: MemoryPayload = {
    ...s,
    ...(patch.workflowPhase !== undefined ? { workflowPhase: patch.workflowPhase } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.refinedTopic !== undefined ? { refinedTopic: patch.refinedTopic } : {}),
    ...(patch.dimensions !== undefined ? { dimensions: patch.dimensions } : {}),
    ...(patch.totalQuestions !== undefined ? { totalQuestions: patch.totalQuestions } : {}),
    updatedAt: new Date().toISOString(),
  };
  inMemorySessions.set(sessionId, merged);
  const { lastSequenceBig, ...rest } = merged;
  return { ...rest, lastSequence: String(lastSequenceBig) };
}

/** Exists check without owner constraint — combine with `requireSessionOwnedBy`. */
export async function getSessionById(sessionId: string): Promise<SessionRecord | null> {
  if (db) {
    const rows = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));

    const row = rows[0];
    return row ? rowToRecord(row) : null;
  }

  const s = inMemorySessions.get(sessionId);
  if (!s) return null;
  const { lastSequenceBig, ...rest } = s;
  return { ...rest, lastSequence: String(lastSequenceBig) };
}

export async function createSession(input: { ownerId: OwnerId; rawTopic: string }): Promise<SessionRecord> {
  if (db) {
    const [row] = await db
      .insert(sessionsTable)
      .values({
        ownerId: input.ownerId,
        status: 'clarifying',
        workflowPhase: 'clarify',
        lastSequence: 0n,
        rawTopic: input.rawTopic,
      })
      .returning();

    if (!row) throw new Error('Failed to create session');
    return rowToRecord(row);
  }

  const id = crypto.randomUUID();
  const createdAtIso = new Date().toISOString();
  const rec: SessionRecord = {
    id,
    ownerId: input.ownerId,
    status: 'clarifying',
    workflowPhase: 'clarify',
    lastSequence: '0',
    rawTopic: input.rawTopic,
    refinedTopic: null,
    dimensions: null,
    totalQuestions: null,
    createdAt: createdAtIso,
    updatedAt: createdAtIso,
  };
  inMemorySessions.set(id, { ...rec, lastSequenceBig: 0n });
  return rec;
}

export async function listSessionsForOwner(ownerId: OwnerId): Promise<SessionRecord[]> {
  if (db) {
    const rows = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.ownerId, ownerId))
      .orderBy(desc(sessionsTable.createdAt));
    return rows.map(rowToRecord);
  }

  return [...inMemorySessions.values()]
    .filter((s) => s.ownerId === ownerId)
    .map(({ lastSequenceBig, ...rest }) => ({ ...rest, lastSequence: String(lastSequenceBig) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSessionForOwner(ownerId: OwnerId, sessionId: string): Promise<SessionRecord | null> {
  if (db) {
    const rows = await db
      .select()
      .from(sessionsTable)
      .where(and(eq(sessionsTable.id, sessionId), eq(sessionsTable.ownerId, ownerId)));

    const row = rows[0];
    return row ? rowToRecord(row) : null;
  }

  const s = inMemorySessions.get(sessionId);
  if (!s || s.ownerId !== ownerId) return null;
  const { lastSequenceBig, ...rest } = s;
  return { ...rest, lastSequence: String(lastSequenceBig) };
}
