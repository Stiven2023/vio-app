type DbErrorShape = {
  code?: string;
  message?: string;
  cause?: { code?: string; message?: string } | null;
};

function readDbErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const e = error as DbErrorShape;
  return e.code ?? e.cause?.code ?? null;
}

function readDbErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const e = error as DbErrorShape;
  return `${e.message ?? ""} ${e.cause?.message ?? ""}`.trim();
}

export function dbErrorResponse(error: unknown) {
  const code = readDbErrorCode(error);
  const msg = readDbErrorMessage(error).toLowerCase();

  if (code === "ECONNREFUSED" || msg.includes("econnrefused")) {
    return new Response("Base de datos no disponible", { status: 503 });
  }

  if (code === "ENOTFOUND" || msg.includes("enotfound")) {
    return new Response("No se pudo resolver el host de la base de datos", {
      status: 503,
    });
  }

  if (code === "ETIMEDOUT" || msg.includes("timeout")) {
    return new Response("Tiempo de espera agotado al conectar la base de datos", {
      status: 503,
    });
  }

  return null;
}
