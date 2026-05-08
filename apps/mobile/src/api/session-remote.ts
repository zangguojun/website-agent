import { parseSseEnvelopeJson } from "@website-agent/core";

import { mapApiEnvelopeToGeneratedQuestion } from "../session/map-remote-question";
import { hydrateQuestionsFromStateMessages } from "../session/hydrate-questions-from-state";
import type { AnswerRecord, GeneratedQuestion, ReportAgentSseSlice, TestPlan } from "../session/types";
import type { SessionRecordSlice, SessionStateResponse } from "./session-contract";
import { parseSessionStateResponse } from "./session-state-parse";
import { getAuthHeaders } from "./auth-headers";
import { resolveApiBaseUrl } from "./base-url";
import { parseSseText, type ParsedSseFrame } from "./sse-read";

async function fetchJson(url: string, init?: RequestInit): Promise<Response> {
  const headersInit = await getAuthHeaders(init?.headers ?? undefined);
  return fetch(url, { ...init, headers: headersInit });
}

export async function fetchSession(sessionId: string): Promise<{ session: SessionRecordSlice }> {
  const base = resolveApiBaseUrl();
  const res = await fetchJson(`${base}/api/sessions/${sessionId}`, { method: "GET" });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GET session ${res.status}: ${t.slice(0, 240)}`);
  }
  const body: unknown = await res.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("session" in body) ||
    typeof (body as { session: unknown }).session !== "object" ||
    (body as { session: unknown }).session === null
  ) {
    throw new Error("Invalid session response");
  }
  return body as { session: SessionRecordSlice };
}

export async function fetchSessionState(sessionId: string): Promise<SessionStateResponse> {
  const base = resolveApiBaseUrl();
  const res = await fetchJson(`${base}/api/sessions/${sessionId}/state`, { method: "GET" });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GET state ${res.status}: ${t.slice(0, 240)}`);
  }
  const body: unknown = await res.json();
  return parseSessionStateResponse(body);
}

