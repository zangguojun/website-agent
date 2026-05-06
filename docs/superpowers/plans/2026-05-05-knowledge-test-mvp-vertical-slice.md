# 知识自测 MVP 纵切实现计划

> **给 agentic workers：** REQUIRED SUB-SKILL：实现本计划时使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`。所有步骤均使用 checkbox (`- [ ]`) 语法，便于逐项执行和复核。

**目标：** 跑通第一条可验证的 MVP 流程：用户输入主题，完成一次澄清，进入答题，提交答案，并看到诊断报告。

**架构：** 使用 pnpm monorepo：`apps/mobile` 是 Expo iOS App，`apps/api` 是 Next.js API，`packages/core` 放共享类型、schema 和评分逻辑。第一阶段用确定性的 mock Agent workflows 替代真实 LLM，先验证 App、API、身份、SSE、评分与报告链路，再用后续计划接入真实 Mastra + Vercel AI Gateway。

**技术栈：** Expo、React Native Reusables、NativeWind、Expo Router、TanStack Query、Zustand、Next.js App Router、Drizzle ORM、Neon Postgres、Mastra、Vercel AI SDK、Vitest、Maestro。

---

## 范围

本计划实现：

- Monorepo 基础结构。
- API 服务骨架。
- 共享 `OwnerId`、schema 和评分函数。
- 匿名 `device:<uuid>` owner 身份模型。
- 最小数据库 schema 与 repository 边界。
- 可替换为真实 Mastra 的 mock workflow 接口。
- Session、澄清、出题、答题、报告 API。
- Expo MVP 页面：Onboarding、首页、澄清、确认、答题、报告、历史、设置。
- 评分单测、owner 隔离测试、API contract 测试、移动端 smoke E2E。

本计划不实现：

- 真实 AI Gateway 模型调用。
- 真实 Clerk 登录与 `/api/auth/claim`。
- Apple IAP、付费层级、题包系统。
- 生产部署与完整可观测性仪表盘。

---

## 文件结构

```text
website-agent/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .env.example
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── drizzle.config.ts
│   │   ├── src/app/api/
│   │   ├── src/auth/
│   │   ├── src/db/
│   │   ├── src/mastra/
│   │   └── src/sse/
│   └── mobile/
│       ├── package.json
│       ├── app.json
│       ├── app/
│       ├── src/
│       └── e2e/
└── packages/
    └── core/
        ├── package.json
        └── src/
```

---

## Task 1：初始化 Monorepo

**文件：**

- 创建：`package.json`
- 创建：`pnpm-workspace.yaml`
- 创建：`turbo.json`
- 创建：`tsconfig.base.json`
- 创建：`.gitignore`
- 创建：`.env.example`
- 创建：`packages/core/package.json`
- 创建：`packages/core/tsconfig.json`
- 创建：`packages/core/src/index.ts`
- **Step 1：创建根目录配置**

创建 `package.json`：

```json
{
  "name": "website-agent",
  "private": true,
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "latest"
  }
}
```

创建 `pnpm-workspace.yaml`：

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

创建 `turbo.json`：

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**", "build/**"] },
    "dev": { "cache": false, "persistent": true },
    "typecheck": { "dependsOn": ["^typecheck"], "outputs": [] },
    "test": { "dependsOn": ["^build"], "outputs": [] },
    "lint": { "outputs": [] }
  }
}
```

创建 `tsconfig.base.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true
  }
}
```

创建 `.gitignore`：

```gitignore
node_modules
.turbo
.next
dist
build
.expo
.env
.env.local
.env.*.local
coverage
*.log
```

创建 `.env.example`：

```bash
DATABASE_URL="postgres://user:password@host/db"
UPSTASH_REDIS_REST_URL="https://example.upstash.io"
UPSTASH_REDIS_REST_TOKEN="example"
CLERK_SECRET_KEY="sk_test_example"
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_example"
EXPO_PUBLIC_API_BASE_URL="http://localhost:3000"
AI_GATEWAY_API_KEY="example"
```

- **Step 2：创建 core package**

创建 `packages/core/package.json`：

```json
{
  "name": "@website-agent/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": { "zod": "latest" },
  "devDependencies": {
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

创建 `packages/core/tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src/**/*.ts"]
}
```

创建 `packages/core/src/index.ts`：

```ts
export * from './ids';
export * from './schemas';
export * from './scoring';
```

- **Step 3：安装依赖并验证**

运行：

```bash
pnpm install
pnpm typecheck
```

预期：依赖安装成功，`pnpm typecheck` 退出码为 0。

- **Step 4：提交**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore .env.example packages/core pnpm-lock.yaml
git commit -m "chore: bootstrap workspace"
```

---

## Task 2：实现共享 Schema 与评分逻辑

**文件：**

- 创建：`packages/core/src/ids.ts`
- 创建：`packages/core/src/schemas.ts`
- 创建：`packages/core/src/scoring.ts`
- 创建：`packages/core/src/scoring.test.ts`
- **Step 1：先写失败的评分测试**

