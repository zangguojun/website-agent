import type { OwnerId } from '@website-agent/core';
import { verifyToken } from '@clerk/backend';
import { toClerkOwnerId, toDeviceOwnerId } from '@website-agent/core';

export class OwnerResolutionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

/**
 * JWT first (validated with Clerk SECRET_KEY), then anonymous `x-device-id`.
 * Production must set `CLERK_SECRET_KEY` when enabling login.
 */
export async function resolveOwnerId(headers: Headers): Promise<OwnerId> {
  const auth = headers.get('authorization');
  const bearerMatch = auth?.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch?.[1]?.trim();
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (token && secretKey) {
    try {
      const payload = await verifyToken(token, { secretKey });
      if (payload?.sub && typeof payload.sub === 'string') {
        return toClerkOwnerId(payload.sub);
      }
    } catch {
      throw new OwnerResolutionError('Invalid or expired session', 401);
    }

    throw new OwnerResolutionError('Invalid or expired session', 401);
  }

  if (token && !secretKey) {
    throw new OwnerResolutionError('Server authentication is misconfigured', 503);
  }

  const deviceId = headers.get('x-device-id');
  if (!deviceId) {
    throw new OwnerResolutionError('Missing owner identity', 401);
  }

  try {
    return toDeviceOwnerId(deviceId);
  } catch {
    throw new OwnerResolutionError('Invalid device identity', 401);
  }
}
