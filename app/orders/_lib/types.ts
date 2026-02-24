export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

export type OrderType = "VN" | "VI";

export type OrderKind = "NUEVO" | "COMPLETACION" | "REFERENTE";

export type OrderStatus =
  | "PENDIENTE"
  | "PRODUCCION"
  | "ATRASADO"
  | "FINALIZADO"
  | "ENTREGADO"
  | "CANCELADO"
  | "REVISION";

export type OrderListItem = {
  id: string;
  orderCode: string;
  kind?: OrderKind;
  sourceOrderId?: string | null;
  sourceOrderCode?: string | null;
  createdBy?: string | null;
  clientId: string | null;
  clientName: string | null;
  type: OrderType;
  status: OrderStatus;
  total: string | null;
  ivaEnabled: boolean | null;
  discount: string | null;
  currency: string | null;
  shippingFee?: string | null;
  paidTotal?: string | null;
  lastStatusAt?: string | null;
  lastStatusBy?: string | null;
  createdAt: string | null;
};

export type OrderItemInput = {
  productId?: string | null;
  additionId?: string | null;
  name?: string;
  quantity: number;
  unitPrice?: string;
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
};

export type OrdersOptions = {
  clients: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
};
