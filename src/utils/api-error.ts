import { ZodError } from "zod";

import { dbErrorResponse } from "@/src/utils/db-errors";

export type FieldErrors = Record<string, string[]>;

export function jsonError(
  status: number,
  code: string,
  message: string,
  fieldErrors?: FieldErrors,
  requestId?: string,
) {
  return Response.json(
    {
      code,
      message,
      ...(fieldErrors ? { fieldErrors } : {}),
      ...(requestId ? { requestId } : {}),
    },
    { status },
  );
}

export function jsonForbidden(
  message = "No tienes permisos para realizar esta acción.",
) {
  return jsonError(403, "FORBIDDEN", message);
}

export function jsonNotFound(message = "Recurso no encontrado.") {
  return jsonError(404, "NOT_FOUND", message);
}

export function zodFirstErrorEnvelope(
  error: ZodError,
  message = "Datos inválidos.",
) {
  const firstIssue = error.issues[0];
  const field = String(firstIssue?.path?.join(".") || "body");
  const detail = firstIssue?.message ?? message;

  return jsonError(400, "VALIDATION_ERROR", message, {
    [field]: [detail],
  });
}

export function dbJsonError(
  error: unknown,
  fallbackMessage = "No se pudo completar la operación.",
) {
  const response = dbErrorResponse(error);

  if (!response) return null;

  return jsonError(response.status, "DATABASE_ERROR", fallbackMessage);
}