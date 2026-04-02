import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { payrollProvisions } from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function toMoneyString(value: number) {
  return value.toFixed(2);
}

function parseMoney(value: unknown) {
  const n = Number(value);

  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "payroll-provisions:patch",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(
    request,
    "CREAR_PROVISIONES_NOMINA",
  );

  if (forbidden) return forbidden;

  const { id } = await params;

  try {
    const body = await request.json();

    const [existing] = await db
      .select({ id: payrollProvisions.id })
      .from(payrollProvisions)
      .where(eq(payrollProvisions.id, id))
      .limit(1);

    if (!existing) {
      return new Response("Provisión no encontrada", { status: 404 });
    }

    const patch: Record<string, string> = {};

    const baseSalary = parseMoney(body.baseSalary);
    const transportAllowance = parseMoney(body.transportAllowance) ?? 0;
    const arlRatePct = parseMoney(body.arlRatePct);

    if (baseSalary !== null) {
      const salary = baseSalary;
      const transport =
        parseMoney(body.transportAllowance) !== null
          ? transportAllowance
          : Number(
              (
                await db
                  .select({ v: payrollProvisions.transportAllowance })
                  .from(payrollProvisions)
                  .where(eq(payrollProvisions.id, id))
                  .limit(1)
              )[0]?.v ?? 0,
            );

      const arl =
        arlRatePct !== null
          ? arlRatePct / 100
          : Number(
              (
                await db
                  .select({ v: payrollProvisions.arlContribution })
                  .from(payrollProvisions)
                  .where(eq(payrollProvisions.id, id))
                  .limit(1)
              )[0]?.v ?? 0,
            ) / salary;

      patch.baseSalary = toMoneyString(salary);
      patch.transportAllowance = toMoneyString(transport);
      patch.severancePay = toMoneyString((salary + transport) / 12);
      patch.severanceInterests = toMoneyString(
        ((salary + transport) / 12) * 0.12,
      );
      patch.serviceBonus = toMoneyString((salary + transport) / 12);
      patch.vacationProvision = toMoneyString(salary / 24);
      patch.healthContribution = toMoneyString(salary * 0.125);
      patch.pensionContribution = toMoneyString(salary * 0.16);
      patch.arlContribution = toMoneyString(salary * arl);
      patch.compensationBoxContribution = toMoneyString(salary * 0.04);
    } else {
      const fields = [
        ["severancePay", body.severancePay],
        ["severanceInterests", body.severanceInterests],
        ["serviceBonus", body.serviceBonus],
        ["vacationProvision", body.vacationProvision],
        ["healthContribution", body.healthContribution],
        ["pensionContribution", body.pensionContribution],
        ["arlContribution", body.arlContribution],
        ["compensationBoxContribution", body.compensationBoxContribution],
        ["transportAllowance", body.transportAllowance],
      ] as const;

      for (const [field, value] of fields) {
        const parsed = parseMoney(value);

        if (parsed !== null) {
          patch[field] = toMoneyString(parsed);
        }
      }
    }

    if (Object.keys(patch).length === 0) {
      return new Response("Sin cambios para aplicar", { status: 400 });
    }

    await db
      .update(payrollProvisions)
      .set(patch)
      .where(eq(payrollProvisions.id, id));

    return Response.json({ ok: true });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo actualizar la provisión", { status: 500 });
  }
}
