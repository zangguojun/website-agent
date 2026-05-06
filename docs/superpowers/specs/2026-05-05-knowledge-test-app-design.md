# 知识自测 iOS App / 设计文档


| 字段   | 值                                             |
| ---- | --------------------------------------------- |
| 项目代号 | `website-agent`（仓库名沿用，产品形态为 iOS App）          |
| 文档作者 | Brainstorming session（Claude Opus 4.7 + 用户协作） |
| 创建日期 | 2026-05-05                                    |
| 状态   | 设计完成，待实现规划                                    |


---

## 1. 产品定位

**一句话**：用户输入任意"想学的知识点"，App 通过对话式澄清 + AI 出题 + 即时评分，快速给出"我对这个东西掌握到什么程度"的诊断报告。

**目标用户**：

- 想自学新技术/新学科但不知从何下手的好奇者
- 准备面试/考证/考研但缺乏即时反馈的学习者
- 任何"对某个概念似懂非懂、想客观验证一下"的人

**核心价值主张**：

- 比"自己回忆"更客观
- 比"做现成 quiz"更贴合自己关心的范围
- 比"找老师"更便宜、更快
- 5-15 分钟完成一次完整测试

**产品边界（明确不做）**：

- 不做"学习闭环"（不推送视频/课程/学习路径），用户自行决定后续学习路径
- 不做社交、不做实时多人答题
- 不做"专业证书认证"，仅供自我评估

---

## 2. 关键决策清单


| #   | 决策项      | 选择                                                        | 备选与理由                                        |
| --- | -------- | --------------------------------------------------------- | -------------------------------------------- |
| 1   | 平台       | Expo iOS（短期），Android / Web 移动端待定                          | 用户技术栈偏好；React Native Reusables 让跨端复用顺畅       |
| 2   | 技术栈      | Expo + React Native Reusables + NativeWind v4             | shadcn for RN，design system 一致性              |
| 3   | 后端       | Next.js on Vercel + Vercel Functions (Fluid Compute)      | 部署体验、AI Gateway、SSE 流式优势                     |
| 4   | 数据库      | Neon Postgres (Vercel Marketplace) + Drizzle ORM          | 类型安全、迁移友好、Serverless                         |
| 5   | 缓存/限流    | Upstash Redis (Vercel Marketplace) + `@upstash/ratelimit` | 同生态、KV 价格低                                   |
| 6   | Auth     | Clerk + Device-ID claim 模式                                | Vercel Marketplace first-party；MVP 阶段 TCO 最优 |
| 7   | 知识来源     | 用户自由输入主题，LLM 实时生成                                         | 最大灵活度，无需建知识库                                 |
| 8   | 题型       | 纯选择题（单选/多选/判断），机械判分                                       | 体验顺滑、零延迟评分、零成本                               |
| 9   | 题量       | LLM 决定 8-25 题（按主题广度自适应）                                   | 智能但有上限                                       |
| 10  | 报告形式     | 维度雷达图 + 错题解析 + 薄弱点 TOP3                                   | 信息密度合适                                       |
| 11  | 商业模式     | 免费版 3 次/日 + Pro 月/年订阅（¥18/月，¥168/年）+ 题包 IAP               | 阶段递进                                         |
| 12  | LLM      | 多供应商可切，默认 DeepSeek-V3，调用走 AI Gateway                      | 成本可控 + 质量可控                                  |
| 13  | Agent 框架 | Mastra + Vercel AI SDK                                    | 同生态、官方模板、社区案例齐全                              |
| 14  | 编排策略     | 受控 Agent（Pipeline 式），4 个 Mastra Workflow                  | 可预测、可调试、有 SLA                                |
| 15  | 用户数据隔离   | 应用层 3 层防御（TS 类型 + AsyncLocalStorage 软 RLS + 集成测试）         | MVP 阶段 RLS 投产比不划算                            |
| 16  | 本地化      | 中文 MVP，i18n 架构预留                                          | 后续按市场加                                       |
| 17  | 匿名 → 登录  | 匿名优先，登录后 `/api/auth/claim` 合并 device-id 数据                | 降低首次门槛                                       |
| 18  | 流式 UX    | 全部 LLM 调用走 SSE，App 端 `react-native-sse`                   | 感知延迟最优                                       |


---

## 3. 系统架构

### 3.1 整体拓扑

```
┌──────────────────────────────────────────────────────────┐
│                   Expo iOS App                           │
│  • Expo Router (file-based routing)                      │
│  • React Native Reusables + NativeWind v4                │
│  • TanStack Query (server state) + Zustand (UI state)    │
│  • i18next (i18n 预留)                                    │
│  • @clerk/clerk-expo (Auth)                              │
│  • expo-secure-store (device-id 持久化)                   │
└──────┬───────────────────────────────────────────────────┘
       │ HTTPS + SSE
       │ Header: Authorization: Bearer <Clerk JWT 或 Device-ID>
       ▼
┌──────────────────────────────────────────────────────────┐
│               Next.js on Vercel                          │
│  • App Router API Routes (Fluid Compute)                 │
│  • Auth Middleware (Clerk JWT → 已登录 / Device-ID → 匿名)│
│  • Mastra Workflows (Agent 层)                            │
│  • Drizzle ORM (类型安全 + 迁移)                          │
└──────┬───────────────────────────────────────────────────┘
       │
   ┌───┼────────────────┬─────────────────┬──────────────┐
   ▼   ▼                ▼                 ▼              ▼
┌──────────┐  ┌────────────────┐  ┌───────────────┐  ┌──────────┐
│  Neon    │  │ Upstash Redis  │  │ Vercel AI SDK │  │  Clerk   │
│ Postgres │  │ - rate limit   │  │ + AI Gateway  │  │  (用户)  │
│          │  │ - SSE backplane│  │ → DeepSeek    │  │          │
│ + 3 层   │  │ - session lock │  │   OpenAI / etc│  │          │
│   防御   │  └────────────────┘  └───────────────┘  └──────────┘
└──────────┘                              │
                                          ▼
                                   ┌──────────────┐
                                   │ LLM Providers│
                                   └──────────────┘
```

