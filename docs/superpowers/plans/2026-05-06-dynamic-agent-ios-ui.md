# Dynamic Agent iOS UI Implementation Plan

> **实现状态（2026-05-06 起持续更新）：** 原计划 Task 1–6 中的类型、主题、页面与 mock 主流程已在代码库落地，并额外接入了 API 快照恢复、报告 SSE 合并、答题/报告 deep link 补强等。本文档中的 `- [ ]` 复选框主要为历史分步记录；以 `git` 与 `apps/mobile` 源码为准。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Expo iOS MVP from static demo screens into a dynamic, transparent Agent-driven diagnostic session UI.

**Architecture:** Keep the backend mock workflow stable for this pass and implement a front-end dynamic session shell driven by typed mock state. Extract focused UI components first, then replace each current screen with the new Native Calm + Agent Companion + Diagnostic Pro experience. Preserve clear boundaries so later SSE/Mastra integration can replace the mock state without rewriting the UI.

**Tech Stack:** Expo Router, React Native, TypeScript strict mode, StyleSheet, TanStack Query, Vitest for pure state tests, Maestro for smoke flow.

---

## File Structure

Create these files:

- `apps/mobile/src/session/types.ts`  
  Shared front-end domain types for clarification turns, test plans, generated questions, report data, and session phases.

- `apps/mobile/src/session/mock-session.ts`  
  Deterministic mock dynamic Agent data used by current UI until real Agent/SSE is connected.

- `apps/mobile/src/session/session-flow.ts`  
  Pure helpers for progressing clarification turns, generating a plan, generating questions, advancing answers, and preparing report data.

- `apps/mobile/src/session/session-flow.test.ts`  
  Unit tests for the pure dynamic session flow.

- `apps/mobile/src/ui/theme.ts`  
  Central Native Calm design tokens: colors, spacing, radii, type sizes, shadows.

- `apps/mobile/src/ui/components.tsx`  
  Shared UI primitives: `ScreenShell`, `PrimaryButton`, `AgentBubble`, `ChoiceOption`, `PlanCard`, `GenerationStepList`, `QuestionCard`, `ReportScoreCard`, `MetricBar`, `WeaknessCard`.

- `apps/mobile/app/session/[id]/generate.tsx`  
  Transparent generation progress screen between plan confirmation and answering.

Modify these files:

- `apps/mobile/package.json`  
  Replace placeholder mobile test script with Vitest and add a focused test command.

- `apps/mobile/app/(tabs)/index.tsx`  
  Redesign Home as an AI assistant entry point.

- `apps/mobile/app/session/[id]/clarify.tsx`  
  Replace static choice page with dynamic clarification chat and plan-ready state.

- `apps/mobile/app/session/[id]/confirm.tsx`  
  Convert test preview into a plan confirmation page using `PlanCard`.

- `apps/mobile/app/session/[id]/answer.tsx`  
  Use generated mock questions from the session model and keep one-question-per-screen behavior.

- `apps/mobile/app/session/[id]/report.tsx`  
  Redesign report with Diagnostic Pro score card, rationale, metrics, weaknesses, and explanations.

- `apps/mobile/e2e/first-test-flow.yaml`  
  Update smoke test to the dynamic Agent UI copy and route sequence.

---

### Task 1: Dynamic Session Model And Tests

**Files:**
- Create: `apps/mobile/src/session/types.ts`
- Create: `apps/mobile/src/session/mock-session.ts`
- Create: `apps/mobile/src/session/session-flow.ts`
- Create: `apps/mobile/src/session/session-flow.test.ts`
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Add the mobile unit test command and dependency**

Modify `apps/mobile/package.json`:

```json
{
  "scripts": {
    "dev": "expo start",
    "dev-client": "expo start --dev-client",
    "ios": "expo start --ios",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/react": "19.2.14",
    "typescript": "5.9.3",
    "vitest": "latest"
  }
}
```

Run:

```bash
pnpm --filter @website-agent/mobile add -D vitest
```

Expected: `vitest` appears in `apps/mobile/package.json` dev dependencies and `pnpm-lock.yaml` updates.

- [ ] **Step 2: Create session types**

Create `apps/mobile/src/session/types.ts`:

```ts
export type ClarificationQuestionType = "single_choice" | "multi_choice" | "free_text" | "confirm";

export type ClarificationOption = {
  id: string;
  label: string;
};

export type ClarificationQuestion = {
  id: string;
  type: ClarificationQuestionType;
  prompt: string;
  why: string;
  options?: ClarificationOption[];
};

export type ClarificationAnswer = {
  questionId: string;
  value: string | string[];
  label: string;
};

export type ClarificationTurn = {
  question: ClarificationQuestion;
  answer?: ClarificationAnswer;
};

export type TestPlanDimension = {
  id: string;
  name: string;
  description: string;
};

export type TestPlan = {
  target: string;
  scope: string;
  difficulty: "入门" | "中阶" | "进阶";
  questionCount: number;
  questionTypes: string[];
  dimensions: TestPlanDimension[];
  rationale: string;
};

export type GeneratedQuestion = {
  id: string;
  dimensionId: string;
  dimensionName: string;
  prompt: string;
  options: Array<{
    id: "A" | "B" | "C" | "D";
    label: string;
  }>;
  correctOptionId: "A" | "B" | "C" | "D";
  explanation: string;
};

export type AnswerRecord = {
  questionId: string;
  optionId: "A" | "B" | "C" | "D";
};

export type ReportMetric = {
  dimensionId: string;
  name: string;
  score: number;
};

export type ReportData = {
  score: number;
  mastery: "需要补基础" | "接近掌握" | "熟练" | "精通";
  summary: string;
  rationale: string;
  metrics: ReportMetric[];
  weaknesses: string[];
  explanations: Array<{
    questionId: string;
    title: string;
    explanation: string;
  }>;
};
```

