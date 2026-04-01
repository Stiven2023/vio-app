import type {
  ClientPriceType,
  QuoteForm,
  QuoteItem,
  TaxZone,
} from "../_lib/types";
import type { QuoteCalculations } from "./useQuoteCalculations";

import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";

import { QUOTATION_COPY } from "../_lib/constants";
import { getQuotationUiLocale } from "../_lib/utils";
import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";

export function useSaveQuotation(
  quoteId?: string,
  initialQuoteCode = "Assigned on save",
) {
  const locale = getQuotationUiLocale();
  const copy = QUOTATION_COPY[locale];
  const [quoteCode, setQuoteCode] = useState<string>(initialQuoteCode);
  const [submitting, setSubmitting] = useState(false);

  const saveQuotation = useCallback(
    async (
      form: QuoteForm,
      items: QuoteItem[],
      computed: QuoteCalculations,
      clientPriceType: ClientPriceType | null,
      shippingEnabled: boolean,
      shippingFee: number,
      insuranceEnabled: boolean,
      insuranceFee: number,
      withholdings: {
        municipalityFiscalSnapshot: string;
        taxZoneSnapshot: TaxZone;
        withholdingTaxRate: number;
        withholdingIcaRate: number;
        withholdingIvaRate: number;
        withholdingTaxAmount: number;
        withholdingIcaAmount: number;
        withholdingIvaAmount: number;
        totalAfterWithholdings: number;
      },
    ): Promise<{ ok: boolean; id?: string; quoteCode?: string }> => {
      if (submitting) return { ok: false };

      if (!form.clientId) {
        toast.error(copy.toasts.selectClient);

        return { ok: false };
      }

      if (!form.sellerId) {
        toast.error(copy.toasts.sellerNotFound);

        return { ok: false };
      }

      const validItems = items.filter(
        (row) => row.productId && row.quantity > 0 && row.unitPrice >= 0,
      );

      if (validItems.length === 0) {
        toast.error(copy.toasts.addValidItem);

        return { ok: false };
      }

      setSubmitting(true);
      try {
        const quoteData: any = {
          // IDs only (essential data)
          clientId: form.clientId,
          sellerId: form.sellerId,
          documentType: form.documentType,
          currency: form.currency,
          expiryDate: form.expiryDate,
          paymentTerms: form.paymentTerms,
          promissoryNoteNumber:
            form.paymentTerms === "CREDITO" ? form.promissoryNoteNumber : null,
          // Shipping and insurance configuration
          shippingEnabled,
          shippingFee,
          insuranceEnabled,
          insuranceFee,
          // Calculated totals
          subtotal: computed.subtotal,
          iva: computed.iva,
          total: computed.total,
          advancePayment: computed.advancePayment,
          municipalityFiscalSnapshot: withholdings.municipalityFiscalSnapshot,
          taxZoneSnapshot: withholdings.taxZoneSnapshot,
          withholdingTaxRate: withholdings.withholdingTaxRate,
          withholdingIcaRate: withholdings.withholdingIcaRate,
          withholdingIvaRate: withholdings.withholdingIvaRate,
          withholdingTaxAmount: withholdings.withholdingTaxAmount,
          withholdingIcaAmount: withholdings.withholdingIcaAmount,
          withholdingIvaAmount: withholdings.withholdingIvaAmount,
          totalAfterWithholdings: withholdings.totalAfterWithholdings,
          // Quote items - only essential data
          items: validItems.map((item) => ({
            productId: item.productId,
            orderType: item.orderType,
            process: item.process,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            orderCodeReference: item.referenceOrderCode ?? null,
            designNumber: item.referenceDesign ?? null,
            additions: item.additions.map((add) => ({
              id: add.id,
              quantity: add.quantity,
              unitPrice: add.unitPrice,
            })),
          })),
        };

        // Only include clientPriceType if it's not null (only for national clients)
        if (clientPriceType !== null) {
          quoteData.clientPriceType = clientPriceType;
        }

        const endpoint = quoteId
          ? `/api/quotations/${quoteId}`
          : "/api/quotations";
        const created = await apiJson<{ id: string; quoteCode: string }>(
          endpoint,
          {
            method: quoteId ? "PUT" : "POST",
            body: JSON.stringify(quoteData),
          },
        );

        setQuoteCode(created.quoteCode);
        toast.success(
          quoteId
            ? copy.toasts.quotationUpdated(created.quoteCode)
            : copy.toasts.quotationCreated(created.quoteCode),
        );

        return { ok: true, id: created.id, quoteCode: created.quoteCode };
      } catch (error) {
        toast.error(getErrorMessage(error));

        return { ok: false };
      } finally {
        setSubmitting(false);
      }
    },
    [quoteId, submitting],
  );

  return { quoteCode, submitting, saveQuotation };
}
