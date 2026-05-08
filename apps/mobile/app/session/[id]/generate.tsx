import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import {
  fetchSessionState,
  loadQuestionsFromQuestionsStream
} from "../../../src/api/session-remote";
import {
  sessionPlanKey,
  sessionQuestionsKey,
  type SessionPlanQueryData
} from "../../../src/api/session-query-keys";
import { GenerationStepList, PrimaryButton, ScreenShell } from "../../../src/ui/components";
import { colors, spacing, typeScale } from "../../../src/ui/theme";

export default function GenerateScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const sessionId: string = routeId ?? "demo";
  const queryClient = useQueryClient();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [sessionId]);

  const {
    data: remoteQuestions,
    isFetching,
    error: remoteError
  } = useQuery({
    queryKey: sessionQuestionsKey(sessionId),
    enabled: true,
    staleTime: Infinity,
    queryFn: async () => {
      const plan = queryClient.getQueryData<SessionPlanQueryData>(sessionPlanKey(sessionId));
      return loadQuestionsFromQuestionsStream(sessionId, plan ?? undefined);
    }
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { session } = await fetchSessionState(sessionId);
        if (cancelled) return;

        const allowed =
          session.workflowPhase === "questions" &&
          (session.status === "questions_ready" || session.status === "awaiting_answers");

        if (!allowed) router.replace(`/session/${sessionId}/confirm`);
      } catch {
        router.replace(`/session/${sessionId}/confirm`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  /** 题目尚未就绪时逐步点亮占位步骤 */
  const remoteGenerationBusy =
    !remoteError &&
    (remoteQuestions === undefined ||
      remoteQuestions.length === 0 ||
      Boolean(isFetching));

  useEffect(() => {
    if (!remoteGenerationBusy) return;
    if (activeIndex >= 4) return;

    const timer = setTimeout(() => setActiveIndex((index) => Math.min(index + 1, 4)), 550);
    return () => clearTimeout(timer);
  }, [remoteGenerationBusy, remoteError, remoteQuestions, isFetching, activeIndex]);

  useEffect(() => {
    if (!remoteQuestions?.length || remoteError) return;
    setActiveIndex(5);
  }, [remoteQuestions, remoteError]);

  const remoteErrorMessage = remoteError instanceof Error ? remoteError.message : null;

  /** 服务端失败时常停留在中间步骤（activeIndex < 5），对齐 spec 的失败步骤标记。 */
  const failedStepIndex =
    remoteErrorMessage !== null && activeIndex >= 0 && activeIndex < 5 ? activeIndex : null;

  const isDone = Boolean(remoteQuestions?.length) && !isFetching && !remoteError && activeIndex >= 5;

  const showRemoteSpinner = isFetching;

  return (
    <ScreenShell>
      <View style={styles.header}>
        <Text style={styles.kicker}>Agent 正在工作</Text>
        <Text style={styles.title}>{isDone ? "测试已经准备好了" : "正在生成你的诊断测试"}</Text>
        <Text style={styles.subtitle}>我会先规划能力维度，再生成和校验选择题，确保每道题都能服务诊断目标。</Text>
      </View>

      {showRemoteSpinner ? (
        <View style={styles.inlineLoad}>
          <ActivityIndicator />
          <Text style={styles.inlineLoadText}>拉取题目 SSE…</Text>
        </View>
      ) : null}

      {remoteErrorMessage !== null ? <Text style={styles.warn}>{remoteErrorMessage}</Text> : null}

      {remoteErrorMessage !== null ? (
        <PrimaryButton
          label="重新生成测试"
          variant="secondary"
          onPress={() => {
            setActiveIndex(0);
            void queryClient.invalidateQueries({ queryKey: sessionQuestionsKey(sessionId) });
          }}
        />
      ) : null}

      <GenerationStepList activeIndex={activeIndex} failedAtIndex={failedStepIndex} />

      <View style={styles.actions}>
        <PrimaryButton
          label={
            isDone ? "开始答题" : remoteErrorMessage !== null ? "生成未完成" : "生成中"
          }
          disabled={!isDone}
          loading={!isDone && remoteErrorMessage === null}
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
  inlineLoad: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  inlineLoadText: { color: colors.textMuted, fontSize: typeScale.label },
  warn: { color: colors.textMuted, fontSize: typeScale.body, lineHeight: 22 },
  actions: { marginTop: "auto" }
});
