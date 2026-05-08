import type { SessionMessageSlice } from "../api/session-contract";
import type { AnswerRecord } from "./types";

function asOptionLetter(raw: string): AnswerRecord["optionId"] | null {
  if (raw === "A" || raw === "B" || raw === "C" || raw === "D") return raw;
  return null;
}

/**
 * 从 `POST …/workflow/advance` 入库的 `payload.kind === questionnaire_submit` 恢复答题记录。
 * 取**时间顺序下最后一条**提交（防重复 advance 时仍以最后一次为准）。
 */
export function hydrateAnswerRecordsFromStateMessages(
  messages: SessionMessageSlice[],
): AnswerRecord[] | null {
  let last: AnswerRecord[] | null = null;

  for (const m of messages) {
    if (m.phase !== "questions" || m.role !== "user" || m.payload === null) continue;
    if (m.payload.kind !== "questionnaire_submit") continue;
    const raw = m.payload.answers;
    if (!Array.isArray(raw)) continue;

    const out: AnswerRecord[] = [];
    let malformed = false;
    for (const item of raw) {
      if (typeof item !== "object" || item === null) {
        malformed = true;
        break;
      }
      const rec = item as Record<string, unknown>;
      const questionId = typeof rec.questionId === "string" ? rec.questionId : null;
      const optionRaw = typeof rec.optionId === "string" ? rec.optionId : null;
      const optionId = optionRaw !== null ? asOptionLetter(optionRaw) : null;
      if (!questionId || !optionId) {
        malformed = true;
        break;
      }
      out.push({ questionId, optionId });
    }

    if (malformed || out.length === 0) continue;
    last = out;
  }

  return last;
}
