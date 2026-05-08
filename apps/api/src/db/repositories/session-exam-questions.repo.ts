import { and, asc, eq } from 'drizzle-orm';

import type { OwnerId } from '@website-agent/core';

import type { ExamQuestion } from '../../mastra/exam-types';
import { db } from '../client';
import { questions as questionsTable } from '../schema';

type MemoryRow = {
  id: string;
  sessionId: string;
  dimensionId: string;
  idx: number;
  type: string;
  body: string;
  options: Array<{ id: string; label: string }>;
  correctAnswer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  explanation: string | null;
};

const inMemoryQuestions = new Map<string, MemoryRow[]>();

export function resetInMemorySessionExamQuestions(): void {
  inMemoryQuestions.clear();
}

function normalizeCorrect(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]!;
  return String(raw ?? '');
}

function rowToExam(row: MemoryRow): ExamQuestion {
  return {
    id: row.id,
    dimensionId: row.dimensionId,
    difficulty: row.difficulty,
    correctAnswer: row.correctAnswer,
    type: 'single_choice',
    body: row.body,
    options: row.options,
    explanation: row.explanation ?? '',
  };
}

export type ExamQuestionInsertInput = Omit<ExamQuestion, 'id' | 'type' | 'explanation'> & {
  idx: number;
  explanation?: string;
};

/** 替换会话题库（写入 Postgres `questions` 或内存等价物）。调用方应先校验会话归属。 */
export async function replaceSessionExamQuestions(params: {
  sessionId: string;
  ownerId: OwnerId;
  items: ExamQuestionInsertInput[];
}): Promise<ExamQuestion[]> {
  const rows: MemoryRow[] = params.items.map((item) => ({
    id: crypto.randomUUID(),
    sessionId: params.sessionId,
    dimensionId: item.dimensionId,
    idx: item.idx,
    type: 'single_choice',
    body: item.body,
    options: item.options,
    correctAnswer:
      typeof item.correctAnswer === 'string'
        ? item.correctAnswer
        : JSON.stringify(item.correctAnswer),
    difficulty: item.difficulty,
    explanation: item.explanation ?? null,
  }));

  if (!db) {
    inMemoryQuestions.set(params.sessionId, rows);
    return rows.map(rowToExam);
  }

  await db.delete(questionsTable).where(eq(questionsTable.sessionId, params.sessionId));

  if (rows.length > 0) {
    await db.insert(questionsTable).values(
      rows.map((r) => ({
        id: r.id,
        sessionId: params.sessionId,
        dimensionId: r.dimensionId,
        idx: r.idx,
        type: r.type,
        body: r.body,
        options: r.options,
        correctAnswer: r.correctAnswer,
        difficulty: r.difficulty,
        explanation: r.explanation,
        retired: false,
      })),
    );
  }

  return rows.map(rowToExam);
}

export async function listSessionExamQuestions(sessionId: string): Promise<ExamQuestion[]> {
  if (!db) {
    const bucket = inMemoryQuestions.get(sessionId) ?? [];
    return [...bucket].sort((a, b) => a.idx - b.idx).map(rowToExam);
  }

  const rows = await db
    .select()
    .from(questionsTable)
    .where(and(eq(questionsTable.sessionId, sessionId), eq(questionsTable.retired, false)))
    .orderBy(asc(questionsTable.idx));

  const memoryRows: MemoryRow[] = rows.map((r) => ({
    id: r.id,
    sessionId,
    dimensionId: r.dimensionId,
    idx: r.idx,
    type: r.type,
    body: r.body,
    options: r.options as Array<{ id: string; label: string }>,
    correctAnswer: normalizeCorrect(r.correctAnswer),
    difficulty: r.difficulty as MemoryRow['difficulty'],
    explanation: r.explanation,
  }));

  return memoryRows.map(rowToExam);
}
