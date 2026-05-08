import type { SessionMessageSlice } from "../api/session-contract";
import type { ClarificationAnswer, ClarificationQuestion, ClarificationTurn } from "./types";

function splitUserValue(content: string): string | string[] {
  const t = content.trim();
  if (t.includes(",")) return t.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  return t;
}

function parseAssistantQuestion(msg: SessionMessageSlice): ClarificationQuestion | null {
  const prompt = msg.content.trim();
  if (!prompt) return null;

  const payload = msg.payload;

  let clarifyStepId: string | null = null;
  if (
    payload !== null &&
    typeof payload === "object" &&
    "clarifyStepId" in payload &&
    typeof (payload as { clarifyStepId: unknown }).clarifyStepId === "string"
  ) {
    const id = (payload as { clarifyStepId: string }).clarifyStepId.trim();
    if (id.length) clarifyStepId = id;
  }

  let why = "来自服务端快照中的澄清记录。";
  if (
    payload !== null &&
    typeof payload === "object" &&
    "why" in payload &&
    typeof (payload as { why: unknown }).why === "string" &&
    (payload as { why: string }).why.trim().length
  ) {
    why = (payload as { why: string }).why.trim();
  }

  let options: ClarificationQuestion["options"];
  const rawOpts = payload !== null && "options" in payload ? payload.options : undefined;

  if (Array.isArray(rawOpts) && rawOpts.length > 0) {
    const out: NonNullable<ClarificationQuestion["options"]> = [];
    for (const item of rawOpts) {
      if (typeof item !== "object" || item === null || !("id" in item) || !("label" in item)) continue;
      const id = typeof (item as { id: unknown }).id === "string" ? (item as { id: string }).id : "";
      const label =
        typeof (item as { label: unknown }).label === "string" ? (item as { label: string }).label : "";
      if (!id || !label) continue;
      out.push({ id, label });
    }
    if (out.length > 0) options = out;
  }

  return {
    id: clarifyStepId ?? `srv-clarify-${msg.id}`,
    type: options !== undefined ? "single_choice" : "free_text",
    prompt,
    why,
    ...(options !== undefined ? { options } : {}),
  };
}

function parseUserAnswer(msg: SessionMessageSlice, questionId: string): ClarificationAnswer {
  const payload = msg.payload;
  let label =
    payload !== null && typeof payload.label === "string" && payload.label.length > 0
      ? payload.label
      : "";
  const content = typeof msg.content === "string" ? msg.content.trim() : "";
  if (!label.length) label = content;

  const value =
    typeof msg.content === "string" ? splitUserValue(msg.content) : content;

  return {
    questionId,
    value,
    label,
  };
}

/**
 * 从 `GET …/state` 的 chronological messages 推导澄清会话，用于 hydrate，避免在未新一轮澄清前重复拉起 clarify SSE。
 * 若没有 assistant 题干落库记录则返回 null（调用方再走 SSE）。
 */
export function hydrateClarificationTurnsFromStateMessages(
  messages: SessionMessageSlice[],
): ClarificationTurn[] | null {
  const clarify = messages.filter((m) => m.phase === "clarify");

  const hasAssistant = clarify.some((m) => m.role === "assistant");
  if (!hasAssistant) return null;

  const turns: ClarificationTurn[] = [];
  let pending: ClarificationQuestion | null = null;

  for (const msg of clarify) {
    if (msg.role === "assistant") {
      const q = parseAssistantQuestion(msg);
      if (!q) return null;
      if (pending !== null) {
        turns.push({ question: pending });
      }
      pending = q;
      continue;
    }

    if (msg.role === "user" && pending !== null) {
      turns.push({
        question: pending,
        answer: parseUserAnswer(msg, pending.id),
      });
      pending = null;
    }
  }

  if (pending !== null) {
    turns.push({ question: pending });
  }

  return turns.length > 0 ? turns : null;
}
