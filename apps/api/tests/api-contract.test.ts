import { describe, expect, it } from 'vitest';
import { encodeSse } from '../src/sse/encode';

describe('SSE contract', () => {
  it('encodes event id, name, and JSON data using standard SSE lines', () => {
    expect(encodeSse('question', { id: 'q1' }, '1')).toBe(
      'id: 1\nevent: question\ndata: {"id":"q1"}\n',
    );
  });
});