### 3.2 关键 API 端点


| 方法   | 路径                                 | 说明                        | 流式               |
| ---- | ---------------------------------- | ------------------------- | ---------------- |
| POST | `/api/sessions`                    | 创建会话（输入 topic）            | 否                |
| POST | `/api/sessions/:id/clarify`        | 触发澄清 Agent，获取下一题或完成信号     | SSE              |
| POST | `/api/sessions/:id/answer-clarify` | 提交澄清问题答案                  | 否                |
| POST | `/api/sessions/:id/start-test`     | 启动出题 Agent                | SSE（plan + 逐题流出） |
| POST | `/api/sessions/:id/answers`        | 提交单题作答                    | 否                |
| POST | `/api/sessions/:id/finalize`       | 触发评分 + 报告                 | SSE（报告流式生成）      |
| GET  | `/api/sessions/:id`                | 拉取会话详情（用于恢复）              | 否                |
| GET  | `/api/sessions/:id/report`         | 拉取已生成报告                   | 否                |
| POST | `/api/auth/claim`                  | 登录后绑定 device-id 数据        | 否                |
| GET  | `/api/me/sessions`                 | 我的历史                      | 否                |
| POST | `/api/billing/iap/verify`          | 验证 Apple IAP 凭据           | 否                |
| POST | `/api/billing/iap/notification`    | Apple Server-to-Server 通知 | 否                |
| GET  | `/share/:token`                    | 公开报告页（HTML，含 OG image）    | 否                |


### 3.3 owner_id 抽象（统一身份层）

```ts
type OwnerId = `device:${string}` | `clerk:${string}`;

// 中间件
async function authMiddleware(req): Promise<OwnerId> {
  const clerkAuth = await clerk.authenticateRequest(req);
  if (clerkAuth.userId) return `clerk:${clerkAuth.userId}`;
  
  const deviceId = req.headers.get('x-device-id');
  if (deviceId && isValidUuid(deviceId)) return `device:${deviceId}`;
  
  throw new UnauthorizedError();
}
```

DB 中所有用户数据用 `owner_id text` 字段，业务代码完全不区分匿名/登录。

---

## 4. 商业模式

### 4.1 单次测试成本（DeepSeek-V3 默认）


| 阶段                  | Token    | 成本             |
| ------------------- | -------- | -------------- |
| 澄清流水线（5 轮）          | ~10K     | ¥0.04          |
| PLAN（出题规划）          | ~1K      | ¥0.001         |
| GENERATE（5 维度并行）    | ~15K     | ¥0.015         |
| VALIDATE（批量校验）      | ~2K      | ¥0.002         |
| ENRICH（错题解析，假设 5 题） | ~5K      | ¥0.005         |
| REPORT（报告自然语言）      | ~2K      | ¥0.002         |
| **合计**              | **~35K** | **~¥0.06 / 次** |


### 4.2 商业策略三阶段

**阶段 1：验证期（0-1K MAU，全免费）**

- 全功能开放，限 3 次/日
- 目标：验证留存、PMF、收集"被反复测的主题"指导后续做精品题包
- 月成本估算：1K MAU × 30 次 × ¥0.06 = **¥1,800/月**（含 Vercel/Neon/Upstash/Clerk/LLM）

**阶段 2：变现期（1K-10K MAU）**


| 层级     | 价格                   | 内容                                |
| ------ | -------------------- | --------------------------------- |
| Free   | ¥0                   | 3 次/日，历史只存 30 天，DeepSeek 模型       |
| Pro 月订 | ¥18/月（国内）/ $2.99（海外） | 不限次数，永久历史，可选 GPT-4o/Claude，PDF 导出 |
| Pro 年订 | ¥168/年 / $24.99      | 同上，省 ¥48                          |
| 题包 IAP | ¥6 – ¥30 一次性         | 精品场景：AWS 认证、考研政治、TOEFL 词根等        |


**阶段 3：放大期（10K+ MAU）**

- Pro+ 层级：BYOK 解锁顶级模型 + 团队共享报告
- B2B：教育机构企业版 + SSO
- API 开放给其他 EdTech

### 4.3 成本对冲


| 风险           | 对冲                                        |
| ------------ | ----------------------------------------- |
| LLM 涨价       | AI Gateway 多 provider 路由                  |
| Apple 30% 抽成 | Apple Small Business Program 降至 15%；引导年订阅 |
| 用户刷免费额度      | Device-ID + Clerk 多账号检测；可疑行为降级到 1 次/日     |
| LLM 输出质量波动   | 报告页"反馈"按钮收集差评样本持续迭代 prompt                |


---

## 5. Agent 系统

### 5.1 Agent 定义与原则

我们用**受控 Agent**（Pipeline 式），不用自主 Agent。


| 维度   | 受控（采用）       | 自主（未采用） |
| ---- | ------------ | ------- |
| 决策权  | 步骤顺序代码定      | LLM 自决  |
| 可预测性 | 高            | 低       |
| 调试难度 | 低            | 高       |
| 适合   | 业务流程清晰 + SLA | 探索性任务   |


**编排框架**：Mastra（基于 Vercel AI SDK），用 Workflow + Step + Evals。

### 5.2 4 个 Workflow 总览


