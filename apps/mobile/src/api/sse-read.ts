export type ParsedSseFrame = {
  id?: string;
  event?: string;
  data: string;
};

/**
 * 解析整块 SSE body（短流可先 `response.text()` 再解析）。
 * 兼容两种常见格式：
 * - 标准：`event`/`data`/`id` 字段组之间用**空行**分隔；
 * - 本仓库 API（`encodeSse`）：连续的 `id`/`event`/`data` 行之间**无**空行，仅以单换行串联多帧。
 */
export function parseSseText(body: string): ParsedSseFrame[] {
  const frames: ParsedSseFrame[] = [];
  let id: string | undefined;
  let event: string | undefined;
  const dataLines: string[] = [];

  const pushFrame = (): void => {
    if (dataLines.length === 0) return;
    const frame: ParsedSseFrame = { data: dataLines.join("\n") };
    if (id !== undefined) frame.id = id;
    if (event !== undefined) frame.event = event;
    frames.push(frame);
    dataLines.length = 0;
  };

  for (const raw of body.split(/\r?\n/)) {
    if (raw === "") {
      pushFrame();
      id = undefined;
      event = undefined;
      continue;
    }
    if (raw.startsWith("id:")) {
      if (dataLines.length > 0) pushFrame();
      id = raw.slice(3).trim();
      continue;
    }
    if (raw.startsWith("event:")) {
      if (dataLines.length > 0) pushFrame();
      event = raw.slice(6).trim();
      continue;
    }
    if (raw.startsWith("data:")) {
      dataLines.push(raw.slice(5).trimStart());
      continue;
    }
  }

  pushFrame();
  return frames;
}
