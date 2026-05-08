import { describe, expect, it } from 'vitest';
import { shouldWriteStreamCheckpoint } from '../src/db/repositories/stream-checkpoints-write.repo';

describe('stream checkpoint throttle (plan Task H)', () => {
  it('allows at most one write per frozen clock when summaries are short', () => {
    const frozenNow = 1_000_000;
    let lastAt = 0;
    let writes = 0;
    for (let i = 0; i < 100; i++) {
      if (shouldWriteStreamCheckpoint(frozenNow, lastAt, 20, { minIntervalMs: 2_000, minSummaryChars: 512 })) {
        writes += 1;
        lastAt = frozenNow;
      }
    }
    expect(writes).toBe(1);
  });

  it('writes immediately when summary crosses length threshold', () => {
    const ok = shouldWriteStreamCheckpoint(100, 100, 600, { minIntervalMs: 2_000, minSummaryChars: 512 });
    expect(ok).toBe(true);
  });
});
