import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { sessionPlanKey } from "../../../src/api/session-query-keys";
import { fetchSessionState, loadTestPlanViaPlanStream } from "../../../src/api/session-remote";
import type { TestPlan } from "../../../src/session/types";
import { PlanCard, PrimaryButton, ScreenShell } from "../../../src/ui/components";
import { colors, spacing, typeScale } from "../../../src/ui/theme";

export default function ConfirmScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const sessionId = routeId ?? "demo";

  const queryClient = useQueryClient();

  const [plan, setPlan] = useState<TestPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [planRetryKey, setPlanRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setWarning(null);
      try {
        const { session } = await fetchSessionState(sessionId);
        if (cancelled) return;
        if (session.workflowPhase !== "plan") {
          router.replace(`/session/${sessionId}/clarify`);
          return;
        }
        const remotePlan = await loadTestPlanViaPlanStream(sessionId);
        if (!cancelled) {
          setPlan(remotePlan);
          queryClient.setQueryData(sessionPlanKey(sessionId), remotePlan);
        }
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : String(e);
          setWarning(`计划流暂时失败：${message}。可返回澄清后再试，或重试加载。`);
          setPlan(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, queryClient, planRetryKey]);

  if (loading) {
    return (
      <ScreenShell>
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.loadingCopy}>读取测试计划流…</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <View style={{ flex: 1, gap: spacing.lg }}>
        <View style={styles.header}>
          <Text style={styles.kicker}>测试计划</Text>
          <Text style={styles.title}>我准备这样测试你</Text>
          <Text style={styles.subtitle}>
            这份计划由刚才的澄清回答生成。你可以开始生成测试，也可以返回继续澄清。
          </Text>
        </View>

        {warning !== null ? (
          <View style={styles.warnBlock}>
            <Text style={styles.warn}>{warning}</Text>
            <PrimaryButton label="重新生成计划" variant="secondary" onPress={() => setPlanRetryKey((k) => k + 1)} />
          </View>
        ) : null}

        {plan !== null ? <PlanCard plan={plan} /> : null}

        <View style={styles.actions}>
          <PrimaryButton
            label="开始生成测试"
            disabled={plan === null}
            onPress={() => router.push(`/session/${sessionId}/generate`)}
          />
          <PrimaryButton label="继续澄清" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, gap: spacing.sm, justifyContent: "center", paddingHorizontal: spacing.lg },
  loadingCopy: { color: colors.textMuted, fontSize: typeScale.body, textAlign: "center" },
  header: { gap: spacing.sm },
  kicker: { color: colors.primaryBlue, fontSize: typeScale.label, fontWeight: "900" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1, lineHeight: 36 },
  subtitle: { color: colors.textMuted, fontSize: typeScale.body, lineHeight: 23 },
  warnBlock: { gap: spacing.sm },
  warn: { color: colors.textMuted, fontSize: typeScale.body, lineHeight: 22 },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
