import { z } from 'zod';

/** Root JSON envelope for segmented SSE payloads (spec §5.2, v=1). */
export const sseEnvelopeV1Schema = z
  .object({
    v: z.literal(1),
    seq: z.string(),
    phase: z.string(),
    kind: z.string(),
  })
  .passthrough();

export type SseEnvelopeV1 = z.infer<typeof sseEnvelopeV1Schema>;

export function parseSseEnvelopeJson(data: string): SseEnvelopeV1 | null {
  try {
    const raw: unknown = JSON.parse(data);
    const parsed = sseEnvelopeV1Schema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
