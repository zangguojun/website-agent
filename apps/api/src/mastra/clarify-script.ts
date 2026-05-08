export type ClarifyScriptStep =
  | {
      id: string;
      prompt: string;
      why: string;
      choices: readonly { readonly id: string; readonly label: string }[];
    }
  | {
      id: string;
      prompt: string;
      why: string;
      freeText: true;
    };

/** 服务端权威澄清脚本（与历史 mock 题库语义一致）；非 LLM 占位，避免「只有两个选项的一道题」。 */
export const CLARIFY_SCRIPT: ClarifyScriptStep[] = [
  {
    id: 'goal',
    prompt: '这次自测你更想验证哪类掌握程度？',
    why: '这个问题用于判断测试应偏概念理解、应用能力还是查漏补缺。',
    choices: [
      { id: 'interview', label: '准备面试' },
      { id: 'system', label: '系统学习' },
      { id: 'gap', label: '查漏补缺' },
      { id: 'unsure', label: '不确定' },
    ],
  },
  {
    id: 'depth',
    prompt: '你希望题目更接近哪种难度？',
    why: '难度会影响题目是否偏定义辨析、场景判断，还是边界条件推理。',
    choices: [
      { id: 'basic', label: '基础概念' },
      { id: 'applied', label: '真实场景应用' },
      { id: 'edge', label: '边界条件和陷阱' },
      { id: 'mixed', label: '混合一点' },
    ],
  },
  {
    id: 'scope',
    prompt: '有没有你特别想测或特别不想测的范围？',
    why: '范围边界可以避免题目过宽，让诊断结果更贴近你的真实目标。',
    freeText: true,
  },
] as const;

export function clarifyStepCount(): number {
  return CLARIFY_SCRIPT.length;
}

export function userIndexToEmit(userMessageCountPrior: number): ClarifyScriptStep | null {
  if (userMessageCountPrior < 0 || userMessageCountPrior >= CLARIFY_SCRIPT.length) return null;
  const step = CLARIFY_SCRIPT[userMessageCountPrior];
  return step ?? null;
}

export { CLARIFY_REQUIRED_USER_MESSAGES } from '@website-agent/core';
