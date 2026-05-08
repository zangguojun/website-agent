import { CLARIFY_REQUIRED_USER_MESSAGES } from "@website-agent/core";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import {
  advanceWorkflowToPlan,
  fetchSessionState,
  loadClarifyAssistantPayload,
  postClarificationUserMessage
} from "../../../src/api/session-remote";
import { hydrateClarificationTurnsFromStateMessages } from "../../../src/session/hydrate-clarify-from-state";
import { answerClarificationTurn, getNextUnansweredTurn } from "../../../src/session/session-flow";
import type { ClarificationTurn } from "../../../src/session/types";
import { AgentBubble, ChoiceOption, PrimaryButton, ScreenShell, UserBubble } from "../../../src/ui/components";
import { colors, spacing, typeScale } from "../../../src/ui/theme";

export default function ClarifyScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const sessionId = routeId ?? "demo";

  const [turns, setTurns] = useState<ClarificationTurn[]>([]);
  const [topicLine, setTopicLine] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const nextTurn = useMemo(() => getNextUnansweredTurn(turns), [turns]);
  const visibleTurns = turns.filter((turn) => turn.answer || turn.question.id === nextTurn?.question.id);

  const scrollChatToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  useEffect(() => {
    scrollChatToBottom();
  }, [turns, nextTurn?.question.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const snapshot = await fetchSessionState(sessionId);
        if (cancelled) return;

        if (snapshot.session.workflowPhase !== "clarify") {
          router.replace(`/session/${sessionId}/confirm`);
          return;
        }

        const topic =
          typeof snapshot.session.rawTopic === "string" ? snapshot.session.rawTopic.trim() : "";
        setTopicLine(topic);

        const userClarifyCount = snapshot.messages.filter(
          (m) => m.phase === "clarify" && m.role === "user"
        ).length;

        if (userClarifyCount >= CLARIFY_REQUIRED_USER_MESSAGES) {
          const filled =
            hydrateClarificationTurnsFromStateMessages(snapshot.messages) ?? [];
          setTurns(filled);
          return;
        }

        const restored = hydrateClarificationTurnsFromStateMessages(snapshot.messages);
        const needsSse =
          restored === null ||
          getNextUnansweredTurn(restored) === null;

        if (!needsSse) {
          setTurns(restored);
          return;
        }

        const outcome = await loadClarifyAssistantPayload(sessionId);
        if (cancelled) return;
        if (outcome.status === "complete") {
          const snapDone = await fetchSessionState(sessionId);
          if (cancelled) return;
          const filled =
            hydrateClarificationTurnsFromStateMessages(snapDone.messages) ?? [];
          setTurns(filled);
          return;
        }

        const snapFinal = await fetchSessionState(sessionId);
        if (cancelled) return;

        const filledFinal =
          hydrateClarificationTurnsFromStateMessages(snapFinal.messages);
        if (!filledFinal || filledFinal.length === 0) {
          throw new Error("澄清Hydrate失败（快照里没有题库题干）");
        }
        setTurns(filledFinal);
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : String(e);
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, retryKey]);

  const refreshAfterAnswer = useCallback(async () => {
    try {
      const snap = await fetchSessionState(sessionId);
      const userN = snap.messages.filter((m) => m.phase === "clarify" && m.role === "user").length;
      if (userN >= CLARIFY_REQUIRED_USER_MESSAGES) {
        setTurns(hydrateClarificationTurnsFromStateMessages(snap.messages) ?? []);
        return;
      }

      let restored = hydrateClarificationTurnsFromStateMessages(snap.messages);
      if (restored && getNextUnansweredTurn(restored)) {
        setTurns(restored);
        return;
      }

      const outcome = await loadClarifyAssistantPayload(sessionId);
      if (outcome.status === "complete") {
        const snap2 = await fetchSessionState(sessionId);
        setTurns(hydrateClarificationTurnsFromStateMessages(snap2.messages) ?? []);
        return;
      }

      const snap3 = await fetchSessionState(sessionId);
      const fin = hydrateClarificationTurnsFromStateMessages(snap3.messages);
      if (fin && fin.length > 0) setTurns(fin);
    } catch {
      /* 保留乐观 UI */
    }
  }, [sessionId]);

  const answerCurrentTurn = useCallback(
    async (value: string | string[], label: string) => {
      if (!nextTurn) return;
      try {
        const content = Array.isArray(value) ? value.join(",") : value;
        await postClarificationUserMessage(sessionId, {
          content,
          payload: { label, source: "clarify_screen" }
        });
        setTurns((currentTurns) =>
          answerClarificationTurn(currentTurns, nextTurn.question.id, value, label)
        );
        await refreshAfterAnswer();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        Alert.alert("提交失败", message);
      }
    },
    [nextTurn, sessionId, refreshAfterAnswer]
  );

  const goToPlan = useCallback(async () => {
    try {
      await advanceWorkflowToPlan(sessionId);
      router.push(`/session/${sessionId}/confirm`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      Alert.alert("无法继续", message);
    }
  }, [sessionId]);

  if (loading) {
    return (
      <ScreenShell>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.hint}>同步澄清进度…</Text>
        </View>
      </ScreenShell>
    );
  }

  if (error) {
    return (
      <ScreenShell>
        <View style={styles.centered}>
          <Text style={styles.errTitle}>澄清流加载失败</Text>
          <Text style={styles.errBody}>
            Agent 没能刷新这一轮澄清。你可以重试，或返回首页稍后继续。
          </Text>
          <Text style={styles.errMeta}>{error}</Text>
          <View style={styles.errActions}>
            <PrimaryButton label="重试" onPress={() => setRetryKey((k) => k + 1)} />
            <PrimaryButton label="返回首页" variant="secondary" onPress={() => router.replace("/(tabs)")} />
          </View>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={12}
        style={styles.keyboardAvoider}
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.topicCompact} numberOfLines={2}>
            {topicLine !== "" ? topicLine : `会话 ${sessionId.slice(0, 8)}…`}
          </Text>
          <Text style={styles.kicker}>正在澄清范围</Text>
          <Text style={styles.title}>我需要再理解一下你的目标</Text>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollChatToBottom}
          showsVerticalScrollIndicator={false}
        >
          {visibleTurns.map((turn) => (
            <View key={turn.question.id} style={styles.turn}>
              <AgentBubble prompt={turn.question.prompt} why={turn.question.why} />
              {turn.answer ? <UserBubble label={turn.answer.label} /> : null}
            </View>
          ))}

          {!nextTurn ? (
            <View style={styles.readyCard}>
              <Text style={styles.readyTitle}>已完成 {CLARIFY_REQUIRED_USER_MESSAGES} 轮澄清</Text>
              <Text style={styles.readyText}>
                可以进入测试计划阶段。点击下方「查看测试计划」继续。
              </Text>
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
                  onPress={() => {
                    void answerCurrentTurn(option.id, option.label);
                  }}
                />
              ))
            ) : (
              <>
                <FreeTextBox
                  onSubmit={(text) => {
                    void answerCurrentTurn(text, text);
                  }}
                />
              </>
            )}
          </View>
        ) : (
          <View style={styles.answerArea}>
            <PrimaryButton label="查看测试计划" onPress={() => void goToPlan()} />
          </View>
        )}
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

