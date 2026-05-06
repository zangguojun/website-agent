import type { OwnerId } from '@website-agent/core';
import { toClerkOwnerId, toDeviceOwnerId } from '@website-agent/core';

export function ownerIdFromHeaders(headers: Headers): OwnerId {
  const clerkUserId = headers.get('x-clerk-user-id');
  if (clerkUserId) return toClerkOwnerId(clerkUserId);

  const deviceId = headers.get('x-device-id');
  if (deviceId) return toDeviceOwnerId(deviceId);

  throw new Error('Missing owner identity');
}
