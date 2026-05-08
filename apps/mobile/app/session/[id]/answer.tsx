import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import {
  fetchSessionState,
  loadQuestionsFromQuestionsStream
} from "../../../src/api/session-remote";
import {
  sessionAnswersKey,
  sessionPlanKey,
  sessionQuestionsKey,
  type SessionPlanQueryData
} from "../../../src/api/session-query-keys";
import { hydrateAnswerRecordsFromStateMessages } from "../../../src/session/hydrate-answers-from-state";
import { answerQuestion } from "../../../src/session/session-flow";
import type { AnswerRecord, GeneratedQuestion } from "../../../src/session/types";
import { PrimaryButton, QuestionCard, ScreenShell } from "../../../src/ui/components";
import { colors, radius, spacing, typeScale } from "../../../src/ui/theme";

function pickSeedAnswers(
  cached: AnswerRecord[],
  fromServer: AnswerRecord[] | null,
  liveQuestions: GeneratedQuestion[]
): AnswerRecord[] {
  const qIds = new Set(liveQuestions.map((q) => q.id));
  const filterInQuiz = (rows: AnswerRecord[]) => rows.filter((a) => qIds.has(a.questionId));

  if (fromServer !== null && fromServer.length > 0) {
    const serverFiltered = filterInQuiz(fromServer);
    if (serverFiltered.length === liveQuestions.length) return serverFiltered;
    if (cached.length === 0) return serverFiltered;
  }

  return filterInQuiz(cached);
}

