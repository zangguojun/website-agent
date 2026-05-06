import { describe, expect, it } from 'vitest';
import { scoreSession } from './scoring';

describe('scoreSession', () => {
  it('computes weighted dimension and overall scores', () => {
    const result = scoreSession({
      dimensions: [
        { id: 'hooks-basics', name: 'Hook 基础', weight: 0.6 },
        { id: 'effects', name: '副作用', weight: 0.4 },
      ],
      questions: [
        { id: 'q1', dimensionId: 'hooks-basics', difficulty: 'easy', correctAnswer: 'A' },
        { id: 'q2', dimensionId: 'hooks-basics', difficulty: 'hard', correctAnswer: 'B' },
        { id: 'q3', dimensionId: 'effects', difficulty: 'medium', correctAnswer: ['A', 'C'] },
      ],
      answers: [
        { questionId: 'q1', userAnswer: 'A' },
        { questionId: 'q2', userAnswer: 'C' },
        { questionId: 'q3', userAnswer: ['C', 'A'] },
      ],
    });

    expect(result.dimensions).toEqual([
      { id: 'hooks-basics', name: 'Hook 基础', score: 33 },
      { id: 'effects', name: '副作用', score: 100 },
    ]);
    expect(result.overallScore).toBe(60);
    expect(result.masteryLabel).toBe('入门');
  });
});
