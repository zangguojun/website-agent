# 真实 Mastra Agent + Next.js API + 分阶段 SSE 集成设计

| 字段 | 值 |
| --- | --- |
| 项目 | Knowledge Test — Expo iOS App + `@website-agent/api` |
| 日期 | 2026-05-07 |
| 状态 | 设计已定稿（待实现计划） |
| 触发 | 替换当前澄清 / 计划 / 出题 / 报告链路的 mock；第一期全链路接真 Mastra |

## 1. 目标与非目标

### 1.1 目标

- 第一期将 **澄清（流式）→ 测试计划 → 出题 → 机械判分答题 → 报告（流式）** 全部接到 **真实 Mastra workflow**，由 Next.js App Router Route Handler **同源 SSE** 输出。
- **身份**：未登录 **`device:<uuid>`**，已登录 **`clerk:<sub>`**，由 §2 规则唯一确定会话归属。
- **持久化**：**偏细粒度** — 对用户可见的对话行、结构化 agent 步骤、可选流式 checkpoint 写入 Neon。
- **安全**：登录态 **仅承认经服务端校验的 Clerk JWT**，不信任客户端自拟的 Clerk user id header。

### 1.2 非目标（本 spec 不写死实现细节的部分）

- 具体 Prompt / tool 契约与 Mastra Agent 图谱（在实现计划中结合现有 `packages/core` schema 细化）。
- 生产环境确切的 `maxDuration`、Region；仅要求「可按阶段单独配置」。
- 完美的全局 SSE Last-Event-ID 续传；**首期以 REST 快照兜底**（见 §3.3）。

## 2. 已定决策摘要

| 主题 | 选择 |
| --- | --- |
| 交付范围 | 第一期三块全接真 Agent（澄清、计划、出题、报告） |
| 身份模型 | 双轨：匿名 device + 登录 Clerk |
| Clerk 认定 | 仅 `Authorization: Bearer <JWT>` + 服务端校验 → `clerk:<sub>` |
| 落库粒度 | 偏细：可见消息 + 结构化步骤 + 可选 checkpoint（可节流） |
| Mastra 部署 | 全在 Next.js App Router，同进程 Route Handler + SSE |
| 流式形态 | **做法 1**：**按阶段拆分 SSE 路由**（非单连接多路复用） |

## 3. 系统边界（§1）

- **Expo 客户端**：仅与配置的 API 源通信；生产 **HTTPS**；SSE 与 REST 同源（或同 API 基址）。
- **Next.js（`apps/api`）**：
  - **REST**：会话生命周期、历史拉取、答题提交、**状态快照**（hydrate / 断线恢复兜底）。
  - **SSE Route Handlers**：各阶段 Mastra streaming；写 Neon；可选 **Upstash Redis**（限流、短时锁、幂等键等，与现有架构对齐时启用）。
- **Mastra**：与 Next 同进程；workflow 按阶段划分（§6）；输出映射到持久化与 SSE 信封（§5、§6）。
- **Neon + Drizzle**：权威存储；断线后优先用 **REST 快照** + 重新进入下一阶段 SSE。

## 4. 鉴权与 OwnerId（§2）

### 4.1 解析顺序

对每个需识别主体的请求（含 SSE 的 `GET`）：

1. 若存在 **`Authorization: Bearer <token>`**：使用 **Clerk 官方服务端能力**（JWKS 或 SDK）校验 JWT；成功后 `ownerId = clerk:${sub}`。
2. 否则：要求 **`x-device-id`**，经与 `@website-agent/core` 一致的格式校验后 `ownerId = device:${id}`。
3. 若两者均无法得到合法 `ownerId` → **401**，错误体与移动端展示文案在实现计划中固定枚举。

**禁止**：生产路径下根据裸 `x-clerk-user-id` 等 header 信任登录身份。

### 4.2 会话归属不变性

- 会话创建时写入 `ownerId`，**全生命周期不可变**。
- 若后续请求与创建时 `ownerId` 不一致（例如由 device 变为 clerk 或相反）→ **403 或 409**（实现计划二选一并全仓一致），**不提供**隐式账号合并。

## 5. 持久化与 SSE 事件模型（§3）

### 5.1 逻辑表 / 实体（Drizzle 实现时命名可微调，语义不变）

1. **`session_messages`**（用户与 Agent **可见**气泡粒度）  
   - 建议字段：`id`, `session_id`, `owner_id`（冗余，便于校验与列表过滤）, `phase`（`clarify` \| `plan` \| `questions` \| `report`）, `role`（`user` \| `assistant` \| `system`）, `content`（短文本或摘要）, `payload`（JSON：选项、槽位、引用 id 等）。

2. **`agent_steps`**（管线 / 工具 / 校验等 **结构化** 事件）  
   - 建议字段：`session_id`, `owner_id`, `phase`, `step_type`（如 `tool_start`, `tool_result`, `schema_validated`, `llm_finish`）, `payload` JSON, **`sequence` BIGINT** 在 **会话维度全局单调递增**（便于对账与重放顺序）。

3. **`stream_checkpoints`**（可选；**首期可节流**）  
   - 建议字段：`session_id`, `phase`, `stream_cursor`（版本或自增）, `summary`（截断占位或哈希摘要）, `client_visible_seq`（与已确认对客户端可见的最后一步对齐）, 可选 `expires_at`。  
   - 写入策略必须在实现计划中写明默认 **N 字符或时间间隔** 上限，避免写放大。

**索引**：`(session_id, sequence)`；`(session_id, phase)`。

### 5.2 SSE 信封约定

