import { CLARIFY_SCRIPT } from '../clarify-script';

/** 兼容旧 POST `/clarify`（非主推路径）；题干与 SSE 链路使用同款脚本第一轮。 */
export async function runClarificationWorkflow(input: { rawTopic: string }) {
  const step = CLARIFY_SCRIPT[0];
  if (!step) {
    throw new Error('CLARIFY_SCRIPT is empty');
  }

  const topic = typeof input.rawTopic === 'string' ? input.rawTopic.trim() : '';
  const prefix = topic.length ? `你想围绕「${topic}」` : '我们继续';
  const question = `${prefix}确认一下：${step.prompt}`;
  const options =
    'choices' in step ? step.choices.map((c) => ({ id: c.id, label: c.label })) : undefined;

  return {
    done: false,
    question,
    options,
    clarifyStepId: step.id,
    why: step.why,
  };
}
