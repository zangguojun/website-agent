import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { StatusBar } from "react-native";

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar barStyle="dark-content" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="session/[id]/clarify"
          options={{ title: "澄清范围", presentation: "card" }}
        />
        <Stack.Screen
          name="session/[id]/confirm"
          options={{ title: "测试预览" }}
        />
        <Stack.Screen
          name="session/[id]/answer"
          options={{ title: "开始答题" }}
        />
        <Stack.Screen
          name="session/[id]/report"
          options={{ title: "诊断报告" }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
