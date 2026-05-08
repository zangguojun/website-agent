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

配置移动端 API 地址（**真机 / 局域网调试时建议使用电脑局域网 IP**，例如 `http://192.168.1.10:3000`；勿在真机上仅用 `localhost`，那会指向手机本身）：

```bash
export EXPO_PUBLIC_API_BASE_URL="http://localhost:3000"
```

开发模式下若未设置 `EXPO_PUBLIC_API_BASE_URL`，会尝试根据 Metro / dev client 的 `hostUri` 自动拼出 `http://<同一主机>:3000`；生产构建**必须**设置该变量。

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

## API 环境与数据库

- `DATABASE_URL`：Neon / Postgres。未设置时在本地为**内存存储**（仅限开发/测试）。
- `CLERK_SECRET_KEY`：需要登录态 `Authorization: Bearer` 时配置；不设则仅匿名 `x-device-id`。
- Drizzle 迁移（在 `apps/api` 目录语义下执行，且需已导出 `DATABASE_URL`）：

```bash
pnpm --filter @website-agent/api db:generate
pnpm --filter @website-agent/api db:migrate
```

### 分段 SSE（Node）

- `GET /api/sessions/:id/stream/clarify | plan | questions | report`

澄清在仅跑完 SSE 后仍停留在 `workflow_phase: clarify`；用户需 `POST /api/sessions/:id/messages` 写入至少一条用户气泡，再：

`POST /api/sessions/:id/workflow/advance`，body：`{"target":"plan"}`，进入计划阶段。

### POST 澄清消息示例

```json
{
  "phase": "clarify",
  "role": "user",
  "content": "先测基础",
  "payload": { "source": "mobile" }
}
```

## 移动端

- **默认**：澄清 / 确认屏走真实 REST + SSE（需 API 可达）。
- **离线 mock UI**：`EXPO_PUBLIC_MOCK_AGENT=true`。

## 当前 MVP 纵切

API 仍为确定性 mock workflow（非 `@mastra/core`），但端到端可走通：会话、澄清 SSE、advance、计划 SSE、出题与报告 SSE。后续接入 Mastra / 真模型见 `docs/superpowers/plans/2026-05-07-real-agent-mastra-sse-implementation.md`。
