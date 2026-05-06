import { getDeviceId } from "../auth/device-id";
import { resolveApiBaseUrl } from "./base-url";

export type Session = {
  id: string;
  topic: string;
};

function normalizeSession(payload: unknown, topic: string): Session {
  if (
    payload &&
    typeof payload === "object" &&
    "id" in payload &&
    typeof payload.id === "string"
  ) {
    return { id: payload.id, topic };
  }

  if (
    payload &&
    typeof payload === "object" &&
    "session" in payload &&
    payload.session &&
    typeof payload.session === "object" &&
    "id" in payload.session &&
    typeof payload.session.id === "string"
  ) {
    return { id: payload.session.id, topic };
  }

  throw new Error("Session response is missing session.id");
}

export async function createSession(topic: string): Promise<Session> {
  let apiBaseUrl: string;

  try {
    apiBaseUrl = resolveApiBaseUrl();
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }

  const deviceId = await getDeviceId();

  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}/api/sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-device-id": deviceId
      },
      body: JSON.stringify({ topic })
    });
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`无法连接 API（${apiBaseUrl}）。${cause}`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `服务器返回错误（${response.status}）${body ? `：${body.slice(0, 240)}` : "。请确认 API 已启动且 DATABASE 等依赖正常。"}`
    );
  }

  const payload: unknown = await response.json();
  return normalizeSession(payload, topic);
}