创建 `packages/core/src/scoring.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { scoreSession } from './scoring';

describe('scoreSession', () => {
  it('computes weighted dimension and overall scores', () => {
    const result = scoreSession({
      dimensions: [
        { id: 'hooks-basics', name: 'Hook 基础', weight: 0.6 },
        { id: 'effects', name: '副作用', weight: 0.4 },
      ],
      questions: [
        { id: 'q1', dimensionId: 'hooks-basics', difficulty: 'easy', correctAnswer: 'A' },
        { id: 'q2', dimensionId: 'hooks-basics', difficulty: 'hard', correctAnswer: 'B' },
        { id: 'q3', dimensionId: 'effects', difficulty: 'medium', correctAnswer: ['A', 'C'] },
      ],
      answers: [
        { questionId: 'q1', userAnswer: 'A' },
        { questionId: 'q2', userAnswer: 'C' },
        { questionId: 'q3', userAnswer: ['C', 'A'] },
      ],
    });

    expect(result.dimensions).toEqual([
      { id: 'hooks-basics', name: 'Hook 基础', score: 33 },
      { id: 'effects', name: '副作用', score: 100 },
    ]);
    expect(result.overallScore).toBe(60);
    expect(result.masteryLabel).toBe('入门');
  });
});
```

- **Step 2：运行测试确认失败**

运行：

```bash
pnpm --filter @website-agent/core test -- src/scoring.test.ts
```

预期：失败，原因是 `./scoring` 尚未实现。

- **Step 3：实现 ID 与 Schema**

创建 `packages/core/src/ids.ts`：

```ts
import { z } from 'zod';

export type OwnerId = `device:${string}` | `clerk:${string}`;

export const ownerIdSchema = z.custom<OwnerId>((value) => {
  return typeof value === 'string' && /^(device|clerk):[A-Za-z0-9_-]+$/.test(value);
}, 'OwnerId must start with device: or clerk:');

export function toDeviceOwnerId(deviceId: string): OwnerId {
  if (!/^[A-Za-z0-9_-]+$/.test(deviceId)) throw new Error('Invalid device id');
  return `device:${deviceId}`;
}

export function toClerkOwnerId(userId: string): OwnerId {
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) throw new Error('Invalid Clerk user id');
  return `clerk:${userId}`;
}
```

创建 `packages/core/src/schemas.ts`：

```ts
import { z } from 'zod';

export const difficultySchema = z.enum(['easy', 'medium', 'hard']);
export type Difficulty = z.infer<typeof difficultySchema>;

export const masteryLabelSchema = z.enum(['初学', '入门', '熟练', '精通']);
export type MasteryLabel = z.infer<typeof masteryLabelSchema>;

export const dimensionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  weight: z.number().positive(),
});
export type Dimension = z.infer<typeof dimensionSchema>;

export const scoredQuestionSchema = z.object({
  id: z.string().min(1),
  dimensionId: z.string().min(1),
  difficulty: difficultySchema,
  correctAnswer: z.union([z.string(), z.array(z.string()).min(1)]),
});
export type ScoredQuestion = z.infer<typeof scoredQuestionSchema>;

export const scoredAnswerSchema = z.object({
  questionId: z.string().min(1),
  userAnswer: z.union([z.string(), z.array(z.string()).min(1)]),
});
export type ScoredAnswer = z.infer<typeof scoredAnswerSchema>;
```

- **Step 4：实现评分函数**

创建 `packages/core/src/scoring.ts`：

```ts
import type { Dimension, MasteryLabel, ScoredAnswer, ScoredQuestion } from './schemas';

const difficultyWeights: Record<ScoredQuestion['difficulty'], number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
};

export type DimensionScore = { id: string; name: string; score: number };

export function scoreSession(input: {
  dimensions: Dimension[];
  questions: ScoredQuestion[];
  answers: ScoredAnswer[];
}) {
  const answersByQuestionId = new Map(input.answers.map((answer) => [answer.questionId, answer]));
  const correctnessByQuestionId: Record<string, boolean> = {};

  for (const question of input.questions) {
    const answer = answersByQuestionId.get(question.id);
    correctnessByQuestionId[question.id] = answer
      ? sameAnswer(answer.userAnswer, question.correctAnswer)
      : false;
  }

  const dimensions = input.dimensions.map((dimension) => {
    const questions = input.questions.filter((question) => question.dimensionId === dimension.id);
    const totalWeight = questions.reduce((sum, question) => sum + difficultyWeights[question.difficulty], 0);
    const earnedWeight = questions.reduce((sum, question) => {
      return sum + (correctnessByQuestionId[question.id] ? difficultyWeights[question.difficulty] : 0);
    }, 0);
    return {
      id: dimension.id,
      name: dimension.name,
      score: totalWeight === 0 ? 0 : Math.round((earnedWeight / totalWeight) * 100),
    };
  });

  const totalDimensionWeight = input.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  const overallScore =
    totalDimensionWeight === 0
      ? 0
      : Math.round(
          dimensions.reduce((sum, score) => {
            const dimension = input.dimensions.find((item) => item.id === score.id);
            return sum + score.score * (dimension?.weight ?? 0);
          }, 0) / totalDimensionWeight,
        );

  return {
    overallScore,
    masteryLabel: toMasteryLabel(overallScore),
    dimensions,
    weaknessTop3: dimensions.filter((item) => item.score < 70).sort((a, b) => a.score - b.score).slice(0, 3),
    correctnessByQuestionId,
  };
}

function sameAnswer(left: string | string[], right: string | string[]) {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    return [...left].sort().join('|') === [...right].sort().join('|');
  }
  return left === right;
}

function toMasteryLabel(score: number): MasteryLabel {
  if (score >= 90) return '精通';
  if (score >= 70) return '熟练';
  if (score >= 50) return '入门';
  return '初学';
}
```

