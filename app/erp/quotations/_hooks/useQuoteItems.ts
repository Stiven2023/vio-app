import { useCallback, useEffect, useState } from "react";
import type {
  ClientPriceType,
  Currency,
  OrderType,
  ProductOption,
  QuoteItem,
} from "../_lib/types";
import { makeItem, resolveUnitPrice } from "../_lib/helpers";

export function useQuoteItems(
  products: ProductOption[],
  currency: Currency,
  clientPriceType: ClientPriceType,
) {
  const [items, setItems] = useState<QuoteItem[]>([makeItem()]);
  const isAuthorizedManual = currency === "COP" && clientPriceType === "AUTORIZADO";

  // Actualizar items cuando cambian productos o moneda
  useEffect(() => {
    setItems((prev) =>
      prev.map((row) => {
        if (!row.productId) return row;
        const product = products.find((p) => p.id === row.productId);

        if (!product) {
          return { ...row, productId: "", code: "", product: "", description: "", unitPrice: 0 };
        }

        return {
          ...row,
          code: product.productCode ?? "",
          product: product.name,
          description: product.description ?? "",
          unitPrice: isAuthorizedManual
            ? row.unitPrice
            : resolveUnitPrice(
                product,
                row.quantity,
                currency,
                clientPriceType,
              ),
        };
      }),
    );
  }, [currency, products, clientPriceType, isAuthorizedManual]);

  const updateItem = useCallback(
    (id: string, patch: Partial<QuoteItem>): void => {
      setItems((prev) =>
        prev.map((row) => {
          if (row.id !== id) return row;
          
          const validatedPatch = { ...patch };
          if (validatedPatch.orderType !== undefined && typeof validatedPatch.orderType === 'string') {
            const validOrderTypes: OrderType[] = [
              "NORMAL",
              "COMPLETACION",
              "REFERENTE",
              "REPOSICION",
              "MUESTRA",
              "OBSEQUIO",
            ];
            if (!validOrderTypes.includes(validatedPatch.orderType as OrderType)) {
              validatedPatch.orderType = "NORMAL";
            }
          }
          const next: QuoteItem = { ...row, ...validatedPatch } as QuoteItem;

          if (patch.productId !== undefined) {
            const product = products.find((p) => p.id === patch.productId);

            if (!product) {
              return {
                ...next,
                productId: "",
                code: "",
                product: "",
                description: "",
                unitPrice: 0,
              };
            }

            return {
              ...next,
              code: product.productCode ?? "",
              product: product.name,
              description: product.description ?? "",
              unitPrice: isAuthorizedManual
                ? 0
                : resolveUnitPrice(
                    product,
                    next.quantity,
                    currency,
                    clientPriceType,
                  ),
            };
          }

          if (patch.quantity !== undefined && next.productId && !isAuthorizedManual) {
            const product = products.find((p) => p.id === next.productId);

            if (product) {
              next.unitPrice = resolveUnitPrice(
                product,
                next.quantity,
                currency,
                clientPriceType,
              );
            }

            if (next.additions.length > 0) {
              next.additions = next.additions.map((add) => ({
                ...add,
                quantity: next.quantity,
              }));
            }
          }

          return next;
        }),
      );
    },
    [products, currency, clientPriceType, isAuthorizedManual],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((row) => row.id !== id);
    });
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, makeItem()]);
  }, []);

  return { items, setItems, updateItem, removeItem, addItem };
}
