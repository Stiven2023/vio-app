import { eq } from "drizzle-orm";

import { banks } from "@/src/db/schema";

export const PAYMENT_TRANSFER_CURRENCIES = new Set(["COP", "USD"]);

export type PaymentBankRow = {
  id: string;
  code: string;
  name: string;
  accountRef: string;
  isActive: boolean | null;
};

export async function resolvePaymentBankById(
  dbOrTx: any,
  bankId: string,
): Promise<PaymentBankRow | null> {
  const id = String(bankId ?? "").trim();

  if (!id) return null;

  const [bank] = await dbOrTx
    .select({
      id: banks.id,
      code: banks.code,
      name: banks.name,
      accountRef: banks.accountRef,
      isActive: banks.isActive,
    })
    .from(banks)
    .where(eq(banks.id, id))
    .limit(1);

  return bank ?? null;
}

export function validatePaymentBankCurrency(
  bank: Pick<PaymentBankRow, "code" | "isActive"> | null,
  currency: string | null,
) {
  if (!bank) {
    return "A bank is required for transfer payments";
  }

  if (bank.isActive === false) {
    return "Selected bank is inactive";
  }

  if (!currency || !PAYMENT_TRANSFER_CURRENCIES.has(currency)) {
    return "Transfer currency must be COP or USD";
  }

  const isExternalBank = bank.code === "VIO_EXT";

  if (currency === "USD" && !isExternalBank) {
    return "USD is only allowed when bank code is VIO-EXT";
  }

  if (isExternalBank && currency !== "USD") {
    return "When bank code is VIO-EXT, currency must be USD";
  }

  return null;
}
