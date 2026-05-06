import type { DimensionScore, MasteryLabel } from '@website-agent/core';

export type ReportWorkflowInput = {
  overallScore: number;
  masteryLabel: MasteryLabel;
  dimensions: DimensionScore[];
  weaknessTop3: DimensionScore[];
};

export async function runReportWorkflow(input: ReportWorkflowInput) {
  const weakest = input.weaknessTop3.map((item) => item.name);

  return {
    headline: `${input.masteryLabel}：本次得分 ${input.overallScore}`,
    summary: `你在本次测评中获得 ${input.overallScore} 分，整体水平为${input.masteryLabel}。`,
    weaknessTop3: input.weaknessTop3,
    nextSteps: weakest.length > 0
      ? weakest.map((name) => `复习 ${name} 的核心概念并完成 3 道练习题。`)
      : ['继续通过综合练习保持熟练度。'],
  };
}
