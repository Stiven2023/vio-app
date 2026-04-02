import { sql } from "drizzle-orm";

import { orderPayments } from "@/src/db/erp/schema";

type PaymentCodeMethod = "EFECTIVO" | "TRANSFERENCIA" | "CREDITO";

function resolvePrefix(method: PaymentCodeMethod, bankIsOfficial?: boolean | null) {
  if (method === "EFECTIVO") return "e";
  if (method === "TRANSFERENCIA") return bankIsOfficial ? "oc" : "noc";

  return "noc";
}

function formatCode(prefix: string, sequence: number) {
  return `${prefix}-${sequence}`;
}

async function getLastSequenceForPrefix(dbOrTx: any, prefix: string) {
  const pattern = `^${prefix}-[0-9]+$`;

  await dbOrTx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`payment-reference:${prefix}`}))`,
  );

  const [row] = (await dbOrTx
    .select({
      maxSequence: sql<number>`coalesce(max((regexp_replace(lower(${orderPayments.referenceCode}), ${`^${prefix}-`}, ''))::int), 100000)`,
    })
    .from(orderPayments)
    .where(sql`lower(${orderPayments.referenceCode}) ~ ${pattern}`)) as Array<{
    maxSequence: number | string | null;
  }>;

  const value = Number(row?.maxSequence ?? 100000);

  if (!Number.isFinite(value) || value < 100000) return 100000;

  return Math.floor(value);
}

export async function generatePaymentReferenceCode(
  dbOrTx: any,
  input: { method: PaymentCodeMethod; bankIsOfficial?: boolean | null },
) {
  const prefix = resolvePrefix(input.method, input.bankIsOfficial ?? null);
  const lastSequence = await getLastSequenceForPrefix(dbOrTx, prefix);

  return formatCode(prefix, lastSequence + 1);
}

export async function generatePaymentReferenceCodes(
  dbOrTx: any,
  input: {
    method: PaymentCodeMethod;
    bankIsOfficial?: boolean | null;
    count: number;
  },
) {
  const prefix = resolvePrefix(input.method, input.bankIsOfficial ?? null);
  const size = Math.max(1, Math.floor(Number(input.count) || 1));
  const lastSequence = await getLastSequenceForPrefix(dbOrTx, prefix);
  const references: string[] = [];

  for (let index = 1; index <= size; index += 1) {
    references.push(formatCode(prefix, lastSequence + index));
  }

  return references;
}
