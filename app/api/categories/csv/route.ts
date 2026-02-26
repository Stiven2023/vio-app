import { asc } from "drizzle-orm";

import { db } from "@/src/db";
import { categories } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "categories:csv:get",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  const items = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.name));

  const header = "id;name";
  const rows = items.map((item) => `${item.id};${String(item.name ?? "").replace(/;/g, ",")}`);
  const csv = [header, ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=categories-id-name.csv",
      "Cache-Control": "no-store",
    },
  });
}