- 使用 **命名 `event:` + 单行 JSON** `data:`，避免未转义多行正文破坏 SSE 帧解析。
- JSON 根建议包含：`v`（协议版本，首期 `1`）, `seq`（与 `agent_steps.sequence` 对齐或派生规则在实现计划中钉死）, `phase`, `kind`, 及负载字段。

**各阶段 `kind` 子集（示例，可扩展）**：

- `clarify`：`assistant_delta`, `assistant_message`, `user_echo`, `clarify_done`。
- `plan`：`plan_partial`, `plan_final`, `plan_done`。
- `questions`：`question_stub`, `question_final`, `questions_done`。
- `report`：`report_delta`, `report_sections`, `report_done`。
- 共通：`error`（分可恢复 / 不可恢复）, `heartbeat`（可选）。

### 5.3 顺序与一致性

- **规则**：对客户端可见的确定性结论，**`sequence` / 落库顺序与 SSE `seq` 单调一致**；具体「先写库后发 SSE」或同一事务边界在实现计划中选定，避免客户端已见而 DB 无记录。

### 5.4 断线与重连（首期 MVP）

- **不强制**实现标准 `Last-Event-ID` 全量续传。
- **必须**提供 **`GET /api/sessions/:id/state`**（§6.1）返回：当前 `phase`/`status`、最近 `session_messages` 摘要、最新 `stream_checkpoints`（若有）。
- 客户端：**REST 快照 hydrate** → 再开 **当前允许阶段的 SSE**。

## 6. API 与 Mastra 分界（§4）

### 6.1 REST（非流）

- `POST /api/sessions`  
  - Body：`{ topic: string }`（与现移动客户端对齐）。  
  - 创建 `sessions` 记录，`ownerId` 来自 §4.1；返回 `session`。
- `GET /api/sessions/:id`  
  - 元数据 + `phase` + `status`。
- `GET /api/sessions/:id/messages`  
  - 分页 `session_messages`（进入澄清/报告等页前 hydrate）。
- `GET /api/sessions/:id/state`  
  - 聚合快照（§5.4）。
- `POST /api/sessions/:id/answers`（或沿用现有路径）  
  - **机械判分**；逻辑在 `@website-agent/core`，与 LLM 解耦。

（会话列表、Redis 限流等延续现有产品决策，本 spec 不重复展开。）

### 6.2 SSE（分阶段，做法 1）

路径示例（实现计划可微调命名，保持「一阶段一路由」）：

- `GET /api/sessions/:id/stream/clarify`
- `GET /api/sessions/:id/stream/plan`
- `GET /api/sessions/:id/stream/questions`
- `GET /api/sessions/:id/stream/report`

**约束**：

- **鉴权**同 §4.1；SSE 须携带与 REST 相同的 Bearer 或 `x-device-id`（RN 若无法为 EventSource 加 header，**仅开发环境**可用 query 兜底，**生产禁止**，须在实现计划中明确摘除路径）。
- **阶段门禁**：依据 `sessions.status` / `phase` 枚举；若在错误阶段开启流 → **409** JSON 响应（**非** SSE body），客户端解析后提示。
- **运行时**：各路由 `runtime = 'nodejs'`；`maxDuration` **按阶段分别**配置。

**Workflow 映射（首期四门）**：`Clarify` → `Plan` → `Questions` → `Report`。  
Plan 的输出为 **结构化 JSON**，与移动端「测试预览 / PlanCard」契约一致：**必须落库**，且可通过 SSE `plan_final` 投递；移动端应以 **REST 可读快照** 为主数据源，SSE 为辅。

### 6.3 错误语义

- 流中错误：SSE `kind: error` + 可恢复标志；必要时更新 `sessions.status`。
- 不可恢复：`sessions` 标记失败终端态；客户端跳转错误页或在实现计划中定义。

## 7. 移动端（§5）

- **匿名**：`expo-secure-store` device id → `x-device-id`。
- **登录**：Clerk Expo 取得 **可校验 JWT**，所有 REST/SSE 请求附加 `Authorization: Bearer …`。
- **SSE**：使用 **支持自定义 Header 的 EventSource 实现或等价 polyfill**；生产禁止使用裸 query token。
- **替换 mock**：主路径数据来自 REST hydrate + 分阶段 SSE；`mock-session` 仅限 `__DEV__` 离线演示或移除（实现计划择优）。
- **TanStack Query**：`session` / `messages` / `state` 以 `sessionId` + `ownerId`（或等价键）分区；收到各阶段 `*_done` 事件后 **invalidate** 相关 query。

## 8. 测试策略（§5）

- **API 集成测试**：对 `POST` / `GET` / SSE **注入 Mastra mock LLM**（固定输出），断言 **DB 行**、**`sequence` 单调**、**`owner_id` 隔离**。
- **契约测试**：SSE JSON 与移动端解析结构 **fixture** 对齐。
- **E2E（Maestro）**：仅冒烟；不稳态依赖禁用真实 LLM。

## 9. Spec 自检

- **占位符**：无 TBD/TODO。
- **一致性**：身份、SSE 分段、四门 workflow、三张持久化语义与历次评审一致。
- **范围**：单 spec 覆盖第一期全链路集成；Prompt/Mastra 图谱细节留给实现计划。
- **歧义**：Clerk SSE 在无 header 环境下的 **生产禁令**已写明；快照兜底与序列入库规则收口在 §5.3–§5.4。

## 10. 后续步骤

1. **实现计划**：使用 **`writing-plans`** 产出分任务实现计划（含 Drizzle migration、路由清单、移动端替换路径、mock LLM 测试钩）。
2. **本 spec 审阅**：实现前需 **再次通读**本文与依赖的 `2026-05-06-dynamic-agent-ios-ui-design.md` 是否冲突；若有冲突以 **本文（数据面与 API 面）** 为准并更新 UI spec 引用。
