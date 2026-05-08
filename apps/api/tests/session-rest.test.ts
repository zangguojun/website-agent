import { describe, expect, it } from 'vitest';

import { CLARIFY_REQUIRED_USER_MESSAGES } from '@website-agent/core';
import { GET as getSession } from '../src/app/api/sessions/[id]/route';
import { POST as clarifySession } from '../src/app/api/sessions/[id]/clarify/route';
import {
  GET as getMessages,
  POST as postMessage,
} from '../src/app/api/sessions/[id]/messages/route';
import { GET as getSessionState } from '../src/app/api/sessions/[id]/state/route';
import { GET as streamClarify } from '../src/app/api/sessions/[id]/stream/clarify/route';
import { POST as advanceWorkflow } from '../src/app/api/sessions/[id]/workflow/advance/route';
import { GET as streamPlan } from '../src/app/api/sessions/[id]/stream/plan/route';
import { GET as streamQuestions } from '../src/app/api/sessions/[id]/stream/questions/route';
import { POST as createSession } from '../src/app/api/sessions/route';
import { resetApiMemoryStores } from '../src/db/repositories/memory-reset';

const ownerDevice = 'owner-device';

async function bootstrapSession(): Promise<string> {
  const res = await createSession(
    new Request('http://localhost/api/sessions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': ownerDevice,
      },
      body: JSON.stringify({ topic: 'Testing' }),
    }),
  );
  const body = (await res.json()) as { session: { id: string } };
  return body.session.id;
}

async function streamClarifyForSession(id: string): Promise<void> {
  await (
    await streamClarify(
      new Request(`http://localhost/api/sessions/${id}/stream/clarify`, {
        headers: { 'x-device-id': ownerDevice },
      }),
      { params: Promise.resolve({ id }) },
    )
  ).text();
}

async function finishClarifyPhase(id: string): Promise<void> {
  for (let i = 0; i < CLARIFY_REQUIRED_USER_MESSAGES; i++) {
    await streamClarifyForSession(id);
    const res = await postMessage(
      new Request(`http://localhost/api/sessions/${id}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-device-id': ownerDevice,
        },
        body: JSON.stringify({
          phase: 'clarify',
          role: 'user',
          content: `round-${i}`,
          payload: { source: 'test' },
        }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(201);
  }
}

async function readQuestionIdsForSession(id: string): Promise<string[]> {
  const stateRes = await getSessionState(
    new Request(`http://localhost/api/sessions/${id}/state`, {
      headers: { 'x-device-id': ownerDevice },
    }),
    { params: Promise.resolve({ id }) },
  );
  expect(stateRes.status).toBe(200);
  const body = (await stateRes.json()) as {
    messages: Array<{ phase?: string; role?: string; payload?: { questions?: Array<{ id: string }> } }>;
  };
  const recap = [...body.messages]
    .reverse()
    .find((m) => m.phase === 'questions' && m.role === 'assistant');
  const qs = recap?.payload?.questions;
  return Array.isArray(qs) ? qs.map((q) => q.id) : [];
}

