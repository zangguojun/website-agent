import { afterEach, describe, expect, it, vi } from 'vitest';

import { OwnerResolutionError, resolveOwnerId } from '../src/auth/resolve-owner';

describe('resolveOwnerId', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves device id when no Bearer', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', '');
    const headers = new Headers({ 'x-device-id': 'device_abc' });
    await expect(resolveOwnerId(headers)).resolves.toBe('device:device_abc');
  });

  it('rejects Bearer when Clerk secret is not configured', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', '');
    const headers = new Headers({
      authorization: 'Bearer fake.jwt.stub',
      'x-device-id': 'device_abc',
    });
    try {
      await resolveOwnerId(headers);
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(OwnerResolutionError);
      expect((e as OwnerResolutionError).statusCode).toBe(503);
    }
  });

  it('requires identity when neither Bearer nor device', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', '');
    try {
      await resolveOwnerId(new Headers());
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(OwnerResolutionError);
      expect((e as OwnerResolutionError).statusCode).toBe(401);
    }
  });
});
