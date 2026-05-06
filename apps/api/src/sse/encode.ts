export function encodeSse(event: string, data: unknown, id?: string): string {
  const lines = [];
  if (id) lines.push(`id: ${id}`);
  lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  return `${lines.join('\n')}\n`;
}

export function sseResponse(chunks: string[]): Response {
  return new Response(`${chunks.join('\n')}\n`, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
