import { and, desc, eq, or, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { confectionistRates } from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type RateBody = {
  garmentType?: unknown;
  garmentSubtype?: unknown;
  process?: unknown;
  sizeRange?: unknown;
  ratePerUnit?: unknown;
  currency?: unknown;
  unit?: unknown;
  validFrom?: unknown;
  validTo?: unknown;
  notes?: unknown;
};

function str(value: unknown) {
  return String(value ?? "").trim();
}

function toPositiveDecimal(value: unknown): string | null {
  const num = Number(String(value ?? "").replace(/,/g, "."));

  if (!Number.isFinite(num) || num <= 0) return null;

  return num.toFixed(2);
}

function isValidDate(value: unknown): boolean {
  if (!value) return false;
  const s = String(value).trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "confectionists:rates:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_CONFECCIONISTAS");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") !== "false";
    const garmentType = searchParams.get("garmentType") ?? null;

    const conditions = [];

    if (activeOnly) conditions.push(eq(confectionistRates.isActive, true));
    if (garmentType) conditions.push(eq(confectionistRates.garmentType, garmentType));

    const rows = await db
      .select()
      .from(confectionistRates)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(confectionistRates.validFrom));

    return Response.json({ items: rows });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar las tarifas", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "confectionists:rates:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ADMINISTRAR_TARIFAS");

  if (forbidden) return forbidden;

  try {
    const body = (await request.json().catch(() => ({}))) as RateBody;
    const garmentType = str(body.garmentType);
    const ratePerUnit = toPositiveDecimal(body.ratePerUnit);
    const validFrom = str(body.validFrom);

    const errors: Record<string, string[]> = {};

    if (!garmentType) errors.garmentType = ["Tipo de prenda requerido."];
    if (!ratePerUnit) errors.ratePerUnit = ["Tarifa por unidad inválida."];
    if (!isValidDate(validFrom)) errors.validFrom = ["Fecha de vigencia inválida (YYYY-MM-DD)."];

    if (Object.keys(errors).length > 0) {
      return Response.json({ errors }, { status: 422 });
    }

    const validTo = isValidDate(body.validTo) ? str(body.validTo) : null;
    const employeeId = getEmployeeIdFromRequest(request);

    const [created] = await db
      .insert(confectionistRates)
      .values({
        garmentType,
        garmentSubtype: str(body.garmentSubtype) || null,
        process: str(body.process) || null,
        sizeRange: str(body.sizeRange) || null,
        ratePerUnit: ratePerUnit!,
        currency: str(body.currency) || "COP",
        unit: str(body.unit) || "UN",
        validFrom,
        validTo,
        notes: str(body.notes) || null,
        isActive: true,
        createdBy: employeeId,
      })
      .returning({ id: confectionistRates.id });

    return Response.json({ id: created.id }, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo crear la tarifa", { status: 500 });
  }
}
