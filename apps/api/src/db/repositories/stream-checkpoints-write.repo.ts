import { db } from '../client';
import { streamCheckpoints as checkpointsTable } from '../schema';

const lastWriteAt = new Map<string, number>();

export function resetStreamCheckpointThrottle(): void {
  lastWriteAt.clear();
}

/** Pure predicate for throttle tests (`Task H`): write when interval **or** length threshold met. */
export function shouldWriteStreamCheckpoint(
  nowMs: number,
  lastWrittenAtMs: number,
  summaryLength: number,
  options?: { minIntervalMs?: number; minSummaryChars?: number },
): boolean {
  const minIntervalMs = options?.minIntervalMs ?? 2_000;
  const minSummaryChars = options?.minSummaryChars ?? 512;
  return (
    summaryLength >= minSummaryChars || nowMs - lastWrittenAtMs >= minIntervalMs
  );
}

/**
 * Throttle checkpoint rows: insert when **either** enough time passed **or** summary is long (plan §H).
 */
export async function maybeAppendStreamCheckpoint(input: {
  sessionId: string;
  ownerId: string;
  phase: string;
  summary: string;
  clientVisibleSeq: bigint;
  minIntervalMs?: number;
  minSummaryChars?: number;
}): Promise<void> {
  if (!db) return;

  const key = `${input.sessionId}::${input.phase}`;
  const now = Date.now();
  const minInterval = input.minIntervalMs ?? 2_000;
  const minChars = input.minSummaryChars ?? 512;
  const prev = lastWriteAt.get(key) ?? 0;

  const shouldPersist = shouldWriteStreamCheckpoint(now, prev, input.summary.length, {
    minIntervalMs: minInterval,
    minSummaryChars: minChars,
  });

  if (!shouldPersist) {
    return;
  }

  lastWriteAt.set(key, now);

  await db.insert(checkpointsTable).values({
    sessionId: input.sessionId,
    phase: input.phase,
    summary: input.summary.slice(0, 8_000),
    clientVisibleSeq: input.clientVisibleSeq,
    streamCursor: input.clientVisibleSeq,
  });
}
