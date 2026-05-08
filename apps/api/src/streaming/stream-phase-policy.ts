import type { SessionRecord } from '../db/repositories/sessions.repo';

/** GET `/stream/*` gate: `session.workflowPhase` must match the stream name. */
export type StreamPhaseGate = 'clarify' | 'plan' | 'questions' | 'report';

export function ssePhaseGateResponse(): Response {
  return Response.json({ error: 'Workflow phase mismatch' }, { status: 409 });
}

export function assertStreamPhase(session: SessionRecord, stream: StreamPhaseGate): Response | null {
  if (session.workflowPhase !== stream) {
    return ssePhaseGateResponse();
  }
  return null;
}
