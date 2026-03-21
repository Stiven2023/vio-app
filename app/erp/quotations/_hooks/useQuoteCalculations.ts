import type { QuoteItem, DocumentType } from "../_lib/types";

import { useMemo } from "react";

export interface QuoteCalculations {
  subtotal: number;
  iva: number;
  total: number;
  advancePayment: number;
}

export function useQuoteCalculations(
  items: QuoteItem[],
  shippingEnabled: boolean,
  shippingFee: number,
  insuranceEnabled: boolean,
  insuranceFee: number,
  documentType: DocumentType = "F", // F = Factura (con IVA), R = Razón social (sin IVA)
): QuoteCalculations {
  return useMemo(() => {
    const itemsSubtotal = items.reduce((acc, row) => {
      const subtotalLine = row.quantity * row.unitPrice;
      const discountAmount = subtotalLine * (row.discount / 100);
      const lineTotal = subtotalLine - discountAmount;

      // Sumar adiciones del item
      const additionsTotal = row.additions.reduce((addAcc, add) => {
        const addSubtotal = add.quantity * add.unitPrice;

        return addAcc + addSubtotal;
      }, 0);

      return acc + lineTotal + additionsTotal;
    }, 0);

    const subtotal = itemsSubtotal;
    const iva = documentType === "F" ? subtotal * 0.19 : 0; // IVA solo si es factura
    const extraShipping = shippingEnabled ? shippingFee : 0;
    const extraInsurance = insuranceEnabled ? insuranceFee : 0;
    const total = subtotal + iva + extraShipping + extraInsurance;
    const advancePayment = total * 0.5;

    return { subtotal, iva, total, advancePayment };
  }, [
    insuranceEnabled,
    insuranceFee,
    items,
    shippingEnabled,
    shippingFee,
    documentType,
  ]);
}
