import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function HistoryScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>历史报告</Text>
        <Text style={styles.subtitle}>
          暂无已存档会话列表。完成后可从首页继续新测试；后续会接入与你的账号同步的历史记录。
        </Text>

        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>提示</Text>
          <Text style={styles.emptyText}>
            未完成的测试可由会话快照恢复进度（需在 API 可用的环境下打开同一设备上的会话）。
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  container: {
    flex: 1,
    gap: 14,
    padding: 24,
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#52525B",
    fontSize: 15,
    lineHeight: 22,
  },
  emptyCard: {
    backgroundColor: "#F4F4F5",
    borderRadius: 16,
    marginTop: 8,
    padding: 16,
  },
  emptyTitle: {
    color: "#27272A",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    color: "#52525B",
    lineHeight: 21,
    marginTop: 6,
  },
});
