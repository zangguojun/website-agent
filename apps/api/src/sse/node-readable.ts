import { encodeSse } from './encode';

/**
 * Node runtime SSE: streams UTF-8 frames; on failure emits one `error` event then closes.
 * @see `docs/superpowers/specs/2026-05-07-real-agent-mastra-sse-design.md` §5.2
 */
export function createNodeSseResponse(run: (write: (frame: string) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        const write = (frame: string) => {
          controller.enqueue(encoder.encode(frame));
        };
        try {
          await run(write);
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Stream failed';
          write(
            encodeSse(
              'error',
              {
                v: 1,
                seq: '0',
                phase: 'unknown',
                kind: 'error',
                message,
                recoverable: false,
              },
              '0',
            ),
          );
        } finally {
          controller.close();
        }
      },
    }),
    {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      },
    },
  );
}