- [ ] **Step 3: Create deterministic mock Agent data**

Create `apps/mobile/src/session/mock-session.ts`:

```ts
import type { ClarificationTurn, GeneratedQuestion, TestPlan } from "./types";

export const mockClarificationTurns: ClarificationTurn[] = [
  {
    question: {
      id: "goal",
      type: "single_choice",
      prompt: "这次自测你更想验证哪类掌握程度？",
      why: "这个问题用于判断测试应偏概念理解、应用能力还是查漏补缺。",
      options: [
        { id: "interview", label: "准备面试" },
        { id: "system", label: "系统学习" },
        { id: "gap", label: "查漏补缺" },
        { id: "unsure", label: "不确定" }
      ]
    }
  },
  {
    question: {
      id: "depth",
      type: "single_choice",
      prompt: "你希望题目更接近哪种难度？",
      why: "难度会影响题目是否偏定义辨析、场景判断，还是边界条件推理。",
      options: [
        { id: "basic", label: "基础概念" },
        { id: "applied", label: "真实场景应用" },
        { id: "edge", label: "边界条件和陷阱" },
        { id: "mixed", label: "混合一点" }
      ]
    }
  },
  {
    question: {
      id: "scope",
      type: "free_text",
      prompt: "有没有你特别想测或特别不想测的范围？",
      why: "范围边界可以避免题目过宽，让诊断结果更贴近你的真实目标。"
    }
  }
];

export const mockTestPlan: TestPlan = {
  target: "验证对 React Server Components 的真实理解和应用能力",
  scope: "聚焦 Server/Client Component 边界、数据读取、缓存和常见误区",
  difficulty: "中阶",
  questionCount: 3,
  questionTypes: ["单选题"],
  rationale: "根据你的回答，这次测试会减少纯定义题，增加真实项目中的判断场景。",
  dimensions: [
    {
      id: "concept",
      name: "核心概念",
      description: "理解 Server Component 与 Client Component 的职责边界。"
    },
    {
      id: "application",
      name: "实际应用",
      description: "能在页面结构和数据读取方式之间做合理选择。"
    },
    {
      id: "pitfall",
      name: "常见误区",
      description: "识别会造成额外客户端 JavaScript 或缓存误用的做法。"
    }
  ]
};

export const mockQuestions: GeneratedQuestion[] = [
  {
    id: "rsc-concept",
    dimensionId: "concept",
    dimensionName: "核心概念",
    prompt: "关于 React Server Components，哪一项说法更准确？",
    options: [
      { id: "A", label: "Server Component 可以直接读取服务端数据源。" },
      { id: "B", label: "Server Component 必须在浏览器里完成渲染。" },
      { id: "C", label: "Server Component 一定可以使用浏览器事件。" },
      { id: "D", label: "Server Component 和 Client Component 没有边界差异。" }
    ],
    correctOptionId: "A",
    explanation: "Server Component 在服务端渲染，可直接读取服务端数据源，但不能直接处理浏览器交互。"
  },
  {
    id: "cache-usage",
    dimensionId: "application",
    dimensionName: "实际应用",
    prompt: "如果页面需要读取数据库并尽快返回首屏，哪种做法更贴近 App Router 思路？",
    options: [
      { id: "A", label: "优先在 Server Component 中获取数据并渲染。" },
      { id: "B", label: "把所有数据请求都放到客户端 useEffect 里。" },
      { id: "C", label: "先渲染空页面，再强制用户刷新。" },
      { id: "D", label: "完全禁用服务端渲染。" }
    ],
    correctOptionId: "A",
    explanation: "App Router 鼓励把可服务端完成的数据读取放在服务端，减少客户端等待和额外 JavaScript。"
  },
  {
    id: "common-misconception",
    dimensionId: "pitfall",
    dimensionName: "常见误区",
    prompt: "下面哪项更可能造成不必要的客户端 JavaScript？",
    options: [
      { id: "A", label: "只在需要交互的组件上使用客户端组件。" },
      { id: "B", label: "在很高层级随意添加 use client。" },
      { id: "C", label: "把纯展示内容留在 Server Component。" },
      { id: "D", label: "把交互控件拆到局部 Client Component。" }
    ],
    correctOptionId: "B",
    explanation: "过高层级的 use client 会把更多子树带入客户端 bundle，增加不必要的客户端 JavaScript。"
  }
];
```

- [ ] **Step 4: Write failing flow tests**

