import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { createSession } from "../../src/api/client";

const suggestions = ["React Server Components", "微积分极限", "英语语法时态"];

export default function HomeScreen() {
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createSessionMutation = useMutation({
    mutationFn: createSession,
    onSuccess: (session) => {
      router.push(`/session/${session.id}/clarify`);
    },
    onError: () => {
      setError("暂时无法创建测试，请稍后重试。");
    }
  });

  const startSession = () => {
    const trimmedTopic = topic.trim();

    if (!trimmedTopic) {
      setError("先输入一个想测试的知识点。");
      return;
    }

    setError(null);
    createSessionMutation.mutate(trimmedTopic);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.kicker}>知识自测</Text>
        <Text style={styles.title}>输入一个主题，快速诊断掌握程度</Text>
        <Text style={styles.subtitle}>
          App 会先澄清范围，再生成 8-25 道选择题，最后给出薄弱点 TOP3。
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>我想测试</Text>
          <TextInput
            value={topic}
            onChangeText={setTopic}
            placeholder="例如：Next.js App Router 缓存"
            placeholderTextColor="#A1A1AA"
            returnKeyType="done"
            style={styles.input}
          />

          <View style={styles.chipRow}>
            {suggestions.map((suggestion) => (
              <Pressable
                key={suggestion}
                onPress={() => setTopic(suggestion)}
                style={styles.chip}
              >
                <Text style={styles.chipText}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            disabled={createSessionMutation.isPending}
            onPress={startSession}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || createSessionMutation.isPending) && styles.buttonPressed
            ]}
          >
            {createSessionMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>开始测试</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>MVP 流程</Text>
          <Text style={styles.noticeText}>澄清 2-5 轮 · 单选题 · 即时报告</Text>
        </View>
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
    padding: 24,
    gap: 18
  },
  kicker: {
    color: "#0066FF",
    fontSize: 15,
    fontWeight: "700"
  },
  title: {
    color: "#111827",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 42
  },
  subtitle: {
    color: "#52525B",
    fontSize: 16,
    lineHeight: 24
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    gap: 14,
    padding: 18,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 16
  },
  label: {
    color: "#18181B",
    fontSize: 15,
    fontWeight: "700"
  },
  input: {
    backgroundColor: "#F4F4F5",
    borderRadius: 12,
    color: "#18181B",
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    backgroundColor: "#EFF6FF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chipText: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "600"
  },
  error: {
    color: "#DC2626",
    fontSize: 14
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#0066FF",
    borderRadius: 14,
    minHeight: 52,
    justifyContent: "center"
  },
  buttonPressed: {
    opacity: 0.75
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700"
  },
  notice: {
    backgroundColor: "#EEF2FF",
    borderRadius: 16,
    padding: 16
  },
  noticeTitle: {
    color: "#312E81",
    fontSize: 15,
    fontWeight: "700"
  },
  noticeText: {
    color: "#4338CA",
    marginTop: 4
  }
});
