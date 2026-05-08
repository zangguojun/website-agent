import type { ScoredQuestion } from '@website-agent/core';

/** 与工作流 SSE / `scoreSession` 对齐的题库记录（可由 LLM 或离线模板生成）。 */
export type ExamQuestion = ScoredQuestion & {
  type: 'single_choice';
  body: string;
  options: Array<{ id: string; label: string }>;
  explanation: string;
};
