import type { AnswerRecord, ClarificationTurn, GeneratedQuestion, ReportAgentSseSlice, ReportData } from "./types";

export function getNextUnansweredTurn(turns: ClarificationTurn[]): ClarificationTurn | null {
  return turns.find((turn) => !turn.answer) ?? null;
}

export function answerClarificationTurn(
  turns: ClarificationTurn[],
  questionId: string,
  value: string | string[],
  label: string
): ClarificationTurn[] {
  return turns.map((turn) =>
    turn.question.id === questionId
      ? {
          ...turn,
          answer: {
            questionId,
            value,
            label
          }
        }
      : turn
  );
}

export function answerQuestion(
  answers: AnswerRecord[],
  questionId: string,
  optionId: AnswerRecord["optionId"]
): AnswerRecord[] {
  return [...answers.filter((answer) => answer.questionId !== questionId), { questionId, optionId }];
}

export function buildReport(questions: GeneratedQuestion[], answers: AnswerRecord[]): ReportData {
  const answersByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer.optionId]));
  const correctQuestions = questions.filter(
    (question) => answersByQuestionId.get(question.id) === question.correctOptionId
  );
  const score = Math.round((correctQuestions.length / questions.length) * 100);
  const dimensions = [...new Map(questions.map((question) => [question.dimensionId, question.dimensionName]))];

  const metrics = dimensions.map(([dimensionId, name]) => {
    const dimensionQuestions = questions.filter((question) => question.dimensionId === dimensionId);
    const correctCount = dimensionQuestions.filter(
      (question) => answersByQuestionId.get(question.id) === question.correctOptionId
    ).length;

    return {
      dimensionId,
      name,
      score: Math.round((correctCount / dimensionQuestions.length) * 100)
    };
  });

  const explanations = questions
    .filter((question) => answersByQuestionId.get(question.id) !== question.correctOptionId)
    .map((question) => ({
      questionId: question.id,
      title: question.dimensionName,
      explanation: question.explanation
    }));

  return {
    score,
    mastery: score >= 85 ? "熟练" : score >= 65 ? "接近掌握" : "需要补基础",
    summary:
      score >= 85
        ? "你已经掌握主要概念，可以进一步挑战边界场景。"
        : "你已经理解一部分概念，但还需要补齐应用和边界判断。",
    rationale: "这份报告根据澄清阶段确定的目标、维度规划和答题结果生成。",
    metrics,
    weaknesses: metrics
      .filter((metric) => metric.score < 80)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((metric) => `${metric.name}：当前得分 ${metric.score}，建议优先复盘相关错题。`),
    explanations
  };
}

/** Mastra/Core 侧的掌握标签（四字）对齐到报告卡的汉字档位。 */
export function mapServerMasteryLabel(label: string): ReportData["mastery"] {
  switch (label) {
    case "精通":
      return "精通";
    case "熟练":
      return "熟练";
    case "入门":
      return "接近掌握";
    case "初学":
    default:
      return "需要补基础";
  }
}

/** 将报告 SSE（`report_sections` / `report_done`）与本地 buildReport 结果合并展示。 */
export function mergeReportWithAgentSse(local: ReportData, sse: ReportAgentSseSlice): ReportData {
  const score = sse.overallScore ?? local.score;
  const mastery =
    sse.masteryLabel !== undefined ? mapServerMasteryLabel(sse.masteryLabel) : local.mastery;

  let rationale = local.rationale;
  if (sse.headline) {
    rationale = `${sse.headline}\n\n${local.rationale}`;
  }

  let summary = sse.summary ?? local.summary;
  if (sse.nextSteps?.length) {
    summary = `${summary}\n\n下一步建议：`;
    summary += sse.nextSteps.map((step) => `\n• ${step}`).join("");
  }

  const weaknesses =
    sse.weaknessLines && sse.weaknessLines.length > 0 ? sse.weaknessLines : local.weaknesses;

  return {
    ...local,
    score,
    mastery,
    summary,
    rationale,
    weaknesses,
  };
}