- **Step 5：运行测试并提交**

运行：

```bash
pnpm --filter @website-agent/core test -- src/scoring.test.ts
```

预期：测试通过。

提交：

```bash
git add packages/core
git commit -m "feat: add shared schemas and scoring"
```

---

## Task 3：搭建 API App

**文件：**

- 创建：`apps/api/package.json`
- 创建：`apps/api/next.config.ts`
- 创建：`apps/api/tsconfig.json`
- 创建：`apps/api/vitest.config.ts`
- 创建：`apps/api/src/app/api/health/route.ts`
- 创建：`apps/api/tests/health.test.ts`
- **Step 1：创建 API package**

创建 `apps/api/package.json`：

```json
{
  "name": "@website-agent/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@website-agent/core": "workspace:*",
    "@neondatabase/serverless": "latest",
    "drizzle-orm": "latest",
    "next": "latest",
    "react": "latest",
    "react-dom": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "drizzle-kit": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

创建 `apps/api/next.config.ts`：

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

创建 `apps/api/tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "tests/**/*.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

创建 `apps/api/vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
});
```

- **Step 2：实现健康检查**

创建 `apps/api/src/app/api/health/route.ts`：

```ts
export async function GET() {
  return Response.json({ ok: true, service: 'website-agent-api' });
}
```

创建 `apps/api/tests/health.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { GET } from '../src/app/api/health/route';

describe('GET /api/health', () => {
  it('returns service health', async () => {
    const response = await GET();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: 'website-agent-api',
    });
  });
});
```

- **Step 3：安装依赖、测试、提交**

运行：

```bash
pnpm install
pnpm --filter @website-agent/api test
```

预期：健康检查测试通过。

提交：

```bash
git add apps/api package.json pnpm-lock.yaml
git commit -m "feat: scaffold api app"
```

---

## Task 4：实现 Owner 身份模型

**文件：**

- 创建：`apps/api/src/auth/owner-id.ts`
- 创建：`apps/api/src/auth/request-context.ts`
- 创建：`apps/api/tests/owner-id.test.ts`
- **Step 1：写身份解析测试**

创建 `apps/api/tests/owner-id.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { ownerIdFromHeaders } from '../src/auth/owner-id';

describe('ownerIdFromHeaders', () => {
  it('prefers Clerk user id when present', () => {
    const headers = new Headers({ 'x-clerk-user-id': 'user_123', 'x-device-id': 'device_abc' });
    expect(ownerIdFromHeaders(headers)).toBe('clerk:user_123');
  });

  it('falls back to device id', () => {
    const headers = new Headers({ 'x-device-id': 'device_abc' });
    expect(ownerIdFromHeaders(headers)).toBe('device:device_abc');
  });

  it('throws for missing identity', () => {
    expect(() => ownerIdFromHeaders(new Headers())).toThrow('Missing owner identity');
  });
});
```

- **Step 2：运行测试确认失败**

运行：

```bash
pnpm --filter @website-agent/api test -- tests/owner-id.test.ts
```

预期：失败，原因是 `owner-id.ts` 尚未实现。

- **Step 3：实现身份解析与请求上下文**

创建 `apps/api/src/auth/owner-id.ts`：

```ts
import type { OwnerId } from '@website-agent/core';
import { toClerkOwnerId, toDeviceOwnerId } from '@website-agent/core';

export function ownerIdFromHeaders(headers: Headers): OwnerId {
  const clerkUserId = headers.get('x-clerk-user-id');
  if (clerkUserId) return toClerkOwnerId(clerkUserId);

  const deviceId = headers.get('x-device-id');
  if (deviceId) return toDeviceOwnerId(deviceId);

  throw new Error('Missing owner identity');
}
```

创建 `apps/api/src/auth/request-context.ts`：

