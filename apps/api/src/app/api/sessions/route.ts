import { ownerIdFromHeaders } from '../../../auth/owner-id';
import { createSession, listSessionsForOwner } from '../../../db/repositories/sessions.repo';

export async function GET(request: Request) {
  try {
    const ownerId = ownerIdFromHeaders(request.headers);
    const sessions = await listSessionsForOwner(ownerId);
    return Response.json({ sessions });
  } catch (error) {
    return ownerErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = ownerIdFromHeaders(request.headers);
    const body = await request.json().catch(() => ({}));
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';

    if (!topic) {
      return Response.json({ error: 'topic is required' }, { status: 400 });
    }

    const session = await createSession({ ownerId, rawTopic: topic });
    return Response.json({ session }, { status: 201 });
  } catch (error) {
    return ownerErrorResponse(error);
  }
}

function ownerErrorResponse(error: unknown): Response {
  if (error instanceof Error && error.message === 'Missing owner identity') {
    return Response.json({ error: error.message }, { status: 401 });
  }
  throw error;
}
