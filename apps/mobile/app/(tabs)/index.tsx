import { useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { createSession } from "../../src/api/client";
import { PrimaryButton, ScreenShell } from "../../src/ui/components";
import { colors, radius, shadow, spacing, typeScale } from "../../src/ui/theme";

const suggestions = ["React Server Components", "微积分极限", "英语语法时态"];

function homeTopStatusLine(now: Date): string {
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;
  if (isWeekend) return "周末适合慢慢查漏补缺，先做一轮短时诊断也不错。";
  return "今天适合做一轮约 6 分钟的诊断测验，理清一个知识盲区。";
}

export default function HomeScreen() {
  const params = useLocalSearchParams<{ retestTopic?: string | string[] }>();
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);

  const topStatus = useMemo(() => homeTopStatusLine(new Date()), []);

  const rawRetest =
    params.retestTopic === undefined
      ? undefined
      : Array.isArray(params.retestTopic)
        ? params.retestTopic[0]
        : params.retestTopic;

  useEffect(() => {
    if (typeof rawRetest !== "string" || rawRetest.trim().length === 0) return;
    try {
      setTopic(decodeURIComponent(rawRetest.trim()));
    } catch {
      setTopic(rawRetest.trim());
    }
  }, [rawRetest]);

  const createSessionMutation = useMutation({
    mutationFn: createSession,
    onSuccess: (session) => {
      router.push(`/session/${session.id}/clarify`);
    },
    onError: (err) => {
      const detail = err instanceof Error ? err.message : String(err);
      setError(
        __DEV__
          ? `没能创建诊断会话。\n${detail}`
          : "没能创建诊断会话，请检查网络后重试。"
      );
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
        <Text style={styles.statusLine}>{topStatus}</Text>
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
          accessibilityHint="输入后会开始一段澄清对话，生成诊断测试。"
          accessibilityLabel="想验证的知识主题"
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
            <Pressable
              key={suggestion}
              accessibilityLabel={`选择建议主题：${suggestion}`}
              accessibilityRole="button"
              onPress={() => setTopic(suggestion)}
              style={styles.suggestion}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {error !== null && !createSessionMutation.isPending ? (
          <PrimaryButton
            label="重试"
            variant="secondary"
            disabled={!topic.trim()}
            onPress={() => {
              setError(null);
              createSessionMutation.mutate(topic.trim());
            }}
          />
        ) : null}

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
  statusLine: { color: colors.textMuted, fontSize: typeScale.caption, fontWeight: "800", lineHeight: 18 },
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
  agentText: { color: colors.text, fontSize: typeScale.body, fontWeight: "600", lineHeight: 23 },
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
