import { authenticationErrorResponse } from '../../../../../auth/http-errors';
import { requireSessionOwnedBy } from '../../../../../auth/session-access';
import { resolveOwnerId } from '../../../../../auth/resolve-owner';
import { listSessionMessagesDesc, messageRowToJson } from '../../../../../db/repositories/session-messages.repo';
import { getSessionById } from '../../../../../db/repositories/sessions.repo';
import { getLatestStreamCheckpoint } from '../../../../../db/repositories/stream-checkpoints.repo';

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

/** REST snapshot per spec §5.4: phase + tail messages + newest checkpoint (if any). */

export async function GET(request: Request, context: RouteContext) {
  try {
    const ownerId = await resolveOwnerId(request.headers);
    const { id } = await context.params;
    const row = await getSessionById(id);
    const gate = requireSessionOwnedBy(row, ownerId);
    if (!gate.ok) return gate.response;

    const [recentDesc, latestCheckpoint] = await Promise.all([
      listSessionMessagesDesc({ sessionId: id, ownerId, limit: 50 }),
      getLatestStreamCheckpoint({ sessionId: id, ownerId }),
    ]);

    const messagesChronological = [...recentDesc].reverse().map(messageRowToJson);

    return Response.json({
      session: gate.session,
      messages: messagesChronological,
      latestCheckpoint,
    });
  } catch (error) {
    const unauthorized = authenticationErrorResponse(error);
    if (unauthorized) return unauthorized;
    throw error;
  }
}
