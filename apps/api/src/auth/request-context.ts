import { AsyncLocalStorage } from 'node:async_hooks';
import type { OwnerId } from '@website-agent/core';

type RequestContext = { ownerId: OwnerId };

const storage = new AsyncLocalStorage<RequestContext>();

export async function withRequestContext<T>(context: RequestContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, fn);
}

export function currentOwnerId(): OwnerId {
  const context = storage.getStore();
  if (!context) throw new Error('No owner context');
  return context.ownerId;
}
