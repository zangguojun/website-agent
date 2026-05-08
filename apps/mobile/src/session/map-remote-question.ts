import type { GeneratedQuestion, TestPlan } from "./types";

function asOptionLetter(id: string): GeneratedQuestion["options"][number]["id"] | null {
  if (id === "A" || id === "B" || id === "C" || id === "D") return id;
  return null;
}

export function dimensionNameFromPlan(plan: TestPlan | undefined, dimensionId: string): string {
  const hit = plan?.dimensions.find((d) => d.id === dimensionId);
  return hit?.name ?? dimensionId;
}

/** Maps API 题目记录（SSE `question_final` 或落库 `payload.questions`）为 `GeneratedQuestion`。 */
export function mapStoredQuestionRecordToGenerated(
  env: Record<string, unknown>,
  resolveDimensionName: (dimensionId: string) => string,
): GeneratedQuestion | null {
  const id = typeof env.id === "string" ? env.id : null;
  const dimensionId = typeof env.dimensionId === "string" ? env.dimensionId : null;
  if (!id || !dimensionId) return null;

  const prompt = typeof env.body === "string" ? env.body : "";
  const correctRaw = env.correctAnswer;
  const correctLetter =
    typeof correctRaw === "string"
      ? asOptionLetter(correctRaw)
      : Array.isArray(correctRaw) && typeof correctRaw[0] === "string"
        ? asOptionLetter(correctRaw[0])
        : null;
  if (!correctLetter) return null;

  const rawOpts = env.options;
  if (!Array.isArray(rawOpts)) return null;

  const options: GeneratedQuestion["options"] = [];
  for (const item of rawOpts) {
    if (typeof item !== "object" || item === null || !("id" in item) || !("label" in item))
      continue;
    const oid = typeof (item as { id: unknown }).id === "string" ? (item as { id: string }).id : "";
    const label =
      typeof (item as { label: unknown }).label === "string" ? (item as { label: string }).label : "";
    const letter = asOptionLetter(oid);
    if (!letter || !label) continue;
    options.push({ id: letter, label });
  }

  if (options.length < 2) return null;

  const explanation = typeof env.explanation === "string" ? env.explanation : "";

  return {
    id,
    dimensionId,
    dimensionName: resolveDimensionName(dimensionId),
    prompt,
    options,
    correctOptionId: correctLetter,
    explanation,
  };
}

/** Maps `question_final` SSE envelope (mock workflow shape) into screen `GeneratedQuestion`. */
export function mapApiEnvelopeToGeneratedQuestion(
  env: Record<string, unknown>,
  plan: TestPlan | undefined,
): GeneratedQuestion | null {
  return mapStoredQuestionRecordToGenerated(env, (dimensionId) => dimensionNameFromPlan(plan, dimensionId));
}
