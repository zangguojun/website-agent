import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { mockTestPlan } from "../../../src/session/mock-session";
import { PlanCard, PrimaryButton, ScreenShell } from "../../../src/ui/components";
import { colors, spacing, typeScale } from "../../../src/ui/theme";

export default function ConfirmScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id ?? "demo";

  return (
    <ScreenShell>
      <View style={styles.header}>
        <Text style={styles.kicker}>测试计划</Text>
        <Text style={styles.title}>我准备这样测试你</Text>
        <Text style={styles.subtitle}>这份计划由刚才的澄清回答生成。你可以开始生成测试，也可以返回继续澄清。</Text>
      </View>

      <PlanCard plan={mockTestPlan} />

      <View style={styles.actions}>
        <PrimaryButton label="开始生成测试" onPress={() => router.push(`/session/${sessionId}/generate`)} />
        <PrimaryButton label="继续澄清" variant="secondary" onPress={() => router.back()} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  kicker: { color: colors.primaryBlue, fontSize: typeScale.label, fontWeight: "900" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1, lineHeight: 36 },
  subtitle: { color: colors.textMuted, fontSize: typeScale.body, lineHeight: 23 },
  actions: { gap: spacing.sm, marginTop: "auto" }
});
