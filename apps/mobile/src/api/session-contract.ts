export type SessionPlanDimensionSlice = {
  id: string;
  name: string;
};

export type SessionRecordSlice = {
  id: string;
  rawTopic: string;
  workflowPhase: string;
  status: string;
  /** 计划 SSE 后因 `sessions.dimensions` JSON 而存在；hydrate 题目维度名用 */
  dimensions?: SessionPlanDimensionSlice[] | undefined;
  totalQuestions?: number | null | undefined;
};

/** Tail of `session_messages` as returned by `GET .../state`. */
export type SessionMessageSlice = {
  id: string;
  phase: string;
  role: string;
  content: string;
  payload: Record<string, unknown> | null;
  createdAt: string | null;
};

/** `stream_checkpoints` row — in memory-only API mode may always be null. */
export type StreamCheckpointSlice = {
  id: string;
  phase: string;
  streamCursor: string;
  summary: string;
  clientVisibleSeq: string | null;
  createdAt: string;
};

/** `GET /api/sessions/:id/state` envelope (spec §5.4 hydrate). */
export type SessionStateResponse = {
  session: SessionRecordSlice;
  messages: SessionMessageSlice[];
  latestCheckpoint: StreamCheckpointSlice | null;
};
