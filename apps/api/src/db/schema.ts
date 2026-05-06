import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id').notNull(),
  status: text('status').notNull().default('input'),
  rawTopic: text('raw_topic').notNull(),
  refinedTopic: text('refined_topic'),
  dimensions: jsonb('dimensions'),
  totalQuestions: integer('total_questions'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  ownerCreatedIdx: index('sessions_owner_created_idx').on(table.ownerId, table.createdAt),
}));

export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull(),
  dimensionId: text('dimension_id').notNull(),
  idx: integer('idx').notNull(),
  type: text('type').notNull(),
  body: text('body').notNull(),
  options: jsonb('options').notNull(),
  correctAnswer: jsonb('correct_answer').notNull(),
  difficulty: text('difficulty').notNull(),
  explanation: text('explanation'),
  retired: boolean('retired').default(false).notNull(),
});

export const answers = pgTable('answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionId: uuid('question_id').notNull(),
  sessionId: uuid('session_id').notNull(),
  userAnswer: jsonb('user_answer').notNull(),
  isCorrect: boolean('is_correct').notNull(),
});

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull(),
  ownerId: text('owner_id').notNull(),
  overallScore: integer('overall_score').notNull(),
  masteryLabel: text('mastery_label').notNull(),
  dimensions: jsonb('dimensions').notNull(),
  weaknessTop3: jsonb('weakness_top3').notNull(),
  headline: text('headline').notNull(),
  summary: text('summary').notNull(),
});
