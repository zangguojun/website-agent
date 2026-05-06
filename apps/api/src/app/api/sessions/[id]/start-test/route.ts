import { ownerIdFromHeaders } from '../../../../../auth/owner-id';
import { getSessionForOwner } from '../../../../../db/repositories/sessions.repo';
import { runQuestionGenerationWorkflow } from '../../../../../mastra/workflows/question-generation.workflow';
import { encodeSse, sseResponse } from '../../../../../sse/encode';

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

    const plan = await runQuestionGenerationWorkflow();
    const chunks = [
      encodeSse('plan', {
        dimensions: plan.dimensions,
        totalQuestions: plan.totalQuestions,
      }),
      ...plan.questions.map((question, index) => encodeSse('question', question, String(index + 1))),
      encodeSse('complete', { done: true }),
    ];

    return sseResponse(chunks);
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
