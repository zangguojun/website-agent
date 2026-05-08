export const runtime = 'nodejs';
export const maxDuration = 120;

import { authenticationErrorResponse } from '../../../../../../auth/http-errors';
import { requireSessionOwnedBy } from '../../../../../../auth/session-access';
import { resolveOwnerId } from '../../../../../../auth/resolve-owner';
import { getSessionById } from '../../../../../../db/repositories/sessions.repo';
import { runPlanPhaseStream } from '../../../../../../streaming/phase-streams';
import { assertStreamPhase } from '../../../../../../streaming/stream-phase-policy';

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const ownerId = await resolveOwnerId(request.headers);
    const { id } = await context.params;
    const row = await getSessionById(id);
    const gate = requireSessionOwnedBy(row, ownerId);
    if (!gate.ok) return gate.response;

    const phaseBlocked = assertStreamPhase(gate.session, 'plan');
    if (phaseBlocked) return phaseBlocked;

    return runPlanPhaseStream(gate.session, ownerId);
  } catch (error) {
    const unauthorized = authenticationErrorResponse(error);
    if (unauthorized) return unauthorized;
    throw error;
  }
}
