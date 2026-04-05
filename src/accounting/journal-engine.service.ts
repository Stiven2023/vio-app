import { and, asc, count, eq, like } from "drizzle-orm";

import { db } from "@/src/db";
import {
  accountingAccounts,
  accountingCostCenters,
  accountingEntries,
  accountingEntryLines,
  accountingRuleDefinitions,
} from "@/src/db/schema";

import {
  periodGuard,
} from "./period-guard.service";
import { formatAccountingPeriodFromDate } from "./accounting-period.helpers";
import {
  resolveAccountingSourceModule,
  resolveVoucherType,
} from "./journal-engine.helpers";

export type AccountingEvent = {
  sourceType: string;
  event: string;
  sourceId: string;
  fecha: string;
  data: Record<string, unknown>;
  costCenterCode?: string;
  createdBy?: string;
};

type JournalLineDraft = {
  accountId: string;
  costCenterId?: string | null;
  debit: string;
  credit: string;
  description: string;
  lineOrder: number;
  metadata: Record<string, unknown>;
};

function toAmount(value: unknown) {
  const normalized = Number(String(value ?? "0"));

  if (!Number.isFinite(normalized)) {
    return 0;
  }

  return normalized;
}

function toMoney(value: number) {
  return value.toFixed(2);
}

export class JournalEntryEngine {
  async processEvent(event: AccountingEvent): Promise<string> {
    await periodGuard.assertOpen(event.fecha);

    const sourceModule = resolveAccountingSourceModule(event.sourceType);
    const rules = await db
      .select({
        id: accountingRuleDefinitions.id,
        descriptionTemplate: accountingRuleDefinitions.descriptionTemplate,
        debitAccountCode: accountingRuleDefinitions.debitAccountCode,
        creditAccountCode: accountingRuleDefinitions.creditAccountCode,
        amountField: accountingRuleDefinitions.amountField,
        sortOrder: accountingRuleDefinitions.sortOrder,
      })
      .from(accountingRuleDefinitions)
      .where(
        and(
          eq(accountingRuleDefinitions.sourceModule, sourceModule),
          eq(accountingRuleDefinitions.sourceType, event.sourceType),
          eq(accountingRuleDefinitions.event, event.event),
          eq(accountingRuleDefinitions.isActive, true),
        ),
      )
      .orderBy(asc(accountingRuleDefinitions.sortOrder));

    if (rules.length === 0) {
      throw new Error(`Sin regla para ${event.sourceType}/${event.event}`);
    }

    const costCenter = event.costCenterCode
      ? await this.getCostCenter(event.costCenterCode)
      : undefined;

    const lines: JournalLineDraft[] = [];
    let debitTotal = 0;
    let creditTotal = 0;

    for (const rule of rules) {
      const amount = toAmount(event.data[rule.amountField]);

      if (amount === 0) {
        continue;
      }

      const debitAccount = await this.getAccount(rule.debitAccountCode);
      const creditAccount = await this.getAccount(rule.creditAccountCode);
      const amountAsMoney = toMoney(amount);
      const nextLineOrder = lines.length + 1;
      const lineBase = {
        costCenterId: costCenter?.id ?? null,
        description: rule.descriptionTemplate,
        metadata: {
          sourceType: event.sourceType,
          event: event.event,
          sourceId: event.sourceId,
          amountField: rule.amountField,
        },
      };

      lines.push({
        accountId: debitAccount.id,
        debit: amountAsMoney,
        credit: "0.00",
        lineOrder: nextLineOrder,
        ...lineBase,
      });
      lines.push({
        accountId: creditAccount.id,
        debit: "0.00",
        credit: amountAsMoney,
        lineOrder: nextLineOrder + 1,
        ...lineBase,
      });

      debitTotal += amount;
      creditTotal += amount;
    }

    if (lines.length === 0) {
      throw new Error(`Las reglas de ${event.sourceType}/${event.event} no produjeron líneas contables.`);
    }

    const voucherType = resolveVoucherType(event.sourceType);
    const year = Number(event.fecha.slice(0, 4));
    const period = formatAccountingPeriodFromDate(event.fecha);

    return db.transaction(async (tx) => {
      const entryNumber = await this.nextNumero(tx, voucherType, year);
      const [inserted] = await tx
        .insert(accountingEntries)
        .values({
          entryNumber,
          voucherType,
          period,
          entryDate: event.fecha,
          status: "POSTED",
          sourceModule,
          sourceType: event.sourceType,
          sourceId: event.sourceId,
          description: `${event.sourceType} · ${event.event}`,
          totalDebit: toMoney(debitTotal),
          totalCredit: toMoney(creditTotal),
          postedAt: new Date(),
          postedBy: event.createdBy ?? null,
          createdBy: event.createdBy ?? null,
          metadata: {
            event: event.event,
            sourceData: event.data,
          },
        })
        .returning({ id: accountingEntries.id });

      await tx.insert(accountingEntryLines).values(
        lines.map((line) => ({
          entryId: inserted.id,
          accountId: line.accountId,
          costCenterId: line.costCenterId ?? null,
          description: line.description,
          debit: line.debit,
          credit: line.credit,
          lineOrder: line.lineOrder,
          metadata: line.metadata,
        })),
      );

      return inserted.id;
    });
  }

  private async getAccount(code: string) {
    const [account] = await db
      .select({
        id: accountingAccounts.id,
        code: accountingAccounts.code,
        isActive: accountingAccounts.isActive,
        isPostable: accountingAccounts.isPostable,
      })
      .from(accountingAccounts)
      .where(eq(accountingAccounts.code, code))
      .limit(1);

    if (!account?.id) {
      throw new Error(`La cuenta contable ${code} no existe.`);
    }

    if (account.isActive !== true || account.isPostable !== true) {
      throw new Error(`La cuenta contable ${code} no está activa o no admite movimientos.`);
    }

    return account;
  }

  private async getCostCenter(code: string) {
    const [costCenter] = await db
      .select({ id: accountingCostCenters.id, code: accountingCostCenters.code })
      .from(accountingCostCenters)
      .where(eq(accountingCostCenters.code, code))
      .limit(1);

    return costCenter;
  }

  private async nextNumero(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    voucherType: string,
    year: number,
  ) {
    const [result] = await tx
      .select({ total: count() })
      .from(accountingEntries)
      .where(
        and(
          eq(accountingEntries.voucherType, voucherType),
          like(accountingEntries.period, `${year}-%`),
        ),
      );

    return `${voucherType}-${year}-${String(Number(result?.total ?? 0) + 1).padStart(4, "0")}`;
  }
}

export const journalEntryEngine = new JournalEntryEngine();