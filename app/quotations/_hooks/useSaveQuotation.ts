import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { apiJson, getErrorMessage } from "@/app/catalog/_lib/api";
import type {
  ClientPriceType,
  QuoteForm,
  QuoteItem,
} from "../_lib/types";
import type { QuoteCalculations } from "./useQuoteCalculations";

export function useSaveQuotation(
  quoteId?: string,
  initialQuoteCode = "Se asigna al guardar",
) {
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
    ): Promise<boolean> => {
      if (submitting) return false;

      if (!form.clientId) {
        toast.error("Selecciona un cliente activo");
        return false;
      }

      if (!form.sellerId) {
        toast.error("No se encontró el vendedor de la sesión. Recarga la página.");
        return false;
      }

      const validItems = items.filter(
        (row) => row.productId && row.quantity > 0 && row.unitPrice >= 0,
      );

      if (validItems.length === 0) {
        toast.error("Agrega al menos un item válido");
        return false;
      }

      setSubmitting(true);
      try {
        const quoteData: any = {
          // IDs only (essential data)
          clientId: form.clientId,
          sellerId: form.sellerId,
          documentType: form.documentType,
          currency: form.currency,
          deliveryDate: form.deliveryDate,
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
          // Quote items - only essential data
          items: validItems.map((item) => ({
            productId: item.productId,
            orderType: item.orderType,
            negotiation:
              item.negotiation === "MUESTRA_G" || item.negotiation === "MUESTRA_C"
                ? "MUESTRA"
                : item.negotiation,
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

        const endpoint = quoteId ? `/api/quotations/${quoteId}` : "/api/quotations";
        const created = await apiJson<{ quoteCode: string }>(endpoint, {
          method: quoteId ? "PUT" : "POST",
          body: JSON.stringify(quoteData),
        });

        setQuoteCode(created.quoteCode);
        toast.success(
          quoteId
            ? `Cotización actualizada: ${created.quoteCode}`
            : `Cotización creada: ${created.quoteCode}`,
        );
        return true;
      } catch (error) {
        toast.error(getErrorMessage(error));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [quoteId, submitting],
  );

  return { quoteCode, submitting, saveQuotation };
}