Create `apps/mobile/src/session/session-flow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { answerClarificationTurn, answerQuestion, buildReport, getNextUnansweredTurn } from "./session-flow";
import { mockClarificationTurns, mockQuestions } from "./mock-session";

describe("dynamic session flow", () => {
  it("returns the first unanswered clarification turn", () => {
    expect(getNextUnansweredTurn(mockClarificationTurns)?.question.id).toBe("goal");
  });

  it("records a clarification answer without mutating previous turns", () => {
    const updated = answerClarificationTurn(mockClarificationTurns, "goal", "gap", "查漏补缺");

    expect(updated[0]?.answer).toEqual({
      questionId: "goal",
      value: "gap",
      label: "查漏补缺"
    });
    expect(mockClarificationTurns[0]?.answer).toBeUndefined();
  });

  it("advances to the next unanswered clarification after answering", () => {
    const updated = answerClarificationTurn(mockClarificationTurns, "goal", "gap", "查漏补缺");

    expect(getNextUnansweredTurn(updated)?.question.id).toBe("depth");
  });

  it("records a question answer by replacing previous answer for the same question", () => {
    const answers = answerQuestion([], "rsc-concept", "B");
    const replaced = answerQuestion(answers, "rsc-concept", "A");

    expect(replaced).toEqual([{ questionId: "rsc-concept", optionId: "A" }]);
  });

  it("builds report metrics and weaknesses from answers", () => {
    const report = buildReport(mockQuestions, [
      { questionId: "rsc-concept", optionId: "A" },
      { questionId: "cache-usage", optionId: "B" },
      { questionId: "common-misconception", optionId: "B" }
    ]);

    expect(report.score).toBe(67);
    expect(report.metrics).toHaveLength(3);
    expect(report.weaknesses[0]).toContain("实际应用");
    expect(report.explanations).toHaveLength(1);
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run:

```bash
pnpm --filter @website-agent/mobile test
```

Expected: FAIL because `apps/mobile/src/session/session-flow.ts` does not exist.

- [ ] **Step 6: Implement pure flow helpers**

Create `apps/mobile/src/session/session-flow.ts`:

```ts
import type { AnswerRecord, ClarificationTurn, GeneratedQuestion, ReportData } from "./types";

export function getNextUnansweredTurn(turns: ClarificationTurn[]): ClarificationTurn | null {
  return turns.find((turn) => !turn.answer) ?? null;
}

export function answerClarificationTurn(
  turns: ClarificationTurn[],
  questionId: string,
  value: string | string[],
  label: string
): ClarificationTurn[] {
  return turns.map((turn) =>
    turn.question.id === questionId
      ? {
          ...turn,
          answer: {
            questionId,
            value,
            label
          }
        }
      : turn
  );
}

export function answerQuestion(
  answers: AnswerRecord[],
  questionId: string,
  optionId: AnswerRecord["optionId"]
): AnswerRecord[] {
  return [...answers.filter((answer) => answer.questionId !== questionId), { questionId, optionId }];
}

export function buildReport(questions: GeneratedQuestion[], answers: AnswerRecord[]): ReportData {
  const answersByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer.optionId]));
  const correctQuestions = questions.filter(
    (question) => answersByQuestionId.get(question.id) === question.correctOptionId
  );
  const score = Math.round((correctQuestions.length / questions.length) * 100);
  const dimensions = [...new Map(questions.map((question) => [question.dimensionId, question.dimensionName]))];

  const metrics = dimensions.map(([dimensionId, name]) => {
    const dimensionQuestions = questions.filter((question) => question.dimensionId === dimensionId);
    const correctCount = dimensionQuestions.filter(
      (question) => answersByQuestionId.get(question.id) === question.correctOptionId
    ).length;

    return {
      dimensionId,
      name,
      score: Math.round((correctCount / dimensionQuestions.length) * 100)
    };
  });

  const explanations = questions
    .filter((question) => answersByQuestionId.get(question.id) !== question.correctOptionId)
    .map((question) => ({
      questionId: question.id,
      title: question.dimensionName,
      explanation: question.explanation
    }));

  return {
    score,
    mastery: score >= 85 ? "熟练" : score >= 65 ? "接近掌握" : "需要补基础",
    summary: score >= 85 ? "你已经掌握主要概念，可以进一步挑战边界场景。" : "你已经理解一部分概念，但还需要补齐应用和边界判断。",
    rationale: "这份报告根据澄清阶段确定的目标、维度规划和答题结果生成。",
    metrics,
    weaknesses: metrics
      .filter((metric) => metric.score < 80)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((metric) => `${metric.name}：当前得分 ${metric.score}，建议优先复盘相关错题。`),
    explanations
  };
}
```

- [ ] **Step 7: Run tests and typecheck**

Run:

```bash
pnpm --filter @website-agent/mobile test
pnpm --filter @website-agent/mobile typecheck
```

Expected: both PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml apps/mobile/src/session
git commit -m "test: add dynamic session flow model"
```

---

### Task 2: Native Calm UI Foundation

**Files:**
- Create: `apps/mobile/src/ui/theme.ts`
- Create: `apps/mobile/src/ui/components.tsx`
- Test: `apps/mobile/src/session/session-flow.test.ts`（流程）与 `apps/mobile/src/ui/theme.test.ts`（设计令牌快照）

- [x] **Step 1: Create design tokens**

Create `apps/mobile/src/ui/theme.ts`:

```ts
export const colors = {
  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceMuted: "#F5F7FB",
  text: "#111827",
  textMuted: "#64748B",
  textSubtle: "#94A3B8",
  primary: "#0F172A",
  primaryBlue: "#2563EB",
  agent: "#EEF2FF",
  agentStrong: "#4F46E5",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#DC2626",
  border: "#E2E8F0",
  reportDark: "#101827"
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999
} as const;

export const typeScale = {
  caption: 12,
  label: 14,
  body: 16,
  title: 24,
  largeTitle: 34,
  score: 72
} as const;

export const shadow = {
  card: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 }
  }
} as const;
```

- [x] **Step 2: Create shared components**

Create `apps/mobile/src/ui/components.tsx`. Implement these exports in one focused file for the current small MVP:

> **注：** `GenerationStepList` 已实现计划原文，并扩展可选 props `failedAtIndex`（生成失败步骤标红），不改变默认用法。

