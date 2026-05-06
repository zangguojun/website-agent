import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { answerQuestion } from "../../../src/session/session-flow";
import { mockQuestions } from "../../../src/session/mock-session";
import type { AnswerRecord } from "../../../src/session/types";
import { PrimaryButton, QuestionCard, ScreenShell } from "../../../src/ui/components";
import { colors, radius, spacing, typeScale } from "../../../src/ui/theme";

export default function AnswerScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id ?? "demo";
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const currentQuestion = mockQuestions[currentIndex];
  if (!currentQuestion) {
    return null;
  }

  const selectedAnswer = answers.find((answer) => answer.questionId === currentQuestion.id)?.optionId ?? null;
  const isLastQuestion = currentIndex === mockQuestions.length - 1;

  const submitAnswer = () => {
    if (!selectedAnswer) {
      setError("请选择一个答案后继续。");
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
    <ScreenShell>
      <View style={styles.header}>
        <Text style={styles.kicker}>诊断测试</Text>
        <Text style={styles.progressText}>
          第 {currentIndex + 1} 题 / 共 {mockQuestions.length} 题
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${((currentIndex + 1) / mockQuestions.length) * 100}%` }
            ]}
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
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label={isLastQuestion ? "提交" : "下一题"} onPress={submitAnswer} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
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
