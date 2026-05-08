/**
 * Validates `GET /api/sessions/:id/state` JSON (spec §5.4 — REST 快照)。
 */
import type {
  SessionMessageSlice,
  SessionPlanDimensionSlice,
  SessionRecordSlice,
  SessionStateResponse,
  StreamCheckpointSlice
} from "./session-contract";

function assertSessionSlice(value: unknown): SessionRecordSlice {
  if (typeof value !== "object" || value === null) throw new Error("Invalid state: session missing");
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : null;
  const workflowPhase = typeof row.workflowPhase === "string" ? row.workflowPhase : null;
  const status = typeof row.status === "string" ? row.status : null;
  if (!id || !workflowPhase || !status) throw new Error("Invalid state: session fields");
  const rawTopic = typeof row.rawTopic === "string" ? row.rawTopic : "";
  const dimsRaw = row.dimensions;
  let dimensions: SessionPlanDimensionSlice[] | undefined;
  if (Array.isArray(dimsRaw)) {
    const parsed: SessionPlanDimensionSlice[] = [];
    for (const item of dimsRaw) {
      if (typeof item !== "object" || item === null) continue;
      const rec = item as Record<string, unknown>;
      const dimId = typeof rec.id === "string" ? rec.id : null;
      if (!dimId) continue;
      const name = typeof rec.name === "string" ? rec.name : dimId;
      parsed.push({ id: dimId, name });
    }
    if (parsed.length > 0) dimensions = parsed;
  }

  let totalQuestions: number | null | undefined;
  if (typeof row.totalQuestions === "number") totalQuestions = row.totalQuestions;
  else if (row.totalQuestions === null) totalQuestions = null;

  const slice: SessionRecordSlice = {
    id,
    rawTopic,
    workflowPhase,
    status,
  };
  if (dimensions !== undefined) {
    slice.dimensions = dimensions;
  }
  if (totalQuestions !== undefined) {
    slice.totalQuestions = totalQuestions;
  }
  return slice;
}

function assertMessageSlice(value: unknown): SessionMessageSlice {
  if (typeof value !== "object" || value === null) throw new Error("Invalid state: message shape");
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : null;
  const phase = typeof row.phase === "string" ? row.phase : null;
  const role = typeof row.role === "string" ? row.role : null;
  const content = typeof row.content === "string" ? row.content : null;
  if (!id || !phase || !role || content === null) throw new Error("Invalid state: message fields");

  let payload: Record<string, unknown> | null = null;
  const rawPayload = row.payload;
  if (rawPayload !== null && rawPayload !== undefined) {
    if (typeof rawPayload !== "object" || Array.isArray(rawPayload)) throw new Error("Invalid state: message payload");
    payload = rawPayload as Record<string, unknown>;
  }

  let createdAt: string | null = null;
  if (row.createdAt !== null && row.createdAt !== undefined) {
    if (typeof row.createdAt !== "string") throw new Error("Invalid state: message createdAt");
    createdAt = row.createdAt;
  }

  return { id, phase, role, content, payload, createdAt };
}

function assertCheckpointSlice(value: unknown): StreamCheckpointSlice {
  if (typeof value !== "object" || value === null) throw new Error("Invalid state: checkpoint shape");
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : null;
  const phase = typeof row.phase === "string" ? row.phase : null;
  const streamCursor = typeof row.streamCursor === "string" ? row.streamCursor : null;
  const summary = typeof row.summary === "string" ? row.summary : null;
  const createdAt = typeof row.createdAt === "string" ? row.createdAt : null;

  let clientVisibleSeq: string | null = null;
  if (typeof row.clientVisibleSeq === "string") clientVisibleSeq = row.clientVisibleSeq;
  else if (row.clientVisibleSeq === null) clientVisibleSeq = null;

  if (!id || !phase || !streamCursor || !summary || !createdAt) {
    throw new Error("Invalid state: checkpoint fields");
  }

  return {
    id,
    phase,
    streamCursor,
    summary,
    clientVisibleSeq,
    createdAt,
  };
}

export function parseSessionStateResponse(body: unknown): SessionStateResponse {
  if (typeof body !== "object" || body === null || !("session" in body)) {
    throw new Error("Invalid state response");
  }
  const blob = body as Record<string, unknown>;
  const session = assertSessionSlice(blob.session);

  const rawMsgs = blob.messages;
  const messages: SessionMessageSlice[] = [];
  if (rawMsgs !== undefined) {
    if (!Array.isArray(rawMsgs)) throw new Error("Invalid state: messages not array");
    for (const m of rawMsgs) {
      messages.push(assertMessageSlice(m));
    }
  }

  let latestCheckpoint: StreamCheckpointSlice | null = null;
  const cp = blob.latestCheckpoint;
  if (cp !== null && cp !== undefined) {
    latestCheckpoint = assertCheckpointSlice(cp);
  }

  return { session, messages, latestCheckpoint };
}
