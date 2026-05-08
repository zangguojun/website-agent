import { scoreSession, scoredAnswerSchema } from '@website-agent/core';
import { z } from 'zod';
import { authenticationErrorResponse } from '../../../../../auth/http-errors';
import { requireSessionOwnedBy } from '../../../../../auth/session-access';
import { resolveOwnerId } from '../../../../../auth/resolve-owner';
import { listSessionExamQuestions } from '../../../../../db/repositories/session-exam-questions.repo';
import { getSessionById } from '../../../../../db/repositories/sessions.repo';
import { dimensionsFromSessionJson } from '../../../../../mastra/dimensions-from-session';
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
    const ownerId = await resolveOwnerId(request.headers);
    const { id } = await context.params;
    const row = await getSessionById(id);
    const gate = requireSessionOwnedBy(row, ownerId);
    if (!gate.ok) return gate.response;

    const parsed = finalizeRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: 'answers are required' }, { status: 400 });
    }

    const examQuestions = await listSessionExamQuestions(id);
    let dimensions = dimensionsFromSessionJson(gate.session.dimensions);
    if (dimensions.length === 0) {
      dimensions = [{ id: 'session', name: '综合', weight: 1 }];
    }

    const score = scoreSession({
      dimensions,
      questions: examQuestions,
      answers: parsed.data.answers,
    });
    const report = await runReportWorkflow({
      overallScore: score.overallScore,
      masteryLabel: score.masteryLabel,
      dimensions: score.dimensions,
      weaknessTop3: score.weaknessTop3,
    });

    return sseResponse([
      encodeSse('score', score),
      encodeSse('report', report),
      encodeSse('complete', { done: true }),
    ]);
  } catch (error) {
    const unauthorized = authenticationErrorResponse(error);
    if (unauthorized) return unauthorized;
    throw error;
  }
}