| #   | Workflow            | 触发时机      | 步骤数                | 总延迟               | 总成本    |
| --- | ------------------- | --------- | ------------------ | ----------------- | ------ |
| 0   | Topic Validate      | 用户提交主题    | 1                  | <1s               | ¥0.001 |
| 1   | Clarification       | 每次澄清回合    | 4                  | 3-5s              | ¥0.008 |
| 2   | Question Generation | 澄清完成进入答题前 | 5（含并行）             | 流式首题 <3s，全完成 ~10s | ¥0.018 |
| 3   | Report Generation   | 答完提交      | 2（ENRICH + REPORT） | 8-15s             | ¥0.007 |


### 5.3 Workflow 1 / Clarification（4 步流水线）

```
            Step 1: ANALYZE (DeepSeek-V3)
            判断已收集了什么、还缺什么
            输出 (Zod):
              { collected: { scope, purpose, concepts,
                             background?, ... },
                topic_is_specific_enough: bool,
                has_concept_ambiguity: bool }
                     │
                     ▼
            Step 2: DECIDE (DeepSeek-V3)
            决定: 继续问 / 给概览 / 完成
            输出: { action: 'ask'|'overview'|'done',
                    if ask: { target_purpose, rationale }
                    if done: { refined_topic, summary } }
            规则:
              - 必须 A/C/E 都收集才能 done
              - turn ≥ 5 强制 done
              - confidence < 0.6 优先追问
                     │
        ┌────────────┴────────────┐
        │                         │
   action=ask                action=done
        │                         │
        ▼                         └─→ 写 sessions.clarification_summary
   Step 3: CRAFT (DeepSeek-V3)         返回 App "ready_to_test"
   生成具体问题(含选项)
   Few-shot: 3-5 个高质量参考
        │
        ▼
   Step 4: VALIDATE (DeepSeek-V3)
   自检 5 条规则:
     1. 选项非互斥/不重叠
     2. 问题清晰无歧义
     3. 相关到 topic
     4. 文化中性
     5. 选项数 2-6
   失败 → 携带 issues 重跑 Step 3 (最多 1 次)
        │
        ▼
   写 messages 表 → 返回 App
```

**澄清信息分类（LLM 自适应判断哪些必问、哪些可选）**：

- 必问（A/C/E）：缩小范围 / 明确目的 / 关键概念对齐
- 可选（B/D）：探听背景 / 领域概览（LLM 视主题特点决定）

**单回合成本**：~~¥0.008
**最多 5 回合**：~~¥0.04 上限

### 5.4 Workflow 2 / Question Generation（5 步含并行）

```
   Step 1: PLAN
   → 拆 dimensions(3-5个,雷达轴) + 决定题数 + 难度分布
   输出: { dimensions[], total_questions(8-25), 
          difficulty_dist: {easy:0.3, medium:0.5, hard:0.2} }
        │ (即刻 SSE 推 dimensions 给 App,显示"将测 5 维度")
        ▼
   Step 2: GENERATE (Promise.allSettled, 并行 N 维度)
   ┌──────────┬──────────┬──────────┐
   │  dim 1   │  dim 2   │  dim N   │
   │ stream   │ stream   │ stream   │
   │ Object   │ Object   │ Object   │
   └────┬─────┴────┬─────┴────┬─────┘
        │ 每出 1 题立即:
        │   1. db.insert(questions)
        │   2. SSE 推送 App
        ▼
   Step 3: VALIDATE (批量,所有题完后)
   - 跨题语义去重(embedding)
   - 难度分布检查
   - 不达标 → 重生该题或减题数
        │
        ▼
   Step 4: ENRICH (懒触发,提交答卷后才跑)
   - 仅对答错题生成解析(省 token)
        │
        ▼
   Step 5: 触发 Workflow 3 / Report
```

**首题感知延迟**：约 2-3 秒（任意 dimension 出第一题即可）
**全部生成完**：约 8-10 秒（并行优势）

### 5.5 Workflow 3 / Report Generation

```
   Step 1: ENRICH (Workflow 2 末尾已并行)
   → 错题逐题解析
        │
        ▼
   Step 2: REPORT (一次 streamObject)
   输入: 评分(机械算) + dimensions + wrong_questions + summary
   输出: {
     headline,
     overall_summary,
     dimension_insights[],
     weakness_top3[ {dim_id, why_weak, recommended_focus[],
                     suggested_resources_keywords[]} ],
     next_steps
   }
   流式输出 → 客户端边收边渲染
```

**为何不直接给学习资源 URL**：URL 易失效（LLM 幻觉重灾区）；产品定位"纯诊断"；只给关键词避免推荐质量责任。

### 5.6 评分逻辑（机械，不调 LLM）

```
for each question:
  is_correct = (user_answer == question.correct_answer)
  # 多选要数组完全匹配

per_dimension_score:
  for each dimension:
    score_d = sum(is_correct in dimension) / count(in dimension) * 100
    weight by question.difficulty:
      easy: 1.0,  medium: 1.5,  hard: 2.0

overall_score = weighted_avg(per_dimension_score, dimension.weight)

mastery_label = 
  90+: 精通
  70-89: 熟练
  50-69: 入门
  <50: 初学

weakness_top3 = sorted(dimensions, score asc).take(3)
                 .filter(score < 70)
```

### 5.7 共享代码结构

