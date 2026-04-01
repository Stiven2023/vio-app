type SiigoTokenCache = {
  token: string;
  obtainedAt: number;
  expiresAt: number;
};

type SiigoAuthPayload = {
  access_token?: unknown;
  token?: unknown;
  accessToken?: unknown;
  expires_in?: unknown;
  expiresIn?: unknown;
  [key: string]: unknown;
};

type SiigoAuthResult = {
  token: string;
  obtainedAt: number;
  expiresAt: number;
  expiresIn: number | null;
  payload: SiigoAuthPayload;
  source: "remote" | "cache" | "env";
};

export class SiigoApiError extends Error {
  status: number;
  payload: SiigoAuthPayload;

  constructor(message: string, status: number, payload: SiigoAuthPayload) {
    super(message);
    this.name = "SiigoApiError";
    this.status = status;
    this.payload = payload;
  }
}

export type SiigoTokenStatus = {
  hasToken: boolean;
  obtainedAt: string | null;
  expiresAt: string | null;
  expiresIn: number | null;
  baseUrl: string;
  liveSubmissionEnabled: boolean;
};

export type SiigoCredentialDebugInfo = {
  usernameConfigured: boolean;
  accessKeyConfigured: boolean;
  tokenConfigured: boolean;
  accessKeySource: "SIIGO_ACCESS_KEY" | "SIIGO_API_SECRET" | "missing";
  accessKeyLength: number | null;
  accessKeyLooksBase64: boolean;
  partnerIdConfigured: boolean;
  baseUrl: string;
  warning: string | null;
};

type SiigoRequestOptions = RequestInit & {
  skipAuth?: boolean;
  retryOnUnauthorized?: boolean;
};

const DEFAULT_SIIGO_BASE_URL = "https://api.siigo.com";
const DEFAULT_TOKEN_TTL_MS = 5 * 60 * 1000;

let tokenCache: SiigoTokenCache | null = null;

function getSiigoBaseUrl() {
  return String(process.env.SIIGO_API_BASE_URL ?? DEFAULT_SIIGO_BASE_URL)
    .trim()
    .replace(/\/$/, "");
}

function getSiigoPartnerId() {
  return cleanEnvValue(process.env.SIIGO_PARTNER_ID);
}

function getStaticSiigoToken() {
  return cleanEnvValue(process.env.SIIGO_TOKEN ?? process.env.SIIGO_API_TOKEN);
}

function toAuthorizationHeader(token: string, source: SiigoAuthResult["source"]) {
  const normalized = String(token ?? "").trim();

  if (!normalized) return normalized;
  if (/^(Bearer|Basic)\s+/i.test(normalized)) return normalized;

  // For env token mode we preserve the token exactly as configured.
  if (source === "env") return normalized;

  return `Bearer ${normalized}`;
}

function buildSiigoApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (
    normalizedPath === "/auth" ||
    normalizedPath.startsWith("/v1/") ||
    normalizedPath === "/v1"
  ) {
    return `${getSiigoBaseUrl()}${normalizedPath}`;
  }

  return `${getSiigoBaseUrl()}/v1${normalizedPath}`;
}

