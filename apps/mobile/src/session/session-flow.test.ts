import { describe, expect, it } from "vitest";
import { answerClarificationTurn, answerQuestion, buildReport, getNextUnansweredTurn } from "./session-flow";
import { mockClarificationTurns, mockQuestions } from "./mock-session";

describe("dynamic session flow", () => {
  it("returns the first unanswered clarification turn", () => {
    expect(getNextUnansweredTurn(mockClarificationTurns)?.question.id).toBe("goal");
  });

  it("records a clarification answer without mutating previous turns", () => {
    const updated = answerClarificationTurn(mockClarificationTurns, "goal", "gap", "查漏补缺");

    expect(updated[0]?.answer).toEqual({
      questionId: "goal",
      value: "gap",
      label: "查漏补缺"
    });
    expect(mockClarificationTurns[0]?.answer).toBeUndefined();
  });

  it("advances to the next unanswered clarification after answering", () => {
    const updated = answerClarificationTurn(mockClarificationTurns, "goal", "gap", "查漏补缺");

    expect(getNextUnansweredTurn(updated)?.question.id).toBe("depth");
  });

  it("records a question answer by replacing previous answer for the same question", () => {
    const answers = answerQuestion([], "rsc-concept", "B");
    const replaced = answerQuestion(answers, "rsc-concept", "A");

    expect(replaced).toEqual([{ questionId: "rsc-concept", optionId: "A" }]);
  });

  it("builds report metrics and weaknesses from answers", () => {
    const report = buildReport(mockQuestions, [
      { questionId: "rsc-concept", optionId: "A" },
      { questionId: "cache-usage", optionId: "B" },
      { questionId: "common-misconception", optionId: "B" }
    ]);

    expect(report.score).toBe(67);
    expect(report.metrics).toHaveLength(3);
    expect(report.weaknesses[0]).toContain("实际应用");
    expect(report.explanations).toHaveLength(1);
  });
});