```
apps/api/src/mastra/
├── index.ts                  # Mastra 实例 + Telemetry
├── workflows/
│   ├── topic-validate.workflow.ts
│   ├── clarification.workflow.ts
│   ├── question-generation.workflow.ts
│   └── report.workflow.ts
├── steps/                    # 跨 workflow 复用
│   ├── llm-call.step.ts      # 包了 token 记账 + tracing
│   └── content-safety.step.ts
├── prompts/                  # 与 step 解耦,版本化
│   ├── analyze.v1.prompt.ts
│   └── ... (含 v2/v3 用于 A/B)
├── schemas/                  # Zod 输出契约
├── evals/                    # Mastra Evals
│   ├── golden/
│   │   ├── topics.json       # 50 个主题金标集
│   │   ├── clarification-rubrics.md
│   │   └── question-rubrics.md
│   └── runners/
└── tools/                    # 暂为空,留位
```

### 5.8 兜底策略链

```
LLM 调用失败 → AI Gateway 自动 failover 到备选 provider
       ↓ 还失败
单 step 重试 1 次
       ↓ 还失败
回退 fallback prompt (更简版)
       ↓ 还失败
硬编码兜底 (clarification: 3 题问卷; question: 5 题通用题包)
       ↓ 仍失败
用户友好错误提示 + 退款额度
```

---

## 6. 数据模型（Neon Postgres + Drizzle ORM）

### 6.1 表结构

```sql
-- 用户(Clerk 镜像 + 业务字段)
profiles (
  id              text PRIMARY KEY,         -- = clerk_user_id
  email           text,
  display_name    text,
  tier            text NOT NULL DEFAULT 'free',  -- free|pro|pro_plus
  pro_expires_at  timestamptz,
  preferred_lang  text DEFAULT 'zh',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
)

-- 测试会话(匿名/登录都用同一张表)
sessions (
  id                    uuid PRIMARY KEY,
  owner_id              text NOT NULL,        -- 'device:<uuid>' 或 'clerk:<id>'
  status                text NOT NULL,        -- input|clarifying|generating|answering|finalized|expired
  raw_topic             text NOT NULL,
  refined_topic         text,
  clarification_summary jsonb,
  dimensions            jsonb,                -- [{id, name, weight, target_count}]
  total_questions       int,
  llm_provider          text DEFAULT 'deepseek',
  llm_model             text,
  expires_at            timestamptz,          -- 24h 后过期
  finalized_at          timestamptz,
  created_at            timestamptz DEFAULT now(),
  
  INDEX (owner_id, created_at DESC),
  INDEX (status, expires_at)                  -- Cron 清理用
)

-- 澄清对话历史
messages (
  id              uuid PRIMARY KEY,
  session_id      uuid REFERENCES sessions(id) ON DELETE CASCADE,
  turn            int NOT NULL,
  role            text NOT NULL,              -- agent|user
  purpose         text,                       -- scope|purpose|concepts|background|overview
  content         jsonb NOT NULL,
  created_at      timestamptz DEFAULT now(),
  
  UNIQUE (session_id, turn, role)
)

-- 题目
questions (
  id              uuid PRIMARY KEY,
  session_id      uuid REFERENCES sessions(id) ON DELETE CASCADE,
  dimension_id    text NOT NULL,
  idx             int NOT NULL,
  type            text NOT NULL,              -- single|multi|truefalse
  body            text NOT NULL,
  options         jsonb NOT NULL,             -- [{id, label}]
  correct_answer  jsonb NOT NULL,             -- 'A' 或 ['A','C']
  difficulty      text NOT NULL,              -- easy|medium|hard
  explanation     text,                       -- ENRICH 后填充(仅答错才生成)
  retired         boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  
  UNIQUE (session_id, idx)
)

-- 答题记录
answers (
  id              uuid PRIMARY KEY,
  question_id     uuid REFERENCES questions(id) ON DELETE CASCADE,
  session_id      uuid NOT NULL,              -- 冗余加速
  user_answer     jsonb NOT NULL,
  is_correct      boolean NOT NULL,
  answered_at     timestamptz DEFAULT now(),
  
  UNIQUE (question_id)
)

-- 最终报告
reports (
  id              uuid PRIMARY KEY,
  session_id      uuid UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  owner_id        text NOT NULL,              -- 冗余加速
  overall_score   int NOT NULL,
  mastery_label   text NOT NULL,
  dimensions      jsonb NOT NULL,             -- [{id, name, score, comment}]
  weakness_top3   jsonb NOT NULL,
  headline        text NOT NULL,
  summary         text NOT NULL,
  next_steps      text,
  rating          int,                        -- 用户对报告打分 1-5
  rating_feedback text,
  shared_token    text UNIQUE,
  generated_at    timestamptz DEFAULT now(),
  
  INDEX (owner_id, generated_at DESC)
)

-- Agent 追踪
agent_traces (
  id              uuid PRIMARY KEY,
  session_id      uuid REFERENCES sessions(id) ON DELETE CASCADE,
  workflow        text NOT NULL,
  step            text NOT NULL,
  turn            int,
  input_summary   jsonb,
  output_summary  jsonb,
  latency_ms      int,
  tokens_in       int,
  tokens_out      int,
  cost_cents      int,
  llm_model       text,
  status          text NOT NULL,              -- ok|retry|fallback|error
  error_message   text,
  created_at      timestamptz DEFAULT now(),
  
  INDEX (session_id, workflow),
  INDEX (created_at DESC)
)

-- 订阅(阶段 2)
subscriptions (
  id                    uuid PRIMARY KEY,
  owner_id              text NOT NULL,        -- = clerk:<id>,匿名不能订阅
  product_id            text NOT NULL,        -- pro_monthly|pro_yearly
  apple_transaction_id  text UNIQUE,
  status                text NOT NULL,        -- active|expired|cancelled|grace
  starts_at             timestamptz NOT NULL,
  expires_at            timestamptz NOT NULL,
  raw_payload           jsonb,
  created_at            timestamptz DEFAULT now(),
  
  INDEX (owner_id, status)
)

-- 题包(阶段 2)
topic_packs (
  id              uuid PRIMARY KEY,
  slug            text UNIQUE,
  title           text,
  description     text,
  price_cents     int,
  apple_product_id text,
  cover_image_url text,
  questions_count int,
  active          boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
)

topic_pack_purchases (
  id                    uuid PRIMARY KEY,
  owner_id              text NOT NULL,
  pack_id               uuid REFERENCES topic_packs(id),
  apple_transaction_id  text UNIQUE,
  purchased_at          timestamptz DEFAULT now(),
  
  UNIQUE (owner_id, pack_id)
)
```

