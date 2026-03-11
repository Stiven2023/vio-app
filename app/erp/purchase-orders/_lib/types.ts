export type PurchaseOrderStatus =
  | "PENDIENTE"
  | "APROBADA"
  | "RECHAZADA"
  | "EN_PROCESO"
  | "FINALIZADA"
  | "VENCIDA"
  | "CANCELADA"
  | string;

export type PurchaseOrderRouteType =
  | "COMPRA_APROBADA"
  | "DESPACHO_CLIENTE"
  | "LLEVADA_CONFECCION"
  | "RETORNO_CONFECCION"
  | string;

export type PurchaseOrderPartyType =
  | "PROVEEDOR"
  | "CONFECCIONISTA"
  | "EMPAQUE"
  | "MENSAJERO"
  | "CONDUCTOR"
  | "DESPACHO"
  | string;

export type PurchaseOrderListRow = {
  id: string;
  purchaseOrderCode: string | null;
  supplierId: string | null;
  supplierName: string | null;
  status: PurchaseOrderStatus | null;
  notes: string | null;
  bankId: string | null;
  bankName: string | null;
  bankAccountRef: string | null;
  approvedAt: string | null;
  approvalExpiresAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  subtotal: string | null;
  total: string | null;
  createdAt: string | null;
  finalizedAt: string | null;
};

export type SupplierOption = {
  id: string;
  name: string;
  supplierCode?: string | null;
  contactName?: string | null;
  email?: string | null;
  identification?: string | null;
  mobile?: string | null;
  fullMobile?: string | null;
  address?: string | null;
  city?: string | null;
  department?: string | null;
  isActive?: boolean | null;
};

export type ConfectionistOption = {
  id: string;
  name: string;
  confectionistCode?: string | null;
  contactName?: string | null;
  fullMobile?: string | null;
  address?: string | null;
  city?: string | null;
  department?: string | null;
  isActive?: boolean | null;
};

export type PackerOption = {
  id: string;
  name: string;
  packerCode?: string | null;
  contactName?: string | null;
  fullMobile?: string | null;
  address?: string | null;
  city?: string | null;
  department?: string | null;
  isActive?: boolean | null;
};

export type EmployeeOption = {
  id: string;
  code: string | null;
  name: string;
  roleName: string | null;
  fullMobile: string | null;
  isActive: boolean | null;
};

export type InventoryItemOption = {
  id: string;
  itemCode?: string | null;
  name: string;
  unit?: string | null;
  price?: string | null;
};

export type BankOption = {
  id: string;
  code: string;
  name: string;
  accountRef: string;
  isActive: boolean | null;
};

export type PurchaseOrderDetailItem = {
  id: string;
  inventoryItemId: string;
  itemCode: string | null;
  itemName: string;
  unit: string | null;
  quantity: string;
  unitPrice: string | null;
  lineTotal: string | null;
};

export type PurchaseOrderDetail = {
  id: string;
  purchaseOrderCode: string | null;
  supplierId: string | null;
  supplierName: string | null;
  supplierCode: string | null;
  supplierContactName: string | null;
  supplierEmail: string | null;
  supplierIdentification: string | null;
  supplierMobile: string | null;
  supplierAddress: string | null;
  supplierCity: string | null;
  supplierDepartment: string | null;
  createdBy: string | null;
  createdByName: string | null;
  status: PurchaseOrderStatus | null;
  notes: string | null;
  bankId: string | null;
  bankName: string | null;
  bankAccountRef: string | null;
  approvedAt: string | null;
  approvalExpiresAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  subtotal: string | null;
  total: string | null;
  createdAt: string | null;
  finalizedAt: string | null;
  items: PurchaseOrderDetailItem[];
};

export type PurchaseOrderHistoryRow = {
  id: string;
  action: string;
  notes: string | null;
  performedBy: string | null;
  performedByName: string | null;
  createdAt: string | null;
};

export type PurchaseOrderRouteRow = {
  id: string;
  routeType: PurchaseOrderRouteType;
  partyType: PurchaseOrderPartyType;
  partyId: string | null;
  partyLabel: string | null;
  driverLabel: string | null;
  vehiclePlate: string | null;
  originArea: string;
  destinationArea: string;
  scheduledAt: string | null;
  status: string | null;
  notes: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string | null;
};