```tsx
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow, spacing, typeScale } from "./theme";
import type { GeneratedQuestion, TestPlan } from "../session/types";

export function ScreenShell({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>{children}</View>
    </SafeAreaView>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary"
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
}) {
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.secondaryButton,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? colors.primary : colors.surface} />
      ) : (
        <Text style={[styles.buttonText, variant === "secondary" && styles.secondaryButtonText]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function AgentBubble({ prompt, why }: { prompt: string; why?: string }) {
  return (
    <View style={styles.agentBubble}>
      <Text style={styles.agentLabel}>Agent</Text>
      <Text style={styles.agentPrompt}>{prompt}</Text>
      {why ? <Text style={styles.agentWhy}>为什么问：{why}</Text> : null}
    </View>
  );
}

export function UserBubble({ label }: { label: string }) {
  return (
    <View style={styles.userBubble}>
      <Text style={styles.userBubbleText}>{label}</Text>
    </View>
  );
}

export function ChoiceOption({
  label,
  selected,
  onPress
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function PlanCard({ plan }: { plan: TestPlan }) {
  return (
    <View style={styles.planCard}>
      <Text style={styles.cardEyebrow}>测试计划</Text>
      <Text style={styles.cardTitle}>{plan.target}</Text>
      <Text style={styles.cardText}>{plan.scope}</Text>
      <View style={styles.planMetaRow}>
        <Text style={styles.metaPill}>{plan.difficulty}</Text>
        <Text style={styles.metaPill}>{plan.questionCount} 题</Text>
        <Text style={styles.metaPill}>{plan.questionTypes.join(" / ")}</Text>
      </View>
      <View style={styles.dimensionList}>
        {plan.dimensions.map((dimension) => (
          <View key={dimension.id} style={styles.dimensionItem}>
            <Text style={styles.dimensionName}>{dimension.name}</Text>
            <Text style={styles.cardText}>{dimension.description}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.agentWhy}>{plan.rationale}</Text>
    </View>
  );
}

export function GenerationStepList({ activeIndex }: { activeIndex: number }) {
  const steps = ["分析主题边界", "划分能力维度", "生成选择题", "校验选项和干扰项", "准备报告框架"];

  return (
    <View style={styles.stepCard}>
      {steps.map((step, index) => (
        <View key={step} style={styles.stepRow}>
          <Text style={[styles.stepDot, index <= activeIndex && styles.stepDotActive]}>
            {index < activeIndex ? "✓" : index === activeIndex ? "•" : "○"}
          </Text>
          <Text style={[styles.stepText, index <= activeIndex && styles.stepTextActive]}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

export function QuestionCard({
  question,
  selectedOptionId,
  onSelect
}: {
  question: GeneratedQuestion;
  selectedOptionId: string | null;
  onSelect: (optionId: GeneratedQuestion["options"][number]["id"]) => void;
}) {
  return (
    <View style={styles.questionCard}>
      <Text style={styles.cardEyebrow}>{question.dimensionName}</Text>
      <Text style={styles.questionText}>{question.prompt}</Text>
      <View style={styles.optionList}>
        {question.options.map((option) => (
          <ChoiceOption
            key={option.id}
            label={`${option.id}. ${option.label}`}
            selected={selectedOptionId === option.id}
            onPress={() => onSelect(option.id)}
          />
        ))}
      </View>
    </View>
  );
}

export function ReportScoreCard({ score, mastery, summary }: { score: number; mastery: string; summary: string }) {
  return (
    <View style={styles.reportScoreCard}>
      <Text style={styles.reportLabel}>掌握度</Text>
      <View style={styles.scoreRow}>
        <Text style={styles.score}>{score}</Text>
        <Text style={styles.mastery}>{mastery}</Text>
      </View>
      <Text style={styles.reportSummary}>{summary}</Text>
    </View>
  );
}

export function MetricBar({ name, score }: { name: string; score: number }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricName}>{name}</Text>
      <View style={styles.metricTrack}>
        <View style={[styles.metricFill, { width: `${score}%` }]} />
      </View>
      <Text style={styles.metricScore}>{score}</Text>
    </View>
  );
}

export function WeaknessCard({ weakness, index }: { weakness: string; index: number }) {
  return (
    <View style={styles.weaknessRow}>
      <Text style={styles.weaknessIndex}>{index + 1}</Text>
      <Text style={styles.weaknessText}>{weakness}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, gap: spacing.lg, padding: spacing.xl },
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 54
  },
  secondaryButton: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { transform: [{ scale: 0.98 }] },
  buttonText: { color: colors.surface, fontSize: typeScale.body, fontWeight: "800" },
  secondaryButtonText: { color: colors.primary },
  agentBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderBottomLeftRadius: radius.sm,
    gap: spacing.sm,
    maxWidth: "92%",
    padding: spacing.lg,
    ...shadow.card
  },
  agentLabel: { color: colors.agentStrong, fontSize: typeScale.caption, fontWeight: "900" },
  agentPrompt: { color: colors.text, fontSize: typeScale.title, fontWeight: "850", lineHeight: 30 },
  agentWhy: { color: colors.textMuted, fontSize: typeScale.label, lineHeight: 20 },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.sm,
    maxWidth: "86%",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  userBubbleText: { color: colors.surface, fontSize: typeScale.body, fontWeight: "700" },
  choice: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg
  },
  choiceSelected: { backgroundColor: colors.agent, borderColor: colors.primaryBlue },
  choiceText: { color: colors.text, fontSize: typeScale.body, fontWeight: "700", lineHeight: 22 },
  choiceTextSelected: { color: colors.primaryBlue },
  planCard: { backgroundColor: colors.surface, borderRadius: radius.xl, gap: spacing.md, padding: spacing.lg, ...shadow.card },
  cardEyebrow: { color: colors.primaryBlue, fontSize: typeScale.caption, fontWeight: "900" },
  cardTitle: { color: colors.text, fontSize: typeScale.title, fontWeight: "850", lineHeight: 30 },
  cardText: { color: colors.textMuted, fontSize: typeScale.label, lineHeight: 20 },
  planMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metaPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    color: colors.text,
    fontSize: typeScale.caption,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  dimensionList: { gap: spacing.sm },
  dimensionItem: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, gap: spacing.xs, padding: spacing.md },
  dimensionName: { color: colors.text, fontSize: typeScale.label, fontWeight: "850" },
  stepCard: { backgroundColor: colors.surface, borderRadius: radius.xl, gap: spacing.md, padding: spacing.lg, ...shadow.card },
  stepRow: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  stepDot: { color: colors.textSubtle, fontSize: typeScale.body, fontWeight: "900", width: 22 },
  stepDotActive: { color: colors.primaryBlue },
  stepText: { color: colors.textSubtle, fontSize: typeScale.body, fontWeight: "700" },
  stepTextActive: { color: colors.text },
  questionCard: { backgroundColor: colors.surface, borderRadius: radius.xl, gap: spacing.lg, padding: spacing.lg, ...shadow.card },
  questionText: { color: colors.text, fontSize: 25, fontWeight: "850", lineHeight: 33 },
  optionList: { gap: spacing.sm },
  reportScoreCard: { backgroundColor: colors.reportDark, borderRadius: radius.xl, gap: spacing.md, padding: spacing.xl },
  reportLabel: { color: "#93C5FD", fontSize: typeScale.caption, fontWeight: "900" },
  scoreRow: { alignItems: "flex-end", flexDirection: "row", gap: spacing.md },
  score: { color: colors.surface, fontSize: typeScale.score, fontWeight: "900", letterSpacing: -3 },
  mastery: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    color: colors.surface,
    fontSize: typeScale.caption,
    fontWeight: "900",
    marginBottom: spacing.sm,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  reportSummary: { color: "#CBD5E1", fontSize: typeScale.label, lineHeight: 21 },
  metricRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  metricName: { color: colors.text, fontSize: typeScale.label, fontWeight: "800", width: 72 },
  metricTrack: { backgroundColor: colors.border, borderRadius: radius.pill, flex: 1, height: 8, overflow: "hidden" },
  metricFill: { backgroundColor: colors.primaryBlue, borderRadius: radius.pill, height: 8 },
  metricScore: { color: colors.text, fontSize: typeScale.label, fontWeight: "900", width: 34 },
  weaknessRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  weaknessIndex: {
    backgroundColor: "#FEF3C7",
    borderRadius: radius.pill,
    color: "#92400E",
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  weaknessText: { color: colors.text, flex: 1, fontSize: typeScale.label, lineHeight: 21 }
});
```

