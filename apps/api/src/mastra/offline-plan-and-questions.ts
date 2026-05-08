import { createHash } from 'node:crypto';

import type { ExamQuestionInsertInput } from '../db/repositories/session-exam-questions.repo';
import { parseDimensionsForPrompt } from './dimensions-from-session';
export type OfflinePlan = {
  dimensions: Array<{
    id: string;
    name: string;
    description: string;
    weight: number;
  }>;
  totalQuestions: number;
  rationale: string;
};

function hashSeed(topic: string, salt: string): number {
  const h = createHash('sha256').update(salt).update('|').update(topic).digest();
  return h.readUInt32BE(0);
}

/** 无 API Key / LLM 失败时的可重复计划草案（仍可落库并由同一套链路出题）。 */
export function buildOfflinePlan(rawTopic: string, clarifyDigest: string): OfflinePlan {
  const topic = rawTopic.trim() || '综合主题';
  const seed = hashSeed(topic, clarifyDigest.slice(0, 400));

  const templates = [
    { name: `「${topic}」核心概念`, desc: '定义、术语与基本原理是否清晰。' },
    { name: `「${topic}」常见误区`, desc: '容易混淆或误用的点。' },
    { name: `「${topic}」应用与场景`, desc: '在真实或接近真实场景中的判断能力。' },
  ];

  const count = 2 + (seed % 2);
  const dims = templates.slice(0, count).map((t, i) => ({
    id: `dim-${i}-${(seed + i).toString(36).slice(-4)}`,
    name: t.name,
    description: t.desc,
    weight: 1,
  }));

  const totalQuestions = 3 + ((seed >>> 8) % 4);

  return {
    dimensions: dims,
    totalQuestions,
    rationale: `已根据主题「${topic}」离线生成 ${dims.length} 条能力维度草案，合计 ${totalQuestions} 道题（在未配置 OPENAI_API_KEY 或未接入模型时使用确定性模板）。`,
  };
}

/** 离线题目：结构与 LLM/SSE 对齐，便于评分与移动端解析。 */
export function buildOfflineExamQuestions(plan: OfflinePlan, rawTopic: string): ExamQuestionInsertInput[] {
  const topic = rawTopic.trim() || '测评主题';
  const seedBase = hashSeed(topic, JSON.stringify(plan.dimensions.map((d) => d.id)));

  const difficulties: ExamQuestionInsertInput['difficulty'][] = ['easy', 'medium', 'hard'];
  const out: ExamQuestionInsertInput[] = [];

  for (let i = 0; i < plan.totalQuestions; i++) {
    const dim = plan.dimensions[i % plan.dimensions.length]!;
    const seed = seedBase + i * 997;
    const hard = difficulties[seed % 3]!;

    const body = `[${dim.name}] 关于「${topic}」，下面哪一项描述更合理？ (#${i + 1})`;

    const wrongA = seed % 2 === 0 ? '把相关概念混在一起，外延过大。' : '忽略了上下文约束，结论武断。';
    const wrongB = '把实现细节当成了定义本身。';
    const wrongC = '误把可选优化当成了硬性前提。';

    const correctLabel =
      seed % 3 === 0
        ? '紧扣定义与边界条件，推理链条完整且不自相矛盾。'
        : seed % 3 === 1
          ? '能识别场景约束，并在约束下给出可落地的判断。'
          : '能区分相邻概念与易混误区，表述严谨。';

    /** 正确答案固定标注为 A，移动端与评分逻辑最简单、稳定。 */
    const options: ExamQuestionInsertInput['options'] = [
      { id: 'A', label: correctLabel },
      { id: 'B', label: wrongA },
      { id: 'C', label: wrongB },
      { id: 'D', label: wrongC },
    ];
    const correctAnswer = 'A';

    const explanation =
      hard === 'hard'
        ? `优先复盘「${dim.name}」中容易混淆的定义边界，再结合场景判断。`
        : `本题考察「${dim.name}」下对主题的准确表述。`;

    out.push({
      idx: i,
      dimensionId: dim.id,
      body,
      options,
      correctAnswer,
      difficulty: hard,
      explanation,
    });
  }

  return out;
}

/** 若会话里已有计划维度，则优先用它来生成离线题库，避免与计划阶段脱节。 */
export function offlinePlanFallbackFromSessionDimensions(
  dimsJson: unknown,
  totalQuestions: number,
  rawTopic: string,
  clarifyDigest: string,
): OfflinePlan {
  const parsed = parseDimensionsForPrompt(dimsJson);
  if (parsed.length >= 2) {
    return {
      dimensions: parsed.map((d) => ({ ...d, weight: 1 })),
      totalQuestions,
      rationale: `基于已落库 ${parsed.length} 条能力维度的离线题库（共 ${totalQuestions} 题）；LLM 不可用或失败时使用。`,
    };
  }
  return buildOfflinePlan(rawTopic, clarifyDigest);
}