```ts
import { AsyncLocalStorage } from 'node:async_hooks';
import type { OwnerId } from '@website-agent/core';

type RequestContext = { ownerId: OwnerId };

const storage = new AsyncLocalStorage<RequestContext>();

export async function withRequestContext<T>(context: RequestContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, fn);
}

export function currentOwnerId(): OwnerId {
  const context = storage.getStore();
  if (!context) throw new Error('No owner context');
  return context.ownerId;
}
```

- **Step 4：运行测试并提交**

运行：

```bash
pnpm --filter @website-agent/api test -- tests/owner-id.test.ts
```

预期：3 个测试通过。

提交：

```bash
git add apps/api/src/auth apps/api/tests/owner-id.test.ts
git commit -m "feat: add owner identity context"
```

---

## Task 5：实现数据库 Schema 与 Repository 边界

**文件：**

- 创建：`apps/api/drizzle.config.ts`
- 创建：`apps/api/src/db/schema.ts`
- 创建：`apps/api/src/db/client.ts`
- 创建：`apps/api/src/db/repositories/sessions.repo.ts`
- 创建：`apps/api/tests/repositories.test.ts`
- **Step 1：写 owner 隔离测试**

创建 `apps/api/tests/repositories.test.ts`：

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSession,
  getSessionForOwner,
  listSessionsForOwner,
  resetInMemorySessions,
} from '../src/db/repositories/sessions.repo';

describe('sessions repository owner isolation', () => {
  beforeEach(() => resetInMemorySessions());

  it('returns only sessions owned by the requested owner', async () => {
    const session = await createSession({ ownerId: 'device:a', rawTopic: 'React Hooks' });
    await createSession({ ownerId: 'device:b', rawTopic: 'TypeScript 泛型' });
    await expect(listSessionsForOwner('device:a')).resolves.toEqual([session]);
  });

  it('does not return another owner session by id', async () => {
    const session = await createSession({ ownerId: 'device:a', rawTopic: 'React Hooks' });
    await expect(getSessionForOwner('device:b', session.id)).resolves.toBeNull();
  });
});
```

- **Step 2：实现 schema、client、内存 repository**

创建 `apps/api/drizzle.config.ts`：

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://user:password@localhost:5432/website_agent',
  },
});
```

创建 `apps/api/src/db/schema.ts`：

```ts
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id').notNull(),
  status: text('status').notNull().default('input'),
  rawTopic: text('raw_topic').notNull(),
  refinedTopic: text('refined_topic'),
  dimensions: jsonb('dimensions'),
  totalQuestions: integer('total_questions'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  ownerCreatedIdx: index('sessions_owner_created_idx').on(table.ownerId, table.createdAt),
}));

export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull(),
  dimensionId: text('dimension_id').notNull(),
  idx: integer('idx').notNull(),
  type: text('type').notNull(),
  body: text('body').notNull(),
  options: jsonb('options').notNull(),
  correctAnswer: jsonb('correct_answer').notNull(),
  difficulty: text('difficulty').notNull(),
  explanation: text('explanation'),
  retired: boolean('retired').default(false).notNull(),
});

export const answers = pgTable('answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionId: uuid('question_id').notNull(),
  sessionId: uuid('session_id').notNull(),
  userAnswer: jsonb('user_answer').notNull(),
  isCorrect: boolean('is_correct').notNull(),
});

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull(),
  ownerId: text('owner_id').notNull(),
  overallScore: integer('overall_score').notNull(),
  masteryLabel: text('mastery_label').notNull(),
  dimensions: jsonb('dimensions').notNull(),
  weaknessTop3: jsonb('weakness_top3').notNull(),
  headline: text('headline').notNull(),
  summary: text('summary').notNull(),
});
```

创建 `apps/api/src/db/client.ts`：

```ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

export const db = connectionString ? drizzle(neon(connectionString), { schema }) : null;
```

创建 `apps/api/src/db/repositories/sessions.repo.ts`：

```ts
import type { OwnerId } from '@website-agent/core';

export type SessionRecord = {
  id: string;
  ownerId: OwnerId;
  status: 'input' | 'clarifying' | 'generating' | 'answering' | 'finalized' | 'expired';
  rawTopic: string;
  refinedTopic: string | null;
  createdAt: string;
};

const inMemorySessions = new Map<string, SessionRecord>();

export function resetInMemorySessions(): void {
  inMemorySessions.clear();
}

export async function createSession(input: { ownerId: OwnerId; rawTopic: string }): Promise<SessionRecord> {
  const session: SessionRecord = {
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    status: 'clarifying',
    rawTopic: input.rawTopic,
    refinedTopic: null,
    createdAt: new Date().toISOString(),
  };
  inMemorySessions.set(session.id, session);
  return session;
}

export async function listSessionsForOwner(ownerId: OwnerId): Promise<SessionRecord[]> {
  return [...inMemorySessions.values()].filter((session) => session.ownerId === ownerId);
}

export async function getSessionForOwner(ownerId: OwnerId, sessionId: string): Promise<SessionRecord | null> {
  const session = inMemorySessions.get(sessionId);
  if (!session || session.ownerId !== ownerId) return null;
  return session;
}
```

