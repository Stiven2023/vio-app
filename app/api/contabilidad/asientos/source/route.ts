import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { accountingEntries, accountingEntryLines } from "@/src/db/schema";
import {
  dbJsonError,
  jsonError,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { accountingEntriesBySourceQuerySchema } from "@/src/utils/accounting-traceability-contract";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "contabilidad:asientos:source:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_CONTABILIDAD");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const parsedQuery = accountingEntriesBySourceQuerySchema.safeParse({
      sourceType: searchParams.get("sourceType") ?? "",
      sourceId: searchParams.get("sourceId") ?? "",
      status: searchParams.get("status") ?? undefined,
    });

    if (!parsedQuery.success) {
      return zodFirstErrorEnvelope(
        parsedQuery.error,
        "Parámetros de origen inválidos.",
      );
    }

    const { sourceType, sourceId, status } = parsedQuery.data;
    const { page, pageSize, offset } = parsePagination(searchParams);

    const conditions = [
      eq(accountingEntries.sourceType, sourceType),
      eq(accountingEntries.sourceId, sourceId),
    ];

    if (status === "POSTED" || status === "DRAFT" || status === "REVERSED") {
      conditions.push(eq(accountingEntries.status, status));
    }

    const where = and(...conditions);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(accountingEntries)
      .where(where);

    const entries = await db
      .select({
        id: accountingEntries.id,
        entryNumber: accountingEntries.entryNumber,
        period: accountingEntries.period,
        entryDate: accountingEntries.entryDate,
        status: accountingEntries.status,
        sourceModule: accountingEntries.sourceModule,
        sourceType: accountingEntries.sourceType,
        sourceId: accountingEntries.sourceId,
        description: accountingEntries.description,
        totalDebit: accountingEntries.totalDebit,
        totalCredit: accountingEntries.totalCredit,
        externalReference: accountingEntries.externalReference,
        postedAt: accountingEntries.postedAt,
        createdAt: accountingEntries.createdAt,
      })
      .from(accountingEntries)
      .where(where)
      .orderBy(desc(accountingEntries.entryDate), desc(accountingEntries.createdAt))
      .limit(pageSize)
      .offset(offset);

    const entryIds = entries.map((entry) => entry.id);

    const lines = entryIds.length
      ? await db
          .select({
            id: accountingEntryLines.id,
            entryId: accountingEntryLines.entryId,
            description: accountingEntryLines.description,
            debit: accountingEntryLines.debit,
            credit: accountingEntryLines.credit,
            lineOrder: accountingEntryLines.lineOrder,
            accountId: accountingEntryLines.accountId,
            thirdPartyType: accountingEntryLines.thirdPartyType,
            thirdPartyId: accountingEntryLines.thirdPartyId,
          })
          .from(accountingEntryLines)
          .where(inArray(accountingEntryLines.entryId, entryIds))
      : [];

    const linesByEntry = new Map<string, typeof lines>();

    for (const line of lines) {
      const current = linesByEntry.get(line.entryId) ?? [];

      current.push(line);
      linesByEntry.set(line.entryId, current);
    }

    return Response.json({
      items: entries.map((entry) => ({
        ...entry,
        lines: (linesByEntry.get(entry.id) ?? []).sort(
          (a, b) => Number(a.lineOrder) - Number(b.lineOrder),
        ),
      })),
      page,
      pageSize,
      total,
      hasNextPage: offset + entries.length < total,
    });
  } catch (error) {
    const response = dbJsonError(error, "No se pudieron consultar los asientos por origen.");

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudieron consultar los asientos por origen.",
    );
  }
}
