import type { Dimension, MasteryLabel, ScoredAnswer, ScoredQuestion } from './schemas';

const difficultyWeights: Record<ScoredQuestion['difficulty'], number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
};

export type DimensionScore = { id: string; name: string; score: number };

export function scoreSession(input: {
  dimensions: Dimension[];
  questions: ScoredQuestion[];
  answers: ScoredAnswer[];
}) {
  const answersByQuestionId = new Map(input.answers.map((answer) => [answer.questionId, answer]));
  const correctnessByQuestionId: Record<string, boolean> = {};

  for (const question of input.questions) {
    const answer = answersByQuestionId.get(question.id);
    correctnessByQuestionId[question.id] = answer
      ? sameAnswer(answer.userAnswer, question.correctAnswer)
      : false;
  }

  const dimensions = input.dimensions.map((dimension) => {
    const questions = input.questions.filter((question) => question.dimensionId === dimension.id);
    const totalWeight = questions.reduce((sum, question) => sum + difficultyWeights[question.difficulty], 0);
    const earnedWeight = questions.reduce((sum, question) => {
      return sum + (correctnessByQuestionId[question.id] ? difficultyWeights[question.difficulty] : 0);
    }, 0);
    return {
      id: dimension.id,
      name: dimension.name,
      score: totalWeight === 0 ? 0 : Math.round((earnedWeight / totalWeight) * 100),
    };
  });

  const totalDimensionWeight = input.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  const overallScore =
    totalDimensionWeight === 0
      ? 0
      : Math.round(
          dimensions.reduce((sum, score) => {
            const dimension = input.dimensions.find((item) => item.id === score.id);
            return sum + score.score * (dimension?.weight ?? 0);
          }, 0) / totalDimensionWeight,
        );

  return {
    overallScore,
    masteryLabel: toMasteryLabel(overallScore),
    dimensions,
    weaknessTop3: dimensions.filter((item) => item.score < 70).sort((a, b) => a.score - b.score).slice(0, 3),
    correctnessByQuestionId,
  };
}

function sameAnswer(left: string | string[], right: string | string[]) {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    return [...left].sort().join('|') === [...right].sort().join('|');
  }
  return left === right;
}

function toMasteryLabel(score: number): MasteryLabel {
  if (score >= 90) return '精通';
  if (score >= 70) return '熟练';
  if (score >= 50) return '入门';
  return '初学';
}
