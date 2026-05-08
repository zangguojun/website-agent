import { authenticationErrorResponse } from '../../../../../auth/http-errors';
import { requireSessionOwnedBy } from '../../../../../auth/session-access';
import { resolveOwnerId } from '../../../../../auth/resolve-owner';
import { getSessionById } from '../../../../../db/repositories/sessions.repo';
import { buildClarifyDigestForSession } from '../../../../../mastra/clarify-digest';
import { runQuestionGenerationWorkflow } from '../../../../../mastra/workflows/question-generation.workflow';
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

    const clarifyDigest = await buildClarifyDigestForSession(id, ownerId);
    const plan = await runQuestionGenerationWorkflow({
      sessionId: id,
      ownerId,
      rawTopic: gate.session.rawTopic,
      clarifyDigest,
      dimensionsJson: gate.session.dimensions,
      totalQuestions: Math.max(1, gate.session.totalQuestions ?? 3),
    });

    const chunks = [
      encodeSse('plan', {
        dimensions: gate.session.dimensions ?? plan.dimensions,
        totalQuestions: plan.totalQuestions,
      }),
      ...plan.questions.map((question, index) =>
        encodeSse('question', question, String(index + 1)),
      ),
      encodeSse('complete', { done: true }),
    ];

    return sseResponse(chunks);
  } catch (error) {
    const unauthorized = authenticationErrorResponse(error);
    if (unauthorized) return unauthorized;
    throw error;
  }
}
