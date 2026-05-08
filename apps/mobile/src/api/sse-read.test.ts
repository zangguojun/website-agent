import { describe, expect, it } from "vitest";

import { parseSseText } from "./sse-read";

describe("parseSseText", () => {
  it("parses back-to-back SSE frames without blank line between (encodeSse shape)", () => {
    const chunk = [
      `id: 1`,
      `event: assistant_delta`,
      `data: {"v":1,"seq":"1","phase":"clarify","kind":"assistant_delta","token":"…"}`,
      `id: 2`,
      `event: assistant_message`,
      `data: {"v":1,"seq":"2","phase":"clarify","kind":"assistant_message","question":"hi","options":[]}`,
      "",
    ].join("\n");

    const frames = parseSseText(chunk);
    const kinds = frames.map((f) => {
      const o = JSON.parse(f.data) as { kind?: string };
      return o.kind;
    });
    expect(kinds).toContain("assistant_delta");
    expect(kinds).toContain("assistant_message");
  });

  it("still splits on blank line between events", () => {
    const chunk = [
      `event: a`,
      `data: {"ok":1}`,
      ``,
      `event: b`,
      `data: {"ok":2}`,
      ``,
    ].join("\n");

    const frames = parseSseText(chunk);
    expect(frames).toHaveLength(2);
    expect(JSON.parse(frames[0]!.data).ok).toBe(1);
    expect(JSON.parse(frames[1]!.data).ok).toBe(2);
  });
});
