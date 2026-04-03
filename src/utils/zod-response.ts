import { ZodError } from "zod";

/**
 * Converts a ZodError into a 400 Response with a JSON body listing field errors.
 * Usage:
 *   const parsed = schema.safeParse(body);
 *   if (!parsed.success) return zodErrorResponse(parsed.error);
 */
export function zodErrorResponse(error: ZodError): Response {
  const issues = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

  return Response.json(
    { error: "Datos inválidos", issues },
    { status: 400 },
  );
}

/**
 * Returns the first ZodError message as a plain-text 400 Response.
 * Useful when you want a simple string error rather than JSON.
 */
export function zodFirstErrorResponse(error: ZodError): Response {
  return new Response(error.issues[0]?.message ?? "Datos inválidos", {
    status: 400,
  });
}