### 6.2 设计取舍

1. **owner_id 是 string，不是 FK** —— 因为可能是匿名 device 或 Clerk 用户，没有统一外键。代码层强校验格式
2. **不开 Postgres RLS** —— 用应用层 3 层防御替代（见 6.3）
3. **冗余字段（如 reports.owner_id）** —— 加速"我的报告列表"查询，避免必走 sessions JOIN
4. **dimensions/clarification_summary 用 JSONB** —— Schema 演进灵活
5. **agent_traces 单独表，存 summary 而非全量** —— 全量 prompt/output 由 Mastra Observability + AI Gateway logs 承担
6. **会话 24h TTL** —— Cron 每日清理 stale session

### 6.3 用户隔离 / 3 层防御（替代 RLS）

**Layer 1：TypeScript 编译期强制**

```ts
type OwnerId = `device:${string}` | `clerk:${string}`;
export async function getMySessions(ownerId: OwnerId, limit = 20) { ... }
// 调用方写不出不带 ownerId 的版本
```

**Layer 2：AsyncLocalStorage 软 RLS**

```ts
const requestContext = new AsyncLocalStorage<{ ownerId: OwnerId }>();

export function authMiddleware(handler) {
  return async (req) => {
    const ownerId = await resolveOwnerId(req);
    return requestContext.run({ ownerId }, () => handler(req));
  };
}

export function currentOwnerId(): OwnerId {
  const ctx = requestContext.getStore();
  if (!ctx) throw new Error('No owner context — auth middleware missing');
  return ctx.ownerId;
}
```

**Layer 3：集成测试强制**

- 每个 repo 函数有"user A 读不到 user B 数据"的测试
- CI 强制覆盖率 100%

### 6.4 Redis 键设计

```
ratelimit:{tier}:{owner_id}            → 滚动窗口计数(@upstash/ratelimit)
session_lock:{session_id}              → 防止同会话并发改状态(setNX, TTL 60s)
sse_resume:{session_id}:last_event_id  → SSE 断线恢复
agent_cache:{topic_hash}               → 同主题 PLAN 输出缓存 24h(可选)
```

### 6.5 Drizzle Schema 文件组织

```
apps/api/src/db/
├── schema/
│   ├── profiles.ts
│   ├── sessions.ts
│   ├── messages.ts
│   ├── questions.ts
│   ├── answers.ts
│   ├── reports.ts
│   ├── traces.ts
│   ├── billing.ts        # subscriptions + topic_pack_*
│   └── index.ts
├── migrations/           # drizzle-kit generate 生成
├── client.ts             # drizzle({connection: NEON_DATABASE_URL})
└── repositories/         # 业务查询封装
    ├── sessions.repo.ts
    └── ...
```

---

## 7. 前端 UI

### 7.1 设计系统


| 维度    | 选择                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------- |
| 基础组件  | React Native Reusables（Button, Card, Input, Dialog, Sheet, RadioGroup, Checkbox, Progress, Toast 全用） |
| 样式    | NativeWind v4                                                                                        |
| 色板（明） | 主色 `#0066FF`；强调 `#FF6B35`；中性 zinc 系；正确绿 `#10B981`；错误红 `#EF4444`                                      |
| 色板（暗） | 主色 `#3B82F6`；背景 `#0A0A0A`；卡片 `#171717`                                                               |
| 字体    | 中文 PingFang SC（系统）/ 英文 Inter                                                                         |
| 圆角    | 卡片 16px，按钮 12px，输入 10px                                                                              |
| 动效    | Reanimated 3 + Moti（spring）；按钮 haptic（expo-haptics）                                                  |
| 图表    | victory-native v40（雷达图）                                                                              |
| 键盘    | react-native-keyboard-controller                                                                     |
| 图标    | Lucide React Native                                                                                  |


### 7.2 路由结构（Expo Router）

```
app/
├── _layout.tsx                     # Root: ClerkProvider + Theme + i18n + QueryClient
├── (onboarding)/
│   └── index.tsx                   # 首次启动 3 屏引导
├── (tabs)/                         # Bottom tabs
│   ├── _layout.tsx
│   ├── index.tsx                   # 🏠 首页(新测试入口)
│   ├── history.tsx                 # 📚 历史
│   └── settings.tsx                # ⚙️ 设置
├── session/
│   └── [id]/
│       ├── _layout.tsx             # 会话内 Stack
│       ├── clarify.tsx             # 1. 澄清对话
│       ├── confirm.tsx             # 2. 测试预览/确认
│       ├── loading.tsx             # 3. 出题 Loading(transient)
│       ├── answer.tsx              # 4. 答题
│       └── report.tsx              # 5. 报告
├── share/
│   └── [token].tsx                 # 公开分享页(也是 Web)
├── pricing.tsx                     # 升级 Pro
├── packs/
│   ├── index.tsx                   # 题包商店(阶段2)
│   └── [id].tsx                    # 题包详情(阶段2)
├── settings/
│   ├── subscription.tsx            # 管理订阅(阶段2)
│   ├── export.tsx                  # 导出数据(隐私合规)
│   ├── appearance.tsx              # 主题/字号
│   ├── llm.tsx                     # LLM 选择(阶段2)
│   └── help.tsx                    # 帮助/反馈
└── (modals)/
    └── sign-in.tsx                 # Clerk 登录(modal sheet)
```

