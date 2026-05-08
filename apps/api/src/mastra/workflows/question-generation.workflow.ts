import type { OwnerId } from '@website-agent/core';

import {
  listSessionExamQuestions,
  replaceSessionExamQuestions,
} from '../../db/repositories/session-exam-questions.repo';
import type { ExamQuestion } from '../exam-types';
import { isOpenAiConfigured } from '../llm/config';
import { generateExamQuestionsWithLlm } from '../llm/questions-with-llm';
import {
  buildOfflineExamQuestions,
  offlinePlanFallbackFromSessionDimensions,
} from '../offline-plan-and-questions';
import { parseDimensionsForPrompt } from '../dimensions-from-session';

export async function runQuestionGenerationWorkflow(input: {
  sessionId: string;
  ownerId: OwnerId;
  rawTopic: string;
  clarifyDigest: string;
  /** 会话在计划阶段写入的 `dimensions` jsonb */
  dimensionsJson: unknown;
  totalQuestions: number;
}): Promise<{
  dimensions: ReturnType<typeof parseDimensionsForPrompt>;
  totalQuestions: number;
  questions: ExamQuestion[];
}> {
  const dims = parseDimensionsForPrompt(input.dimensionsJson);

  const existing = await listSessionExamQuestions(input.sessionId);
  const targetCount = Math.max(1, Math.round(input.totalQuestions));

  if (existing.length === targetCount && existing.length > 0) {
    return {
      dimensions: dims,
      totalQuestions: targetCount,
      questions: existing,
    };
  }

  let persisted: ExamQuestion[];

  try {
    if (isOpenAiConfigured() && dims.length >= 2) {
      const inserts = await generateExamQuestionsWithLlm({
        rawTopic: input.rawTopic,
        clarifyDigest: input.clarifyDigest,
        dimensions: dims,
        totalQuestions: targetCount,
      });
      persisted = await replaceSessionExamQuestions({
        sessionId: input.sessionId,
        ownerId: input.ownerId,
        items: inserts,
      });
    } else {
      throw new Error('LLM disabled or insufficient dimensions');
    }
  } catch (error) {
    console.warn('[question-generation.workflow] falling back to offline questions:', error);
    const offPlan = offlinePlanFallbackFromSessionDimensions(
      input.dimensionsJson,
      targetCount,
      input.rawTopic,
      input.clarifyDigest,
    );
    const inserts = buildOfflineExamQuestions(offPlan, input.rawTopic);
    persisted = await replaceSessionExamQuestions({
      sessionId: input.sessionId,
      ownerId: input.ownerId,
      items: inserts,
    });
  }

  return {
    dimensions: dims,
    totalQuestions: targetCount,
    questions: persisted,
  };
}
