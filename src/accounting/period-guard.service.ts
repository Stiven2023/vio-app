import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { accountingPeriods } from "@/src/db/schema";

import { formatAccountingPeriodFromDate } from "./accounting-period.helpers";

export class PeriodClosedError extends Error {
  constructor(year: number, month: number) {
    super(
      `El período ${year}-${String(month).padStart(2, "0")} está CERRADO, BLOQUEADO o no admite movimientos. No se pueden registrar asientos.`,
    );
    this.name = "PeriodClosedError";
  }
}

export class PeriodGuard {
  async assertOpen(isoDate: string): Promise<void> {
    const period = formatAccountingPeriodFromDate(isoDate);
    const [year, month] = period.split("-").map(Number);

    const [existing] = await db
      .select({ id: accountingPeriods.id, status: accountingPeriods.status })
      .from(accountingPeriods)
      .where(eq(accountingPeriods.period, period))
      .limit(1);

    if (!existing?.id) {
      await this.createPeriod(year, month);
      return;
    }

    if (existing.status === "CLOSED" || existing.status === "BLOCKED") {
      throw new PeriodClosedError(year, month);
    }
  }

  async createPeriod(year: number, month: number): Promise<void> {
    const period = `${year}-${String(month).padStart(2, "0")}`;

    await db
      .insert(accountingPeriods)
      .values({
        period,
        status: "OPEN",
        closureType: "MENSUAL",
      })
      .onConflictDoNothing();
  }

  async getPeriodId(isoDate: string): Promise<string> {
    const period = formatAccountingPeriodFromDate(isoDate);

    const [existing] = await db
      .select({ id: accountingPeriods.id })
      .from(accountingPeriods)
      .where(eq(accountingPeriods.period, period))
      .limit(1);

    if (!existing?.id) {
      throw new Error(`No existe el período contable ${period}.`);
    }

    return existing.id;
  }
}

export const periodGuard = new PeriodGuard();