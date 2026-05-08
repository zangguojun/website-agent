import { describe, expect, it } from "vitest";

import type { SessionMessageSlice } from "../api/session-contract";
import { hydrateClarificationTurnsFromStateMessages } from "./hydrate-clarify-from-state";

function msg(partial: Omit<SessionMessageSlice, "payload"> & { payload?: SessionMessageSlice["payload"] }) {
  return {
    payload: null,
    ...partial,
  };
}

describe("hydrateClarificationTurnsFromStateMessages", () => {
  it("returns null when no clarify assistant", () => {
    expect(hydrateClarificationTurnsFromStateMessages([])).toBeNull();
    expect(
      hydrateClarificationTurnsFromStateMessages([
        msg({
          id: "1",
          phase: "clarify",
          role: "user",
          content: "orphan",
          createdAt: null,
        }),
      ]),
    ).toBeNull();
  });

  it("builds one unanswered assistant turn", () => {
    const turns = hydrateClarificationTurnsFromStateMessages([
      msg({
        id: "a1",
        phase: "clarify",
        role: "assistant",
        content: "目标？",
        payload: {
          options: [
            { id: "gap", label: "查漏补缺" },
            { id: "sys", label: "系统学习" },
          ],
        },
        createdAt: "2026-01-01",
      }),
    ]);

    expect(turns?.length).toBe(1);
    expect(turns?.[0]?.question.prompt).toBe("目标？");
    expect(turns?.[0]?.question.type).toBe("single_choice");
    expect(turns?.[0]?.answer).toBeUndefined();
  });

  it("pairs assistant and user into answered turn plus new assistant pending", () => {
    const turns = hydrateClarificationTurnsFromStateMessages([
      msg({
        id: "a1",
        phase: "clarify",
        role: "assistant",
        content: "第一轮？",
        payload: {
          options: [{ id: "A", label: "选A" }],
        },
        createdAt: null,
      }),
      msg({
        id: "u1",
        phase: "clarify",
        role: "user",
        content: "A",
        payload: { label: "选A", source: "t" },
        createdAt: null,
      }),
      msg({
        id: "a2",
        phase: "clarify",
        role: "assistant",
        content: "第二轮？",
        payload: null,
        createdAt: null,
      }),
    ]);

    expect(turns?.length).toBe(2);
    expect(turns?.[0]?.answer?.label).toBe("选A");
    expect(turns?.[1]?.question.prompt).toBe("第二轮？");
    expect(turns?.[1]?.question.type).toBe("free_text");
    expect(turns?.[1]?.answer).toBeUndefined();
  });
});
