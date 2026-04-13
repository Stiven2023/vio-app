import type { LegalDiscountsPreviewBody } from "@/src/utils/legal-discounts-contract";

type AppliedRule = {
  code: string;
  description: string;
};

type LegalDiscountBreakdown = {
  reteFuente: string;
  reteIva: string;
  reteIca: string;
  stamps: string;
  totalLegalDiscounts: string;
};

export type LegalDiscountsCalculationResult = {
  subtotal: string;
  ivaRate: string;
  ivaAmount: string;
  totalInvoice: string;
  discounts: LegalDiscountBreakdown;
  totalPayable: string;
  appliedRules: AppliedRule[];
};

const DEFAULT_RETE_FUENTE_BY_OPERATION: Record<
  LegalDiscountsPreviewBody["operationType"],
  number
> = {
  PURCHASE: 2.5,
  SERVICE: 4,
  FEE: 10,
};

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function toMoneyString(value: number) {
  return toMoney(value).toFixed(2);
}

function resolveReteFuenteRate(input: LegalDiscountsPreviewBody) {
  if (typeof input.reteFuenteRate === "number") {
    return input.reteFuenteRate;
  }

  return DEFAULT_RETE_FUENTE_BY_OPERATION[input.operationType];
}

function resolveRetentionFlags(input: LegalDiscountsPreviewBody) {
  const isSmall = input.customerProfile === "SMALL_CUSTOMER";
  const isLarge = input.customerProfile === "LARGE_CONTRIBUTOR";
  const isPublic = input.customerProfile === "PUBLIC_ENTITY";
  const isAgent = input.customerProfile === "WITHHOLDING_AGENT";

  // PUBLIC_ENTITY and SMALL_CUSTOMER don't apply reteFuente
  const applyReteFuente = !isSmall && !isPublic;
  const applyReteIva = isLarge;
  const applyReteIca = isLarge || isAgent;
  const applyStamps =
    typeof input.applyStamps === "boolean"
      ? input.applyStamps
      : isPublic || input.contractRequiresStamps;

  return {
    applyReteFuente,
    applyReteIva,
    applyReteIca,
    applyStamps,
  };
}

export function calculateLegalDiscounts(
  input: LegalDiscountsPreviewBody,
): LegalDiscountsCalculationResult {
  const subtotal = toMoney(Number(input.subtotal));
  const ivaRate = Number(input.ivaRate);
  const ivaAmount = toMoney(subtotal * (ivaRate / 100));
  const totalInvoice = toMoney(subtotal + ivaAmount);

  const reteFuenteRate = resolveReteFuenteRate(input);
  const flags = resolveRetentionFlags(input);

  const reteFuente = flags.applyReteFuente
    ? toMoney(subtotal * (reteFuenteRate / 100))
    : 0;
  const reteIca = flags.applyReteIca
    ? toMoney(subtotal * (Number(input.reteIcaRate) / 100))
    : 0;
  const reteIva = flags.applyReteIva
    ? toMoney(ivaAmount * (Number(input.reteIvaRate) / 100))
    : 0;
  const stamps = flags.applyStamps
    ? toMoney(totalInvoice * (Number(input.stampRate) / 100))
    : 0;

  const totalLegalDiscounts = toMoney(reteFuente + reteIca + reteIva + stamps);
  const totalPayable = toMoney(totalInvoice - totalLegalDiscounts);

  const appliedRules: AppliedRule[] = [
    {
      code: "IVA",
      description: `IVA principal al ${toMoney(ivaRate).toFixed(2)}%.`,
    },
  ];

  if (flags.applyReteFuente) {
    appliedRules.push({
      code: "RETE_FUENTE",
      description: `Retencion en la fuente al ${toMoney(reteFuenteRate).toFixed(2)}% sobre subtotal.`,
    });
  }

  if (flags.applyReteIca) {
    appliedRules.push({
      code: "RETE_ICA",
      description: `Retencion ICA al ${toMoney(Number(input.reteIcaRate)).toFixed(3)}% sobre subtotal.`,
    });
  }

  if (flags.applyReteIva) {
    appliedRules.push({
      code: "RETE_IVA",
      description: `Retencion IVA al ${toMoney(Number(input.reteIvaRate)).toFixed(2)}% sobre el IVA.`,
    });
  }

  if (flags.applyStamps) {
    appliedRules.push({
      code: "STAMPS",
      description: `Estampillas al ${toMoney(Number(input.stampRate)).toFixed(2)}% sobre subtotal.`,
    });
  }

  return {
    subtotal: toMoneyString(subtotal),
    ivaRate: toMoney(ivaRate).toFixed(2),
    ivaAmount: toMoneyString(ivaAmount),
    totalInvoice: toMoneyString(totalInvoice),
    discounts: {
      reteFuente: toMoneyString(reteFuente),
      reteIca: toMoneyString(reteIca),
      reteIva: toMoneyString(reteIva),
      stamps: toMoneyString(stamps),
      totalLegalDiscounts: toMoneyString(totalLegalDiscounts),
    },
    totalPayable: toMoneyString(totalPayable),
    appliedRules,
  };
}