- **Step 3：测试并提交**

运行：

```bash
pnpm --filter @website-agent/api test -- tests/repositories.test.ts
```

预期：2 个测试通过。

提交：

```bash
git add apps/api/drizzle.config.ts apps/api/src/db apps/api/tests/repositories.test.ts
git commit -m "feat: add database schema and session repository"
```

---

## Task 6：实现 Mock Agent Workflows 与 SSE API

**文件：**

- 创建：`apps/api/src/mastra/mock-data.ts`
- 创建：`apps/api/src/mastra/workflows/clarification.workflow.ts`
- 创建：`apps/api/src/mastra/workflows/question-generation.workflow.ts`
- 创建：`apps/api/src/mastra/workflows/report.workflow.ts`
- 创建：`apps/api/src/sse/encode.ts`
- 创建：`apps/api/src/app/api/sessions/route.ts`
- 创建：`apps/api/src/app/api/sessions/[id]/clarify/route.ts`
- 创建：`apps/api/src/app/api/sessions/[id]/start-test/route.ts`
- 创建：`apps/api/src/app/api/sessions/[id]/finalize/route.ts`
- **Step 1：创建 mock Agent 数据和 workflow**

创建 `apps/api/src/mastra/mock-data.ts`：

```ts
export const mockDimensions = [
  { id: 'basics', name: '基础概念', weight: 0.4 },
  { id: 'usage', name: '实际使用', weight: 0.4 },
  { id: 'edge-cases', name: '边界场景', weight: 0.2 },
];

export const mockQuestions = [
  {
    id: 'q1',
    dimensionId: 'basics',
    idx: 1,
    type: 'single',
    body: '关于 React Hooks，下面哪个说法更准确？',
    options: [
      { id: 'A', label: 'Hooks 只能在函数组件或自定义 Hook 中调用' },
      { id: 'B', label: 'Hooks 可以在任意普通函数里调用' },
    ],
    correctAnswer: 'A',
    difficulty: 'easy',
  },
];
```

创建 `apps/api/src/mastra/workflows/clarification.workflow.ts`：

```ts
export async function runClarificationWorkflow(input: { rawTopic: string }) {
  return {
    done: false,
    nextQuestion: {
      purpose: 'scope',
      type: 'single',
      question: `你想测试「${input.rawTopic}」的哪一部分？`,
      options: [
        { id: 'all', label: '整体掌握程度' },
        { id: 'basics', label: '基础概念' },
      ],
    },
  };
}
```

创建 `apps/api/src/mastra/workflows/question-generation.workflow.ts`：

```ts
import { mockDimensions, mockQuestions } from '../mock-data';

export async function runQuestionGenerationWorkflow() {
  return {
    dimensions: mockDimensions,
    totalQuestions: mockQuestions.length,
    questions: mockQuestions,
  };
}
```

创建 `apps/api/src/mastra/workflows/report.workflow.ts`：

```ts
import type { DimensionScore } from '@website-agent/core';

export async function runReportWorkflow(input: {
  topic: string;
  overallScore: number;
  masteryLabel: string;
  dimensions: DimensionScore[];
}) {
  return {
    headline: `你对「${input.topic}」处于${input.masteryLabel}水平`,
    summary: `本次测试得分 ${input.overallScore}/100。建议先复盘错题，再重新测试一次。`,
    weaknessTop3: input.dimensions.filter((item) => item.score < 70).slice(0, 3),
    nextSteps: '复盘薄弱点后再测一次。',
  };
}
```

- **Step 2：创建 SSE 工具**

创建 `apps/api/src/sse/encode.ts`：

```ts
export function encodeSse(event: string, data: unknown, id?: string): string {
  const lines = [];
  if (id) lines.push(`id: ${id}`);
  lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  lines.push('');
  return lines.join('\n');
}

export function sseResponse(chunks: string[]): Response {
  return new Response(chunks.join('\n'), {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
```

- **Step 3：实现最小 API**

创建 `apps/api/src/app/api/sessions/route.ts`：

```ts
import { ownerIdFromHeaders } from '@/auth/owner-id';
import { createSession, listSessionsForOwner } from '@/db/repositories/sessions.repo';
import { z } from 'zod';

const createSessionSchema = z.object({ topic: z.string().trim().min(2).max(100) });

export async function POST(request: Request) {
  const ownerId = ownerIdFromHeaders(request.headers);
  const body = createSessionSchema.parse(await request.json());
  const session = await createSession({ ownerId, rawTopic: body.topic });
  return Response.json({ session });
}

export async function GET(request: Request) {
  const ownerId = ownerIdFromHeaders(request.headers);
  return Response.json({ sessions: await listSessionsForOwner(ownerId) });
}
```

创建 `apps/api/src/app/api/sessions/[id]/clarify/route.ts`：

