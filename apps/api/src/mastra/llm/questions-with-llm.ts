import { generateObject } from 'ai';
import { z } from 'zod';

import type { ExamQuestionInsertInput } from '../../db/repositories/session-exam-questions.repo';

import { createProjectOpenAI, openaiModelUserPreference } from './openai-provider';

const optionSchema = z.object({
  id: z.enum(['A', 'B', 'C', 'D']),
  label: z.string().min(1),
});

const questionsSchema = z.object({
  questions: z.array(
    z.object({
      dimensionId: z.string(),
      difficulty: z.enum(['easy', 'medium', 'hard']),
      body: z.string().min(15),
      options: z.array(optionSchema).length(4),
      correctAnswer: z.enum(['A', 'B', 'C', 'D']),
      explanation: z.string().min(10),
    }),
  ),
});

function normalizeExamInserts(rows: z.infer<typeof questionsSchema>['questions']): ExamQuestionInsertInput[] {
  return rows.map((row, idx) => {
    const ids = new Set(row.options.map((o) => o.id));
    if (ids.size !== 4) {
      throw new Error('LLM returned duplicate option ids');
    }
    return {
      idx,
      dimensionId: row.dimensionId,
      body: row.body,
      options: row.options.map((o) => ({ id: o.id, label: o.label })),
      correctAnswer: row.correctAnswer,
      difficulty: row.difficulty,
      explanation: row.explanation,
    };
  });
}

export async function generateExamQuestionsWithLlm(input: {
  rawTopic: string;
  clarifyDigest: string;
  dimensions: Array<{ id: string; name: string; description: string }>;
  totalQuestions: number;
}): Promise<ExamQuestionInsertInput[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const openai = createProjectOpenAI();
  const dimBlock = input.dimensions
    .map((d) => `- id=${d.id} name="${d.name}" 说明="${d.description}"`)
    .join('\n');

  const { object } = await generateObject({
    model: openai(openaiModelUserPreference()),
    schema: questionsSchema,
    prompt: [
      '你是资深测评命题人。请在 JSON `questions` 数组中产出若干道「四选一单项选择题」，必须覆盖指定维度。',
      '',
      `主题：${input.rawTopic}`,
      '',
      `澄清摘要：`,
      input.clarifyDigest,
      '',
      '维度目录（题干必须可被映射回 dimensionId）：',
      dimBlock,
      '',
      `需要恰好 ${input.totalQuestions} 道题（questions.length === ${input.totalQuestions}）。`,
      '',
      '硬性规则：',
      '- 仅输出 JSON schema 定义的字段。',
      '- 每题 options 必须恰好四条，id 必须为 A,B,C,D 全集。',
      '- correctAnswer 必须是 A,B,C,D 之一，且与各选项语义一致。',
      '- difficulty ∈ easy|medium|hard，尽量在维度间分摊。',
      '- body 题干用中文陈述一个可判断的情境或定义辨析。',
      '- explanation 用中文两行内说明正确项的依据。',
      '- dimensionId 必须严格等于上文目录其一。',
      '- 题干不得出现「正确答案在 X」之类元提示。',
    ].join('\n'),
  });

  if (object.questions.length !== input.totalQuestions) {
    throw new Error(`LLM question count mismatch (${object.questions.length} vs ${input.totalQuestions})`);
  }

  const dimIds = new Set(input.dimensions.map((d) => d.id));
  for (const q of object.questions) {
    if (!dimIds.has(q.dimensionId)) throw new Error(`Unknown dimension ${q.dimensionId}`);
  }

  return normalizeExamInserts(object.questions);
}
