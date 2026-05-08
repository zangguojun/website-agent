# 真实 Mastra + 分阶段 SSE 实现计划

> **Agent 工作者说明：** 建议配合 `superpowers:subagent-driven-development`（或 `executing-plans`）按任务顺序实现。步骤统一使用 `- [ ]` 复选框以便跟踪进度。  
> **设计依据：** [`docs/superpowers/specs/2026-05-07-real-agent-mastra-sse-design.md`](../specs/2026-05-07-real-agent-mastra-sse-design.md)（已实现且已评审通过）。

---

## 总目标与架构摘要

**目标：** 按设计 spec 第一期交付，将 **澄清 / 测试计划 / 出题 / 报告** 四门 Mastra workflow 挂在 Next.js **Node runtime** Route Handler 上，通过 **四条独立 SSE** 下发；Neon **细粒度持久化**（可见消息 + `agent_steps` + 节流 checkpoint）；Clerk **`Authorization: Bearer` JWT** 服务端校验后与匿名 **device id** 双轨 `OwnerId`。

**关键点：**

- 替换当前 `sessions.repo.ts` **内存会话**为主路径的 **Drizzle + Neon**，并与设计中的 **`session_messages` / `agent_steps` / `stream_checkpoints`** 对齐。
- `owner-id`：**生产禁止**仅靠 `x-clerk-user-id`；Clerk 用户必须 **JWT 校验**后再 `toClerkOwnerId(sub)`。
- **阶段门禁：** 错的 `workflow_phase`/状态开 SSE → **409** JSON（非 SSE 帧）。
- **归属冲突：** 已存在会话的 `owner_id` 与请求解析出的 `ownerId` 不一致 → 统一 **`403 Forbidden`**（全仓一处封装，勿混用 401）。
- SSE：**命名 event + 单行 JSON**；与服务端 **`sequence` 单调**规则在写入层单点实现。
- Mobile：**REST 快照 hydrate**（`GET .../state`）+ 分段 **SSE**；生产 **禁止** query 传 JWT（仅 **`__DEV__`** 可作逃生阀，须在代码中加 `NODE_ENV`/Expo profile 断言）。

---

## 建议文件拓扑（可调，实现时钉死）

### 新建（API）

| 路径 | 职责 |
| --- | --- |
| `apps/api/src/auth/clerk-verify.ts` | Clerk JWT 校验（`@clerk/backend` 或官方推荐 SSR API），导出 `verifyBearerOrThrow` → `sub` |
| `apps/api/src/auth/resolve-owner.ts` | 组合 Bearer + device：**解析 `OwnerId`**，401/错误体枚举 |
| `apps/api/src/auth/session-owner-guard.ts` | `assertSessionOwned(sessionRow, ownerId)` → `403`，供 REST/SSE 复用 |
| `apps/api/src/db/schema.ts`（扩展） | 增加 `session_messages`、`agent_steps`、`stream_checkpoints`；扩展 `sessions` 字段 |
| `apps/api/drizzle/*` | 迁移 SQL（或 drizzle-kit generate） |
| `apps/api/src/db/repositories/messages.repo.ts` | message CRUD / 分页 |
| `apps/api/src/db/repositories/agent-steps.repo.ts` | **`nextSequence`** 事务、`appendStep`、`listForSession` |
| `apps/api/src/db/repositories/checkpoints.repo.ts` | **节流写入**策略（常量：如≥2s 或≥512 字符概要一次） |
| `apps/api/src/sse/format.ts` | `encodeSse(eventName, payloadObj)` → `Uint8Array`/`string` chunks |
| `apps/api/src/mastra/**` | 四门 workflow + 共用「假 LLM」测试适配器钩子 |
| `apps/api/src/app/api/sessions/[id]/messages/route.ts` | `GET` 分页消息 |
| `apps/api/src/app/api/sessions/[id]/state/route.ts` | `GET` 聚合快照 |
| `apps/api/src/app/api/sessions/[id]/stream/clarify/route.ts` | `GET` SSE |
| （同理 `.../plan|questions|report/route.ts`） | 四门 SSE |

### 新建或修改（Mobile）

