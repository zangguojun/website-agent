import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { mockQuestions } from "../../../src/session/mock-session";
import { buildReport } from "../../../src/session/session-flow";
import { MetricBar, PrimaryButton, ReportScoreCard, ScreenShell, WeaknessCard } from "../../../src/ui/components";
import { colors, radius, shadow, spacing, typeScale } from "../../../src/ui/theme";

const report = buildReport(mockQuestions, [
  { questionId: "rsc-concept", optionId: "A" },
  { questionId: "cache-usage", optionId: "B" },
  { questionId: "common-misconception", optionId: "B" }
]);

export default function ReportScreen() {
  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>诊断报告</Text>
          <Text style={styles.title}>这次测试说明了什么</Text>
        </View>

        <ReportScoreCard score={report.score} mastery={report.mastery} summary={report.summary} />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>为什么这样评估</Text>
          <Text style={styles.cardText}>{report.rationale}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>维度概览</Text>
          {report.metrics.map((metric) => (
            <MetricBar key={metric.dimensionId} name={metric.name} score={metric.score} />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>薄弱点</Text>
          {report.weaknesses.map((weakness, index) => (
            <WeaknessCard key={weakness} weakness={weakness} index={index} />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>错题解释</Text>
          {report.explanations.map((item) => (
            <View key={item.questionId} style={styles.explanationCard}>
              <Text style={styles.explanationTitle}>{item.title}</Text>
              <Text style={styles.cardText}>{item.explanation}</Text>
            </View>
          ))}
        </View>

        <PrimaryButton label="回到首页" onPress={() => router.replace("/(tabs)")} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.sm },
  kicker: { color: colors.primaryBlue, fontSize: typeScale.label, fontWeight: "900" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1, lineHeight: 36 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    gap: spacing.md,
    padding: spacing.lg,
    ...shadow.card
  },
  cardTitle: { color: colors.text, fontSize: typeScale.title, fontWeight: "900" },
  cardText: { color: colors.textMuted, fontSize: typeScale.label, lineHeight: 21 },
  explanationCard: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, gap: spacing.xs, padding: spacing.md },
  explanationTitle: { color: colors.text, fontSize: typeScale.label, fontWeight: "900" }
});
