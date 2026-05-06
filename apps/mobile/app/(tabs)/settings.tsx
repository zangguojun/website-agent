import { SafeAreaView, StyleSheet, Text, View } from "react-native";

const settings = ["匿名设备 ID", "主题与字号", "导出数据", "帮助与反馈"];

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>设置</Text>
        <Text style={styles.subtitle}>保持匿名优先，登录和订阅留到后续阶段扩展。</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Free</Text>
          <Text style={styles.cardText}>每日 3 次测试 · 历史保留 30 天</Text>
        </View>

        {settings.map((item) => (
          <View key={item} style={styles.row}>
            <Text style={styles.rowText}>{item}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        ))}
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
    gap: 12,
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
    backgroundColor: "#0F172A",
    borderRadius: 18,
    marginVertical: 8,
    padding: 18
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800"
  },
  cardText: {
    color: "#CBD5E1",
    marginTop: 6
  },
  row: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16
  },
  rowText: {
    color: "#18181B",
    fontSize: 16,
    fontWeight: "600"
  },
  chevron: {
    color: "#A1A1AA",
    fontSize: 26
  }
});
