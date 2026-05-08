import { generateObject } from 'ai';
import { z } from 'zod';

import { createProjectOpenAI, openaiModelUserPreference } from './openai-provider';

const planSchema = z.object({
  dimensions: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        weight: z.number().min(0.25).max(5),
      }),
    )
    .min(2)
    .max(5),
  totalQuestions: z.number().min(3).max(12),
  rationale: z.string().min(40),
});

export type LlmPlanObject = z.infer<typeof planSchema>;

/** 结构化测评计划草案（OpenAI 或 OpenAI 兼容网关如百炼）。 */
export async function generatePlanWithLlm(input: {
  rawTopic: string;
  clarifyDigest: string;
}): Promise<LlmPlanObject> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const openai = createProjectOpenAI();
  const { object } = await generateObject({
    model: openai(openaiModelUserPreference()),
    schema: planSchema,
    prompt: [
      '你是一个严谨的学习测评设计师。请在 JSON 字段中产出「维度 + 题目数量 + 出题理由」，不得输出题干。',
      '',
      `测评主题（用户自述）：${input.rawTopic}`,
      '',
      '澄清对白（节选，可能不完整）：',
      input.clarifyDigest,
      '',
      '要求：',
      '- dimensions 每项含 id（短英文 slug）、name（中文短语）、description（一句诊断意图）、weight（0.25~5，可先全为 1）。',
      '- 维度数 2~5。',
      '- totalQuestions 必须与诊断深度匹配，范围 3~12。',
      '- rationale 用中文说明如何把澄清目标映射成测评方案。',
      '- 题干必须留到下一步生成；此处不要出现具体题目。',
    ].join('\n'),
  });

  return object;
}