function cleanEnvValue(value: string | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/^['"]+|['"]+$/g, "");
}

function looksLikeBase64(value: string) {
  if (!value || value.length < 16) return false;
  if (!/^[A-Za-z0-9+/=]+$/.test(value)) return false;

  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=");

  try {
    const decoded = atob(padded);

    return decoded.includes(":");
  } catch {
    return false;
  }
}

export function getSiigoCredentialDebugInfo(): SiigoCredentialDebugInfo {
  const username = cleanEnvValue(process.env.SIIGO_USER_KEY);
  const accessKeyEnv = cleanEnvValue(process.env.SIIGO_ACCESS_KEY);
  const apiSecretEnv = cleanEnvValue(process.env.SIIGO_API_SECRET);
  const effectiveAccessKey = accessKeyEnv || apiSecretEnv;
  const staticToken = getStaticSiigoToken();
  const partnerId = getSiigoPartnerId();

  const accessKeyWarning = accessKeyEnv
    ? null
    : apiSecretEnv
      ? "La integración está usando SIIGO_API_SECRET como fallback legacy. Define SIIGO_ACCESS_KEY con la credencial vigente de Siigo y reinicia el servidor."
      : "No hay access_key configurada en el entorno.";

  const partnerIdWarning = partnerId
    ? null
    : "Falta SIIGO_PARTNER_ID. Siigo requiere el header Partner-Id en todas las solicitudes.";

  return {
    usernameConfigured: Boolean(username),
    accessKeyConfigured: Boolean(effectiveAccessKey),
    tokenConfigured: Boolean(staticToken),
    accessKeySource: accessKeyEnv
      ? "SIIGO_ACCESS_KEY"
      : apiSecretEnv
        ? "SIIGO_API_SECRET"
        : "missing",
    accessKeyLength: effectiveAccessKey ? effectiveAccessKey.length : null,
    accessKeyLooksBase64: looksLikeBase64(effectiveAccessKey),
    partnerIdConfigured: Boolean(partnerId),
    baseUrl: getSiigoBaseUrl(),
    warning: accessKeyWarning ?? partnerIdWarning,
  };
}

function getSiigoCredentials() {
  const username = cleanEnvValue(process.env.SIIGO_USER_KEY);
  const accessKey = cleanEnvValue(
    process.env.SIIGO_ACCESS_KEY ?? process.env.SIIGO_API_SECRET,
  );

  if (!username || !accessKey) {
    throw new Error(
      "Faltan credenciales de Siigo. Define SIIGO_USER_KEY y SIIGO_ACCESS_KEY.",
    );
  }

  return {
    username,
    accessKey,
  };
}

function parseExpiryMs(payload: SiigoAuthPayload) {
  const raw = payload.expires_in ?? payload.expiresIn;
  const seconds = Number(raw);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_TOKEN_TTL_MS;
  }

  return Math.max(60_000, seconds * 1000);
}

function readTokenFromPayload(payload: SiigoAuthPayload) {
  const token = payload.access_token ?? payload.token ?? payload.accessToken;
  const normalized = String(token ?? "").trim();

  if (!normalized) {
    throw new Error(
      "La autenticación de Siigo no devolvió un token reconocible.",
    );
  }

  return normalized;
}

async function parseJsonSafe(response: Response) {
  try {
    return (await response.json()) as SiigoAuthPayload;
  } catch {
    return {} as SiigoAuthPayload;
  }
}

export function clearSiigoTokenCache() {
  tokenCache = null;
}

export function getSiigoTokenStatus(): SiigoTokenStatus {
  const liveRaw = String(process.env.SIIGO_ALLOW_LIVE_SUBMISSION ?? "")
    .trim()
    .toLowerCase();
  const liveSubmissionEnabled =
    liveRaw === "1" ||
    liveRaw === "true" ||
    liveRaw === "yes" ||
    liveRaw === "on";

  if (!tokenCache || tokenCache.expiresAt <= Date.now()) {
    if (tokenCache && tokenCache.expiresAt <= Date.now()) {
      tokenCache = null;
    }

    return {
      hasToken: false,
      obtainedAt: null,
      expiresAt: null,
      expiresIn: null,
      baseUrl: getSiigoBaseUrl(),
      liveSubmissionEnabled,
    };
  }

  return {
    hasToken: true,
    obtainedAt: new Date(tokenCache.obtainedAt).toISOString(),
    expiresAt: new Date(tokenCache.expiresAt).toISOString(),
    expiresIn: Math.max(
      0,
      Math.floor((tokenCache.expiresAt - Date.now()) / 1000),
    ),
    baseUrl: getSiigoBaseUrl(),
    liveSubmissionEnabled,
  };
}

