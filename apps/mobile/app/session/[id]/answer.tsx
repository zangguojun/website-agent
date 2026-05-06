import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

type Choice = "A" | "B";

const options: Array<{ id: Choice; label: string }> = [
  { id: "A", label: "Server Component 可以直接读取服务端数据源。" },
  { id: "B", label: "Server Component 必须在浏览器里完成渲染。" }
];

export default function AnswerScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id ?? "demo";
  const [selected, setSelected] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitAnswer = () => {
    if (!selected) {
      setError("请选择 A 或 B 后继续。");
      return;
    }

    setError(null);
    router.push(`/session/${sessionId}/report`);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <View>
          <Text style={styles.step}>3 / 4 · 第 1 题</Text>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.dimension}>核心概念</Text>
          <Text style={styles.question}>关于 React Server Components，哪一项说法更准确？</Text>

          <View style={styles.options}>
            {options.map((option) => {
              const isSelected = selected === option.id;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => setSelected(option.id)}
                  style={[styles.option, isSelected && styles.optionSelected]}
                >
                  <Text style={[styles.optionKey, isSelected && styles.optionKeySelected]}>
                    {option.id}
                  </Text>
                  <Text style={styles.optionText}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable onPress={submitAnswer} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>提交并查看报告</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  container: {
    flex: 1,
    gap: 18,
    padding: 24
  },
  step: {
    color: "#0066FF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10
  },
  progressTrack: {
    backgroundColor: "#E4E4E7",
    borderRadius: 999,
    height: 8,
    overflow: "hidden"
  },
  progressFill: {
    backgroundColor: "#0066FF",
    borderRadius: 999,
    height: 8,
    width: "20%"
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    gap: 18,
    padding: 18
  },
  dimension: {
    color: "#FF6B35",
    fontSize: 14,
    fontWeight: "800"
  },
  question: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 32
  },
  options: {
    gap: 12
  },
  option: {
    alignItems: "center",
    borderColor: "#E4E4E7",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14
  },
  optionSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#0066FF"
  },
  optionKey: {
    backgroundColor: "#F4F4F5",
    borderRadius: 999,
    color: "#52525B",
    fontSize: 15,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  optionKeySelected: {
    backgroundColor: "#0066FF",
    color: "#FFFFFF"
  },
  optionText: {
    color: "#27272A",
    flex: 1,
    fontSize: 16,
    lineHeight: 22
  },
  error: {
    color: "#DC2626"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#0066FF",
    borderRadius: 14,
    marginTop: "auto",
    minHeight: 52,
    justifyContent: "center"
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800"
  }
});
