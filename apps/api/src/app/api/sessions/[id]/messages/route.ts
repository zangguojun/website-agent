import { z } from 'zod';

import { authenticationErrorResponse } from '../../../../../auth/http-errors';
import { requireSessionOwnedBy } from '../../../../../auth/session-access';
import { resolveOwnerId } from '../../../../../auth/resolve-owner';
import {
  insertSessionMessage,
  listSessionMessagesAscPaged,
  messageRowToJson,
} from '../../../../../db/repositories/session-messages.repo';
import { getSessionById } from '../../../../../db/repositories/sessions.repo';

const postMessageSchema = z.object({
  phase: z.enum(['clarify', 'plan', 'questions', 'report']),
  role: z.literal('user'),
  content: z.string().min(1).max(32_000),
  payload: z.record(z.string(), z.unknown()).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const ownerId = await resolveOwnerId(request.headers);
    const { id } = await context.params;
    const row = await getSessionById(id);
    const gate = requireSessionOwnedBy(row, ownerId);
    if (!gate.ok) return gate.response;

    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    const limitRaw = url.searchParams.get('limit');
    const parsedLimit = limitRaw !== null && limitRaw !== '' ? Number.parseInt(limitRaw, 10) : NaN;
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;

    let page;
    try {
      page = await listSessionMessagesAscPaged({
        sessionId: id,
        ownerId,
        ...(cursor !== null && cursor !== '' ? { afterCursor: cursor } : {}),
        ...(limit !== undefined ? { limit } : {}),
      });
    } catch (e) {
      if (e instanceof RangeError) {
        return Response.json({ error: 'Invalid messages cursor' }, { status: 400 });
      }
      throw e;
    }

    return Response.json({
      messages: page.messages.map(messageRowToJson),
      nextCursor: page.nextCursor,
    });
  } catch (error) {
    const unauthorized = authenticationErrorResponse(error);
    if (unauthorized) return unauthorized;
    throw error;
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const ownerId = await resolveOwnerId(request.headers);
    const { id } = await context.params;
    const row = await getSessionById(id);
    const gate = requireSessionOwnedBy(row, ownerId);
    if (!gate.ok) return gate.response;

    const body = await request.json().catch(() => ({}));
    const parsed = postMessageSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid message body' }, { status: 400 });
    }

    if (parsed.data.phase !== gate.session.workflowPhase) {
      return Response.json({ error: 'Workflow phase mismatch' }, { status: 409 });
    }

    const created = await insertSessionMessage({
      sessionId: id,
      ownerId,
      phase: parsed.data.phase,
      role: parsed.data.role,
      content: parsed.data.content,
      ...(parsed.data.payload !== undefined ? { payload: parsed.data.payload } : {}),
    });

    return Response.json(
      {
        message: {
          id: created.id,
          phase: parsed.data.phase,
          role: parsed.data.role,
          content: parsed.data.content,
          payload: parsed.data.payload ?? null,
          createdAt: created.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const unauthorized = authenticationErrorResponse(error);
    if (unauthorized) return unauthorized;
    throw error;
  }
}
