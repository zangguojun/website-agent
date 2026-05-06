import { router } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

const weaknesses = [
  "边界条件判断：缓存失效和重新验证时机",
  "实际应用：服务端与客户端组件拆分",
  "常见误区：把渲染位置和交互能力混为一谈"
];

const dimensions = [
  { name: "核心概念", score: 86 },
  { name: "实际应用", score: 72 },
  { name: "边界条件", score: 61 }
];

export default function ReportScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.step}>4 / 4</Text>
        <View style={styles.scoreCard}>
          <Text style={styles.score}>78</Text>
          <Text style={styles.mastery}>熟练</Text>
          <Text style={styles.summary}>
            你已经掌握主要概念，下一步建议针对边界条件和真实场景拆分做查漏补缺。
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>维度概览</Text>
          {dimensions.map((dimension) => (
            <View key={dimension.name} style={styles.dimensionRow}>
              <Text style={styles.dimensionName}>{dimension.name}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${dimension.score}%` }]} />
              </View>
              <Text style={styles.dimensionScore}>{dimension.score}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>薄弱点 TOP3</Text>
          {weaknesses.map((weakness, index) => (
            <View key={weakness} style={styles.weaknessRow}>
              <Text style={styles.weaknessIndex}>{index + 1}</Text>
              <Text style={styles.weaknessText}>{weakness}</Text>
            </View>
          ))}
        </View>

        <Pressable onPress={() => router.replace("/(tabs)")} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>回到首页</Text>
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
    gap: 14,
    padding: 24
  },
  step: {
    color: "#0066FF",
    fontSize: 14,
    fontWeight: "800"
  },
  scoreCard: {
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderRadius: 24,
    padding: 24
  },
  score: {
    color: "#FFFFFF",
    fontSize: 72,
    fontWeight: "900"
  },
  mastery: {
    backgroundColor: "#10B981",
    borderRadius: 999,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  summary: {
    color: "#CBD5E1",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
    textAlign: "center"
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    gap: 12,
    padding: 18
  },
  cardTitle: {
    color: "#18181B",
    fontSize: 18,
    fontWeight: "800"
  },
  dimensionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  dimensionName: {
    color: "#3F3F46",
    fontWeight: "700",
    width: 72
  },
  barTrack: {
    backgroundColor: "#E4E4E7",
    borderRadius: 999,
    flex: 1,
    height: 8,
    overflow: "hidden"
  },
  barFill: {
    backgroundColor: "#0066FF",
    borderRadius: 999,
    height: 8
  },
  dimensionScore: {
    color: "#18181B",
    fontWeight: "800",
    width: 32
  },
  weaknessRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10
  },
  weaknessIndex: {
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    color: "#92400E",
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  weaknessText: {
    color: "#27272A",
    flex: 1,
    fontSize: 15,
    lineHeight: 21
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#0066FF",
    borderRadius: 14,
    minHeight: 52,
    justifyContent: "center"
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800"
  }
});
