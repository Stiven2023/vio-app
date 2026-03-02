import { requireExternalAccessActiveClient } from "@/src/utils/external-auth";

export async function GET(request: Request) {
  const { error, payload, client } = await requireExternalAccessActiveClient(request);

  if (error) return error;

  return Response.json({ ok: true, session: payload, client });
}