```ts
import { ownerIdFromHeaders } from '@/auth/owner-id';
import { getSessionForOwner } from '@/db/repositories/sessions.repo';
import { runClarificationWorkflow } from '@/mastra/workflows/clarification.workflow';
import { encodeSse, sseResponse } from '@/sse/encode';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ownerId = ownerIdFromHeaders(request.headers);
  const { id } = await context.params;
  const session = await getSessionForOwner(ownerId, id);
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

  const result = await runClarificationWorkflow({ rawTopic: session.rawTopic });
  return sseResponse([encodeSse('clarification', result, '1')]);
}
```

创建 `apps/api/src/app/api/sessions/[id]/start-test/route.ts`：

```ts
import { ownerIdFromHeaders } from '@/auth/owner-id';
import { getSessionForOwner } from '@/db/repositories/sessions.repo';
import { runQuestionGenerationWorkflow } from '@/mastra/workflows/question-generation.workflow';
import { encodeSse, sseResponse } from '@/sse/encode';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ownerId = ownerIdFromHeaders(request.headers);
  const { id } = await context.params;
  const session = await getSessionForOwner(ownerId, id);
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

  const result = await runQuestionGenerationWorkflow();
  return sseResponse([
    encodeSse('plan', { dimensions: result.dimensions, totalQuestions: result.totalQuestions }, 'plan'),
    ...result.questions.map((question, index) => encodeSse('question', question, String(index + 1))),
    encodeSse('complete', { ok: true }, 'complete'),
  ]);
}
```

创建 `apps/api/src/app/api/sessions/[id]/finalize/route.ts`：

```ts
import { ownerIdFromHeaders } from '@/auth/owner-id';
import { getSessionForOwner } from '@/db/repositories/sessions.repo';
import { mockDimensions, mockQuestions } from '@/mastra/mock-data';
import { runReportWorkflow } from '@/mastra/workflows/report.workflow';
import { encodeSse, sseResponse } from '@/sse/encode';
import { scoreSession } from '@website-agent/core';
import { z } from 'zod';

const finalizeSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string(),
    userAnswer: z.union([z.string(), z.array(z.string()).min(1)]),
  })),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ownerId = ownerIdFromHeaders(request.headers);
  const { id } = await context.params;
  const session = await getSessionForOwner(ownerId, id);
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

  const body = finalizeSchema.parse(await request.json());
  const score = scoreSession({
    dimensions: mockDimensions,
    questions: mockQuestions.map((q) => ({
      id: q.id,
      dimensionId: q.dimensionId,
      difficulty: q.difficulty,
      correctAnswer: q.correctAnswer,
    })),
    answers: body.answers,
  });
  const report = await runReportWorkflow({
    topic: session.rawTopic,
    overallScore: score.overallScore,
    masteryLabel: score.masteryLabel,
    dimensions: score.dimensions,
  });

  return sseResponse([
    encodeSse('score', score, 'score'),
    encodeSse('report', report, 'report'),
    encodeSse('complete', { ok: true }, 'complete'),
  ]);
}
```

- **Step 4：验证并提交**

运行：

```bash
pnpm --filter @website-agent/api typecheck
pnpm --filter @website-agent/api test
```

预期：全部通过。

提交：

```bash
git add apps/api/src
git commit -m "feat: add mvp session api flow"
```

---

## Task 7：搭建 Expo App 与 MVP 页面

**文件：**

- 创建：`apps/mobile/package.json`
- 创建：`apps/mobile/app.json`
- 创建：`apps/mobile/app/_layout.tsx`
- 创建：`apps/mobile/app/(tabs)/_layout.tsx`
- 创建：`apps/mobile/app/(tabs)/index.tsx`
- 创建：`apps/mobile/app/(tabs)/history.tsx`
- 创建：`apps/mobile/app/(tabs)/settings.tsx`
- 创建：`apps/mobile/app/session/[id]/clarify.tsx`
- 创建：`apps/mobile/app/session/[id]/confirm.tsx`
- 创建：`apps/mobile/app/session/[id]/answer.tsx`
- 创建：`apps/mobile/app/session/[id]/report.tsx`
- 创建：`apps/mobile/src/auth/device-id.ts`
- 创建：`apps/mobile/src/api/client.ts`
- **Step 1：创建 mobile package 与布局**

创建 `apps/mobile/package.json`：

```json
{
  "name": "@website-agent/mobile",
  "version": "0.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "ios": "expo run:ios",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@tanstack/react-query": "latest",
    "@website-agent/core": "workspace:*",
    "expo": "latest",
    "expo-router": "latest",
    "expo-secure-store": "latest",
    "nativewind": "latest",
    "react": "latest",
    "react-native": "latest",
    "react-native-reanimated": "latest",
    "react-native-safe-area-context": "latest",
    "react-native-screens": "latest",
    "zustand": "latest"
  },
  "devDependencies": {
    "@types/react": "latest",
    "jest": "latest",
    "typescript": "latest"
  }
}
```

