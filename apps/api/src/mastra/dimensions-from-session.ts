import type { Dimension } from '@website-agent/core';

/** 会话 `dimensions` jsonb → `scoreSession` 所需 `Dimension[]`。 */
export function dimensionsFromSessionJson(json: unknown): Dimension[] {
  if (!Array.isArray(json)) return [];
  const out: Dimension[] = [];

  for (const item of json) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.trim() : '';
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const weight =
      typeof o.weight === 'number' && Number.isFinite(o.weight) && o.weight > 0 ? o.weight : 1;

    if (id.length && name.length) {
      out.push({ id, name, weight });
    }
  }

  return out;
}

export function parseDimensionsForPrompt(
  json: unknown,
): Array<{ id: string; name: string; description: string }> {
  if (!Array.isArray(json)) return [];
  const out: Array<{ id: string; name: string; description: string }> = [];

  for (const item of json) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.trim() : '';
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const description =
      typeof o.description === 'string' ? o.description.trim() : '';

    if (id.length && name.length) {
      out.push({ id, name, description: description.length ? description : name });
    }
  }

  return out;
}
