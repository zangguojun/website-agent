import { getDeviceId } from "../auth/device-id";

const API_BASE_URL = "http://localhost:3000";

export type Session = {
  id: string;
  topic: string;
};

function createLocalSession(topic: string): Session {
  const randomUUID = globalThis.crypto?.randomUUID;
  const id =
    typeof randomUUID === "function"
      ? randomUUID.call(globalThis.crypto)
      : `local-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

  return { id, topic };
}

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

  return createLocalSession(topic);
}

export async function createSession(topic: string): Promise<Session> {
  const deviceId = await getDeviceId();

  try {
    const response = await fetch(`${API_BASE_URL}/api/sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-device-id": deviceId
      },
      body: JSON.stringify({ topic })
    });

    if (!response.ok) {
      return createLocalSession(topic);
    }

    const payload: unknown = await response.json();
    return normalizeSession(payload, topic);
  } catch {
    return createLocalSession(topic);
  }
}