- [x] **Step 3: Run verification**

Run:

```bash
pnpm --filter @website-agent/mobile typecheck
pnpm --filter @website-agent/mobile test
```

Expected: both PASS.

- [x] **Step 4: Commit**

（由开发者在仓库中执行；预期提交信息：`feat: add native calm ui primitives`。）

---

### Task 3: Home As AI Assistant Entry

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Use: `apps/mobile/src/ui/components.tsx`

> **注：** 已实现计划布局，并扩展：顶部日程提示条、`retestTopic` 深链回填、失败时次级按钮「重试」、无障碍属性与开发态错误明细。

- [x] **Step 1: Redesign home screen**

Replace current Home layout with:

```tsx
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { createSession } from "../../src/api/client";
import { PrimaryButton, ScreenShell } from "../../src/ui/components";
import { colors, radius, shadow, spacing, typeScale } from "../../src/ui/theme";

const suggestions = ["React Server Components", "微积分极限", "英语语法时态"];

export default function HomeScreen() {
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createSessionMutation = useMutation({
    mutationFn: createSession,
    onSuccess: (session) => {
      router.push(`/session/${session.id}/clarify`);
    },
    onError: () => {
      setError("没能创建诊断会话，请检查网络后重试。");
    }
  });

  const startSession = () => {
    const trimmedTopic = topic.trim();

    if (!trimmedTopic) {
      setError("先告诉我你想验证哪部分知识。");
      return;
    }

    setError(null);
    createSessionMutation.mutate(trimmedTopic);
  };

  return (
    <ScreenShell>
      <View style={styles.hero}>
        <Text style={styles.kicker}>AI 知识诊断</Text>
        <Text style={styles.title}>你想验证哪部分知识？</Text>
        <Text style={styles.subtitle}>我会先问几个澄清问题，再为你生成一套诊断测试。</Text>
      </View>

      <View style={styles.agentCard}>
        <Text style={styles.agentLabel}>Agent</Text>
        <Text style={styles.agentText}>可以输入一个概念、课程章节、面试主题，或任何你觉得“似懂非懂”的知识点。</Text>
      </View>

      <View style={styles.inputCard}>
        <TextInput
          value={topic}
          onChangeText={setTopic}
          placeholder="例如：Next.js App Router 缓存"
          placeholderTextColor={colors.textSubtle}
          returnKeyType="done"
          style={styles.input}
        />

        <Text style={styles.suggestionTitle}>助教建议</Text>
        <View style={styles.suggestionRow}>
          {suggestions.map((suggestion) => (
            <Pressable key={suggestion} onPress={() => setTopic(suggestion)} style={styles.suggestion}>
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label="开始诊断"
          loading={createSessionMutation.isPending}
          disabled={createSessionMutation.isPending}
          onPress={startSession}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm, paddingTop: spacing.sm },
  kicker: { color: colors.primaryBlue, fontSize: typeScale.label, fontWeight: "900" },
  title: { color: colors.text, fontSize: typeScale.largeTitle, fontWeight: "900", letterSpacing: -1.4, lineHeight: 40 },
  subtitle: { color: colors.textMuted, fontSize: typeScale.body, lineHeight: 24 },
  agentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    gap: spacing.sm,
    padding: spacing.lg,
    ...shadow.card
  },
  agentLabel: { color: colors.agentStrong, fontSize: typeScale.caption, fontWeight: "900" },
  agentText: { color: colors.text, fontSize: typeScale.body, fontWeight: "650", lineHeight: 23 },
  inputCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    gap: spacing.md,
    padding: spacing.lg,
    ...shadow.card
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: typeScale.body,
    minHeight: 56,
    paddingHorizontal: spacing.md
  },
  suggestionTitle: { color: colors.textMuted, fontSize: typeScale.caption, fontWeight: "900" },
  suggestionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  suggestion: {
    backgroundColor: colors.agent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  suggestionText: { color: colors.primaryBlue, fontSize: typeScale.caption, fontWeight: "800" },
  error: { color: colors.danger, fontSize: typeScale.label }
});
```

