# Website Agent / Knowledge Test

一个基于 Expo iOS App + Vercel API 的 AI 知识自测产品。

## Apps

- `apps/mobile`：Expo iOS App
- `apps/api`：Next.js API，负责 session、Agent workflow、评分与报告
- `packages/core`：共享 schema、ID 与评分逻辑

## 本地开发

安装依赖：

```bash
pnpm install
```

配置移动端 API 地址：

```bash
export EXPO_PUBLIC_API_BASE_URL="http://localhost:3000"
```

移动端启动时必须设置 `EXPO_PUBLIC_API_BASE_URL`。缺少该环境变量时，App 会直接抛错，避免请求落到错误地址。

启动 API：

```bash
pnpm --filter @website-agent/api dev
```

启动 iOS App：

```bash
pnpm --filter @website-agent/mobile ios
```

运行检查：

```bash
pnpm typecheck
pnpm test
```

## 当前 MVP 纵切

当前版本使用确定性的 mock Agent workflows。目标是先验证产品流程与接口契约，再接入真实 Vercel AI Gateway 和 Mastra 模型调用。
