import { scoreSession, scoredAnswerSchema } from '@website-agent/core';
import { z } from 'zod';
import { ownerIdFromHeaders } from '../../../../../auth/owner-id';
import { getSessionForOwner } from '../../../../../db/repositories/sessions.repo';
import { mockDimensions, mockQuestions } from '../../../../../mastra/mock-data';
import { runReportWorkflow } from '../../../../../mastra/workflows/report.workflow';
import { encodeSse, sseResponse } from '../../../../../sse/encode';

const finalizeRequestSchema = z.object({
  answers: z.array(scoredAnswerSchema),
});

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const ownerId = ownerIdFromHeaders(request.headers);
    const { id } = await context.params;
    const session = await getSessionForOwner(ownerId, id);

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const parsed = finalizeRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: 'answers are required' }, { status: 400 });
    }

    const score = scoreSession({
      dimensions: mockDimensions,
      questions: mockQuestions,
      answers: parsed.data.answers,
    });
    const report = await runReportWorkflow(score);

    return sseResponse([
      encodeSse('score', score),
      encodeSse('report', report),
      encodeSse('complete', { done: true }),
    ]);
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
