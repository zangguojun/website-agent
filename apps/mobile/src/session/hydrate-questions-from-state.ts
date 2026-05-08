import type { SessionMessageSlice, SessionRecordSlice } from "../api/session-contract";
import { mapStoredQuestionRecordToGenerated } from "./map-remote-question";
import type { GeneratedQuestion } from "./types";

/**
 * 从 `questions` phase assistant 消息的 `payload.questions` 恢复题目（SSE 出题完成后入库）。
 * 若存在多条出题摘要，采用**最后一次**快照（覆盖重复跑流的场景）。
 */
export function hydrateQuestionsFromStateMessages(
  messages: SessionMessageSlice[],
  session: SessionRecordSlice,
): GeneratedQuestion[] | null {
  const dims = session.dimensions ?? [];
  const resolveDimensionName = (dimensionId: string): string => {
    const hit = dims.find((d) => d.id === dimensionId);
    return hit?.name ?? dimensionId;
  };

  let lastPayloadQuestions: unknown[] | null = null;
  for (const m of messages) {
    if (m.phase !== "questions" || m.role !== "assistant" || m.payload === null) continue;
    const raw = m.payload.questions;
    if (!Array.isArray(raw) || raw.length === 0) continue;
    lastPayloadQuestions = raw;
  }

  if (!lastPayloadQuestions) return null;

  const questions: GeneratedQuestion[] = [];
  for (const item of lastPayloadQuestions) {
    if (typeof item !== "object" || item === null) return null;
    const mapped = mapStoredQuestionRecordToGenerated(item as Record<string, unknown>, resolveDimensionName);
    if (!mapped) return null;
    questions.push(mapped);
  }

  return questions.length > 0 ? questions : null;
}
