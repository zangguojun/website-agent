import { describe, expect, it } from 'vitest';
import { GET } from '../src/app/api/health/route';

describe('GET /api/health', () => {
  it('returns service health', async () => {
    const response = await GET();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: 'website-agent-api',
    });
  });
});
