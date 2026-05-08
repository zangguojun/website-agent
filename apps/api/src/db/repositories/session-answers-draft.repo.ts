import type { ScoredAnswer } from '@website-agent/core';

const drafts = new Map<string, ScoredAnswer[]>();

function storeKey(sessionId: string, ownerId: string): string {
  return `${sessionId}::${ownerId}`;
}

export function resetSessionAnswersDrafts(): void {
  drafts.clear();
}

export function setSessionAnswersDraft(
  sessionId: string,
  ownerId: string,
  answers: ScoredAnswer[],
): void {
  drafts.set(storeKey(sessionId, ownerId), answers.map((a) => ({ ...a })));
}

export function takeSessionAnswersDraft(sessionId: string, ownerId: string): ScoredAnswer[] | null {
  const k = storeKey(sessionId, ownerId);
  const val = drafts.get(k);
  if (!val) return null;
  drafts.delete(k);
  return val;
}
