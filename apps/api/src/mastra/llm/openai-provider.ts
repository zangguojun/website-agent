import { createOpenAI } from '@ai-sdk/openai';

/** 是否为「OpenAI 兼容」网关（百炼、Groq、Together 等），需同时配置 base URL。 */
export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * 可选。例如阿里云百炼兼容模式：

 * - 北京：`https://dashscope.aliyuncs.com/compatible-mode/v1`
 * - 新加坡：`https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
 *
 * 不配则请求官方 `api.openai.com`（即 `OPENAI_API_KEY` 为 OpenAI 密钥时）。
 */
export function openAiCompatibleBaseUrl(): string | undefined {
  const u = process.env.OPENAI_BASE_URL?.trim();
  return u?.length ? u : undefined;
}

export function openaiModelUserPreference(): string {
  return process.env.OPENAI_MODEL?.trim().length ? process.env.OPENAI_MODEL!.trim() : 'gpt-4o-mini';
}

/** 统一创建 OpenAI SDK 客户端（支持百炼等兼容 Base URL）。 */
export function createProjectOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY!;
  const baseURL = openAiCompatibleBaseUrl();
  return createOpenAI(
    baseURL
      ? {
          apiKey,
          baseURL,
        }
      : { apiKey },
  );
}