- [x] **Step 2: Verify**

Run:

```bash
pnpm --filter @website-agent/mobile typecheck
```

Expected: PASS.

- [x] **Step 3: Commit**

（由开发者在仓库中执行：`git commit -m "feat: redesign home as agent entry"`）

---

### Task 4: Dynamic Clarification Chat And Plan Confirmation

**Files:**
- Modify: `apps/mobile/app/session/[id]/clarify.tsx`
- Modify: `apps/mobile/app/session/[id]/confirm.tsx`
- Use: `apps/mobile/src/session/*`
- Use: `apps/mobile/src/ui/*`

> **注：** 澄清/预览已实现 API 回填、SSE 与 mock 分支；本节勾选表示与计划语义对齐（compact 主题抬头、离线「继续澄清」、计划副本与重试）。

- [x] **Step 1: Replace clarify page with dynamic chat shell**

Implement `apps/mobile/app/session/[id]/clarify.tsx` with:

```tsx
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { answerClarificationTurn, getNextUnansweredTurn } from "../../../src/session/session-flow";
import { mockClarificationTurns } from "../../../src/session/mock-session";
import type { ClarificationTurn } from "../../../src/session/types";
import { AgentBubble, ChoiceOption, PrimaryButton, ScreenShell, UserBubble } from "../../../src/ui/components";
import { colors, spacing, typeScale } from "../../../src/ui/theme";

export default function ClarifyScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id ?? "demo";
  const [turns, setTurns] = useState<ClarificationTurn[]>(mockClarificationTurns);
  const [freeText, setFreeText] = useState("");
  const nextTurn = useMemo(() => getNextUnansweredTurn(turns), [turns]);
  const visibleTurns = turns.filter((turn) => turn.answer || turn.question.id === nextTurn?.question.id);

  const answerCurrentTurn = (value: string | string[], label: string) => {
    if (!nextTurn) return;
    setTurns((currentTurns) => answerClarificationTurn(currentTurns, nextTurn.question.id, value, label));
    setFreeText("");
  };

  const goToPlan = () => router.push(`/session/${sessionId}/confirm`);

  return (
    <ScreenShell>
      <View style={styles.header}>
        <Text style={styles.kicker}>正在澄清范围</Text>
        <Text style={styles.title}>我需要再理解一下你的目标</Text>
      </View>

      <ScrollView contentContainerStyle={styles.chatContent} showsVerticalScrollIndicator={false}>
        {visibleTurns.map((turn) => (
          <View key={turn.question.id} style={styles.turn}>
            <AgentBubble prompt={turn.question.prompt} why={turn.question.why} />
            {turn.answer ? <UserBubble label={turn.answer.label} /> : null}
          </View>
        ))}

        {!nextTurn ? (
          <View style={styles.readyCard}>
            <Text style={styles.readyTitle}>信息足够了</Text>
            <Text style={styles.readyText}>我可以基于这些回答整理一份测试计划，你也可以继续补充范围。</Text>
          </View>
        ) : null}
      </ScrollView>

      {nextTurn ? (
        <View style={styles.answerArea}>
          {nextTurn.question.options ? (
            nextTurn.question.options.map((option) => (
              <ChoiceOption
                key={option.id}
                label={option.label}
                onPress={() => answerCurrentTurn(option.id, option.label)}
              />
            ))
          ) : (
            <>
              <TextInput
                value={freeText}
                onChangeText={setFreeText}
                placeholder="可以简单写一句，也可以填“不确定”。"
                placeholderTextColor={colors.textSubtle}
                style={styles.textInput}
              />
              <PrimaryButton
                label="提交回答"
                disabled={!freeText.trim()}
                onPress={() => answerCurrentTurn(freeText.trim(), freeText.trim())}
              />
            </>
          )}
        </View>
      ) : (
        <View style={styles.answerArea}>
          <PrimaryButton label="查看测试计划" onPress={goToPlan} />
          <PrimaryButton label="继续澄清" variant="secondary" onPress={() => setTurns(mockClarificationTurns)} />
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  kicker: { color: colors.primaryBlue, fontSize: typeScale.label, fontWeight: "900" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1, lineHeight: 36 },
  chatContent: { gap: spacing.lg, paddingBottom: spacing.md },
  turn: { gap: spacing.sm },
  readyCard: { backgroundColor: colors.agent, borderRadius: 22, gap: spacing.sm, padding: spacing.lg },
  readyTitle: { color: colors.text, fontSize: typeScale.title, fontWeight: "900" },
  readyText: { color: colors.textMuted, fontSize: typeScale.body, lineHeight: 23 },
  answerArea: { gap: spacing.sm },
  textInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: typeScale.body,
    minHeight: 54,
    paddingHorizontal: spacing.md
  }
});
```

