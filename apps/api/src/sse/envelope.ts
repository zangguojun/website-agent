export type SseEnvelope = {
  v: 1;
  seq: string;
  phase: string;
  kind: string;
} & Record<string, unknown>;

export function buildEnvelope(
  seq: bigint,
  phase: string,
  kind: string,
  extras: Record<string, unknown> = {},
): SseEnvelope {
  return {
    v: 1,
    seq: seq.toString(),
    phase,
    kind,
    ...extras,
  };
}
