import { CLARIFY_REQUIRED_USER_MESSAGES, scoreSession, type OwnerId } from '@website-agent/core';

import { appendAgentStep } from '../db/repositories/agent-steps.repo';
import { takeSessionAnswersDraft } from '../db/repositories/session-answers-draft.repo';
import {
  countClarifyUserMessages,
  insertSessionMessage,
  listSessionMessagesAscPaged,
} from '../db/repositories/session-messages.repo';
import {
  updateSessionForOwner,
  type SessionRecord,
  getSessionForOwner,
} from '../db/repositories/sessions.repo';
import { maybeAppendStreamCheckpoint } from '../db/repositories/stream-checkpoints-write.repo';
import { listSessionExamQuestions } from '../db/repositories/session-exam-questions.repo';
import { buildClarifyDigestForSession } from '../mastra/clarify-digest';
import { dimensionsFromSessionJson } from '../mastra/dimensions-from-session';
import { userIndexToEmit } from '../mastra/clarify-script';
import { runPlanWorkflow } from '../mastra/workflows/plan.workflow';
import { runQuestionGenerationWorkflow } from '../mastra/workflows/question-generation.workflow';
import { runReportWorkflow } from '../mastra/workflows/report.workflow';
import { buildEnvelope } from '../sse/envelope';
import { encodeSse } from '../sse/encode';
import { createNodeSseResponse } from '../sse/node-readable';

async function nextSequence(
  sessionId: string,
  ownerId: OwnerId,
  phase: string,
  stepType: string,
  payload: Record<string, unknown>,
): Promise<bigint> {
  const r = await appendAgentStep({
    sessionId,
    ownerId,
    phase,
    stepType,
    payload,
  });
  if (!r) throw new Error('Failed to append agent step');
  return r.sequence;
}

async function emitCheckpoint(
  sessionId: string,
  ownerId: OwnerId,
  phase: string,
  summary: string,
  seq: bigint,
): Promise<void> {
  await maybeAppendStreamCheckpoint({
    sessionId,
    ownerId,
    phase,
    summary,
    clientVisibleSeq: seq,
  });
}

function push(
  write: (frame: string) => void,
  kind: string,
  seq: bigint,
  phase: string,
  extras: Record<string, unknown>,
): void {
  write(encodeSse(kind, buildEnvelope(seq, phase, kind, extras), String(seq)));
}

async function lastClarifyMessage(sessionId: string, ownerId: OwnerId) {
  const page = await listSessionMessagesAscPaged({ sessionId, ownerId, limit: 400 });
  const clarify = page.messages.filter((m) => m.phase === 'clarify');
  return clarify.at(-1) ?? null;
}

export function runClarifyPhaseStream(session: SessionRecord, ownerId: OwnerId): Response {
  const sessionId = session.id;

  return createNodeSseResponse(async (write) => {
    const phase = 'clarify';
    let seq = await nextSequence(sessionId, ownerId, phase, 'stream_open', { phase });
    await emitCheckpoint(sessionId, ownerId, phase, 'stream_open', seq);

    seq = await nextSequence(sessionId, ownerId, phase, 'workflow_start', {
      workflow: 'clarify',
    });

    seq = await nextSequence(sessionId, ownerId, phase, 'assistant_delta', {
      preview: true,
    });
    push(write, 'assistant_delta', seq, phase, { token: '\u2026' });

    const userCount = await countClarifyUserMessages({ sessionId, ownerId });

    if (userCount >= CLARIFY_REQUIRED_USER_MESSAGES) {
      seq = await nextSequence(sessionId, ownerId, phase, 'phase_transition_pending', {
        next: 'plan',
        gate: 'POST /workflow/advance',
      });
      push(write, 'phase_transition_pending', seq, phase, {
        next: 'plan',
        gate: 'POST /workflow/advance',
      });
      await emitCheckpoint(sessionId, ownerId, phase, 'clarify:complete', seq);

      seq = await nextSequence(sessionId, ownerId, phase, 'clarify_done', { ok: true, complete: true });
      push(write, 'clarify_done', seq, phase, { ok: true, complete: true });
      return;
    }

    const step = userIndexToEmit(userCount);
    if (!step) {
      seq = await nextSequence(sessionId, ownerId, phase, 'clarify_done', { ok: true, complete: true });
      push(write, 'clarify_done', seq, phase, { ok: true, complete: true });
      return;
    }

    const last = await lastClarifyMessage(sessionId, ownerId);
    let shouldInsert = true;
    if (last?.role === 'assistant' && last.payload && typeof last.payload === 'object') {
      const sid = (last.payload as { clarifyStepId?: unknown }).clarifyStepId;
      if (typeof sid === 'string' && sid === step.id) {
        shouldInsert = false;
      }
    }

    const options =
      'choices' in step ? step.choices.map((c) => ({ id: c.id, label: c.label })) : undefined;
    const question = step.prompt;
    const why = step.why;

    seq = await nextSequence(sessionId, ownerId, phase, 'llm_finish', {
      options: options?.length ?? 0,
      clarifyStepId: step.id,
    });

    push(write, 'assistant_message', seq, phase, {
      question,
      options,
      why,
      clarifyStepId: step.id,
      done: false,
    });

    if (shouldInsert) {
      await insertSessionMessage({
        sessionId,
        ownerId,
        phase,
        role: 'assistant',
        content: question,
        payload: {
          options,
          why,
          clarifyStepId: step.id,
          done: false,
          agentStepSeq: seq.toString(),
        },
      });
    }

    await emitCheckpoint(sessionId, ownerId, phase, `clarify:${step.id}`, seq);

    seq = await nextSequence(sessionId, ownerId, phase, 'clarify_done', { ok: true });
    push(write, 'clarify_done', seq, phase, { ok: true });
  });
}