| 路径 | 职责 |
| --- | --- |
| `apps/mobile/src/api/sse-client.ts` | RN 可用的 **Streaming fetch**（`react-native-fetch-api`/`exponential`/`eventsource-parser` 等择一）；**Bearer + x-device-id** |
| `apps/mobile/src/session/server-sync.ts`（或等价） | `hydrateFromState`、`applySseEnvelope` reducer |
| 各 `apps/mobile/app/session/[id]/*.tsx` | 移除主路径 mock，对接 REST/SSE |

### 可选（Packages）

| 路径 | 职责 |
| --- | --- |
| `packages/core/src/sse-events.ts` | SSE JSON `kind`/`v`/`phase` 的 **Zod schema**（API 与 App 共用，减少分叉） |

---

## 环境与依赖命令（占位，版本以 Expo/Next/Mastra 当时文档为准）

```bash
# API：Clerk + Mastra +（如需要）streaming 助手
pnpm --filter @website-agent/api add @clerk/backend @mastra/core
# Mastra LLM Driver（DeepSeek/OpenAI-compatible 等）：按选型再 add

# Mobile：SSE / stream（选型其一，实现时敲定）
pnpm --filter @website-agent/mobile add react-native-fetch-api react-native-eventsource-parser
# 或替代方案须在 PR 描述写明原因
```

本地环境：`DATABASE_URL`、`CLERK_SECRET_KEY`/`CLERK_PUBLISHABLE_KEY`（校验 JWT 所需，按 Clerk 后端文档）、已有 `UPSTASH_*` 按需接限流。

---

## Phase 常量与阶段门禁（实现时写入单模块）

建议在 `apps/api/src/session-phase.ts` 定义：

```ts
export const WORKFLOW_PHASES = [
  "clarify",
  "plan",
  "questions",
  "report",
  "done",
] as const;
```

门禁表（示意，实现计划中代码化）：

| 允许打开的 SSE | 会话 `sessions.workflowPhase`（或等价） |
| --- | --- |
| `/stream/clarify` | `clarify`（新建后默认） |
| `/stream/plan` | `plan_pending` …（实现钉枚举） |

**要求在 PR 自检：** 四门路由各至少一个 **409** 用例。

---

### Task A：数据库 schema 与迁移

**产出：** Drizzle schema + `drizzle-kit generate`/`migrate`，Neon 可应用。

**`sessions` 扩展建议字段：** `workflow_phase`（text）、`last_sequence`（bigint，默认 0）、`updated_at`。保留现有 `status` 字段时可做映射表（旧值 → 新 phase），避免移动端大面积断裂。

**新表：**

1. **`session_messages`**：`id` uuid PK，`session_id` FK cascade，`owner_id` text not null，`phase` text，`role` text，`content` text，`payload` jsonb，`created_at` timestamptz。索引 `(session_id, created_at)`。
2. **`agent_steps`**：`id` bigint serial 或 uuid；`session_id` FK；`owner_id`；`phase`；`step_type` text；`payload` jsonb；**`sequence` bigint NOT NULL UNIQUE (session_scoped)** — 建议使用 **部分唯一**：`(session_id, sequence)` unique；` BIGINT`。
3. **`stream_checkpoints`**：`session_id`；`phase`；`stream_cursor` bigint；`summary` text；`client_visible_seq` bigint；`created_at`。

- [ ] **Step A1：** 在 `schema.ts` 定义上表与外键，`sessions.last_sequence` 与 `agent_steps.sequence` 的递增规则写明注释。  
- [ ] **Step A2：** 生成迁移；在 CI/本地脚本 `pnpm --filter @website-agent/api drizzle-kit migrate`（或项目已有命令）验证。  
- [ ] **Step A3：** `pnpm --filter @website-agent/api typecheck` 通过。

**验证命令：**

```bash
pnpm --filter @website-agent/api typecheck
pnpm --filter @website-agent/api test
```

---

### Task B：`ownerId` 解析（Clerk JWT + device）与会话归属

**修改：** 删除/弃用生产路径对 `x-clerk-user-id` 的信任；`owner-id.ts` 改为委托 `resolve-owner.ts`。

- [ ] **Step B1：** 实现 `verifyBearerOrThrow`：无/非法 token → 401，body `{ error: '...' }` 枚举化。  
- [ ] **Step B2：** `resolveOwnerId(Request)`：  
  1) 有 `Authorization: Bearer` → Clerk → `clerk:sub`  
  2) 否则 `x-device-id` → `device:id`  
  3) 否则 401。  
