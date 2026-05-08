import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id').notNull(),
    status: text('status').notNull().default('input'),
    /** Mastra gate + UX; persisted for SSE guards (clarify → plan → questions → report → done). */
    workflowPhase: text('workflow_phase').notNull().default('clarify'),
    /** Monotonic cursor for `agent_steps` / SSE `seq` (session-scoped). */
    lastSequence: bigint('last_sequence', { mode: 'bigint' }).notNull().default(0n),
    rawTopic: text('raw_topic').notNull(),
    refinedTopic: text('refined_topic'),
    dimensions: jsonb('dimensions'),
    totalQuestions: integer('total_questions'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    ownerCreatedIdx: index('sessions_owner_created_idx').on(table.ownerId, table.createdAt),
  }),
);

export const sessionMessages = pgTable(
  'session_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id').notNull(),
    phase: text('phase').notNull(),
    role: text('role').notNull(),
    content: text('content').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionCreatedIdx: index('session_messages_session_created_idx').on(table.sessionId, table.createdAt),
    sessionPhaseIdx: index('session_messages_session_phase_idx').on(table.sessionId, table.phase),
  }),
);

export const agentSteps = pgTable(
  'agent_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id').notNull(),
    phase: text('phase').notNull(),
    stepType: text('step_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    sequence: bigint('sequence', { mode: 'bigint' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionSequenceUniq: uniqueIndex('agent_steps_session_sequence_uidx').on(table.sessionId, table.sequence),
    sessionSeqLookupIdx: index('agent_steps_session_seq_idx').on(table.sessionId, table.sequence),
  }),
);

export const streamCheckpoints = pgTable(
  'stream_checkpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    phase: text('phase').notNull(),
    streamCursor: bigint('stream_cursor', { mode: 'bigint' }).notNull().default(1n),
    summary: text('summary').notNull(),
    clientVisibleSeq: bigint('client_visible_seq', { mode: 'bigint' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionPhaseCreatedIdx: index('stream_ckpt_session_phase_created_idx').on(
      table.sessionId,
      table.phase,
      table.createdAt,
    ),
  }),
);

export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
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
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  userAnswer: jsonb('user_answer').notNull(),
  isCorrect: boolean('is_correct').notNull(),
});

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').notNull(),
  overallScore: integer('overall_score').notNull(),
  masteryLabel: text('mastery_label').notNull(),
  dimensions: jsonb('dimensions').notNull(),
  weaknessTop3: jsonb('weakness_top3').notNull(),
  headline: text('headline').notNull(),
  summary: text('summary').notNull(),
});
