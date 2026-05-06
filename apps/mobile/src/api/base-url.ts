import Constants from "expo-constants";

function hostFromMetroUri(uri: string | null | undefined): string | null {
  if (!uri || typeof uri !== "string") return null;
  const host = uri.split(":")[0]?.trim();
  if (!host) return null;
  if (host === "localhost") return "127.0.0.1";
  return host;
}

/**
 * In dev, Metro / dev client usually expose the packager host (LAN IP or loopback).
 * Using the same host for the Next.js API avoids "localhost" on a physical device
 * pointing at the phone itself instead of your computer.
 */
function inferDevHostFromConstants(): string | null {
  const expoConfigUri = Constants.expoConfig?.hostUri;
  const fromExpoConfig = hostFromMetroUri(expoConfigUri);
  if (fromExpoConfig) return fromExpoConfig;

  const manifest2 = Constants.manifest2;
  if (manifest2 && typeof manifest2 === "object" && "extra" in manifest2) {
    const extra = (manifest2 as { extra?: Record<string, unknown> }).extra;
    const expoClient = extra?.expoClient;
    if (expoClient && typeof expoClient === "object" && "hostUri" in expoClient) {
      const fromManifest2 = hostFromMetroUri(String((expoClient as { hostUri?: string }).hostUri));
      if (fromManifest2) return fromManifest2;
    }
  }

  const legacy = Constants.manifest && typeof Constants.manifest === "object" ? Constants.manifest : null;
  const fromLegacy =
    legacy && "hostUri" in legacy ? hostFromMetroUri(String((legacy as { hostUri?: string }).hostUri)) : null;
  if (fromLegacy) return fromLegacy;

  return null;
}

export function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }

  if (!__DEV__) {
    throw new Error("Missing EXPO_PUBLIC_API_BASE_URL（生产构建必须配置该环境变量）");
  }

  const host = inferDevHostFromConstants();
  if (host) {
    return `http://${host}:3000`;
  }

  return "http://127.0.0.1:3000";
}
