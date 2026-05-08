import { z } from 'zod';

import { authenticationErrorResponse } from '../../../../../../auth/http-errors';
import { requireSessionOwnedBy } from '../../../../../../auth/session-access';
import { resolveOwnerId } from '../../../../../../auth/resolve-owner';
import {
  countClarifyUserMessages,
  insertSessionMessage,
} from '../../../../../../db/repositories/session-messages.repo';
import { setSessionAnswersDraft } from '../../../../../../db/repositories/session-answers-draft.repo';
import { getSessionById, updateSessionForOwner } from '../../../../../../db/repositories/sessions.repo';
import { CLARIFY_REQUIRED_USER_MESSAGES } from '@website-agent/core';

import { listSessionExamQuestions } from '../../../../../../db/repositories/session-exam-questions.repo';
import { validateAnswersAgainstExamQuestions } from '../../../../../../streaming/mock-answers-guard';

const bodySchema = z.discriminatedUnion('target', [
  z.object({
    target: z.literal('plan'),
  }),
  z.object({
    target: z.literal('report'),
    answers: z.array(
      z.object({
        questionId: z.string().min(1),
        optionId: z.string().min(1),
      }),
    ),
  }),
]);

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

/** POST-after-clarification gate: avoids upgrading phase during SSE alone (§6.1.1). */
export async function POST(request: Request, context: RouteContext) {
  try {
    const ownerId = await resolveOwnerId(request.headers);
    const { id } = await context.params;
    const row = await getSessionById(id);
    const gate = requireSessionOwnedBy(row, ownerId);
    if (!gate.ok) return gate.response;

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: 'Invalid advance body' }, { status: 400 });
    }

    if (parsed.data.target === 'plan') {
      if (gate.session.workflowPhase !== 'clarify') {
        return Response.json({ error: 'Workflow phase mismatch' }, { status: 409 });
      }

      const clarifyUserMessages = await countClarifyUserMessages({ sessionId: id, ownerId });
      if (clarifyUserMessages < CLARIFY_REQUIRED_USER_MESSAGES) {
        return Response.json(
          {
            error: `Clarify requires ${CLARIFY_REQUIRED_USER_MESSAGES} answered rounds before continuing (got ${clarifyUserMessages})`,
          },
          { status: 400 },
        );
      }

      const updated = await updateSessionForOwner(ownerId, id, {
        workflowPhase: 'plan',
        status: 'planned',
      });

      return Response.json({ session: updated });
    }

    if (parsed.data.target === 'report') {
      if (gate.session.workflowPhase !== 'questions' || gate.session.status !== 'awaiting_answers') {
        return Response.json({ error: 'Workflow phase mismatch' }, { status: 409 });
      }

      const examQuestions = await listSessionExamQuestions(id);
      const checked = validateAnswersAgainstExamQuestions(examQuestions, parsed.data.answers);
      if (!checked.ok) {
        return Response.json({ error: checked.error }, { status: 400 });
      }

      setSessionAnswersDraft(id, ownerId, checked.scored);

      await insertSessionMessage({
        sessionId: id,
        ownerId,
        phase: 'questions',
        role: 'user',
        content: `已提交 ${parsed.data.answers.length} 道题的答案。`,
        payload: {
          kind: 'questionnaire_submit',
          answers: parsed.data.answers.map((answer) => ({
            questionId: answer.questionId,
            optionId: answer.optionId,
          })),
        },
      });

      const updated = await updateSessionForOwner(ownerId, id, {
        workflowPhase: 'report',
        status: 'report_ready',
      });

      return Response.json({ session: updated });
    }

    return Response.json({ error: 'Unsupported advance target' }, { status: 400 });
  } catch (error) {
    const unauthorized = authenticationErrorResponse(error);
    if (unauthorized) return unauthorized;
    throw error;
  }
}