- [x] **Step 2: Replace confirm page with plan card**

Implement `apps/mobile/app/session/[id]/confirm.tsx` with:

```tsx
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { mockTestPlan } from "../../../src/session/mock-session";
import { PlanCard, PrimaryButton, ScreenShell } from "../../../src/ui/components";
import { colors, spacing, typeScale } from "../../../src/ui/theme";

export default function ConfirmScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id ?? "demo";

  return (
    <ScreenShell>
      <View style={styles.header}>
        <Text style={styles.kicker}>测试计划</Text>
        <Text style={styles.title}>我准备这样测试你</Text>
        <Text style={styles.subtitle}>这份计划由刚才的澄清回答生成。你可以开始生成测试，也可以返回继续澄清。</Text>
      </View>

      <PlanCard plan={mockTestPlan} />

      <View style={styles.actions}>
        <PrimaryButton label="开始生成测试" onPress={() => router.push(`/session/${sessionId}/generate`)} />
        <PrimaryButton label="继续澄清" variant="secondary" onPress={() => router.back()} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  kicker: { color: colors.primaryBlue, fontSize: typeScale.label, fontWeight: "900" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1, lineHeight: 36 },
  subtitle: { color: colors.textMuted, fontSize: typeScale.body, lineHeight: 23 },
  actions: { gap: spacing.sm, marginTop: "auto" }
});
```

- [x] **Step 3: Verify**

Run:

```bash
pnpm --filter @website-agent/mobile typecheck
pnpm --filter @website-agent/mobile test
```

Expected: both PASS.

- [x] **Step 4: Commit**

（由开发者在仓库中执行：`git commit -m "feat: add dynamic clarification plan flow"`）

---

### Task 5: Transparent Generation Screen

**Files:**
- Create: `apps/mobile/app/session/[id]/generate.tsx`

> **注：** 已实现定时步骤推进（mock）、`useQuery`+`loadQuestionsFromQuestionsStream`（live）、相位守卫、失败步骤 `failedAtIndex`、重试时重置进度；本节勾选表示与 Task 5 语义及透明生成 UX 对齐。

- [x] **Step 1: Create generation screen**

Create `apps/mobile/app/session/[id]/generate.tsx`:

```tsx
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { GenerationStepList, PrimaryButton, ScreenShell } from "../../../src/ui/components";
import { colors, spacing, typeScale } from "../../../src/ui/theme";

export default function GenerateScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id ?? "demo";
  const [activeIndex, setActiveIndex] = useState(0);
  const isDone = activeIndex >= 5;

  useEffect(() => {
    if (activeIndex >= 5) return;
    const timer = setTimeout(() => setActiveIndex((index) => index + 1), 550);
    return () => clearTimeout(timer);
  }, [activeIndex]);

  return (
    <ScreenShell>
      <View style={styles.header}>
        <Text style={styles.kicker}>Agent 正在工作</Text>
        <Text style={styles.title}>{isDone ? "测试已经准备好了" : "正在生成你的诊断测试"}</Text>
        <Text style={styles.subtitle}>我会先规划能力维度，再生成和校验选择题，确保每道题都能服务诊断目标。</Text>
      </View>

      <GenerationStepList activeIndex={activeIndex} />

      <View style={styles.actions}>
        <PrimaryButton
          label={isDone ? "开始答题" : "生成中"}
          disabled={!isDone}
          loading={!isDone}
          onPress={() => router.push(`/session/${sessionId}/answer`)}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  kicker: { color: colors.agentStrong, fontSize: typeScale.label, fontWeight: "900" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1, lineHeight: 36 },
  subtitle: { color: colors.textMuted, fontSize: typeScale.body, lineHeight: 23 },
  actions: { marginTop: "auto" }
});
```

- [x] **Step 2: Verify**

Run:

```bash
pnpm --filter @website-agent/mobile typecheck
```

Expected: PASS.

- [x] **Step 3: Commit**

（由开发者在仓库中执行：`git commit -m "feat: add transparent generation screen"`）

---

### Task 6: Dynamic Answer And Diagnostic Report

**Files:**
- Modify: `apps/mobile/app/session/[id]/answer.tsx`
- Modify: `apps/mobile/app/session/[id]/report.tsx`

> **注：** 答题页已支持 mock、`useQuery` 拉题、快照恢复答案与直接进入报告跳转；报告页含 mock 演示数据、快照恢复、`advance`、报告 SSE `mergeReportWithAgentSse`、`重新测试相近主题` 等。与计划字面稿的差异以本节「完成」口径为准。

- [x] **Step 1: Replace answer page with generated mock questions**

Implement `apps/mobile/app/session/[id]/answer.tsx` using `mockQuestions`, `answerQuestion`, and `QuestionCard`. Preserve one-question-per-screen and route to report after the last question.

Key implementation:

```tsx
const currentQuestion = mockQuestions[currentIndex] ?? mockQuestions[0];
const selectedAnswer = answers.find((answer) => answer.questionId === currentQuestion.id)?.optionId ?? null;
const isLastQuestion = currentIndex === mockQuestions.length - 1;
```

When selecting an option:

```tsx
setAnswers((currentAnswers) => answerQuestion(currentAnswers, currentQuestion.id, optionId));
```

When pressing the primary button:

```tsx
if (!selectedAnswer) {
  setError("请选择一个答案后继续。");
  return;
}

setError(null);
if (isLastQuestion) {
  router.push(`/session/${sessionId}/report`);
  return;
}

setCurrentIndex((index) => index + 1);
```

