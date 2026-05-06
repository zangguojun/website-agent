import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

type Choice = "A" | "B";

type Question = {
  id: string;
  dimension: string;
  question: string;
  options: Array<{ id: Choice; label: string }>;
};

const questions: [Question, ...Question[]] = [
  {
    id: "rsc-concept",
    dimension: "核心概念",
    question: "关于 React Server Components，哪一项说法更准确？",
    options: [
      { id: "A", label: "Server Component 可以直接读取服务端数据源。" },
      { id: "B", label: "Server Component 必须在浏览器里完成渲染。" }
    ]
  },
  {
    id: "cache-usage",
    dimension: "实际应用",
    question: "如果一个页面需要读取数据库并尽快返回首屏，哪种做法更贴近 App Router 思路？",
    options: [
      { id: "A", label: "优先在 Server Component 中获取数据并渲染。" },
      { id: "B", label: "把所有数据请求都放到客户端 useEffect 里。" }
    ]
  },
  {
    id: "common-misconception",
    dimension: "常见误区",
    question: "下面哪项更可能造成不必要的客户端 JavaScript？",
    options: [
      { id: "A", label: "只在需要交互的组件上使用客户端组件。" },
      { id: "B", label: "在很高层级随意添加 use client。" }
    ]
  }
];

export default function AnswerScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id ?? "demo";
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Choice>>({});
  const [error, setError] = useState<string | null>(null);
  const currentQuestion = questions[currentIndex] ?? questions[0];
  const selected = answers[currentQuestion.id] ?? null;
  const isLastQuestion = currentIndex === questions.length - 1;

  const submitAnswer = () => {
    if (!selected) {
      setError("请选择 A 或 B 后继续。");
      return;
    }

    setError(null);
    if (isLastQuestion) {
      router.push(`/session/${sessionId}/report`);
      return;
    }

    setCurrentIndex((index) => index + 1);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <View>
          <Text style={styles.step}>
            3 / 4 · 第 {currentIndex + 1} 题 / 共 {questions.length} 题
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${((currentIndex + 1) / questions.length) * 100}%` }
              ]}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.dimension}>{currentQuestion.dimension}</Text>
          <Text style={styles.question}>{currentQuestion.question}</Text>

          <View style={styles.options}>
            {currentQuestion.options.map((option) => {
              const isSelected = selected === option.id;

              return (
                <Pressable
                  key={option.id}
                  onPress={() =>
                    setAnswers((currentAnswers) => ({
                      ...currentAnswers,
                      [currentQuestion.id]: option.id
                    }))
                  }
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
          <Text style={styles.primaryButtonText}>
            {isLastQuestion ? "提交并查看报告" : "下一题"}
          </Text>
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
    height: 8
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
