import { getDeviceId } from "../auth/device-id";

function getApiBaseUrl() {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (!apiBaseUrl) {
    throw new Error("Missing EXPO_PUBLIC_API_BASE_URL");
  }

  return apiBaseUrl;
}

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
  const deviceId = await getDeviceId();
  const apiBaseUrl = getApiBaseUrl();

  const response = await fetch(`${apiBaseUrl}/api/sessions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-device-id": deviceId
    },
    body: JSON.stringify({ topic })
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.status}`);
  }

  const payload: unknown = await response.json();
  return normalizeSession(payload, topic);
}