function FreeTextBox({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [freeText, setFreeText] = useState("");
  return (
    <>
      <TextInput
        accessibilityHint="补充这次测试需要包含或排除的范围。"
        accessibilityLabel="测试范围补充"
        value={freeText}
        onChangeText={setFreeText}
        placeholder="可以简单写一句，也可以填「不确定」。"
        placeholderTextColor={colors.textSubtle}
        style={styles.textInput}
      />
      <PrimaryButton
        label="提交回答"
        disabled={!freeText.trim()}
        onPress={() => onSubmit(freeText.trim())}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, gap: spacing.sm, justifyContent: "center", padding: spacing.lg },
  hint: { color: colors.textMuted, fontSize: typeScale.body },
  errTitle: { color: colors.text, fontSize: typeScale.title, fontWeight: "900" },
  errBody: { color: colors.textMuted, fontSize: typeScale.body, lineHeight: 23 },
  errMeta: { color: colors.textSubtle, fontSize: typeScale.label, lineHeight: 18 },
  errActions: { gap: spacing.sm, marginTop: spacing.sm },
  keyboardAvoider: { flex: 1, gap: spacing.lg },
  chatScroll: { flex: 1 },
  header: { gap: spacing.sm },
  topicCompact: {
    color: colors.textMuted,
    fontSize: typeScale.caption,
    fontWeight: "800",
    lineHeight: 18
  },
  kicker: { color: colors.primaryBlue, fontSize: typeScale.label, fontWeight: "900" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1, lineHeight: 36 },
  chatContent: { gap: spacing.lg, paddingBottom: spacing.md },
  turn: { gap: spacing.sm },
  readyCard: {
    backgroundColor: colors.agent,
    borderRadius: 22,
    gap: spacing.sm,
    padding: spacing.lg
  },
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