export default function AnswerScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const sessionId: string = routeId ?? "demo";
  const queryClient = useQueryClient();

  const hydratedKeyRef = useRef<string | null>(null);

  const {
    data: liveQuestions,
    isPending: livePending,
    isError: liveError,
    error: liveQueryError
  } = useQuery({
    queryKey: sessionQuestionsKey(sessionId),
    enabled: true,
    staleTime: Infinity,
    queryFn: async () => {
      const plan = queryClient.getQueryData<SessionPlanQueryData>(sessionPlanKey(sessionId));
      return loadQuestionsFromQuestionsStream(sessionId, plan ?? undefined);
    }
  });

  const questions = liveQuestions;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hydratedKeyRef.current = null;
  }, [sessionId]);

  const questionSig = liveQuestions?.length
    ? `${sessionId}:${liveQuestions.map((q) => q.id).join("|")}`
    : null;

  useEffect(() => {
    if (!questionSig || !liveQuestions?.length) return;
    if (hydratedKeyRef.current === questionSig) return;
    hydratedKeyRef.current = questionSig;

    let cancelled = false;

    void (async () => {
      const cached = queryClient.getQueryData<AnswerRecord[]>(sessionAnswersKey(sessionId)) ?? [];
      /** `hydrate` 返回 [] 时没有提交快照，按 null 视为无服务端答卷。 */
      let fromServerForPick: AnswerRecord[] | null = null;
      let phasePastQuiz = false;

      try {
        const snap = await fetchSessionState(sessionId);
        if (cancelled) return;
        const rawServer = hydrateAnswerRecordsFromStateMessages(snap.messages);
        fromServerForPick = rawServer !== null && rawServer.length > 0 ? rawServer : null;
        phasePastQuiz =
          snap.session.workflowPhase === "report" || snap.session.workflowPhase === "done";
      } catch {
        /* 仍可纯本地答题 */
      }

      if (cancelled) return;

      const seed = pickSeedAnswers(cached, fromServerForPick, liveQuestions);
      const everyAnswered =
        liveQuestions.length > 0 &&
        liveQuestions.every((q) => seed.some((a) => a.questionId === q.id));

      if (everyAnswered && phasePastQuiz) {
        queryClient.setQueryData(sessionAnswersKey(sessionId), seed);
        router.replace(`/session/${sessionId}/report`);
        return;
      }

      if (seed.length > 0) {
        queryClient.setQueryData(sessionAnswersKey(sessionId), seed);
        const firstUnset = liveQuestions.findIndex((q) => !seed.some((a) => a.questionId === q.id));
        setAnswers(seed);
        setCurrentIndex(firstUnset === -1 ? liveQuestions.length - 1 : firstUnset);
      }
    })();

    return () => {
      cancelled = true;
      /** StrictMode remount：允许未完成的一次 hydrate 重跑。 */
      if (hydratedKeyRef.current === questionSig) hydratedKeyRef.current = null;
    };
  }, [questionSig, liveQuestions, queryClient, sessionId]);

  if (livePending) {
    return (
      <ScreenShell>
        <View style={[styles.loadingBox, styles.header]}>
          <ActivityIndicator />
          <Text style={styles.progressText}>正在加载服务端题目…</Text>
          <Text style={styles.hint}>若从分享链接进入，我们会尝试用会话快照恢复题目与已提交答案。</Text>
          <PrimaryButton label="返回" variant="secondary" onPress={() => router.back()} />
        </View>
      </ScreenShell>
    );
  }

  if (liveError) {
    const msg = liveQueryError instanceof Error ? liveQueryError.message : String(liveQueryError);
    return (
      <ScreenShell>
        <View style={[styles.loadingBox, styles.header]}>
          <Text style={styles.progressText}>题目加载失败</Text>
          <Text style={styles.hint}>{msg}</Text>
          <PrimaryButton
            label="重试"
            onPress={() => queryClient.invalidateQueries({ queryKey: sessionQuestionsKey(sessionId) })}
          />
          <PrimaryButton label="返回" variant="secondary" onPress={() => router.back()} />
        </View>
      </ScreenShell>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <ScreenShell>
        <View style={[styles.loadingBox, styles.header]}>
          <Text style={styles.progressText}>没有可用题目。</Text>
          <PrimaryButton label="返回生成" variant="secondary" onPress={() => router.back()} />
        </View>
      </ScreenShell>
    );
  }

  const currentQuestion = questions![currentIndex]!;
  const selectedAnswer = answers.find((answer) => answer.questionId === currentQuestion.id)?.optionId ?? null;
  const isLastQuestion = currentIndex === questions!.length - 1;

  const goNextOrFinish = () => {
    if (!selectedAnswer) {
      setError("请选择一个答案后继续。");
      return;
    }

    setError(null);
    const merged = answerQuestion(answers, currentQuestion.id, selectedAnswer);

    if (isLastQuestion) {
      queryClient.setQueryData(sessionAnswersKey(sessionId), merged);
      router.push(`/session/${sessionId}/report`);
      return;
    }

    setAnswers(merged);
    setCurrentIndex((index) => index + 1);
  };

  const totalLen = questions!.length;

  return (
    <ScreenShell>
      <View style={styles.header}>
        <Text style={styles.kicker}>诊断测试</Text>
        <Text style={styles.progressText}>
          第 {currentIndex + 1} 题 / 共 {totalLen} 题
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${((currentIndex + 1) / totalLen) * 100}%` }]}
          />
        </View>
      </View>

      <QuestionCard
        question={currentQuestion}
        selectedOptionId={selectedAnswer}
        onSelect={(optionId) => {
          setAnswers((currentAnswers) => answerQuestion(currentAnswers, currentQuestion.id, optionId));
          setError(null);
        }}
      />

      <View style={styles.footer}>
        {error !== null ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label={isLastQuestion ? "提交" : "下一题"} onPress={goNextOrFinish} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loadingBox: { flex: 1, gap: spacing.md, justifyContent: "center" },
  hint: { color: colors.textMuted, fontSize: typeScale.body, lineHeight: 22 },
  header: { gap: spacing.sm },
  kicker: { color: colors.primaryBlue, fontSize: typeScale.label, fontWeight: "900" },
  progressText: { color: colors.text, fontSize: typeScale.title, fontWeight: "900" },
  progressTrack: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    height: 8,
    overflow: "hidden"
  },
  progressFill: {
    backgroundColor: colors.primaryBlue,
    borderRadius: radius.pill,
    height: 8
  },
  footer: { gap: spacing.sm, marginTop: "auto" },
  error: { color: colors.danger, fontSize: typeScale.label }
});
