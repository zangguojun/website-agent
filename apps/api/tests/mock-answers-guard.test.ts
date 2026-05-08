import { describe, expect, it } from 'vitest';
import type { ExamQuestion } from '../src/mastra/exam-types';
import { validateAnswersAgainstExamQuestions } from '../src/streaming/mock-answers-guard';

const q: ExamQuestion[] = [
  {
    id: 'q1',
    dimensionId: 'd1',
    type: 'single_choice',
    body: 'x?',
    options: [
      { id: 'A', label: 'a' },
      { id: 'B', label: 'b' },
    ],
    correctAnswer: 'A',
    difficulty: 'easy',
    explanation: 'e',
  },
  {
    id: 'q2',
    dimensionId: 'd1',
    type: 'single_choice',
    body: 'y?',
    options: [
      { id: 'A', label: 'a' },
      { id: 'B', label: 'b' },
    ],
    correctAnswer: 'B',
    difficulty: 'easy',
    explanation: 'e',
  },
];

describe('validateAnswersAgainstExamQuestions', () => {
  it('accepts ordered answers mapped to scored session answers', () => {
    const r = validateAnswersAgainstExamQuestions(q, [
      { questionId: 'q1', optionId: 'A' },
      { questionId: 'q2', optionId: 'B' },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.scored).toEqual([
        { questionId: 'q1', userAnswer: 'A' },
        { questionId: 'q2', userAnswer: 'B' },
      ]);
    }
  });

  it('rejects duplicates or mismatched cardinality', () => {
    expect(
      validateAnswersAgainstExamQuestions(q, [{ questionId: 'q1', optionId: 'A' }]).ok,
    ).toBe(false);
    expect(
      validateAnswersAgainstExamQuestions(q, [
        { questionId: 'q1', optionId: 'A' },
        { questionId: 'q1', optionId: 'B' },
      ]).ok,
    ).toBe(false);
  });

  it('rejects unknown option ids', () => {
    const r = validateAnswersAgainstExamQuestions(q, [
      { questionId: 'q1', optionId: 'Z' },
      { questionId: 'q2', optionId: 'B' },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Invalid option');
  });
});
