import { describe, expect, it } from 'vitest';
import { parseSseEnvelopeJson, sseEnvelopeV1Schema } from './sse-events';

describe('sseEnvelopeV1Schema', () => {
  it('parses valid v1 envelopes with extra fields', () => {
    const raw =
      '{"v":1,"seq":"3","phase":"clarify","kind":"assistant_message","question":"hi","options":[]}';
    expect(parseSseEnvelopeJson(raw)?.kind).toBe('assistant_message');
    const parsed = sseEnvelopeV1Schema.safeParse(JSON.parse(raw));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect((parsed.data as Record<string, unknown>)['question']).toBe('hi');
    }
  });

  it('returns null for malformed json', () => {
    expect(parseSseEnvelopeJson('not-json')).toBeNull();
  });
});
