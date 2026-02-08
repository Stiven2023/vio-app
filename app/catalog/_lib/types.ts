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
  name: string;
  description: string | null;
  categoryId: string | null;
  isSet?: boolean | null;
  productionType?: string | null;
  isActive: boolean | null;
  createdAt: string | null;
};

export type ProductPrice = {
  id: string;
  productId: string | null;
  referenceCode: string;
  priceCOP: string | null;
  priceUSD: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean | null;
};

export type InventoryItem = {
  id: string;
  name: string;
  unit: string | null;
};

export type InventoryEntry = {
  id: string;
  inventoryItemId: string | null;
  itemName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  quantity: string | null;
  createdAt: string | null;
};

export type InventoryOutput = {
  id: string;
  inventoryItemId: string | null;
  itemName: string | null;
  orderItemId: string | null;
  orderItemName: string | null;
  quantity: string | null;
  reason: string | null;
  createdAt: string | null;
};
