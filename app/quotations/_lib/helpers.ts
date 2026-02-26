import { Addition, ClientPriceType, Currency, OrderType, ProductOption, QuoteItem } from "./types";

export function makeItem(): QuoteItem {
  return {
    id: crypto.randomUUID(),
    productId: "",
    orderType: "NORMAL",
    process: "PRODUCCION",
    code: "",
    quantity: 1,
    product: "",
    description: "",
    unitPrice: 0,
    discount: 0,
    additions: [],
  };
}

export function makeAddition(): Addition {
  return {
    id: crypto.randomUUID(),
    quantity: 1,
    unitPrice: 0,
  };
}

export function asMoney(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function toNumber(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function resolveCopUnitPrice(
  product: ProductOption,
  quantity: number,
  clientPriceType: ClientPriceType,
): number {
  if (clientPriceType === "MAYORISTA") {
    return toNumber(product.priceMayorista || product.priceCopR1 || product.priceCopBase);
  }

  if (clientPriceType === "COLANTA") {
    return toNumber(product.priceColanta || product.priceCopR1 || product.priceCopBase);
  }

  if (clientPriceType === "VIOMAR") {
    if (quantity <= 499) return toNumber(product.priceCopBase || product.priceCopR1);
    if (quantity <= 1000) return toNumber(product.priceCopR2 || product.priceCopBase || product.priceCopR1);

    return toNumber(product.priceCopR3 || product.priceCopR2 || product.priceCopBase || product.priceCopR1);
  }

  if (clientPriceType === "AUTORIZADO") {
    return toNumber(product.priceCopBase || product.priceCopR1);
  }

  return toNumber(product.priceCopBase || product.priceCopR1);
}

export function resolveUnitPrice(
  product: ProductOption,
  quantity: number,
  currency: Currency,
  clientPriceType: ClientPriceType,
): number {
  if (currency === "USD") {
    return toNumber(product.priceUSD);
  }

  return resolveCopUnitPrice(product, quantity, clientPriceType);
}
