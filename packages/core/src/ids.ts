import { z } from 'zod';

export type OwnerId = `device:${string}` | `clerk:${string}`;

export const ownerIdSchema = z.custom<OwnerId>((value) => {
  return typeof value === 'string' && /^(device|clerk):[A-Za-z0-9_-]+$/.test(value);
}, 'OwnerId must start with device: or clerk:');

export function toDeviceOwnerId(deviceId: string): OwnerId {
  if (!/^[A-Za-z0-9_-]+$/.test(deviceId)) throw new Error('Invalid device id');
  return `device:${deviceId}`;
}

export function toClerkOwnerId(userId: string): OwnerId {
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) throw new Error('Invalid Clerk user id');
  return `clerk:${userId}`;
}
