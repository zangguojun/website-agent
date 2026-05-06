import * as SecureStore from "expo-secure-store";

const DEVICE_ID_KEY = "website-agent.device-id";

function createFallbackId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function createDeviceId() {
  const randomUUID = globalThis.crypto?.randomUUID;

  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }

  return createFallbackId();
}

export async function getDeviceId() {
  const storedDeviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);

  if (storedDeviceId) {
    return storedDeviceId;
  }

  const deviceId = createDeviceId();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);

  return deviceId;
}
