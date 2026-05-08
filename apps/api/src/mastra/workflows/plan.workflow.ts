import { buildOfflinePlan } from '../offline-plan-and-questions';
import { isOpenAiConfigured } from '../llm/config';
import { generatePlanWithLlm } from '../llm/plan-with-llm';

export type PlanWorkflowDimension = {
  id: string;
  name: string;
  description: string;
  weight: number;
};

/** 结构化测评计划：优先 OpenAI object mode，失败或未配置密钥则离线模板。 */
export async function runPlanWorkflow(input: {
  rawTopic: string;
  clarifyDigest: string;
}) {
  if (isOpenAiConfigured()) {
    try {
      const obj = await generatePlanWithLlm({
        rawTopic: input.rawTopic,
        clarifyDigest: input.clarifyDigest,
      });

      return {
        dimensions: obj.dimensions.map((d): PlanWorkflowDimension => ({
          id: d.id,
          name: d.name,
          description: d.description,
          weight: d.weight,
        })),
        totalQuestions: obj.totalQuestions,
        rationale: obj.rationale,
      };
    } catch (error) {
      console.warn('[plan.workflow] LLM branch failed, using offline plan:', error);
    }
  }

  const fallback = buildOfflinePlan(input.rawTopic, input.clarifyDigest);
  return {
    dimensions: fallback.dimensions,
    totalQuestions: fallback.totalQuestions,
    rationale: fallback.rationale,
  };
}