export async function postClarificationUserMessage(
  sessionId: string,
  input: {
    content: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  const base = resolveApiBaseUrl();
  const res = await fetchJson(`${base}/api/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      phase: "clarify",
      role: "user",
      content: input.content,
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`POST message ${res.status}: ${t.slice(0, 240)}`);
  }
}

export async function advanceWorkflowToPlan(sessionId: string): Promise<void> {
  const base = resolveApiBaseUrl();
  const res = await fetchJson(`${base}/api/sessions/${sessionId}/workflow/advance`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target: "plan" }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`advance ${res.status}: ${t.slice(0, 240)}`);
  }
}

export async function advanceWorkflowToReport(
  sessionId: string,
  answers: AnswerRecord[],
): Promise<void> {
  const base = resolveApiBaseUrl();
  const res = await fetchJson(`${base}/api/sessions/${sessionId}/workflow/advance`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      target: "report",
      answers: answers.map((a) => ({ questionId: a.questionId, optionId: a.optionId })),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`advance report ${res.status}: ${t.slice(0, 240)}`);
  }
}

async function consumeSseRequest(url: string): Promise<ParsedSseFrame[]> {
  const res = await fetchJson(url, {
    method: "GET",
    headers: { Accept: "text/event-stream" },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`SSE ${res.status}: ${t.slice(0, 240)}`);
  }
  const text = await res.text();
  return parseSseText(text);
}

export type ClarifyAssistantPayload =
  | {
      status: "question";
      stepId: string;
      prompt: string;
      why: string;
      options?: Array<{ id: string; label: string }>;
    }
  | { status: "complete" };

export async function loadClarifyAssistantPayload(sessionId: string): Promise<ClarifyAssistantPayload> {
  const base = resolveApiBaseUrl();
  const frames = await consumeSseRequest(`${base}/api/sessions/${sessionId}/stream/clarify`);

  for (const frame of frames) {
    const env = parseSseEnvelopeJson(frame.data);
    if (!env || env.kind !== "assistant_message") continue;
    const record = env as Record<string, unknown>;
    const question = typeof record.question === "string" ? record.question : "";
    const why =
      typeof record.why === "string" && record.why.trim().length
        ? record.why.trim()
        : "来自服务端分段 SSE（澄清阶段）。";
    const stepId =
      typeof record.clarifyStepId === "string" && record.clarifyStepId.trim().length
        ? record.clarifyStepId.trim()
        : "live-clarify";
    const rawOpts = record.options;
    let options: Array<{ id: string; label: string }> | undefined;
    if (Array.isArray(rawOpts)) {
      options = [];
      for (const item of rawOpts) {
        if (item && typeof item === "object" && "id" in item && "label" in item) {
          const o = item as { id: unknown; label: unknown };
          if (typeof o.id === "string" && typeof o.label === "string") {
            options.push({ id: o.id, label: o.label });
          }
        }
      }
      if (options.length === 0) options = undefined;
    }

    return {
      status: "question",
      stepId,
      prompt: question,
      why,
      ...(options !== undefined ? { options } : {}),
    };
  }

  for (const frame of frames) {
    const env = parseSseEnvelopeJson(frame.data);
    if (env?.kind === "clarify_done") {
      return { status: "complete" };
    }
  }

  throw new Error("SSE clarify stream missing assistant_message or clarify_done");
}

function mapEnvelopeToPlan(
  env: Record<string, unknown>,
  rawTopic: string,
): TestPlan {
  const dimsRaw = env.dimensions;
  const dimensions: Array<{ id: string; name: string; description: string }> = [];
  if (Array.isArray(dimsRaw)) {
    for (const d of dimsRaw) {
      if (
        typeof d !== "object" ||
        d === null ||
        !("id" in d) ||
        !("name" in d)
      )
        continue;
      const dd = d as { id?: unknown; name?: unknown };
      dimensions.push({
        id: typeof dd.id === "string" ? dd.id : "dim",
        name: typeof dd.name === "string" ? dd.name : "维度",
        description: "",
      });
    }
  }

  const total =
    typeof env.totalQuestions === "number" ? env.totalQuestions : dimensions.length || 10;
  const rationale =
    typeof env.rationale === "string"
      ? env.rationale
      : "服务端已根据澄清结果给出测评维度草案。";

  return {
    target: rawTopic,
    scope: rationale.slice(0, 240),
    difficulty: "中阶",
    questionCount: Math.max(total, 1),
    questionTypes: ["选择题"],
    dimensions,
    rationale,
  };
}

export async function loadTestPlanViaPlanStream(sessionId: string): Promise<TestPlan> {
  const { session } = await fetchSession(sessionId);
  if (session.workflowPhase !== "plan") {
    throw new Error(`plan stream requires workflowPhase plan, got ${session.workflowPhase}`);
  }

  const base = resolveApiBaseUrl();
  const frames = await consumeSseRequest(`${base}/api/sessions/${sessionId}/stream/plan`);

  for (const frame of frames) {
    const env = parseSseEnvelopeJson(frame.data);
    if (!env || env.kind !== "plan_final") continue;
    return mapEnvelopeToPlan(env as Record<string, unknown>, session.rawTopic);
  }

  throw new Error("plan stream missing plan_final");
}

export async function loadQuestionsFromQuestionsStream(
  sessionId: string,
  plan: TestPlan | undefined,
): Promise<GeneratedQuestion[]> {
  const snapshot = await fetchSessionState(sessionId);
  const fromSnapshot = hydrateQuestionsFromStateMessages(snapshot.messages, snapshot.session);
  if (fromSnapshot !== null && fromSnapshot.length > 0) {
    return fromSnapshot;
  }

  if (snapshot.session.workflowPhase !== "questions") {
    throw new Error(
      `questions stream requires workflowPhase questions, got ${snapshot.session.workflowPhase}`,
    );
  }

  const base = resolveApiBaseUrl();
  const frames = await consumeSseRequest(`${base}/api/sessions/${sessionId}/stream/questions`);

  const questions: GeneratedQuestion[] = [];
  for (const frame of frames) {
    const env = parseSseEnvelopeJson(frame.data);
    if (!env || env.kind !== "question_final") continue;
    const mapped = mapApiEnvelopeToGeneratedQuestion(env as Record<string, unknown>, plan);
    if (mapped) questions.push(mapped);
  }

  if (questions.length === 0) {
    throw new Error("questions stream missing question_final payloads");
  }

  return questions;
}

export async function consumeReportStream(sessionId: string): Promise<ReportAgentSseSlice> {
  const { session } = await fetchSession(sessionId);
  if (session.workflowPhase !== "report") {
    throw new Error(`report stream requires workflowPhase report, got ${session.workflowPhase}`);
  }

  const base = resolveApiBaseUrl();
  const res = await fetchJson(`${base}/api/sessions/${sessionId}/stream/report`, {
    method: "GET",
    headers: { Accept: "text/event-stream" },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`report SSE ${res.status}: ${t.slice(0, 240)}`);
  }
  const text = await res.text();
  return extractReportAgentSsePayload(parseSseText(text));
}

function extractReportAgentSsePayload(frames: ParsedSseFrame[]): ReportAgentSseSlice {
  const out: ReportAgentSseSlice = {};
  for (const frame of frames) {
    const env = parseSseEnvelopeJson(frame.data);
    if (!env) continue;
    const rec = env as Record<string, unknown>;

    if (env.kind === "report_sections") {
      if (typeof rec.headline === "string") out.headline = rec.headline;
      if (typeof rec.summary === "string") out.summary = rec.summary;

      const next = rec.nextSteps;
      if (Array.isArray(next)) {
        const lines = next.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
        if (lines.length) out.nextSteps = lines;
      }

      const weak = rec.weaknessTop3;
      if (Array.isArray(weak)) {
        const lines: string[] = [];
        for (const item of weak) {
          if (typeof item !== "object" || item === null) continue;
          const o = item as Record<string, unknown>;
          const name = typeof o.name === "string" ? o.name : "";
          const score = typeof o.score === "number" ? o.score : null;
          if (name && score !== null) lines.push(`${name}：维度得分 ${score}`);
          else if (name.length > 0) lines.push(name);
        }
        if (lines.length) out.weaknessLines = lines;
      }
    }

    if (env.kind === "report_done") {
      if (typeof rec.overallScore === "number") out.overallScore = rec.overallScore;
      if (typeof rec.masteryLabel === "string") out.masteryLabel = rec.masteryLabel;
    }
  }
  return out;
}
