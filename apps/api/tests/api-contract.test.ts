import { describe, expect, it } from 'vitest';
import { POST as createSession } from '../src/app/api/sessions/route';
import { resetApiMemoryStores } from '../src/db/repositories/memory-reset';
import { encodeSse } from '../src/sse/encode';

describe('SSE contract', () => {
  it('encodes event id, name, and JSON data using standard SSE lines', () => {
    expect(encodeSse('question', { id: 'q1' }, '1')).toBe(
      'id: 1\nevent: question\ndata: {"id":"q1"}\n',
    );
  });
});

describe('session create contract', () => {
  it('accepts topic and stores it as rawTopic', async () => {
    resetApiMemoryStores();

    const response = await createSession(
      new Request('http://localhost/api/sessions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-device-id': 'test-device',
        },
        body: JSON.stringify({ topic: 'React Server Components' }),
      }),
    );

    const payload = (await response.json()) as { session?: { rawTopic?: string } };

    expect(response.status).toBe(201);
    expect(payload.session?.rawTopic).toBe('React Server Components');
  });
});