describe('session REST surfaces', () => {
  it('403 when another owner opens a concrete session path', async () => {
    resetApiMemoryStores();
    const id = await bootstrapSession();

    const res = await getSession(
      new Request(`http://localhost/api/sessions/${id}`, {
        headers: { 'x-device-id': 'other-device' },
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(res.status).toBe(403);
  });

  it('allows POST user message during clarify phase and lists chronological pages', async () => {
    resetApiMemoryStores();
    const id = await bootstrapSession();

    const headers = new Headers({
      'content-type': 'application/json',
      'x-device-id': ownerDevice,
    });

    const post = await postMessage(
      new Request(`http://localhost/api/sessions/${id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phase: 'clarify',
          role: 'user',
          content: 'My answer text',
          payload: { foo: true },
        }),
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(post.status).toBe(201);
    const created = (await post.json()) as { message: { id: string; content: string } };
    expect(created.message.content).toBe('My answer text');

    const msgs = await getMessages(
      new Request(`http://localhost/api/sessions/${id}/messages`, { headers }),
      { params: Promise.resolve({ id }) },
    );

    expect(msgs.status).toBe(200);
    const list = (await msgs.json()) as { messages: unknown[] };
    expect(list.messages.length).toBeGreaterThanOrEqual(1);

    const stateRes = await getSessionState(new Request(`http://localhost/api/sessions/${id}/state`, { headers }), {
      params: Promise.resolve({ id }),
    });
    expect(stateRes.status).toBe(200);
    const snapshot = (await stateRes.json()) as {
      messages: unknown[];
      session: { id: string };
      latestCheckpoint?: unknown | null;
    };
    expect(snapshot.session.id).toBe(id);
    expect(snapshot.messages.length).toBeGreaterThanOrEqual(1);
    expect(snapshot).toHaveProperty('latestCheckpoint');
  });

  it('POST message returns 409 when payload phase mismatches workflow phase', async () => {
    resetApiMemoryStores();
    const id = await bootstrapSession();

    const res = await postMessage(
      new Request(`http://localhost/api/sessions/${id}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-device-id': ownerDevice,
        },
        body: JSON.stringify({
          phase: 'plan',
          role: 'user',
          content: 'nope',
        }),
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(res.status).toBe(409);
  });

  it('SSE-style routes yield 403 for wrong owner instead of disappearing as 404', async () => {
    resetApiMemoryStores();
    const id = await bootstrapSession();

    const res = await clarifySession(
      new Request(`http://localhost/api/sessions/${id}/clarify`, {
        method: 'POST',
        headers: { 'x-device-id': 'other-device' },
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(res.status).toBe(403);
  });

  it('POST workflow advance rejects plan without user clarify message', async () => {
    resetApiMemoryStores();
    const id = await bootstrapSession();

    await (
      await streamClarify(
        new Request(`http://localhost/api/sessions/${id}/stream/clarify`, {
          headers: { 'x-device-id': ownerDevice },
        }),
        { params: Promise.resolve({ id }) },
      )
    ).text();

    const advance = await advanceWorkflow(
      new Request(`http://localhost/api/sessions/${id}/workflow/advance`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-device-id': ownerDevice,
        },
        body: JSON.stringify({ target: 'plan' }),
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(advance.status).toBe(400);
  });

  it('POST workflow advance rejects plan before enough clarify rounds', async () => {
    resetApiMemoryStores();
    const id = await bootstrapSession();

    await streamClarifyForSession(id);
    const post = await postMessage(
      new Request(`http://localhost/api/sessions/${id}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-device-id': ownerDevice,
        },
        body: JSON.stringify({
          phase: 'clarify',
          role: 'user',
          content: 'ok',
        }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(post.status).toBe(201);

    const advance = await advanceWorkflow(
      new Request(`http://localhost/api/sessions/${id}/workflow/advance`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-device-id': ownerDevice,
        },
        body: JSON.stringify({ target: 'plan' }),
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(advance.status).toBe(400);
  });

  it('POST workflow advance succeeds after three clarify user messages', async () => {
    resetApiMemoryStores();
    const id = await bootstrapSession();

    await finishClarifyPhase(id);

    const advance = await advanceWorkflow(
      new Request(`http://localhost/api/sessions/${id}/workflow/advance`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-device-id': ownerDevice,
        },
        body: JSON.stringify({ target: 'plan' }),
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(advance.status).toBe(200);
  });

  it('POST workflow advance report returns 409 before questions stream awaits answers', async () => {
    resetApiMemoryStores();
    const id = await bootstrapSession();

    await finishClarifyPhase(id);

    await advanceWorkflow(
      new Request(`http://localhost/api/sessions/${id}/workflow/advance`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-device-id': ownerDevice,
        },
        body: JSON.stringify({ target: 'plan' }),
      }),
      { params: Promise.resolve({ id }) },
    );

    await (
      await streamPlan(
        new Request(`http://localhost/api/sessions/${id}/stream/plan`, {
          headers: { 'x-device-id': ownerDevice },
        }),
        { params: Promise.resolve({ id }) },
      )
    ).text();

    const early = await advanceWorkflow(
      new Request(`http://localhost/api/sessions/${id}/workflow/advance`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-device-id': ownerDevice,
        },
        body: JSON.stringify({
          target: 'report',
          answers: [
            { questionId: 'react-hooks-use-state', optionId: 'A' },
            { questionId: 'react-hooks-use-effect-empty-deps', optionId: 'A' },
            { questionId: 'react-hooks-conditional-call', optionId: 'A' },
          ],
        }),
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(early.status).toBe(409);

    await (
      await streamQuestions(
        new Request(`http://localhost/api/sessions/${id}/stream/questions`, {
          headers: { 'x-device-id': ownerDevice },
        }),
        { params: Promise.resolve({ id }) },
      )
    ).text();

    const qids = await readQuestionIdsForSession(id);
    expect(qids.length).toBeGreaterThan(0);

    const ok = await advanceWorkflow(
      new Request(`http://localhost/api/sessions/${id}/workflow/advance`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-device-id': ownerDevice,
        },
        body: JSON.stringify({
          target: 'report',
          answers: qids.map((questionId) => ({ questionId, optionId: 'A' })),
        }),
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(ok.status).toBe(200);

    const stateAfter = await getSessionState(
      new Request(`http://localhost/api/sessions/${id}/state`, {
        headers: { 'x-device-id': ownerDevice },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(stateAfter.status).toBe(200);
    const afterBody = (await stateAfter.json()) as {
      messages: Array<{ phase?: string; role?: string; payload?: unknown }>;
    };
    const submitMsgs = afterBody.messages.filter((m) => {
      if (m.phase !== 'questions' || m.role !== 'user') return false;
      const p = m.payload;
      return (
        p !== null &&
        typeof p === 'object' &&
        'kind' in p &&
        (p as { kind: string }).kind === 'questionnaire_submit'
      );
    });
    expect(submitMsgs.length).toBeGreaterThanOrEqual(1);
  });
});