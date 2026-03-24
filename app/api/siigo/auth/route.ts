import {
  authenticateWithSiigo,
  getSiigoCredentialDebugInfo,
  getSiigoTokenStatus,
  SiigoApiError,
} from "@/src/utils/siigo";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "siigo:auth:get",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  return Response.json(getSiigoTokenStatus());
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "siigo:auth:post",
    limit: 20,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  try {
    const result = await authenticateWithSiigo();

    return Response.json({
      ok: true,
      source: result.source,
      obtainedAt: new Date(result.obtainedAt).toISOString(),
      expiresAt: new Date(result.expiresAt).toISOString(),
      expiresIn: result.expiresIn,
      tokenField:
        result.payload.access_token != null
          ? "access_token"
          : result.payload.token != null
            ? "token"
            : result.payload.accessToken != null
              ? "accessToken"
              : result.source === "cache"
                ? "cache"
                : "unknown",
    });
  } catch (error) {
    const debug = getSiigoCredentialDebugInfo();

    if (error instanceof SiigoApiError) {
      const upstreamCode = Array.isArray(error.payload?.errors)
        ? String(
            (error.payload.errors[0] as { code?: unknown } | undefined)?.code ??
              "",
          )
        : "";

      return Response.json(
        {
          ok: false,
          error: error.message,
          hint:
            upstreamCode === "invalid_value"
              ? "Siigo rechazo la credencial configurada. Verifica en el portal de Siigo que la access_key vigente sea la correcta y reemplaza la del entorno local."
              : "La autenticacion fue rechazada por Siigo.",
          warning: debug.warning,
          debug,
        },
        { status: error.status },
      );
    }

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Siigo auth failed",
        warning: debug.warning,
        debug,
      },
      { status: 502 },
    );
  }
}