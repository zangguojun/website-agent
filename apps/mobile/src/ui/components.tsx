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
  agentPrompt: { color: colors.text, fontSize: typeScale.title, fontWeight: "800", lineHeight: 30 },
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
  cardTitle: { color: colors.text, fontSize: typeScale.title, fontWeight: "800", lineHeight: 30 },
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
  dimensionName: { color: colors.text, fontSize: typeScale.label, fontWeight: "800" },
  stepCard: { backgroundColor: colors.surface, borderRadius: radius.xl, gap: spacing.md, padding: spacing.lg, ...shadow.card },
  stepRow: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  stepDot: { color: colors.textSubtle, fontSize: typeScale.body, fontWeight: "900", width: 22 },
  stepDotActive: { color: colors.primaryBlue },
  stepText: { color: colors.textSubtle, fontSize: typeScale.body, fontWeight: "700" },
  stepTextActive: { color: colors.text },
  questionCard: { backgroundColor: colors.surface, borderRadius: radius.xl, gap: spacing.lg, padding: spacing.lg, ...shadow.card },
  questionText: { color: colors.text, fontSize: 25, fontWeight: "800", lineHeight: 33 },
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
