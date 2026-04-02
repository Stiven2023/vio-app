import { eq } from "drizzle-orm";

import { POST as syncCustomersPost } from "@/app/api/siigo/sync-customers/route";
import { db } from "@/src/db";
import { siigoSyncJobs } from "@/src/db/erp/schema";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

const ACCOUNTING_ROLES = new Set([
  "ADMINISTRADOR",
  "LIDER_FINANCIERA",
  "AUXILIAR_CONTABLE",
  "TESORERIA_Y_CARTERA",
]);

function isAccountingRole(role: string | null) {
  return Boolean(role && ACCOUNTING_ROLES.has(role));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "siigo:sync-jobs:retry",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PAGO");

  if (forbidden) return forbidden;

  const role = getRoleFromRequest(request);

  if (!isAccountingRole(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const jobId = String(id ?? "").trim();

  if (!jobId) return new Response("id required", { status: 400 });

  const [job] = await db
    .select({
      id: siigoSyncJobs.id,
      jobType: siigoSyncJobs.jobType,
      bankId: siigoSyncJobs.bankId,
    })
    .from(siigoSyncJobs)
    .where(eq(siigoSyncJobs.id, jobId))
    .limit(1);

  if (!job) return new Response("Not found", { status: 404 });

  if (job.jobType !== "SYNC_CUSTOMERS") {
    return new Response("Retry is not implemented for this job type", {
      status: 422,
    });
  }

  const headers = new Headers(request.headers);

  headers.set("x-siigo-job-retry", "1");

  const retryRequest = new Request(
    `http://localhost/api/siigo/sync-customers${job.bankId ? `?bankId=${encodeURIComponent(String(job.bankId))}` : ""}`,
    {
      method: "POST",
      headers,
    },
  );

  const response = await syncCustomersPost(retryRequest);
  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}
