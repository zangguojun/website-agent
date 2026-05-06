import { z } from 'zod';

export const difficultySchema = z.enum(['easy', 'medium', 'hard']);
export type Difficulty = z.infer<typeof difficultySchema>;

export const masteryLabelSchema = z.enum(['初学', '入门', '熟练', '精通']);
export type MasteryLabel = z.infer<typeof masteryLabelSchema>;

export const dimensionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  weight: z.number().positive(),
});
export type Dimension = z.infer<typeof dimensionSchema>;

export const scoredQuestionSchema = z.object({
  id: z.string().min(1),
  dimensionId: z.string().min(1),
  difficulty: difficultySchema,
  correctAnswer: z.union([z.string(), z.array(z.string()).min(1)]),
});
export type ScoredQuestion = z.infer<typeof scoredQuestionSchema>;

export const scoredAnswerSchema = z.object({
  questionId: z.string().min(1),
  userAnswer: z.union([z.string(), z.array(z.string()).min(1)]),
});
export type ScoredAnswer = z.infer<typeof scoredAnswerSchema>;
