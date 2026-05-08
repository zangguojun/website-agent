import { and, eq, sql } from 'drizzle-orm';

import type { OwnerId } from '@website-agent/core';

import { db } from '../client';
import { agentSteps as agentStepsTable, sessions as sessionsTable } from '../schema';
import { bumpMemoryAgentSequence } from './sessions.repo';

const inMemorySteps = new Map<
  string,
  Array<{
    sequence: bigint;
    phase: string;
    stepType: string;
    payload: Record<string, unknown>;
  }>
>();

function bucketKey(sessionId: string, ownerId: string): string {
  return `${sessionId}::${ownerId}`;
}

export function resetInMemoryAgentSteps(): void {
  inMemorySteps.clear();
}

export async function appendAgentStep(input: {
  sessionId: string;
  ownerId: string;
  phase: string;
  stepType: string;
  payload: Record<string, unknown>;
}): Promise<{ sequence: bigint } | null> {
  if (!db) {
    const seq = bumpMemoryAgentSequence(input.sessionId, input.ownerId as OwnerId);
    if (seq === null) return null;
    const key = bucketKey(input.sessionId, input.ownerId);
    const bucket = inMemorySteps.get(key) ?? [];
    bucket.push({
      sequence: seq,
      phase: input.phase,
      stepType: input.stepType,
      payload: input.payload,
    });
    inMemorySteps.set(key, bucket);
    return { sequence: seq };
  }

  const incremented = await db
    .update(sessionsTable)
    .set({
      lastSequence: sql`${sessionsTable.lastSequence} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(sessionsTable.id, input.sessionId), eq(sessionsTable.ownerId, input.ownerId)))
    .returning({ seq: sessionsTable.lastSequence });

  const updated = incremented[0];
  if (!updated?.seq) {
    return null;
  }

  const seq = updated.seq;

  await db.insert(agentStepsTable).values({
    sessionId: input.sessionId,
    ownerId: input.ownerId,
    phase: input.phase,
    stepType: input.stepType,
    payload: input.payload,
    sequence: seq,
  });

  return { sequence: seq };
}
