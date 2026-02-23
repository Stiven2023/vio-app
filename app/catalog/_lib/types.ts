export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

export type Category = {
  id: string;
  name: string;
};

export type Product = {
  id: string;
  productCode: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  isActive: boolean | null;
  createdAt: string | null;
};

export type ProductPrice = {
  id: string;
  productId: string | null;
  referenceCode: string;
  priceCopR1: string | null;
  priceCopR2: string | null;
  priceCopR3: string | null;
  priceViomar: string | null;
  priceColanta: string | null;
  priceMayorista: string | null;
  priceUSD: string | null;
  isEditable: boolean | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean | null;
  updatedAt: string | null;
};

export type InventoryItem = {
  id: string;
  name: string;
  unit: string | null;
  description?: string | null;
  price?: string | null;
  supplierId?: string | null;
  minStock?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type InventoryEntry = {
  id: string;
  inventoryItemId: string | null;
  itemName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  location: "BODEGA_PRINCIPAL" | "TIENDA" | null;
  quantity: string | null;
  createdAt: string | null;
};

export type InventoryOutput = {
  id: string;
  inventoryItemId: string | null;
  itemName: string | null;
  orderItemId: string | null;
  orderItemName: string | null;
  location: "BODEGA_PRINCIPAL" | "TIENDA" | null;
  quantity: string | null;
  reason: string | null;
  createdAt: string | null;
};
