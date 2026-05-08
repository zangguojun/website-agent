import { authenticationErrorResponse } from '../../../../../auth/http-errors';
import { requireSessionOwnedBy } from '../../../../../auth/session-access';
import { resolveOwnerId } from '../../../../../auth/resolve-owner';
import { getSessionById } from '../../../../../db/repositories/sessions.repo';
import { runClarificationWorkflow } from '../../../../../mastra/workflows/clarification.workflow';
import { encodeSse, sseResponse } from '../../../../../sse/encode';

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const ownerId = await resolveOwnerId(request.headers);
    const { id } = await context.params;
    const row = await getSessionById(id);
    const gate = requireSessionOwnedBy(row, ownerId);
    if (!gate.ok) return gate.response;

    const session = gate.session;
    const clarification = await runClarificationWorkflow({ rawTopic: session.rawTopic });
    return sseResponse([encodeSse('clarification', clarification)]);
  } catch (error) {
    const unauthorized = authenticationErrorResponse(error);
    if (unauthorized) return unauthorized;
    throw error;
  }
}