创建 `apps/mobile/app.json`：

```json
{
  "expo": {
    "name": "Knowledge Test",
    "slug": "knowledge-test",
    "scheme": "knowledgetest",
    "platforms": ["ios"],
    "plugins": ["expo-router", "expo-secure-store"],
    "ios": { "bundleIdentifier": "com.websiteagent.knowledgetest" }
  }
}
```

创建 `apps/mobile/app/_layout.tsx`：

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
```

创建 `apps/mobile/app/(tabs)/_layout.tsx`：

```tsx
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: '首页' }} />
      <Tabs.Screen name="history" options={{ title: '历史' }} />
      <Tabs.Screen name="settings" options={{ title: '设置' }} />
    </Tabs>
  );
}
```

- **Step 2：实现 device id 与 API client**

创建 `apps/mobile/src/auth/device-id.ts`：

```ts
import * as SecureStore from 'expo-secure-store';

const key = 'website-agent-device-id';

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(key);
  if (existing) return existing;
  const generated = crypto.randomUUID();
  await SecureStore.setItemAsync(key, generated);
  return generated;
}
```

创建 `apps/mobile/src/api/client.ts`：

```ts
import { getOrCreateDeviceId } from '../auth/device-id';

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

async function headers(): Promise<HeadersInit> {
  const deviceId = await getOrCreateDeviceId();
  return {
    'content-type': 'application/json',
    'x-device-id': deviceId,
  };
}

export async function createSession(topic: string) {
  const response = await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({ topic }),
  });
  if (!response.ok) throw new Error('Failed to create session');
  return response.json() as Promise<{ session: { id: string; rawTopic: string } }>;
}
```

- **Step 3：实现 MVP 页面**

创建 `apps/mobile/app/(tabs)/index.tsx`：

```tsx
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { createSession } from '../../src/api/client';

export default function HomeScreen() {
  const router = useRouter();
  const [topic, setTopic] = useState('');

  async function start() {
    const { session } = await createSession(topic.trim());
    router.push(`/session/${session.id}/clarify`);
  }

  return (
    <View className="flex-1 bg-zinc-50 px-6 pt-20">
      <Text className="text-4xl font-bold text-zinc-950">学一个新东西？</Text>
      <Text className="mt-3 text-base text-zinc-500">先来测一测你掌握的程度。</Text>
      <TextInput className="mt-10 rounded-2xl border border-zinc-200 bg-white px-4 py-4" placeholder="如「React Hooks」" value={topic} onChangeText={setTopic} />
      <Pressable className="mt-4 h-14 items-center justify-center rounded-xl bg-blue-600" onPress={start}>
        <Text className="font-semibold text-white">开始测试</Text>
      </Pressable>
    </View>
  );
}
```

创建 `apps/mobile/app/(tabs)/history.tsx`：

```tsx
import { Text, View } from 'react-native';

export default function HistoryScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-zinc-50 px-6">
      <Text className="text-2xl font-bold">还没有测试历史</Text>
      <Text className="mt-3 text-center text-zinc-500">来测试一个你最近在学的主题吧。</Text>
    </View>
  );
}
```

创建 `apps/mobile/app/(tabs)/settings.tsx`：

```tsx
import { Text, View } from 'react-native';

export default function SettingsScreen() {
  return (
    <View className="flex-1 bg-zinc-50 px-6 pt-20">
      <Text className="text-3xl font-bold">设置</Text>
      <Text className="mt-6">语言：中文</Text>
      <Text className="mt-3">主题：跟随系统</Text>
    </View>
  );
}
```

创建 `apps/mobile/app/session/[id]/clarify.tsx`：

```tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export default function ClarifyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <View className="flex-1 bg-zinc-50 px-6 pt-20">
      <Text className="text-sm text-zinc-500">澄清中 1/5</Text>
      <Text className="mt-6 text-2xl font-bold">你想测试这个主题的哪一部分？</Text>
      <Pressable className="mt-8 rounded-2xl border border-zinc-200 bg-white px-4 py-4">
        <Text>整体掌握程度</Text>
      </Pressable>
      <Pressable className="mt-8 h-14 items-center justify-center rounded-xl bg-blue-600" onPress={() => router.push(`/session/${id}/confirm`)}>
        <Text className="font-semibold text-white">确认</Text>
      </Pressable>
    </View>
  );
}
```

创建 `apps/mobile/app/session/[id]/confirm.tsx`：

```tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export default function ConfirmScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <View className="flex-1 bg-zinc-50 px-6 pt-20">
      <Text className="text-3xl font-bold">准备开始测试</Text>
      <Text className="mt-6">即将测试 3 个维度，共约 3 题。</Text>
      <Pressable className="mt-8 h-14 items-center justify-center rounded-xl bg-blue-600" onPress={() => router.push(`/session/${id}/answer`)}>
        <Text className="font-semibold text-white">开始测试</Text>
      </Pressable>
    </View>
  );
}
```

创建 `apps/mobile/app/session/[id]/answer.tsx`：

```tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

