import { and, asc, eq, ilike } from "drizzle-orm";

import { db } from "@/src/db";
import { confectionists } from "@/src/db/erp/schema";
import { getUserIdFromRequest } from "@/src/utils/auth-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function ensureAuth(request: Request) {
  const userId = getUserIdFromRequest(request);

  if (!userId) {
    return {
      userId: null,
      response: new Response("Unauthorized", { status: 401 }),
    } as const;
  }

  return { userId, response: null } as const;
}

function str(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "shipments:recipients:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const auth = ensureAuth(request);

  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const area = str(searchParams.get("area")).toUpperCase();
  const q = str(searchParams.get("q"));

  if (area !== "CONFECCIONISTA") {
    return Response.json({ items: [] });
  }

  const where = and(
    eq(confectionists.isActive, true),
    q ? ilike(confectionists.name, `%${q}%`) : undefined,
  );

  const items = await db
    .select({
      id: confectionists.id,
      code: confectionists.confectionistCode,
      name: confectionists.name,
      contactName: confectionists.contactName,
    })
    .from(confectionists)
    .where(where)
    .orderBy(asc(confectionists.name))
    .limit(50);

  return Response.json({ items });
}
