import { OwnerResolutionError } from './resolve-owner';

export function authenticationErrorResponse(error: unknown): Response | null {
  if (!(error instanceof OwnerResolutionError)) {
    return null;
  }
  return Response.json({ error: error.message }, { status: error.statusCode });
}