const question = {
  id: 'q1',
  body: '关于 React Hooks，下面哪个说法更准确？',
  options: [
    { id: 'A', label: 'Hooks 只能在函数组件或自定义 Hook 中调用' },
    { id: 'B', label: 'Hooks 可以在任意普通函数里调用' },
  ],
};

export default function AnswerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <View className="flex-1 bg-zinc-50 px-6 pt-20">
      <Text className="text-center text-sm text-zinc-500">题 1 / 1</Text>
      <Text className="mt-8 text-xl font-semibold">{question.body}</Text>
      {question.options.map((option) => (
        <Pressable key={option.id} className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-4" onPress={() => setSelected(option.id)}>
          <Text>{option.id}. {option.label}</Text>
        </Pressable>
      ))}
      <Pressable disabled={!selected} className="mt-auto mb-10 h-14 items-center justify-center rounded-xl bg-blue-600" onPress={() => router.push(`/session/${id}/report`)}>
        <Text className="font-semibold text-white">查看报告</Text>
      </Pressable>
    </View>
  );
}
```

创建 `apps/mobile/app/session/[id]/report.tsx`：

```tsx
import { Text, View } from 'react-native';

export default function ReportScreen() {
  return (
    <View className="flex-1 bg-zinc-50 px-6 pt-20">
      <Text className="text-center text-2xl font-bold">你的测试报告</Text>
      <Text className="mt-10 text-center text-6xl font-bold">78</Text>
      <Text className="mt-2 text-center text-zinc-500">/ 100 · 熟练</Text>
      <View className="mt-8 rounded-3xl bg-white p-5">
        <Text className="text-lg font-bold">薄弱点 TOP 3</Text>
        <Text className="mt-3">1. useEffect 依赖数组</Text>
        <Text className="mt-2">2. 边界场景判断</Text>
        <Text className="mt-2">3. 自定义 Hook 命名约定</Text>
      </View>
    </View>
  );
}
```

- **Step 4：验证并提交**

运行：

```bash
pnpm install
pnpm --filter @website-agent/mobile typecheck
```

预期：类型检查通过。

提交：

```bash
git add apps/mobile package.json pnpm-lock.yaml
git commit -m "feat: add mvp mobile screens"
```

---

## Task 8：添加 E2E Smoke Flow 与 README

**文件：**

- 创建：`apps/mobile/e2e/first-test-flow.yaml`
- 创建：`README.md`
- **Step 1：创建 Maestro smoke 测试**

创建 `apps/mobile/e2e/first-test-flow.yaml`：

```yaml
appId: com.websiteagent.knowledgetest
---
- launchApp
- assertVisible: "学一个新东西？"
- tapOn: "如「React Hooks」"
- inputText: "React Hooks"
- tapOn: "开始测试"
- assertVisible: "你想测试这个主题的哪一部分？"
- tapOn: "整体掌握程度"
- tapOn: "确认"
- assertVisible: "准备开始测试"
- tapOn: "开始测试"
- assertVisible: "关于 React Hooks"
- tapOn: "A. Hooks 只能在函数组件或自定义 Hook 中调用"
- tapOn: "查看报告"
- assertVisible: "你的测试报告"
- assertVisible: "78"
```

- **Step 2：创建 README**

创建 `README.md`：

```md
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

```

- [ ] **Step 3：最终验证**

运行：

```bash
pnpm typecheck
pnpm test
```

预期：两个命令都以退出码 0 结束。

- **Step 4：提交**

```bash
git add apps/mobile/e2e README.md
git commit -m "docs: add mvp smoke flow and development guide"
```

---

## 自检

### Spec 覆盖情况

- MVP 产品纵切：Task 6-8 覆盖。
- Expo iOS App：Task 7-8 覆盖。
- Vercel / Next API：Task 3、Task 6 覆盖。
- 匿名 device id 身份：Task 2、Task 4、Task 7 覆盖。
- 共享评分：Task 2 覆盖。
- DB schema / repository 边界：Task 5 覆盖。
- Agent workflow 接口：Task 6 覆盖。
- SSE 协议：Task 6 覆盖。
- 报告 UI：Task 7 覆盖。
- 测试：Task 2、Task 3、Task 4、Task 5、Task 8 覆盖。

### 明确延后

- 真实 AI Gateway 模型调用。
- 真实 Mastra Evals 和 golden dataset。
- Clerk 登录与匿名数据 claim。
- Neon 持久化 repository 的完整实现。
- IAP 和付费层级。
- 公开分享页。

### 命名一致性

- `OwnerId` 在 `@website-agent/core` 定义，API repository 复用。
- `scoreSession` 的输入字段与共享 schema 一致。
- Session 路由参数统一使用 `id`。
- 第一阶段 API 与移动端都围绕同一条 mock MVP 路径组织。

