export type Currency = "COP" | "USD";
export type ClientPriceType = "AUTORIZADO" | "MAYORISTA" | "VIOMAR" | "COLANTA";
export type DocumentType = "P" | "R"; // P = Persona (con IVA), R = Razón social (sin IVA)
export type OrderType = "NORMAL" | "COMPLETACION" | "REFERENTE" | "REPOSICION" | "BODEGA";
export type Negotiation =
  | ""
  | "CONVENIO"
  | "OBSEQUIO"
  | "MUESTRA"
  | "BODEGA"
  | "COMPRAS"
  | "PRODUCCION"
  | "MUESTRA_G"
  | "MUESTRA_C";

export type ClientOption = {
  id: string;
  name: string;
  clientCode: string | null;
  clientType: "NACIONAL" | "EXTRANJERO" | "EMPLEADO" | null;
  identificationType: "CC" | "NIT" | "CE" | "PAS" | "EMPRESA_EXTERIOR" | null;
  email: string | null;
  identification: string | null;
  dv: string | null;
  address: string | null;
  country: string | null;
  city: string | null;
  postalCode: string | null;
  contactName: string | null;
  contactPhone: string | null;
  priceClientType: ClientPriceType | null;
  isActive: boolean | null;
  hasCredit: boolean | null;
  promissoryNoteNumber: string | null;
};

export type ProductOption = {
  id: string;
  productCode: string | null;
  name: string;
  description: string | null;
  priceCopBase: string | null;
  priceCopR1: string | null;
  priceCopR2: string | null;
  priceCopR3: string | null;
  priceViomar: string | null;
  priceColanta: string | null;
  priceMayorista: string | null;
  priceUSD: string | null;
};

export type AdditionOption = {
  id: string;
  additionCode: string | null;
  name: string;
  description: string | null;
  priceCopBase: string | null;
  priceUSD: string | null;
};

export type Addition = {
  id: string;
  unitPrice: number;
  quantity: number;
};

export type QuoteItem = {
  id: string;
  productId: string;
  orderType: OrderType;
  negotiation: Negotiation;
  code: string;
  quantity: number;
  product: string;
  description: string;
  unitPrice: number;
  discount: number;
  additions: Addition[];
  referenceOrderCode?: string;
  referenceDesign?: string;
};

export type QuoteForm = {
  // IDs only (saved to database)
  clientId: string;
  sellerId: string; // User ID
  documentType: DocumentType; // P = Persona (con IVA), R = Razón social (sin IVA)
  currency: Currency;
  deliveryDate: string;
  expiryDate: string;
  paymentTerms: string;
  promissoryNoteNumber: string; // Solo si paymentTerms es CREDITO

  // Display only (not saved, fetched from client/seller on read)
  customerName: string;
  customerEmail: string;
  documentNumber: string;
  documentVerificationDigit: string;
  contactName: string;
  contactPhone: string;
  address: string;
  country: string;
  city: string;
  postalCode: string;
  seller: string;
  clientPriceTypeDisplay: ClientPriceType | null;
};
