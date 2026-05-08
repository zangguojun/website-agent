import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  advanceWorkflowToReport,
  consumeReportStream,
  fetchSession,
  fetchSessionState,
} from "../../../src/api/session-remote";
import { sessionAnswersKey, sessionQuestionsKey } from "../../../src/api/session-query-keys";
import { hydrateAnswerRecordsFromStateMessages } from "../../../src/session/hydrate-answers-from-state";
import { hydrateQuestionsFromStateMessages } from "../../../src/session/hydrate-questions-from-state";
import { buildReport, mergeReportWithAgentSse } from "../../../src/session/session-flow";
import type { AnswerRecord, GeneratedQuestion, ReportAgentSseSlice, ReportData } from "../../../src/session/types";
import { MetricBar, PrimaryButton, ReportScoreCard, ScreenShell, WeaknessCard } from "../../../src/ui/components";
import { colors, radius, shadow, spacing, typeScale } from "../../../src/ui/theme";

export default function ReportScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const sessionId: string = routeId ?? "demo";

  const queryClient = useQueryClient();

  /** 快照恢复后写入 Query 缓存时需 bump（本页未 `useQuery` 订阅）。 */
  const [recoveryTick, setRecoveryTick] = useState(0);
  const [recoveryDone, setRecoveryDone] = useState(false);

  const liveQuestions = useMemo(
    () => queryClient.getQueryData<GeneratedQuestion[]>(sessionQuestionsKey(sessionId)) ?? null,
    [sessionId, queryClient, recoveryTick],
  );

  const liveAnswers = useMemo(
    () => queryClient.getQueryData<AnswerRecord[]>(sessionAnswersKey(sessionId)) ?? null,
    [sessionId, queryClient, recoveryTick],
  );

  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [nearRetestTopic, setNearRetestTopic] = useState("");

  useEffect(() => {
    void fetchSession(sessionId)
      .then((r) => setNearRetestTopic(r.session.rawTopic))
      .catch(() => setNearRetestTopic(""));
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;

    const qs0 = queryClient.getQueryData<GeneratedQuestion[]>(sessionQuestionsKey(sessionId)) ?? [];
    const ans0 = queryClient.getQueryData<AnswerRecord[]>(sessionAnswersKey(sessionId)) ?? [];
    if (qs0.length > 0 && ans0.length > 0) {
      setRecoveryDone(true);
      return;
    }

    void (async () => {
      try {
        const snap = await fetchSessionState(sessionId);
        if (cancelled) return;

        const qsNow =
          queryClient.getQueryData<GeneratedQuestion[]>(sessionQuestionsKey(sessionId)) ?? [];
        const ansNow = queryClient.getQueryData<AnswerRecord[]>(sessionAnswersKey(sessionId)) ?? [];

        let wrote = false;
        if (qsNow.length === 0) {
          const qh = hydrateQuestionsFromStateMessages(snap.messages, snap.session);
          if (qh !== null && qh.length > 0) {
            queryClient.setQueryData(sessionQuestionsKey(sessionId), qh);
            wrote = true;
          }
        }
        if (ansNow.length === 0) {
          const ah = hydrateAnswerRecordsFromStateMessages(snap.messages);
          if (ah !== null && ah.length > 0) {
            queryClient.setQueryData(sessionAnswersKey(sessionId), ah);
            wrote = true;
          }
        }
        if (!cancelled && wrote) setRecoveryTick((tick) => tick + 1);
      } finally {
        if (!cancelled) setRecoveryDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, queryClient]);

  const liveReport = useMemo(() => {
    if (!liveQuestions?.length || !liveAnswers?.length) return null;
    return buildReport(liveQuestions, liveAnswers);
  }, [liveQuestions, liveAnswers]);

  const [sseSlice, setSseSlice] = useState<ReportAgentSseSlice>({});

  const mergedReport = useMemo(() => {
    if (!liveReport) return null;
    return mergeReportWithAgentSse(liveReport, sseSlice);
  }, [liveReport, sseSlice]);

  const report: ReportData | null = mergedReport;

  useEffect(() => {
    if (!liveQuestions?.length || !liveAnswers?.length) return;

    let cancelled = false;

    void (async () => {
      setServerMessage(null);
      setSyncing(true);
      try {
        const first = await fetchSessionState(sessionId);
        if (cancelled) return;

        if (first.session.workflowPhase === "done") {
          /** 已完成报告流时可仅展示本地合并结果（无二次 SSE）。 */
          return;
        }

        if (
          first.session.workflowPhase === "questions" &&
          first.session.status === "awaiting_answers"
        ) {
          await advanceWorkflowToReport(sessionId, liveAnswers);
        }

        if (cancelled) return;

        const second = await fetchSessionState(sessionId);
        if (cancelled) return;

        if (second.session.workflowPhase === "report") {
          const slice = await consumeReportStream(sessionId);
          if (!cancelled) setSseSlice(slice);
        }
      } catch (e) {
        if (!cancelled) {
          setServerMessage(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, liveQuestions, liveAnswers]);

  if (!recoveryDone) {
    return (
      <ScreenShell>
        <View style={[styles.placeholder, { alignItems: "center" }]}>
          <ActivityIndicator />
          <Text style={styles.placeholderSub}>尝试从服务端快照恢复测验与作答…</Text>
        </View>
      </ScreenShell>
    );
  }

  if (!report) {
    return (
      <ScreenShell>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>暂无可展示的答题数据</Text>
          <Text style={styles.placeholderSub}>
            请从预览页走完「生成 → 答题」后再查看报告。
          </Text>
          <PrimaryButton label="回到首页" variant="secondary" onPress={() => router.replace("/(tabs)")} />
        </View>
      </ScreenShell>
    );
  }

  const data = report!;

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {serverMessage !== null ? <Text style={styles.warn}>{serverMessage}</Text> : null}

        {syncing ? (
          <View style={styles.inlineLoad}>
            <ActivityIndicator />
            <Text style={styles.inlineLoadText}>正在同步服务端报告流…（可照常阅读下方本地汇总）</Text>
          </View>
        ) : null}

        <View style={styles.header}>
          <Text style={styles.kicker}>诊断报告</Text>
          <Text style={styles.title}>这次测试说明了什么</Text>
        </View>

        <ReportScoreCard score={data.score} mastery={data.mastery} summary={data.summary} />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>为什么这样评估</Text>
          <Text style={styles.cardText}>{data.rationale}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>维度概览</Text>
          {data.metrics.map((metric) => (
            <MetricBar key={metric.dimensionId} name={metric.name} score={metric.score} />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>薄弱点</Text>
          {data.weaknesses.map((weakness, index) => (
            <WeaknessCard key={weakness} weakness={weakness} index={index} />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>错题解释</Text>
          {data.explanations.map((item) => (
            <View key={item.questionId} style={styles.explanationCard}>
              <Text style={styles.explanationTitle}>{item.title}</Text>
              <Text style={styles.cardText}>{item.explanation}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footerActions}>
          <PrimaryButton label="回到首页" onPress={() => router.replace("/(tabs)")} />
          <PrimaryButton
            label="重新测试相近主题"
            variant="secondary"
            onPress={() =>
              router.replace({
                pathname: "/(tabs)",
                params: {
                  retestTopic: encodeURIComponent(nearRetestTopic.trim())
                }
              })
            }
          />
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, gap: spacing.md, justifyContent: "center", paddingHorizontal: spacing.lg },
  placeholderTitle: { color: colors.text, fontSize: typeScale.title, fontWeight: "900" },
  placeholderSub: { color: colors.textMuted, fontSize: typeScale.body, lineHeight: 22 },
  warn: { color: colors.danger, fontSize: typeScale.label, lineHeight: 20 },
  inlineLoad: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  inlineLoadText: { color: colors.textMuted, flex: 1, fontSize: typeScale.label, lineHeight: 19 },
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
  explanationCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    gap: spacing.xs,
    padding: spacing.md
  },
  explanationTitle: { color: colors.text, fontSize: typeScale.label, fontWeight: "900" },
  footerActions: { gap: spacing.sm }
});
