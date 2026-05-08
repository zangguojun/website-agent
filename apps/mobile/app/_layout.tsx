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
        {/* `title` 用于子页面左上角返回旁显示简短上一屏标题（如「首页」），避免裸露的路由段名“(tabs)” */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "首页" }} />
        <Stack.Screen
          name="session/[id]/clarify"
          options={{
            headerBackTitle: "首页",
            title: "澄清范围",
            presentation: "card"
          }}
        />
        <Stack.Screen
          name="session/[id]/confirm"
          options={{ headerBackTitle: "澄清", title: "测试预览" }}
        />
        <Stack.Screen
          name="session/[id]/generate"
          options={{ headerBackTitle: "预览", title: "生成测试中" }}
        />
        <Stack.Screen
          name="session/[id]/answer"
          options={{ headerBackTitle: "生成", title: "开始答题" }}
        />
        <Stack.Screen
          name="session/[id]/report"
          options={{ headerBackTitle: "答题", title: "诊断报告" }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
