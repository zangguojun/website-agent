import { getDeviceId } from "../auth/device-id";

/** 统一注入匿名 `x-device-id`；Bearer 由调用方通过 `HeadersInit` 传入。 */
export async function getAuthHeaders(extra?: HeadersInit): Promise<Headers> {
  const headers = new Headers(extra ?? undefined);

  const deviceId = await getDeviceId();
  headers.set("x-device-id", deviceId);

  return headers;
}
