import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "center",
        tabBarActiveTintColor: "#0066FF"
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "首页",
          tabBarLabel: "首页"
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "历史",
          tabBarLabel: "历史"
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "设置",
          tabBarLabel: "设置"
        }}
      />
    </Tabs>
  );
}
