import type { OwnerId } from '@website-agent/core';
import { toClerkOwnerId, toDeviceOwnerId } from '@website-agent/core';

type OwnerIdFromHeadersOptions = { trustClerkHeader?: boolean };

export function ownerIdFromHeaders(headers: Headers, options: OwnerIdFromHeadersOptions = {}): OwnerId {
  const clerkUserId = headers.get('x-clerk-user-id');
  if (options.trustClerkHeader && clerkUserId) return toClerkOwnerId(clerkUserId);

  const deviceId = headers.get('x-device-id');
  if (deviceId) return toDeviceOwnerId(deviceId);

  throw new Error('Missing owner identity');
}
