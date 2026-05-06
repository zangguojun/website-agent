import type { OwnerId } from '@website-agent/core';

export type SessionRecord = {
  id: string;
  ownerId: OwnerId;
  status: 'input' | 'clarifying' | 'generating' | 'answering' | 'finalized' | 'expired';
  rawTopic: string;
  refinedTopic: string | null;
  createdAt: string;
};

const inMemorySessions = new Map<string, SessionRecord>();

export function resetInMemorySessions(): void {
  inMemorySessions.clear();
}

export async function createSession(input: { ownerId: OwnerId; rawTopic: string }): Promise<SessionRecord> {
  const session: SessionRecord = {
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    status: 'clarifying',
    rawTopic: input.rawTopic,
    refinedTopic: null,
    createdAt: new Date().toISOString(),
  };
  inMemorySessions.set(session.id, session);
  return session;
}

export async function listSessionsForOwner(ownerId: OwnerId): Promise<SessionRecord[]> {
  return [...inMemorySessions.values()].filter((session) => session.ownerId === ownerId);
}

export async function getSessionForOwner(ownerId: OwnerId, sessionId: string): Promise<SessionRecord | null> {
  const session = inMemorySessions.get(sessionId);
  if (!session || session.ownerId !== ownerId) return null;
  return session;
}
