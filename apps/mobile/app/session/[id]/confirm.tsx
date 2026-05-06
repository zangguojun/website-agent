import { router, useLocalSearchParams } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

const dimensions = ["核心概念", "实际应用", "边界条件", "常见误区", "进阶判断"];

export default function ConfirmScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id ?? "demo";

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.step}>2 / 4</Text>
        <Text style={styles.title}>测试预览</Text>
        <Text style={styles.subtitle}>将生成 12 道选择题，预计 6-8 分钟完成。</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>将覆盖 5 个维度</Text>
          {dimensions.map((dimension, index) => (
            <View key={dimension} style={styles.dimensionRow}>
              <Text style={styles.dimensionIndex}>{index + 1}</Text>
              <Text style={styles.dimensionText}>{dimension}</Text>
            </View>
          ))}
        </View>

        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>规则</Text>
          <Text style={styles.calloutText}>单题作答后不可修改，答完后立即生成诊断报告。</Text>
        </View>

        <Pressable
          onPress={() => router.push(`/session/${sessionId}/answer`)}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>开始答题</Text>
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
    gap: 12
  },
  dimensionIndex: {
    backgroundColor: "#DBEAFE",
    borderRadius: 999,
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  dimensionText: {
    color: "#27272A",
    fontSize: 16,
    fontWeight: "600"
  },
  callout: {
    backgroundColor: "#FFF7ED",
    borderRadius: 16,
    padding: 16
  },
  calloutTitle: {
    color: "#C2410C",
    fontSize: 15,
    fontWeight: "800"
  },
  calloutText: {
    color: "#9A3412",
    lineHeight: 21,
    marginTop: 6
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