export function runPlanPhaseStream(session: SessionRecord, ownerId: OwnerId): Response {
  const sessionId = session.id;

  return createNodeSseResponse(async (write) => {
    const phase = 'plan';
    let seq = await nextSequence(sessionId, ownerId, phase, 'stream_open', { phase });
    await emitCheckpoint(sessionId, ownerId, phase, 'stream_open', seq);

    seq = await nextSequence(sessionId, ownerId, phase, 'workflow_start', { workflow: 'plan' });
    push(write, 'plan_partial', seq, phase, { status: 'synthesizing' });

    const clarifyDigest = await buildClarifyDigestForSession(sessionId, ownerId);
    const plan = await runPlanWorkflow({ rawTopic: session.rawTopic, clarifyDigest });

    seq = await nextSequence(sessionId, ownerId, phase, 'schema_validated', {
      dimensionCount: plan.dimensions.length,
    });
    push(write, 'plan_final', seq, phase, {
      dimensions: plan.dimensions,
      totalQuestions: plan.totalQuestions,
      rationale: plan.rationale,
    });

    await insertSessionMessage({
      sessionId,
      ownerId,
      phase,
      role: 'assistant',
      content: plan.rationale,
      payload: {
        dimensions: plan.dimensions,
        totalQuestions: plan.totalQuestions,
      },
    });

    await updateSessionForOwner(ownerId, sessionId, {
      workflowPhase: 'questions',
      status: 'questions_ready',
      dimensions: plan.dimensions as SessionRecord['dimensions'],
      totalQuestions: plan.totalQuestions,
    });

    seq = await nextSequence(sessionId, ownerId, phase, 'phase_transition', { next: 'questions' });
    await emitCheckpoint(sessionId, ownerId, phase, plan.rationale, seq);

    seq = await nextSequence(sessionId, ownerId, phase, 'plan_done', { ok: true });
    push(write, 'plan_done', seq, phase, { ok: true });
  });
}

