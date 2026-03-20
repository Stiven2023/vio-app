export type MoldingTemplateRow = {
  id: string;
  moldingCode: string;
  version: number;
  garmentType: string | null;
  garmentSubtype: string | null;
  designDetail: string | null;
  fabric: string | null;
  color: string | null;
  gender: string | null;
  process: string | null;
  estimatedLeadDays: number | null;
  isActive: boolean | null;
  createdAt: string | null;
  createdByName: string | null;
};

export type MoldingTemplateDetail = MoldingTemplateRow & {
  imageUrl: string | null;
  clothingImageOneUrl: string | null;
  clothingImageTwoUrl: string | null;
  logoImageUrl: string | null;
  manufacturingId: string | null;
  screenPrint: boolean | null;
  embroidery: boolean | null;
  buttonhole: boolean | null;
  snap: boolean | null;
  tag: boolean | null;
  flag: boolean | null;
  neckType: string | null;
  sesgoType: string | null;
  sesgoColor: string | null;
  hiladillaColor: string | null;
  sleeveType: string | null;
  cuffType: string | null;
  cuffMaterial: string | null;
  zipperLocation: string | null;
  zipperColor: string | null;
  zipperSizeCm: string | null;
  cordColor: string | null;
  hasElastic: boolean | null;
  liningType: string | null;
  liningColor: string | null;
  hoodType: string | null;
  hasInnerLining: boolean | null;
  hasPocket: boolean | null;
  pocketZipperColor: string | null;
  hasLateralMesh: boolean | null;
  lateralMeshColor: string | null;
  hasFajon: boolean | null;
  hasTanca: boolean | null;
  hasProtection: boolean | null;
  buttonType: string | null;
  buttonholeType: string | null;
  perillaColor: string | null;
  collarType: string | null;
  fusioningNotes: string | null;
  hasEntretela: boolean | null;
  invisibleZipperColor: string | null;
  observations: string | null;
  updatedAt: string | null;
  insumos: MoldingTemplateInsumo[];
};

export type MoldingTemplateInsumo = {
  id: string;
  moldingTemplateId: string;
  inventoryItemId: string;
  variantId: string | null;
  qtyPerUnit: string;
  unit: string;
  variesBySize: boolean | null;
  additionId: string | null;
  notes: string | null;
  createdAt: string | null;
};

export type MoldingInsumoStatus =
  | "PENDIENTE"
  | "SOLICITADO_COMPRAS"
  | "EN_STOCK"
  | "DESPACHADO_CONFECCION"
  | "COMPLETADO";

export type OrderItemMolding = {
  id: string;
  orderItemId: string;
  moldingTemplateId: string | null;
  combinationOrder: number;
  moldingCode: string | null;
  version: number | null;
  garmentType: string | null;
  fabric: string | null;
  color: string | null;
  observations: string | null;
  assignedBy: string | null;
  createdAt: string | null;
};

export type OrderItemMoldingInsumo = {
  id: string;
  orderItemMoldingId: string;
  inventoryItemId: string;
  inventoryItemName: string | null;
  variantId: string | null;
  variantSku: string | null;
  additionId: string | null;
  size: string | null;
  qtyRequired: string;
  qtyAvailable: string;
  qtyToPurchase: string;
  unit: string;
  status: MoldingInsumoStatus;
  notes: string | null;
};

export type PurchaseNeedRow = {
  inventoryItemId: string;
  inventoryItemName: string | null;
  inventoryItemUnit: string | null;
  variantId: string | null;
  variantSku: string | null;
  totalQtyToPurchase: number;
  pendingInsumoCount: number;
};
