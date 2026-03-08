export type PurchaseOrderStatus = "PENDIENTE" | "FINALIZADA" | string;

export type PurchaseOrderListRow = {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
  status: PurchaseOrderStatus | null;
  notes: string | null;
  createdAt: string | null;
  finalizedAt: string | null;
};

export type SupplierOption = { id: string; name: string; isActive?: boolean | null };
export type InventoryItemOption = { id: string; name: string; unit?: string | null };
