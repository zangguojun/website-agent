import { and, asc, desc, eq, gt, or, sql } from 'drizzle-orm';

import type { OwnerId } from '@website-agent/core';
import { db } from '../client';
import { sessionMessages as messagesTable } from '../schema';

type MessageRow = {
  id: string;
  phase: string;
  role: string;
  content: string;
  payload: Record<string, unknown> | null;
  createdAt: Date | null;
};

const inMemoryMessages = new Map<string, MessageRow[]>();

export function resetInMemorySessionMessages(): void {
  inMemoryMessages.clear();
}

function memoryBucketKey(sessionId: string, ownerId: OwnerId): string {
  return `${sessionId}::${ownerId}`;
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ c: createdAt.toISOString(), i: id }), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { c: Date; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      c?: string;
      i?: string;
    };
    const c =
      parsed.c !== undefined &&
      parsed.i !== undefined &&
      typeof parsed.c === 'string' &&
      typeof parsed.i === 'string'
        ? { c: new Date(parsed.c), id: parsed.i }
        : null;
    return c && Number.isFinite(c.c.getTime()) ? c : null;
  } catch {
    return null;
  }
}

export async function countClarifyUserMessages(params: {
  sessionId: string;
  ownerId: OwnerId;
}): Promise<number> {
  if (!db) {
    const key = memoryBucketKey(params.sessionId, params.ownerId);
    const bucket = inMemoryMessages.get(key) ?? [];
    return bucket.filter((m) => m.phase === 'clarify' && m.role === 'user').length;
  }

  const [row] = await db
    .select({ n: sql<number>`cast(count(*) as int)` })
    .from(messagesTable)
    .where(
      and(
        eq(messagesTable.sessionId, params.sessionId),
        eq(messagesTable.ownerId, params.ownerId),
        eq(messagesTable.phase, 'clarify'),
        eq(messagesTable.role, 'user'),
      ),
    );

  return Number(row?.n ?? 0);
}

export async function insertSessionMessage(input: {
  sessionId: string;
  ownerId: OwnerId;
  phase: string;
  role: string;
  content: string;
  payload?: Record<string, unknown> | null;
}): Promise<{ id: string; createdAt: string }> {
  if (!db) {
    const key = memoryBucketKey(input.sessionId, input.ownerId);
    const bucket = inMemoryMessages.get(key) ?? [];
    const row: MessageRow = {
      id: crypto.randomUUID(),
      phase: input.phase,
      role: input.role,
      content: input.content,
      payload: input.payload ?? null,
      createdAt: new Date(),
    };
    bucket.push(row);
    inMemoryMessages.set(key, bucket);
    return { id: row.id, createdAt: (row.createdAt ?? new Date()).toISOString() };
  }

  const [created] = await db
    .insert(messagesTable)
    .values({
      sessionId: input.sessionId,
      ownerId: input.ownerId,
      phase: input.phase,
      role: input.role,
      content: input.content,
      payload: input.payload ?? null,
    })
    .returning({ id: messagesTable.id, createdAt: messagesTable.createdAt });

  if (!created) {
    throw new Error('Failed to insert session message');
  }

  return {
    id: created.id,
    createdAt: (created.createdAt ?? new Date()).toISOString(),
  };
}

/** Newest-first page (snapshot / hydrate tail). Owner-enforced filter. */
export async function listSessionMessagesDesc(params: {
  sessionId: string;
  ownerId: OwnerId;
  limit?: number;
}): Promise<MessageRow[]> {
  const limit = params.limit ?? 100;

  if (!db) {
    const key = memoryBucketKey(params.sessionId, params.ownerId);
    const bucket = inMemoryMessages.get(key) ?? [];
    return [...bucket]
      .sort((a, b) => {
        const at = (a.createdAt ?? new Date(0)).getTime();
        const bt = (b.createdAt ?? new Date(0)).getTime();
        if (bt !== at) return bt - at;
        return b.id.localeCompare(a.id);
      })
      .slice(0, limit);
  }

  return db
    .select({
      id: messagesTable.id,
      phase: messagesTable.phase,
      role: messagesTable.role,
      content: messagesTable.content,
      payload: messagesTable.payload,
      createdAt: messagesTable.createdAt,
    })
    .from(messagesTable)
    .where(and(eq(messagesTable.sessionId, params.sessionId), eq(messagesTable.ownerId, params.ownerId)))
    .orderBy(desc(messagesTable.createdAt), desc(messagesTable.id))
    .limit(limit);
}

/**
 * Chronological paging for chat history: ascending by `(created_at, id)`.
 * `after` resumes after the decoded cursor tuple (exclusive).
 */
export async function listSessionMessagesAscPaged(params: {
  sessionId: string;
  ownerId: OwnerId;
  limit?: number;
  afterCursor?: string | null;
}): Promise<{ messages: MessageRow[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const decoded = params.afterCursor ? decodeCursor(params.afterCursor) : null;
  if (params.afterCursor && !decoded) {
    throw new RangeError('Invalid messages cursor');
  }

  const baseFilter = () =>
    decoded
      ? and(
          eq(messagesTable.sessionId, params.sessionId),
          eq(messagesTable.ownerId, params.ownerId),
          or(
            gt(messagesTable.createdAt, decoded.c),
            and(eq(messagesTable.createdAt, decoded.c), gt(messagesTable.id, decoded.id)),
          ),
        )
      : and(eq(messagesTable.sessionId, params.sessionId), eq(messagesTable.ownerId, params.ownerId));

  if (!db) {
    const key = memoryBucketKey(params.sessionId, params.ownerId);
    const bucket = inMemoryMessages.get(key) ?? [];
    const sorted = [...bucket].sort((a, b) => {
      const at = (a.createdAt ?? new Date(0)).getTime();
      const bt = (b.createdAt ?? new Date(0)).getTime();
      if (at !== bt) return at - bt;
      return a.id.localeCompare(b.id);
    });
    const filtered = decoded
      ? sorted.filter((m) => {
          const t = (m.createdAt ?? new Date(0)).getTime();
          const dt = decoded.c.getTime();
          if (t > dt) return true;
          if (t < dt) return false;
          return m.id > decoded.id;
        })
      : sorted;
    const page = filtered.slice(0, limit);
    const last = page.at(-1);
    return {
      messages: page,
      nextCursor:
        page.length === limit && last?.createdAt
          ? encodeCursor(last.createdAt, last.id)
          : null,
    };
  }

  const page = await db
    .select({
      id: messagesTable.id,
      phase: messagesTable.phase,
      role: messagesTable.role,
      content: messagesTable.content,
      payload: messagesTable.payload,
      createdAt: messagesTable.createdAt,
    })
    .from(messagesTable)
    .where(baseFilter())
    .orderBy(asc(messagesTable.createdAt), asc(messagesTable.id))
    .limit(limit);

  const last = page.at(-1);
  return {
    messages: page,
    nextCursor:
      page.length === limit && last?.createdAt
        ? encodeCursor(last.createdAt, last.id)
        : null,
  };
}

export function messageRowToJson(row: MessageRow) {
  return {
    id: row.id,
    phase: row.phase,
    role: row.role,
    content: row.content,
    payload: row.payload,
    createdAt: row.createdAt?.toISOString() ?? null,
  };
}
