import type { OrderStatus as DbOrderStatus } from "@/src/utils/order-status";

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

export type OrderType = "VN" | "VI" | "VT" | "VW";

export type OrderKind = "NUEVO" | "COMPLETACION" | "REFERENTE";

export type OrderStatus = DbOrderStatus;

export type OrderListItem = {
  id: string;
  orderCode: string;
  kind?: OrderKind;
  sourceOrderId?: string | null;
  sourceOrderCode?: string | null;
  createdBy?: string | null;
  clientId: string | null;
  clientName: string | null;
  clientCode?: string | null;
  type: OrderType;
  status: OrderStatus;
  total: string | null;
  ivaEnabled: boolean | null;
  discount: string | null;
  currency: string | null;
  shippingFee?: string | null;
  paidTotal?: string | null;
  deliveryDate?: string | null;
  lastStatusAt?: string | null;
  lastStatusBy?: string | null;
  createdAt: string | null;
  provisionalCode?: string | null;
  operationalApprovedAt?: string | null;
};

export type OrderItemInput = {
  productId?: string | null;
  additionId?: string | null;
  name?: string;
  quantity: number;
  unitPrice?: string;
  designType?: "PRODUCCION" | "COMPRA" | "BODEGA";
  productionTechnique?: "SUBLIMACION" | "FONDO_ENTERO";
  designerId?: string | null;
  discipline?: string | null;
  hasCordon?: boolean;
  cordonColor?: string | null;
  category?: string | null;
  labelBrand?: string | null;
};

export type OrderInput = {
  clientId?: string;
  type: OrderType;
  kind?: OrderKind;
  sourceOrderCode?: string;
  status: OrderStatus;
  ivaEnabled: boolean;
  discount?: string;
  currency: string;
  shippingFee?: string;
  items?: OrderItemInput[];
  provisionalCode?: string;
};

export type OrdersOptions = {
  clients: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
};

export type UiLocale = "en" | "es";

export type CommercialAction = "APPROVE" | "WAIT_FOR_PAYMENT";

export type OrderHistoryItem = {
  id: string;
  status: string | null;
  changedByName: string | null;
  reasonCode: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string | null;
};
