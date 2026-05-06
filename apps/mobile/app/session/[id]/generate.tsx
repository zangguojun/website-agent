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
