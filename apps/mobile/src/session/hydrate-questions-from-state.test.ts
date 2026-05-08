import { describe, expect, it } from "vitest";

import type { SessionMessageSlice } from "../api/session-contract";
import type { SessionRecordSlice } from "../api/session-contract";
import { hydrateQuestionsFromStateMessages } from "./hydrate-questions-from-state";

function msg(partial: Omit<SessionMessageSlice, "payload"> & { payload?: SessionMessageSlice["payload"] }) {
  return { payload: null, ...partial };
}

describe("hydrateQuestionsFromStateMessages", () => {
  it("returns null when no questions payload", () => {
    expect(
      hydrateQuestionsFromStateMessages([], {
        id: "s",
        rawTopic: "",
        workflowPhase: "questions",
        status: "questions_ready",
      }),
    ).toBeNull();
  });

  it("maps last assistant questions message with session dimensions", () => {
    const session: SessionRecordSlice = {
      id: "s",
      rawTopic: "t",
      workflowPhase: "questions",
      status: "awaiting_answers",
      dimensions: [{ id: "dim-1", name: "维度一" }],
    };
    const messages: SessionMessageSlice[] = [
      msg({
        id: "m1",
        phase: "questions",
        role: "assistant",
        content: "已生成",
        payload: {
          totalQuestions: 1,
          questions: [
            {
              id: "q1",
              dimensionId: "dim-1",
              body: "题干？",
              difficulty: "easy",
              type: "single_choice",
              options: [
                { id: "A", label: "是" },
                { id: "B", label: "否" },
                { id: "C", label: "可能" },
                { id: "D", label: "跳过" },
              ],
              correctAnswer: "A",
              explanation: "因为",
            },
          ],
        },
        createdAt: null,
      }),
    ];
    const got = hydrateQuestionsFromStateMessages(messages, session);
    expect(got?.length).toBe(1);
    expect(got?.[0]?.id).toBe("q1");
    expect(got?.[0]?.dimensionName).toBe("维度一");
    expect(got?.[0]?.correctOptionId).toBe("A");
  });
});
