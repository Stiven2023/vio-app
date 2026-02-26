export type PackagingMode = "AGRUPADO" | "INDIVIDUAL";

export type OrderItemPackagingInput = {
  mode: PackagingMode;
  size: string;
  quantity?: number;
  personName?: string | null;
  personNumber?: string | null;
};

export type OrderItemSockInput = {
  size: string;
  quantity?: number;
  description?: string | null;
  imageUrl?: string | null;
};

export type OrderItemMaterialInput = {
  inventoryItemId: string;
  quantity?: string | number | null;
  note?: string | null;
};

export type OrderItemInput = {
  id?: string;
  orderId: string;
  productId?: string | null;
  additionId?: string | null;
  hasAdditions?: boolean;
  additionEvidence?: string | null;
  productPriceId?: string | null;
  quantity: number;
  unitPrice?: string | number | null;
  totalPrice?: string | number | null;

  observations?: string | null;
  fabric?: string | null;
  name?: string | null;
  imageUrl?: string | null;

  screenPrint?: boolean;
  embroidery?: boolean;
  buttonhole?: boolean;
  snap?: boolean;
  tag?: boolean;
  flag?: boolean;

  gender?: string | null;
  process?: string | null;
  neckType?: string | null;
  sleeve?: string | null;
  color?: string | null;

  requiresSocks?: boolean;
  isActive?: boolean;
  manufacturingId?: string | null;

  packaging?: OrderItemPackagingInput[];
  socks?: OrderItemSockInput[];
  materials?: OrderItemMaterialInput[];
};