### 7.3 屏幕清单


| #   | 屏幕              | 路径                      | 阶段             |
| --- | --------------- | ----------------------- | -------------- |
| 1   | Onboarding 3 屏  | `(onboarding)/...`      | MVP            |
| 2   | 首页（Topic Input） | `(tabs)/index`          | MVP            |
| 3   | 历史（含空状态）        | `(tabs)/history`        | MVP            |
| 4   | 设置              | `(tabs)/settings`       | MVP            |
| 5   | 澄清对话            | `session/[id]/clarify`  | MVP            |
| 6   | 测试预览/确认         | `session/[id]/confirm`  | MVP            |
| 7   | 出题 Loading      | `session/[id]/loading`  | MVP            |
| 8   | 答题（单题）          | `session/[id]/answer`   | MVP            |
| 9   | 题目准备中           | inline state            | MVP            |
| 10  | 报告              | `session/[id]/report`   | MVP            |
| 11  | 公开分享页           | `share/[token]`（Web）    | MVP            |
| 12  | 登录 Sheet        | `(modals)/sign-in`      | MVP            |
| 13  | 升级 Pro Paywall  | `pricing` 或 modal       | 阶段 2           |
| 14  | 配额耗尽 Modal      | inline modal            | MVP（先显示"明天再来"） |
| 15  | 订阅成功            | inline                  | 阶段 2           |
| 16  | 错误页（统一模板）       | error boundary          | MVP            |
| 17  | 网络断开提示          | inline banner           | MVP            |
| 18  | 会话过期            | inline modal            | MVP            |
| 19  | 继续测试提示          | 首页 banner               | MVP            |
| 20  | 管理订阅            | `settings/subscription` | 阶段 2           |
| 21  | 导出数据            | `settings/export`       | 隐私合规必须         |
| 22  | 主题/字号           | `settings/appearance`   | MVP            |
| 23  | LLM 选择          | `settings/llm`          | 阶段 2           |
| 24  | 帮助/反馈           | `settings/help`         | MVP（先 mailto）  |
| 25  | 题包商店            | `packs/index`           | 阶段 2           |
| 26  | 题包详情            | `packs/[id]`            | 阶段 2           |


**MVP 必做**：1-12, 14, 16-19, 21, 22, 24（共 17 屏）
**阶段 2 增加**：13, 15, 20, 23, 25, 26

### 7.4 关键 UX 全局原则

1. **永远不让用户呆等没解释** —— 所有 LLM 调用都有 streaming 或骨架屏，绝不出现"白屏 5 秒"
2. **进度可见** —— 澄清进度条、答题进度条、生成中提示
3. **可中断、可恢复** —— 任何屏幕都能"退出"，回来还在
4. **错误友好** —— 无 alert 框，统一 Toast / 内嵌错误条
5. **Pro 提示克制** —— 仅在配额耗尽、看 30 天前历史等"摩擦点"出现
6. **iOS 原生感** —— Sheet/Alert 用 expo-router Modal Presentation，haptics + 弹簧动画
7. **暗色优先支持** —— 设计稿同时出明暗版

### 7.5 关键自定义组件


| 组件                | 来源             | 用途               |
| ----------------- | -------------- | ---------------- |
| `<TopicInput>`    | 自建             | 首页主输入框 + 推荐 chip |
| `<ChatBubble>`    | 自建 + RNR Card  | 澄清对话气泡           |
| `<QuestionCard>`  | 自建             | 答题选项卡            |
| `<RadarChart>`    | victory-native | 报告维度图            |
| `<ScoreBadge>`    | 自建             | 大分数 + 等级标签       |
| `<UpgradeSheet>`  | RNR Sheet + 自建 | 升级 Pro 弹窗        |
| `<ErrorToast>`    | RNR Toast      | 全局错误提示           |
| `<StreamingText>` | 自建             | 流式文本打字效果         |


---

## 8. 错误处理

### 8.1 错误分类与策略


| 类别           | 场景              | 用户感知       | 策略                                       |
| ------------ | --------------- | ---------- | ---------------------------------------- |
| LLM 调用失败     | 超时 / 5xx        | 不感知        | AI Gateway failover；3 次失败 → fallback     |
| LLM 输出异常     | JSON / Zod 校验失败 | 不感知        | 同 step 重试 1 次；再失败 → fallback prompt      |
| 澄清死循环        | Agent 不收敛       | 不感知        | 5 轮硬上限                                   |
| 出题质量差        | Validate 拒绝     | 略增 1-2 秒   | 该题重生成；3 次失败 → 该 dimension 减题或兜底库         |
| 总生成全失败       | 5 dimension 全挂  | 看到错误       | 通用 5 题题包兜底 + 标记降级                        |
| SSE 断        | 网络抖动            | 加载暂停       | 自动重连 + Last-Event-ID 续推                  |
| App 杀进程      | 切换 App          | 重开恢复       | 状态在 DB；首页"继续上次测试"                        |
| 会话过期         | 24h 未完成         | 看到提示       | "测试已过期"按钮"开始新测试"                         |
| 答题快过生成       | 用户手快            | 短暂 loading | 最多等 5 秒；超时插占位题或提前结束                      |
| 限流耗尽         | Free 用户用完       | 看到弹窗       | "明天再来 / 升级 Pro / 看视频"                    |
| 支付异常         | Apple IAP 取消/退款 | 自动降级       | Apple Server Notification → tier 改回 free |
| Clerk 验证失败   | JWT 过期          | 自动续        | clerk-expo 自动 refresh；连续失败 → 引导重登        |
| Device-ID 丢失 | App 数据被清        | 历史丢失       | 接受现实；提示"登录可永久保存"                         |
| LLM 输出有害内容   | 政治/不当           | 不感知        | Validate step 加内容审查；命中重生成                |
| 用户输入垃圾       | "asdfasdf"      | 友好提示       | Topic 预校验拒绝 + 给好例子                       |
| 同主题反复刷       | 用户行为            | 不感知        | 24h 内同 owner_id 同 topic 复用题库             |


