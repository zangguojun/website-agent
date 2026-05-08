import { describe, expect, it } from 'vitest';

import { CLARIFY_REQUIRED_USER_MESSAGES } from '@website-agent/core';
import {
  POST as postMessage,
} from '../src/app/api/sessions/[id]/messages/route';
import { GET as streamClarify } from '../src/app/api/sessions/[id]/stream/clarify/route';
import { GET as streamPlan } from '../src/app/api/sessions/[id]/stream/plan/route';
import { GET as streamQuestions } from '../src/app/api/sessions/[id]/stream/questions/route';
import { GET as streamReport } from '../src/app/api/sessions/[id]/stream/report/route';
import { POST as advanceWorkflow } from '../src/app/api/sessions/[id]/workflow/advance/route';
import { GET as getSessionState } from '../src/app/api/sessions/[id]/state/route';
import { POST as createSession } from '../src/app/api/sessions/route';
import { resetApiMemoryStores } from '../src/db/repositories/memory-reset';
import { getSessionForOwner } from '../src/db/repositories/sessions.repo';

const device = 'stream-smoke-device';

function jsonPost(id: string, path: string, body: unknown): Request {
  return new Request(`http://localhost/api/sessions/${id}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-device-id': device,
    },
    body: JSON.stringify(body),
  });
}

async function newSessionId(): Promise<string> {
  const res = await createSession(
    new Request('http://localhost/api/sessions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': device,
      },
      body: JSON.stringify({ topic: 'Linear pipeline' }),
    }),
  );
  const body = (await res.json()) as { session: { id: string } };
  return body.session.id;
}

function streamRequest(id: string, path: string): Request {
  return new Request(`http://localhost/api/sessions/${id}${path}`, {
    headers: { 'x-device-id': device },
  });
}

async function readQuestionIdsFromState(id: string, deviceHeader: string): Promise<string[]> {
  const stateRes = await getSessionState(
    new Request(`http://localhost/api/sessions/${id}/state`, {
      headers: { 'x-device-id': deviceHeader },
    }),
    { params: Promise.resolve({ id }) },
  );
  expect(stateRes.status).toBe(200);
  const stateJson = (await stateRes.json()) as {
    messages: Array<{ phase: string; role: string; payload?: { questions?: Array<{ id: string }> } }>;
  };
  const questionsRecap = [...stateJson.messages]
    .reverse()
    .find((m) => m.phase === 'questions' && m.role === 'assistant');
  const qs = questionsRecap?.payload?.questions;
  if (!Array.isArray(qs)) return [];
  return qs.map((q) => q.id);
}

describe('segmented Mastra SSE streams', () => {
  it('returns 409 JSON when the stream phase does not match session.workflowPhase', async () => {
    resetApiMemoryStores();
    const id = await newSessionId();

    const res = await streamPlan(streamRequest(id, '/stream/plan'), {
      params: Promise.resolve({ id }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBeDefined();
  });

  it('runs clarify → advance → plan → questions → report with monotonic seq envelopes', async () => {
    resetApiMemoryStores();
    const id = await newSessionId();

    for (let i = 0; i < CLARIFY_REQUIRED_USER_MESSAGES; i++) {
      await (
        await streamClarify(streamRequest(id, '/stream/clarify'), {
          params: Promise.resolve({ id }),
        })
      ).text();

      const userMsg = await postMessage(
        jsonPost(id, '/messages', {
          phase: 'clarify',
          role: 'user',
          content: `clarify-${i}`,
          payload: { source: 'test' },
        }),
        { params: Promise.resolve({ id }) },
      );
      expect(userMsg.status).toBe(201);
    }

    const advance = await advanceWorkflow(jsonPost(id, '/workflow/advance', { target: 'plan' }), {
      params: Promise.resolve({ id }),
    });
    expect(advance.status).toBe(200);

    let session = await getSessionForOwner(`device:${device}`, id);
    expect(session?.workflowPhase).toBe('plan');

    const planBody = await (
      await streamPlan(streamRequest(id, '/stream/plan'), {
        params: Promise.resolve({ id }),
      })
    ).text();
    expect(planBody).toContain('"kind":"plan_done"');

    session = await getSessionForOwner(`device:${device}`, id);
    expect(session?.workflowPhase).toBe('questions');
    const expectedQ = Math.max(1, session?.totalQuestions ?? 3);

    const questionsBody = await (
      await streamQuestions(streamRequest(id, '/stream/questions'), {
        params: Promise.resolve({ id }),
      })
    ).text();
    expect(questionsBody).toContain('"kind":"questions_done"');
    expect(questionsBody.match(/"kind":"question_final"/g)?.length).toBe(expectedQ);

    const stateRes = await getSessionState(
      new Request(`http://localhost/api/sessions/${id}/state`, {
        headers: { 'x-device-id': device },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(stateRes.status).toBe(200);
    const stateJson = (await stateRes.json()) as {
      messages: Array<{ phase: string; role: string; payload?: { questions?: unknown[] } }>;
    };
    const questionsRecap = [...stateJson.messages]
      .reverse()
      .find((m) => m.phase === 'questions' && m.role === 'assistant');
    expect(Array.isArray(questionsRecap?.payload?.questions)).toBe(true);
    expect(questionsRecap?.payload?.questions?.length).toBe(expectedQ);

    session = await getSessionForOwner(`device:${device}`, id);
    expect(session?.workflowPhase).toBe('questions');
    expect(session?.status).toBe('awaiting_answers');

    const questionIds = await readQuestionIdsFromState(id, device);
    expect(questionIds.length).toBe(expectedQ);

    const advanceReport = await advanceWorkflow(
      jsonPost(id, '/workflow/advance', {
        target: 'report',
        answers: questionIds.map((questionId) => ({ questionId, optionId: 'A' })),
      }),
      {
        params: Promise.resolve({ id }),
      },
    );
    expect(advanceReport.status).toBe(200);

    session = await getSessionForOwner(`device:${device}`, id);
    expect(session?.workflowPhase).toBe('report');

    const reportBody = await (
      await streamReport(streamRequest(id, '/stream/report'), {
        params: Promise.resolve({ id }),
      })
    ).text();
    expect(reportBody).toContain('"kind":"report_done"');

    session = await getSessionForOwner(`device:${device}`, id);
    expect(session?.workflowPhase).toBe('done');
  });
});