export async function authenticateWithSiigo(args?: {
  forceRefresh?: boolean;
}): Promise<SiigoAuthResult> {
  const forceRefresh = Boolean(args?.forceRefresh);
  const staticToken = getStaticSiigoToken();

  if (staticToken) {
    const now = Date.now();

    return {
      token: staticToken,
      obtainedAt: now,
      expiresAt: now + DEFAULT_TOKEN_TTL_MS,
      expiresIn: null,
      payload: {},
      source: "env",
    };
  }

  if (!forceRefresh && tokenCache && tokenCache.expiresAt > Date.now()) {
    return {
      token: tokenCache.token,
      obtainedAt: tokenCache.obtainedAt,
      expiresAt: tokenCache.expiresAt,
      expiresIn: Math.max(
        0,
        Math.floor((tokenCache.expiresAt - Date.now()) / 1000),
      ),
      payload: {},
      source: "cache",
    };
  }

  const { username, accessKey } = getSiigoCredentials();
  const partnerId = getSiigoPartnerId();
  const authHeaders: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (partnerId) {
    authHeaders["Partner-Id"] = partnerId;
  }

  const response = await fetch(buildSiigoApiUrl("/auth"), {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      username,
      access_key: accessKey,
    }),
    cache: "no-store",
  });

  const payload = await parseJsonSafe(response);

  if (!response.ok) {
    throw new SiigoApiError(
      `Siigo auth failed (${response.status}): ${JSON.stringify(payload)}`,
      response.status,
      payload,
    );
  }

  const token = readTokenFromPayload(payload);
  const ttlMs = parseExpiryMs(payload);
  const obtainedAt = Date.now();
  const expiresAt = Date.now() + ttlMs - 30_000;

  tokenCache = {
    token,
    obtainedAt,
    expiresAt,
  };

  return {
    token,
    obtainedAt,
    expiresAt,
    expiresIn:
      payload.expires_in != null || payload.expiresIn != null
        ? Math.max(0, Math.floor(ttlMs / 1000))
        : null,
    payload,
    source: "remote",
  };
}

export async function siigoRequest(
  path: string,
  options?: SiigoRequestOptions,
): Promise<Response> {
  const {
    skipAuth = false,
    retryOnUnauthorized = true,
    headers,
    ...init
  } = options ?? {};

  const finalHeaders = new Headers(headers ?? {});

  finalHeaders.set("Accept", finalHeaders.get("Accept") ?? "application/json");

  const partnerId = getSiigoPartnerId();

  if (partnerId && !finalHeaders.has("Partner-Id")) {
    finalHeaders.set("Partner-Id", partnerId);
  }

  if (!skipAuth) {
    const auth = await authenticateWithSiigo();

    finalHeaders.set("Authorization", toAuthorizationHeader(auth.token, auth.source));
  }

  const url = buildSiigoApiUrl(path);

  const response = await fetch(url, {
    ...init,
    headers: finalHeaders,
    cache: init.cache ?? "no-store",
  });

  if (!skipAuth && retryOnUnauthorized && response.status === 401) {
    const auth = await authenticateWithSiigo({ forceRefresh: true });
    const retryHeaders = new Headers(finalHeaders);

    retryHeaders.set(
      "Authorization",
      toAuthorizationHeader(auth.token, auth.source),
    );

    return fetch(url, {
      ...init,
      headers: retryHeaders,
      cache: init.cache ?? "no-store",
    });
  }

  return response;
}

export async function siigoJson<T>(
  path: string,
  options?: SiigoRequestOptions,
): Promise<T> {
  const response = await siigoRequest(path, options);
  const payload = await parseJsonSafe(response);

  if (!response.ok) {
    throw new SiigoApiError(
      `Siigo request failed (${response.status}): ${JSON.stringify(payload)}`,
      response.status,
      payload,
    );
  }

  return payload as T;
}