### 8.2 客户端统一错误展示

3 类抽象：

1. **可重试型**（网络/瞬时 5xx）→ 全屏插画 + 「重试」+ 「联系客服」
2. **可降级型**（LLM 全挂、限流耗尽）→ 局部提示条 + 替代操作
3. **致命型**（账号被封等）→ 模态框引导

所有错误打到 Sentry，带 owner_id（脱敏）+ session_id 上下文。

### 8.3 监控告警


| 指标               | 阈值          | 渠道                   |
| ---------------- | ----------- | -------------------- |
| LLM 失败率          | > 5% / 5min | Sentry → Slack       |
| 单次会话成本           | > ¥0.5      | Vercel AI Gateway 告警 |
| 流式中断率            | > 10% / 1h  | Sentry               |
| 报告 NPS           | < 3.5 / 周均  | 周报邮件                 |
| Free 用户人均 LLM 成本 | > ¥1 / 月    | 月度 Review            |
| Neon 连接池占用       | > 80%       | Vercel monitoring    |


---

## 9. 测试与评估策略

### 9.1 测试金字塔

```
     ▲   E2E (Maestro)              ── 5-10 个核心用户路径
     |   ────────────────────
     |   Integration                 ── API + DB + Agent 联调
     |   ──────────────────────────
     |   Unit                        ── 纯函数,大头
     ▼
```

### 9.2 Unit 测试

- 覆盖率 80%+
- 重点：评分计算、Repository 层（含用户隔离）、Schemas（Zod）、Topic 校验、限流
- 工具：Vitest（API）+ Jest（App，Expo 默认）

### 9.3 Integration 测试

- 每个 API 端点 + 关键 Agent step
- DB：每个测试启动 Neon Branch（Vercel Marketplace 一键多分支）→ 隔离干净
- LLM 调用：用 Vercel AI SDK Mock Provider，断言 prompt 而非真实调用
- SSE 流：supertest + EventSource 客户端验证 event 顺序

### 9.4 Agent 评估（Mastra Evals）

```
apps/api/src/mastra/evals/
├── golden/
│   ├── topics.json              # 50 个主题(技术/人文/语言/职业/兴趣)
│   ├── clarification-rubrics.md # 人工评判标准
│   └── question-rubrics.md
├── runners/
│   ├── clarification.eval.ts
│   ├── question-gen.eval.ts
│   └── report.eval.ts
└── reports/                     # CI 产出归档
```

3 种评估方式：

1. **基于规则**（自动）：澄清问题数 ≤ 5、出题数 8-25、选项数 2-6、题目语义相似度 < 0.85
2. **LLM-as-Judge**（自动 + 抽样人工）：用 GPT-4/Claude 评判 DeepSeek 输出，1-5 分；人工复核 10%
3. **人工评**（每周 20 个）：团队成员实测打分

CI 集成：

- 每 PR 跑金标子集（10 题，<2 分钟）
- 每夜跑全量（50 题，约 15 分钟），结果发 Slack
- 任何 prompt 改动必须 attach eval 对比报告

### 9.5 E2E 测试（Maestro）

5-10 条核心路径：

1. 首次安装 → 输入主题 → 完成澄清 → 完成测试 → 看报告
2. 中途退出 → 重开 → 继续上次
3. 用完免费额度 → 看到升级弹窗
4. 匿名做完 1 次 → 登录 → 历史成功合并
5. 测试中网络断开 → 恢复后能续答
6. 升级 Pro → 选 GPT-4o → 出题成功
7. 报告分享 → 公共链接打开正常

### 9.6 性能与负载（上线前）

- LLM 调用 P99 < 15s
- API 端点（不含 LLM）P99 < 200ms
- SSE 首字节 < 1s
- 100 并发模拟会话不挂（k6 脚本）

### 9.7 灰度与发布

- TestFlight 内测 50 人 → 看 7 日留存
- App Store 上线后用 EAS Update 灰度 OTA：先 10% 用户，48 小时无异常 → 50% → 100%
- 后端 Vercel 用 Preview Deploy + Branch URL 做无风险预览

---

## 10. 借鉴的社区项目

### 10.1 直接对标项目（学习架构）