- [ ] **Step B3：** `assertSessionOwner(row, ownerId)`：不一致 → **403**。  
- [ ] **Step B4：** 单元测试：缺 header、错 JWT、仅 device、Clerk 成功（mock `verifyToken`）。

**验证命令：**

```bash
pnpm --filter @website-agent/api test
```

---

### Task C：序列号与写入事务（`agent_steps` + SSE `seq`）

**要求：** `appendStep` 在 **单事务**内：`SELECT last_sequence FOR UPDATE` → `next = last+1` → insert step → update `sessions.last_sequence` → 返回 `next` 供 SSE 使用。

- [ ] **Step C1：** `agent-steps.repo.ts` 实现上述事务（Neon serverless 兼容模式：单连接或 `sql.begin` 按 Drizzle 文档）。  
- [ ] **Step C2：** `session_messages` 写入不强制与 sequence 一一对应，但若某类消息代表「可见结论」，在 payload 里带 `sequence` 引用。  
- [ ] **Step C3：** 集成测试：并发两个 `appendStep` 仍单调无重复。

**验证命令：**

```bash
pnpm --filter @website-agent/api test
```

---

### Task D：从内存 `sessions.repo` 迁到 Drizzle

- [ ] **Step D1：** `createSession` / `getSessionForOwner` / `listSessionsForOwner` 改为查询 `sessions` 表。  
- [ ] **Step D2：** `POST /api/sessions` 行为不变（201 + `{ session }`），但持久化。  
- [ ] **Step D3：** 删除或保留 `inMemorySessions` **仅测试**（若保留须 `NODE_ENV==='test'` 注入，避免生产误用）。推荐 **完全移除** 内存实现，测试用 PG testcontainer 或 Neon branch（实现者择一并在 PR 说明）。

**验证命令：**

```bash
pnpm --filter @website-agent/api typecheck
pnpm --filter @website-agent/api test
```

---

### Task E：REST — `GET /sessions/:id`、`GET .../messages`、`GET .../state`

- [ ] **Step E1：** `GET /api/sessions/[id]`：404 无此 id；403 非 owner；返回 `workflow_phase`、`status`、`rawTopic` 等。  
- [ ] **Step E2：** `GET /api/sessions/[id]/messages?cursor=`：按 `created_at` 分页。  
- [ ] **Step E3：** `GET /api/sessions/[id]/state`：拼：最近 N 条 `session_messages`、最新 checkpoint、`workflow_phase`。  
- [ ] **Step E4：** Vitest 集成测试（内存 DB 或 mock DB 层）：owner 隔离。

**验证命令：**

```bash
pnpm --filter @website-agent/api test
```

---

### Task F：Mastra 四门 workflow（先接「假 LLM」再换真模型）

- [ ] **Step F1：** 在 `apps/api/src/mastra` 注册 **Clarify / Plan / Questions / Report** workflow，输出 **结构化 Zod**（与 `packages/core` 已有题型、维度类型对齐）。  
- [ ] **Step F2：** 提供 **`MockLanguageModel`**（或 Mastra 官方 test double），使 CI **无 API key** 可跑。  
- [ ] **Step F3：** 每 workflow 结束：写 `session_messages`（assistant 最终可见摘要）+ 更新 `sessions.workflow_phase` 下一状态。  
- [ ] **Step F4：** 真模型接入：环境变量 `DEEPSEEK_API_KEY` 等，**失败**走 SSE `kind:error` + `sessions` 终端态（spec §6.3）。

**验证命令：**

```bash
pnpm --filter @website-agent/api test
pnpm --filter @website-agent/api build
```

---

### Task G：SSE 四路由（共享 helper）

- [ ] **Step G1：** `createSseResponse(request, sessionId, phase, run)`：返回 `Response` with `ReadableStream`，`Content-Type: text/event-stream`，`Cache-Control: no-cache`，适当 `Connection`/`X-Accel-Buffering`（若部署 Vercel 按平台文档）。  
- [ ] **Step G2：** 每阶段入口：`resolveOwnerId` → 取 session → `assertSessionOwner` → **阶段门禁** → 启动 workflow stream；循环中：  
  - `appendStep` → 拿 `seq` → `encodeSse` → `controller.enqueue`  
  - 对用户可见 token：`session_messages` 策略（delta 可只发 SSE，周期 fsync 到 messages 表，规则在 PR 写清以降低写放大）。  
