import { describe, expect, it } from 'vitest';
import { ownerIdFromHeaders } from '../src/auth/owner-id';

describe('ownerIdFromHeaders', () => {
  it('prefers Clerk user id in trusted middleware context', () => {
    const headers = new Headers({ 'x-clerk-user-id': 'user_123', 'x-device-id': 'device_abc' });
    expect(ownerIdFromHeaders(headers, { trustClerkHeader: true })).toBe('clerk:user_123');
  });

  it('ignores Clerk user id without trusted middleware context', () => {
    const headers = new Headers({ 'x-clerk-user-id': 'user_123', 'x-device-id': 'device_abc' });
    expect(ownerIdFromHeaders(headers)).toBe('device:device_abc');
  });

  it('falls back to device id', () => {
    const headers = new Headers({ 'x-device-id': 'device_abc' });
    expect(ownerIdFromHeaders(headers)).toBe('device:device_abc');
  });

  it('throws for missing identity', () => {
    expect(() => ownerIdFromHeaders(new Headers())).toThrow('Missing owner identity');
  });
});
