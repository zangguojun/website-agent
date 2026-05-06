import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSession,
  getSessionForOwner,
  listSessionsForOwner,
  resetInMemorySessions,
} from '../src/db/repositories/sessions.repo';

describe('sessions repository owner isolation', () => {
  beforeEach(() => resetInMemorySessions());

  it('returns only sessions owned by the requested owner', async () => {
    const session = await createSession({ ownerId: 'device:a', rawTopic: 'React Hooks' });
    await createSession({ ownerId: 'device:b', rawTopic: 'TypeScript 泛型' });
    await expect(listSessionsForOwner('device:a')).resolves.toEqual([session]);
  });

  it('does not return another owner session by id', async () => {
    const session = await createSession({ ownerId: 'device:a', rawTopic: 'React Hooks' });
    await expect(getSessionForOwner('device:b', session.id)).resolves.toBeNull();
  });
});
