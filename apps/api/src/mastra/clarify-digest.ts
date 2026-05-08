import type { OwnerId } from '@website-agent/core';

import { listSessionMessagesAscPaged } from '../db/repositories/session-messages.repo';

/** 紧凑文本，喂给测评计划模型，避免复述整库消息。 */
export async function buildClarifyDigestForSession(sessionId: string, ownerId: OwnerId): Promise<string> {
  const { messages } = await listSessionMessagesAscPaged({ sessionId, ownerId, limit: 200 });
  const lines: string[] = [];
  for (const m of messages.filter((msg) => msg.phase === 'clarify')) {
    const who = m.role === 'assistant' ? '助教' : '学员';
    const text = typeof m.content === 'string' ? m.content.trim() : '';
    if (!text.length) continue;
    lines.push(`${who}：${text}`);
  }

  return lines.length > 0 ? lines.join('\n') : '（暂无澄清对白；仅依据测评主题出题。）';
}
