import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={12}
        style={styles.keyboardAvoider}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>正在澄清范围</Text>
          <Text style={styles.title}>我需要再理解一下你的目标</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
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
                  accessibilityHint="补充这次测试需要包含或排除的范围。"
                  accessibilityLabel="测试范围补充"
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
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  keyboardAvoider: { flex: 1, gap: spacing.lg },
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
