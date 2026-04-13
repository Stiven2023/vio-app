import { and, desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { employeeRequests } from "@/src/db/erp/schema";
import {
  dbJsonError,
  jsonError,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { resolveEmployeeIdFromRequest } from "@/src/utils/employee-session";
import { requirePermission } from "@/src/utils/permission-middleware";
import {
  createPerDiemSchema,
  perDiemListQuerySchema,
  type CreatePerDiemInput,
} from "@/src/utils/per-diem-contract";
import { rateLimit } from "@/src/utils/rate-limit";

const MODULE_TAG = "[PER_DIEM]";

type PerDiemMetadata = {
  supportInvoiceUrl: string;
  supportInvoiceNumber?: string;
  amount: string;
  expenseType: string;
  tripStartDate: string;
  tripEndDate: string;
  purchaseOrderId?: string;
  supplierInvoiceId?: string;
  notes?: string;
  accountingClassification: "ABONO";
  siigoEligibility: "PAID_100_REQUIRED";
};

function buildPerDiemDescription(input: CreatePerDiemInput): string {
  const payload: PerDiemMetadata = {
    supportInvoiceUrl: input.supportInvoiceUrl,
    supportInvoiceNumber: input.supportInvoiceNumber,
    amount: Number(input.amount).toFixed(2),
    expenseType: input.expenseType,
    tripStartDate: input.tripStartDate,
    tripEndDate: input.tripEndDate,
    purchaseOrderId: input.purchaseOrderId,
    supplierInvoiceId: input.supplierInvoiceId,
    notes: input.notes,
    accountingClassification: "ABONO",
    siigoEligibility: "PAID_100_REQUIRED",
  };

  return JSON.stringify(payload);
}

function tryParseDescription(value: unknown): PerDiemMetadata | null {
  const raw = String(value ?? "").trim();

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PerDiemMetadata>;

    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.supportInvoiceUrl !== "string") return null;
    if (typeof parsed.amount !== "string") return null;

    return {
      supportInvoiceUrl: parsed.supportInvoiceUrl,
      supportInvoiceNumber: parsed.supportInvoiceNumber,
      amount: parsed.amount,
      expenseType: String(parsed.expenseType ?? "OTHER"),
      tripStartDate: String(parsed.tripStartDate ?? ""),
      tripEndDate: String(parsed.tripEndDate ?? ""),
      purchaseOrderId: parsed.purchaseOrderId,
      supplierInvoiceId: parsed.supplierInvoiceId,
      notes: parsed.notes,
      accountingClassification: "ABONO",
      siigoEligibility: "PAID_100_REQUIRED",
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "hcm:viaticos:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PORTAL_HCM");

  if (forbidden) return forbidden;

  const employeeId = await resolveEmployeeIdFromRequest(request);

  if (!employeeId) {
    return jsonError(
      401,
      "UNAUTHORIZED",
      "No autenticado o sin perfil de empleado.",
    );
  }

  const { searchParams } = new URL(request.url);
  const parsedQuery = perDiemListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });

  if (!parsedQuery.success) {
    return zodFirstErrorEnvelope(
      parsedQuery.error,
      "Parametros invalidos para listar viaticos.",
    );
  }

  const { page, pageSize } = parsedQuery.data;
  const offset = (page - 1) * pageSize;

  try {
    const where = and(
      eq(employeeRequests.employeeId, employeeId),
      ilike(employeeRequests.subject, `${MODULE_TAG}%`),
    );

    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(employeeRequests)
      .where(where);

    const rows = await db
      .select({
        id: employeeRequests.id,
        subject: employeeRequests.subject,
        status: employeeRequests.status,
        priority: employeeRequests.priority,
        createdAt: employeeRequests.createdAt,
        description: employeeRequests.description,
      })
      .from(employeeRequests)
      .where(where)
      .orderBy(desc(employeeRequests.createdAt))
      .limit(pageSize)
      .offset(offset);

    const items = rows.map((row) => ({
      id: row.id,
      subject: row.subject,
      status: row.status,
      priority: row.priority,
      createdAt: row.createdAt,
      details: tryParseDescription(row.description),
    }));

    return Response.json({
      items,
      page,
      pageSize,
      total: countRow?.total ?? 0,
      hasNextPage: offset + rows.length < (countRow?.total ?? 0),
    });
  } catch (error) {
    const response = dbJsonError(
      error,
      "No se pudieron consultar los viaticos.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudieron consultar los viaticos.",
    );
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "hcm:viaticos:post",
    limit: 40,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PORTAL_HCM");

  if (forbidden) return forbidden;

  const employeeId = await resolveEmployeeIdFromRequest(request);

  if (!employeeId) {
    return jsonError(
      401,
      "UNAUTHORIZED",
      "No autenticado o sin perfil de empleado.",
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsedBody = createPerDiemSchema.safeParse(body);

  if (!parsedBody.success) {
    return zodFirstErrorEnvelope(
      parsedBody.error,
      "Datos invalidos para registrar viaticos.",
    );
  }

  const data = parsedBody.data;

  try {
    const [created] = await db
      .insert(employeeRequests)
      .values({
        employeeId,
        type: "SOLICITUD",
        subject: `${MODULE_TAG} ${data.expenseType}`,
        description: buildPerDiemDescription(data),
        requestDate: data.tripStartDate,
        priority: "MEDIA",
        status: "PENDIENTE",
      })
      .returning({
        id: employeeRequests.id,
        createdAt: employeeRequests.createdAt,
      });

    return Response.json(
      {
        ok: true,
        id: created.id,
        createdAt: created.createdAt,
        accountingClassification: "ABONO",
        siigoEligibility: "PAID_100_REQUIRED",
      },
      { status: 201 },
    );
  } catch (error) {
    const response = dbJsonError(error, "No se pudo registrar el viatico.");

    if (response) return response;

    return jsonError(500, "INTERNAL_ERROR", "No se pudo registrar el viatico.");
  }
}