export function runQuestionsPhaseStream(session: SessionRecord, ownerId: OwnerId): Response {
  const sessionId = session.id;

  return createNodeSseResponse(async (write) => {
    const phase = 'questions';
    let seq = await nextSequence(sessionId, ownerId, phase, 'stream_open', { phase });

    seq = await nextSequence(sessionId, ownerId, phase, 'workflow_start', {
      workflow: 'questions',
    });

    const freshSession = await getSessionForOwner(ownerId, sessionId);
    const sessionForQuiz = freshSession ?? session;
    const clarifyDigest = await buildClarifyDigestForSession(sessionId, ownerId);
    const targetTotal = Math.max(1, sessionForQuiz.totalQuestions ?? 3);

    const gen = await runQuestionGenerationWorkflow({
      sessionId,
      ownerId,
      rawTopic: sessionForQuiz.rawTopic,
      clarifyDigest,
      dimensionsJson: sessionForQuiz.dimensions,
      totalQuestions: targetTotal,
    });

    for (let i = 0; i < gen.questions.length; i++) {
      const question = gen.questions[i]!;
      seq = await nextSequence(sessionId, ownerId, phase, 'question_stub', {
        index: i,
        id: question.id,
      });
      push(write, 'question_stub', seq, phase, {
        index: i,
        id: question.id,
        type: question.type,
      });

      seq = await nextSequence(sessionId, ownerId, phase, 'question_final', {
        id: question.id,
      });

      push(
        write,
        'question_final',
        seq,
        phase,
        JSON.parse(JSON.stringify(question)) as Record<string, unknown>,
      );
    }

    await insertSessionMessage({
      sessionId,
      ownerId,
      phase,
      role: 'assistant',
      content: `已生成 ${gen.questions.length} 道题。`,
      payload: {
        totalQuestions: gen.totalQuestions,
        questions: gen.questions.map((question) =>
          JSON.parse(JSON.stringify(question)) as Record<string, unknown>,
        ),
      },
    });

    await updateSessionForOwner(ownerId, sessionId, {
      workflowPhase: 'questions',
      status: 'awaiting_answers',
    });

    await emitCheckpoint(sessionId, ownerId, phase, `questions:${gen.questions.length}`, seq);

    seq = await nextSequence(sessionId, ownerId, phase, 'questions_done', {
      ok: true,
      count: gen.questions.length,
    });
    push(write, 'questions_done', seq, phase, {
      ok: true,
      totalQuestions: gen.totalQuestions,
    });
  });
}

export function runReportPhaseStream(session: SessionRecord, ownerId: OwnerId): Response {
  const sessionId = session.id;

  return createNodeSseResponse(async (write) => {
    const phase = 'report';
    let seq = await nextSequence(sessionId, ownerId, phase, 'stream_open', { phase });

    seq = await nextSequence(sessionId, ownerId, phase, 'workflow_start', {
      workflow: 'report',
    });

    const draft = takeSessionAnswersDraft(sessionId, ownerId);

    /** Advance handler should enqueue answers before streaming report; empty answers score as all wrong. */
    const answersForScore = draft ?? [];

    const gradedSession = await getSessionForOwner(ownerId, sessionId);
    const dimensionsSlice = gradedSession?.dimensions ?? null;

    const dimensions = dimensionsFromSessionJson(dimensionsSlice);
    const examQuestions = await listSessionExamQuestions(sessionId);

    const scored = scoreSession({
      dimensions: dimensions.length ? dimensions : [{ id: 'unknown', name: '综合', weight: 1 }],
      questions: examQuestions,
      answers: answersForScore,
    });

    const report = await runReportWorkflow({
      overallScore: scored.overallScore,
      masteryLabel: scored.masteryLabel,
      dimensions: scored.dimensions,
      weaknessTop3: scored.weaknessTop3,
    });

    seq = await nextSequence(sessionId, ownerId, phase, 'report_delta', {
      partial: report.headline,
    });
    push(write, 'report_delta', seq, phase, {
      headline: report.headline,
    });

    seq = await nextSequence(sessionId, ownerId, phase, 'report_sections', {
      sections: ['summary', 'weakness'],
    });

    push(write, 'report_sections', seq, phase, {
      headline: report.headline,
      summary: report.summary,
      weaknessTop3: report.weaknessTop3,
      nextSteps: report.nextSteps,
    });

    await insertSessionMessage({
      sessionId,
      ownerId,
      phase,
      role: 'assistant',
      content: report.headline,
      payload: {
        summary: report.summary,
        weaknessTop3: report.weaknessTop3,
        nextSteps: report.nextSteps,
      },
    });

    await updateSessionForOwner(ownerId, sessionId, {
      workflowPhase: 'done',
      status: 'completed',
    });

    await emitCheckpoint(sessionId, ownerId, phase, report.headline, seq);

    seq = await nextSequence(sessionId, ownerId, phase, 'report_done', { ok: true });
    push(write, 'report_done', seq, phase, {
      ok: true,
      overallScore: scored.overallScore,
      masteryLabel: scored.masteryLabel,
    });
  });
}