| 项目                                                                                     | 学什么                                                                      |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [GenCertQuiz](https://github.com/jishen027/GenCertQuiz)                                | 4-Agent 流水线（Researcher/Style Analyzer/Psychometrician/Critic）的 prompt 设计 |
| [QuizAI / agentic-quiz-generator](https://github.com/alfaarizi/agentic-quiz-generator) | 自主 Agent + 多语言 + 学习档案                                                    |
| [Adaptive Knowledge Graph](https://github.com/MysterionRise/adaptive-knowledge-graph)  | 生产级 KG-RAG + IRT/BKT 掌握度模型（Phase 2 升级参考）                                 |
| [PersonalExam](https://github.com/sribdcn/PersonalExam)                                | 中文场景 BKT + 知识点细粒度跟踪                                                      |
| [Quazar](https://github.com/zop-hacks/quazar)                                          | 多 Agent 拆分思路                                                             |


### 10.2 评估学理论（Phase 2 自适应升级）


| 项目                                                                                                           | 学什么                     |
| ------------------------------------------------------------------------------------------------------------ | ----------------------- |
| [ATLAS](https://github.com/Peiyu-Georgia-Li/ATLAS)                                                           | IRT + CAT 公式实现          |
| [LLM-Adaptive Quiz Biology](https://github.com/Sujitha1221/LLM-Based-Adaptive-Quiz-Platform-for-A-L-Biology) | IRT + RAG + FAISS 完整代码  |
| [KAQG](https://github.com/mfshiu/kaqg)                                                                       | 多 Agent + KG + 教育测量学严谨度 |


### 10.3 Mobile + Mastra 工程参考


| 项目                                                                                     | 学什么                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------- |
| [Linguamate AI Tutor](https://github.com/Shards-inc/Linguamate-ai-tutor)               | Production Expo App 工程结构、导航/同步策略            |
| [OliverMengich/ai-tutor](https://github.com/OliverMengich/ai-tutor)                    | Mastra + Expo + RAG + workflow + evals 完整范例 |
| [Mastra `template-pdf-questions](https://github.com/mastra-ai/template-pdf-questions)` | Mastra workflow + agent 官方写法                |
| [Expo AI Kit](https://github.com/laraelmas/expo-ai-kit)                                | 端侧推理（未来"离线题包"功能可借鉴）                         |


### 10.4 不 fork 的理由

1. 栈不匹配（多为 FastAPI/Python，我们是 Next.js + Vercel + Clerk + Neon）
2. 工程质量参差（多为 hackathon / 研究项目）
3. 产品定位差异（消费品 + 任意主题 + 对话式澄清，与"教材→题"或"题库+自适应"不同）
4. fork 综合症（初期省事，长期被锁住）

---

## 11. 实施路线图

### Phase 0 / 项目初始化（约 1 周）

- 仓库结构（Turborepo 或 pnpm workspaces）
- Expo 项目脚手架 + React Native Reusables 接入
- Next.js 项目脚手架 + Vercel 部署
- Vercel Marketplace 开通 Neon + Upstash + Clerk
- Drizzle 迁移基础表（profiles + sessions + messages + questions + answers + reports + agent_traces）
- 环境变量管理（vercel env pull）
- CI 基础（lint + typecheck + unit test）

### Phase 1 / MVP 后端核心（约 2 周）

- Auth 中间件（Clerk + Device-ID）+ owner_id 抽象 + 3 层防御
- Mastra 接入 + 4 个 Workflow 骨架
- Workflow 0 / Topic Validate
- Workflow 1 / Clarification（4 步 + Few-shot 示例 + Fallback）
- Workflow 2 / Question Generation（5 步 + 并行 + SSE）
- Workflow 3 / Report Generation
- 评分 + 报告 API
- Upstash 限流
- AI Gateway 配置 DeepSeek + GPT-4o + Claude 备选

### Phase 2 / MVP 前端核心（约 3 周）

- 首页 + 主题输入 + 推荐
- 澄清对话页（聊天卡片 + 进度条）
- 测试预览/确认
- 答题页（单题 + 流式准备 + haptic）
- 报告页（雷达图 + 错题解析 + 薄弱点）
- 历史页 + 空状态
- 设置页 + 主题/字号
- 错误处理（统一 Toast + 错误页）
- 可中断/可恢复机制

### Phase 3 / Auth + 数据持久化（约 1 周）

- Clerk Sign-In Sheet + Apple/Google/Email
- /api/auth/claim 端点（device-id → clerk:id 数据迁移事务）
- 历史合并 toast
- Onboarding 3 屏

### Phase 4 / 测试与上线（约 2 周）

- Mastra Evals 金标集 50 题
- 单测覆盖 80%+
- E2E 5-10 条路径（Maestro）
- 性能压测（k6）
- TestFlight 内测 50 人
- 反馈收集 + 调优 prompt
- App Store 上架（截图 + 描述 + 隐私政策）

### Phase 5 / 商业化（约 2 周，MVP 后）

- 订阅/题包数据模型 + 迁移
- StoreKit 2 接入 + Apple IAP 验证
- Apple Server-to-Server Notification
- Paywall 屏 + 升级流程
- 历史 30 天保留差异化
- 模型选择差异化

**MVP 预估总工时：约 8-9 周（单人全职）**

---

## 12. 不在本设计内的事项（明确边界）

- 学习路径推荐 / 课程推送
- 多人答题 / 社交分享
- 离线模式
- Web 端
- Android 端（短期）
- 实时语音/对话
- BYOK（用户自带 API Key）
- 自定义题库上传
- 教师/团队管理后台
- 阶段 3 的 B2B、API 开放、多 Agent 协作

这些都是有意义的扩展方向，但不在 MVP 范围内。

---

## 附录 A：术语表


| 术语            | 定义                                            |
| ------------- | --------------------------------------------- |
| owner_id      | 统一用户标识，格式为 `device:<uuid>` 或 `clerk:<userId>` |
| dimension     | 雷达图的一个轴，对应主题的一个子点                             |
| Workflow      | Mastra 的工作流（一组有序 Step 的编排）                    |
| Step          | Workflow 的最小单元，纯函数 + Zod schema 输入输出          |
| Mastery Label | 掌握度等级标签（初学/入门/熟练/精通）                          |
| Tier          | 用户付费层级（free / pro / pro_plus）                 |
| Claim         | 匿名用户登录后将 device-id 名下数据迁移到 clerk-id 的过程       |


