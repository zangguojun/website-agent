import { SafeAreaView, StyleSheet, Text, View } from "react-native";

const mockSessions = [
  { id: "1", topic: "React Server Components", score: 78, date: "今天" },
  { id: "2", topic: "线性代数向量空间", score: 64, date: "昨天" }
];

export default function HistoryScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>历史报告</Text>
        <Text style={styles.subtitle}>MVP 阶段先展示静态样例，后续接入我的会话列表。</Text>

        {mockSessions.map((session) => (
          <View key={session.id} style={styles.card}>
            <View>
              <Text style={styles.topic}>{session.topic}</Text>
              <Text style={styles.meta}>{session.date}</Text>
            </View>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreText}>{session.score}</Text>
            </View>
          </View>
        ))}

        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>继续测试提示</Text>
          <Text style={styles.emptyText}>
            未完成的测试会在这里提示恢复，避免中断后丢失进度。
          </Text>
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
    gap: 14,
    padding: 24
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: "#52525B",
    fontSize: 15,
    lineHeight: 22
  },
  card: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16
  },
  topic: {
    color: "#18181B",
    fontSize: 16,
    fontWeight: "700"
  },
  meta: {
    color: "#71717A",
    marginTop: 4
  },
  scoreBadge: {
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  scoreText: {
    color: "#047857",
    fontSize: 17,
    fontWeight: "800"
  },
  emptyCard: {
    backgroundColor: "#F4F4F5",
    borderRadius: 16,
    marginTop: 8,
    padding: 16
  },
  emptyTitle: {
    color: "#27272A",
    fontSize: 16,
    fontWeight: "700"
  },
  emptyText: {
    color: "#52525B",
    lineHeight: 21,
    marginTop: 6
  }
});
