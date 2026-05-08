import { authenticationErrorResponse } from '../../../auth/http-errors';
import { resolveOwnerId } from '../../../auth/resolve-owner';
import { createSession, listSessionsForOwner } from '../../../db/repositories/sessions.repo';

export async function GET(request: Request) {
  try {
    const ownerId = await resolveOwnerId(request.headers);
    const sessions = await listSessionsForOwner(ownerId);
    return Response.json({ sessions });
  } catch (error) {
    const unauthorized = authenticationErrorResponse(error);
    if (unauthorized) return unauthorized;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await resolveOwnerId(request.headers);
    const body = await request.json().catch(() => ({}));
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';

    if (!topic) {
      return Response.json({ error: 'topic is required' }, { status: 400 });
    }

    const session = await createSession({ ownerId, rawTopic: topic });
    return Response.json({ session }, { status: 201 });
  } catch (error) {
    const unauthorized = authenticationErrorResponse(error);
    if (unauthorized) return unauthorized;
    throw error;
  }
}
