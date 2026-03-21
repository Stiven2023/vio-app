import { desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { employees, pettyCashFunds } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "contabilidad:caja-menor-funds:get",
    limit: 150,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_CAJA_MENOR");

  if (forbidden) return forbidden;

  try {
    const funds = await db
      .select({
        id: pettyCashFunds.id,
        name: pettyCashFunds.name,
        description: pettyCashFunds.description,
        initialBalance: pettyCashFunds.initialBalance,
        currentBalance: pettyCashFunds.currentBalance,
        maxBalance: pettyCashFunds.maxBalance,
        currency: pettyCashFunds.currency,
        status: pettyCashFunds.status,
        createdAt: pettyCashFunds.createdAt,
        responsibleName: employees.name,
      })
      .from(pettyCashFunds)
      .leftJoin(
        employees,
        eq(pettyCashFunds.responsibleEmployeeId, employees.id),
      )
      .orderBy(desc(pettyCashFunds.createdAt));

    return Response.json({ items: funds });
  } catch (error) {
    const dbError = dbErrorResponse(error);

    if (dbError) return dbError;

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "contabilidad:caja-menor-funds:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "GESTIONAR_CAJA_MENOR");

  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const { name, description, initialBalance, maxBalance, currency } = body;

    if (!name || !initialBalance) {
      return Response.json(
        { error: "Name and initial balance are required" },
        { status: 400 },
      );
    }

    const numInitial = parseFloat(initialBalance);

    if (isNaN(numInitial) || numInitial < 0) {
      return Response.json(
        { error: "Invalid initial balance" },
        { status: 400 },
      );
    }

    const [fund] = await db
      .insert(pettyCashFunds)
      .values({
        name,
        description: description || null,
        initialBalance: String(numInitial),
        currentBalance: String(numInitial),
        maxBalance: maxBalance ? String(parseFloat(maxBalance)) : null,
        currency: currency || "COP",
        status: "ACTIVE",
      })
      .returning();

    return Response.json(fund, { status: 201 });
  } catch (error) {
    const dbError = dbErrorResponse(error);

    if (dbError) return dbError;

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
