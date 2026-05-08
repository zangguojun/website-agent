import { describe, expect, it } from "vitest";

import type { SessionMessageSlice } from "../api/session-contract";
import { hydrateAnswerRecordsFromStateMessages } from "./hydrate-answers-from-state";

describe("hydrateAnswerRecordsFromStateMessages", () => {
  it("returns null without questionnaire_submit", () => {
    expect(hydrateAnswerRecordsFromStateMessages([])).toBeNull();
    expect(
      hydrateAnswerRecordsFromStateMessages([
        {
          id: "1",
          phase: "questions",
          role: "user",
          content: "noise",
          payload: { foo: true },
          createdAt: null,
        },
      ]),
    ).toBeNull();
  });

  it("parses last submit with A-D options", () => {
    const messages: SessionMessageSlice[] = [
      {
        id: "bad",
        phase: "questions",
        role: "user",
        content: "x",
        payload: { kind: "questionnaire_submit", answers: [{}] },
        createdAt: null,
      },
      {
        id: "ok",
        phase: "questions",
        role: "user",
        content: "已提交",
        payload: {
          kind: "questionnaire_submit",
          answers: [
            { questionId: "q1", optionId: "A" },
            { questionId: "q2", optionId: "B" },
          ],
        },
        createdAt: null,
      },
    ];
    expect(hydrateAnswerRecordsFromStateMessages(messages)).toEqual([
      { questionId: "q1", optionId: "A" },
      { questionId: "q2", optionId: "B" },
    ]);
  });
});
