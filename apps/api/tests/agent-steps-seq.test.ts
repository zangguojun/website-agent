import { describe, expect, it } from 'vitest';
import { appendAgentStep } from '../src/db/repositories/agent-steps.repo';
import { resetApiMemoryStores } from '../src/db/repositories/memory-reset';
import { createSession } from '../src/db/repositories/sessions.repo';

describe('appendAgentStep sequences', () => {
  it('assigns strictly increasing bigint sequences when chained', async () => {
    resetApiMemoryStores();
    const session = await createSession({ ownerId: 'device:e2e-seq', rawTopic: 'seq' });

    const first = await appendAgentStep({
      sessionId: session.id,
      ownerId: session.ownerId,
      phase: 'clarify',
      stepType: 'a',
      payload: {},
    });

    const second = await appendAgentStep({
      sessionId: session.id,
      ownerId: session.ownerId,
      phase: 'clarify',
      stepType: 'b',
      payload: {},
    });

    expect(first?.sequence).toBeTruthy();
    expect(second?.sequence).toBeTruthy();
    if (first?.sequence !== undefined && second?.sequence !== undefined) {
      expect(second.sequence > first.sequence).toBe(true);
      expect(Number(second.sequence - first.sequence)).toBe(1);
    }
  });
});