Use `QuestionCard` for the question body and `PrimaryButton` for the bottom CTA.

- [x] **Step 2: Replace report page with diagnostic report layout**

Implement `apps/mobile/app/session/[id]/report.tsx` with deterministic `buildReport(mockQuestions, answers)` fallback. Because answer state is not persisted across routes yet, use a representative mock answer set:

```ts
const report = buildReport(mockQuestions, [
  { questionId: "rsc-concept", optionId: "A" },
  { questionId: "cache-usage", optionId: "B" },
  { questionId: "common-misconception", optionId: "B" }
]);
```

Render:

- `ReportScoreCard`
- `为什么这样评估`
- `MetricBar` rows
- `WeaknessCard` list
- wrong-answer explanation cards
- primary CTA `回到首页`

- [x] **Step 3: Verify**

Run:

```bash
pnpm --filter @website-agent/mobile typecheck
pnpm --filter @website-agent/mobile test
```

Expected: both PASS.

- [x] **Step 4: Commit**

（由开发者在仓库中执行：`git commit -m "feat: add dynamic answer and report ui"`）

---

### Task 7: Smoke Flow And Final Verification

**Files:**
- Modify: `apps/mobile/e2e/first-test-flow.yaml`
- Verify: mobile typecheck, mobile tests, Expo dependency check

> **注：** `first-test-flow.yaml` 已与计划内步骤等价（仅存文件头 MOCK 提示注释）；需在 `EXPO_PUBLIC_MOCK_AGENT=true` 跑 Maestro。

- [x] **Step 1: Update Maestro smoke flow**

Replace `apps/mobile/e2e/first-test-flow.yaml` with:

```yaml
appId: com.websiteagent.knowledgetest
---
- launchApp
- assertVisible: "你想验证哪部分知识？"
- tapOn: "例如：Next.js App Router 缓存"
- inputText: "React Server Components"
- tapOn: "开始诊断"
- assertVisible: "我需要再理解一下你的目标"
- assertVisible: "这次自测你更想验证哪类掌握程度？"
- tapOn: "查漏补缺"
- assertVisible: "你希望题目更接近哪种难度？"
- tapOn: "真实场景应用"
- assertVisible: "有没有你特别想测或特别不想测的范围？"
- inputText: "重点测试 Server 和 Client Component 的边界"
- tapOn: "提交回答"
- assertVisible: "信息足够了"
- tapOn: "查看测试计划"
- assertVisible: "我准备这样测试你"
- tapOn: "开始生成测试"
- assertVisible: "正在生成你的诊断测试"
- assertVisible: "开始答题"
- tapOn: "开始答题"
- assertVisible: "关于 React Server Components，哪一项说法更准确？"
- tapOn: "A. Server Component 可以直接读取服务端数据源。"
- tapOn: "下一题"
- assertVisible: "如果页面需要读取数据库并尽快返回首屏"
- tapOn: "A. 优先在 Server Component 中获取数据并渲染。"
- tapOn: "下一题"
- assertVisible: "下面哪项更可能造成不必要的客户端 JavaScript？"
- tapOn: "B. 在很高层级随意添加 use client。"
- tapOn: "提交"
- assertVisible: "为什么这样评估"
- assertVisible: "薄弱点"
```

- [x] **Step 2: Run final verification commands**

Run:

```bash
pnpm --filter @website-agent/mobile typecheck
pnpm --filter @website-agent/mobile test
pnpm --filter @website-agent/mobile exec expo install --check
```

Expected:

- typecheck exits 0.
- vitest exits 0.
- Expo dependency check prints `Dependencies are up to date`.

- [ ] **Step 3: Manual dev-client verification**

（须在真机/dev-client 上手跑：计划内 IP 仅为示例，请替换为你的局域网地址。）

Start or reuse the current services:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.31.208:3000 pnpm --filter @website-agent/mobile exec expo start --dev-client --host lan --clear
```

In the iOS dev client, connect to:

```text
exp://192.168.31.208:8081
```

Verify:

1. Home uses AI assistant entry copy.
2. Clarification appears as chat flow.
3. Plan card appears after three answers.
4. Generation steps progress to answer screen.
5. Answer screen advances through three questions.
6. Report shows score, rationale, metrics, weaknesses, and explanations.

- [ ] **Step 4: Commit**

（由开发者在 YAML 确有改动时提交：`git commit -m "test: update dynamic agent smoke flow"`）

---

## Self-Review

### Spec Coverage

- Dynamic Agent model: covered by Task 1 session types and flow helpers.
- Native Calm design system: covered by Task 2 theme and components.
- AI assistant home: covered by Task 3.
- Dynamic clarification chat: covered by Task 4.
- Plan confirmation: covered by Task 4.
- Transparent generation steps: covered by Task 5.
- Dynamic answer flow: covered by Task 6.
- Diagnostic report: covered by Task 6.
- Smoke flow and verification: covered by Task 7.

### Scope

This plan intentionally does not implement real Mastra/LLM streaming. It builds the dynamic UI shell with deterministic mock state, matching the spec's MVP implementation boundary.

### Type Consistency

The plan uses the same domain names across files:

- `ClarificationQuestion`
- `ClarificationTurn`
- `TestPlan`
- `GeneratedQuestion`
- `AnswerRecord`
- `ReportData`

All route names match Expo Router files:

- `/session/${sessionId}/clarify`
- `/session/${sessionId}/confirm`
- `/session/${sessionId}/generate`
- `/session/${sessionId}/answer`
- `/session/${sessionId}/report`
