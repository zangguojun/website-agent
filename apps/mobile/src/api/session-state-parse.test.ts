import { describe, expect, it } from "vitest";
import { parseSessionStateResponse } from "./session-state-parse";

describe("parseSessionStateResponse", () => {
  it("parses minimal snapshot with empty messages and null checkpoint", () => {
    const got = parseSessionStateResponse({
      session: {
        id: "s1",
        rawTopic: "Topic",
        workflowPhase: "clarify",
        status: "clarifying",
      },
      messages: [],
      latestCheckpoint: null,
    });
    expect(got.session).toEqual({
      id: "s1",
      rawTopic: "Topic",
      workflowPhase: "clarify",
      status: "clarifying",
    });
    expect(got.messages).toEqual([]);
    expect(got.latestCheckpoint).toBeNull();
  });

  it("parses checkpoint and message payload null", () => {
    const got = parseSessionStateResponse({
      session: {
        id: "s1",
        rawTopic: "",
        workflowPhase: "questions",
        status: "awaiting_answers",
      },
      messages: [
        {
          id: "m1",
          phase: "clarify",
          role: "user",
          content: "hello",
          payload: null,
          createdAt: "2026-05-06T12:00:00.000Z",
        },
      ],
      latestCheckpoint: {
        id: "cp1",
        phase: "clarify",
        streamCursor: "1",
        summary: "ok",
        clientVisibleSeq: "9",
        createdAt: "2026-05-06T12:05:00.000Z",
      },
    });
    expect(got.messages[0]?.content).toBe("hello");
    expect(got.messages[0]?.payload).toBeNull();
    expect(got.latestCheckpoint?.summary).toBe("ok");
  });

  it("rejects malformed session", () => {
    expect(() => parseSessionStateResponse({ session: { id: "x" } })).toThrow();
  });

  it("parses session dimensions when present", () => {
    const got = parseSessionStateResponse({
      session: {
        id: "s1",
        rawTopic: "",
        workflowPhase: "questions",
        status: "questions_ready",
        dimensions: [{ id: "d1", name: "第一" }],
        totalQuestions: 3,
      },
      messages: [],
      latestCheckpoint: null,
    });
    expect(got.session.dimensions).toEqual([{ id: "d1", name: "第一" }]);
    expect(got.session.totalQuestions).toBe(3);
  });
});
