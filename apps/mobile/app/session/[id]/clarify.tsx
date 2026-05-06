import { router, useLocalSearchParams } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

const choices = ["准备面试", "系统学习", "查漏补缺"];

export default function ClarifyScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id ?? "demo";

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.step}>1 / 4</Text>
        <Text style={styles.title}>先澄清测试目的</Text>
        <Text style={styles.subtitle}>
          为了让题目更贴合你，我们会用几轮问题缩小范围。这里先展示 MVP 静态流程。
        </Text>

        <View style={styles.agentBubble}>
          <Text style={styles.bubbleLabel}>Agent</Text>
          <Text style={styles.bubbleText}>这次自测你更偏向哪种目标？</Text>
        </View>

        <View style={styles.choiceGroup}>
          {choices.map((choice) => (
            <Pressable key={choice} style={styles.choice}>
              <Text style={styles.choiceText}>{choice}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => router.push(`/session/${sessionId}/confirm`)}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>使用这些信息生成测试</Text>
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
    gap: 16,
    padding: 24
  },
  step: {
    color: "#0066FF",
    fontSize: 14,
    fontWeight: "800"
  },
  title: {
    color: "#111827",
    fontSize: 30,
    fontWeight: "800"
  },
  subtitle: {
    color: "#52525B",
    fontSize: 15,
    lineHeight: 22
  },
  agentBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    maxWidth: "88%",
    padding: 16
  },
  bubbleLabel: {
    color: "#0066FF",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6
  },
  bubbleText: {
    color: "#18181B",
    fontSize: 17,
    lineHeight: 24
  },
  choiceGroup: {
    gap: 10
  },
  choice: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16
  },
  choiceText: {
    color: "#3730A3",
    fontSize: 16,
    fontWeight: "700"
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