- [ ] **Step G3：** **`runtime = 'nodejs'`** 与各文件 `maxDuration` 占位（注释建议值）。  
- [ ] **Step G4：** 集成测试：用 `fetch` 读 SSE 直到 `*_done`，断言 **DB sequence 单调**、`session_messages` 行数下限。

**验证命令：**

```bash
pnpm --filter @website-agent/api test
```

---

### Task H：`stream_checkpoints` 节流实现

- [ ] **Step H1：** 在 SSE 写入循环中加 **时间+字数**双阈；超阈才 insert。  
- [ ] **Step H2：** 测试：快速流 100 条 delta，checkpoint 行数 ≤ 上限证明。

---

### Task I：移动端 — 替换 mock 主路径

- [ ] **Step I1：** `createSession` / `fetch` 统一 **`getAuthHeaders()`**：若无 Clerk 则无 Bearer；若有则注入。  
- [ ] **Step I2：** 实现 SSE 订阅 hook（建议在 `src/api/use-session-stream.ts`）：`state` hydrate → connect → reducer 更新 **TanStack Query** cache 或本地 `useReducer`。  
- [ ] **Step I3：** 澄清页：`POST /api/sessions/[id]/messages`（契约见 **`docs/superpowers/specs/2026-05-07-real-agent-mastra-sse-design.md` §6.1.1**）入库用户消息后，再连接 **`GET .../stream/clarify`** 拉取 Agent SSE；选择题与自由文本统一走同一 REST。  
      **修正默认方案（写死）：**  
      - 用户侧澄清选项/文本：**`POST /api/sessions/[id]/messages`** body `{ phase:'clarify', role:'user', content, payload }`。  
      - 服务端校验 phase 门禁后入库，再由客户端 **新开或复用** `GET .../stream/clarify` 触发本轮模型回复（或由 POST 异步触发队列——首期 **POST 返回后客户端立即连 SSE** 最简单）。  
- [ ] **Step I4：** `confirm` / `generate` / `answer` / `report` 屏幕按 `workflow_phase` 跳转；`generate` 可与 `plan` SSE 尾部或 `questions` 前置合并逻辑在 PR 讨论，**默认可保留独立 loading 屏连 `stream/questions`**。  
- [ ] **Step I5：** `pnpm --filter @website-agent/mobile typecheck && test`。

**验证命令：**

```bash
pnpm --filter @website-agent/mobile typecheck
pnpm --filter @website-agent/mobile test
```

---

### Task J：E2E 与文档

- [ ] **Step J1：** Maestro：**mock API 开关**（如 `EXPO_PUBLIC_E2E_MOCK=true`）或 **wire mock server**——避免 E2E 依赖真实 Mastra。**若短期内无法**：则 E2E 只测「离线 mock 构建」分支并文档声明。  
- [ ] **Step J2：** 更新 [`README.md`](../../README.md)：`CLERK` 后端 env、SSE 分段说明、局域网调试。  
- [ ] **Step J3：** 若 §6.1.1（`POST .../messages`）行为有示例 JSON，可同步到 **`README.md`**。

---

## 全仓验证清单（里程碑）

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @website-agent/api build
pnpm --filter @website-agent/mobile exec expo install --check
```

---

## 风险与待定项（实现时记入 PR）

1. **Neon Serverless + 交互式事务：** 若无 `FOR UPDATE`，需改用 **单行 `sessions` CAS 乐观锁** (`UPDATE ... WHERE last_sequence = ?`)。  
2. **SSE on Vercel：** 确认 **Edge 未误配**；仅用 **Node**。  
3. **RN SSE Header：** polyfill 选型的 **maintainer 活跃度**评估。  
4. **澄清双工：** 本计划在 spec 增补 **`POST .../messages`**（§6.1.1），与 SSE 分段策略兼容。

---

## Self-Review（计划发布前自检）

| 检查项 | 状态 |
| --- | --- |
| 可追溯至正式 spec | ✅ |
| 任务可分 PR / 可分 subagent | ✅ |
| 每任务有验证命令 | ✅ |
| 安全：Clerk JWT、403 归属 | ✅ |

---

**计划文件路径：** `docs/superpowers/plans/2026-05-07-real-agent-mastra-sse-implementation.md`

写入后：**提交 Git** → 可按团队习惯再 **`git push`**。
