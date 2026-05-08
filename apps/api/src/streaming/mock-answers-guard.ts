import type { ScoredAnswer } from '@website-agent/core';

import type { ExamQuestion } from '../mastra/exam-types';

/** 校验客户端提交与当前会话题库一一对应（含选项 id 合法）。 */
export function validateAnswersAgainstExamQuestions(
  questions: ExamQuestion[],
  answers: Array<{ questionId: string; optionId: string }>,
): { ok: true; scored: ScoredAnswer[] } | { ok: false; error: string } {
  const expectedIds = [...new Set(questions.map((q) => q.id))].sort();
  const gotIds = [...new Set(answers.map((a) => a.questionId))].sort();
  if (
    expectedIds.length !== gotIds.length ||
    expectedIds.some((id, i) => id !== gotIds[i]) ||
    answers.length !== questions.length
  ) {
    return { ok: false, error: 'Answer count must match current question set exactly' };
  }

  const byId = new Map(questions.map((q) => [q.id, q]));
  const scored: ScoredAnswer[] = [];

  for (const a of answers) {
    const question = byId.get(a.questionId);
    if (!question) return { ok: false, error: `Unknown question ${a.questionId}` };
    const optionOk = question.options.some((option) => option.id === a.optionId);
    if (!optionOk) return { ok: false, error: `Invalid option for question ${a.questionId}` };
    scored.push({ questionId: a.questionId, userAnswer: a.optionId });
  }

  return { ok: true, scored };
}

/** @deprecated 使用 validateAnswersAgainstExamQuestions */
export const validateAnswersAgainstMockQuestions = validateAnswersAgainstExamQuestions;
