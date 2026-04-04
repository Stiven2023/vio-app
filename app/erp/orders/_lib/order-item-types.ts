export type PackagingMode = "AGRUPADO" | "INDIVIDUAL";

export type DesignType = "PRODUCCION" | "COMPRA" | "BODEGA";

export type ProductionTechnique = "SUBLIMACION" | "FONDO_ENTERO";

export type ScreenPrintType = "DTF" | "VINILO";

export type OrderConfigurationMode =
  | "PRENDA"
  | "CONJUNTO"
  | "CONJUNTO_ARQUERO";

export type Position =
  | "JUGADOR"
  | "ARQUERO"
  | "CAPITAN"
  | "JUEZ"
  | "ENTRENADOR"
  | "LIBERO"
  | "ADICIONAL";

export type SockLength = "LARGA" | "TRES_CUARTOS" | "TALONERA";

export type OrderItemPackagingInput = {
  id?: string | null;
  mode: PackagingMode;
  teamId?: string | null;
  position?: Position | null;
  size: string;
  quantity?: number;
  personName?: string | null;
  personNumber?: string | null;
};

export type OrderItemSockInput = {
  teamId?: string | null;
  position?: Position | null;
  sockLength?: SockLength | null;
  color?: string | null;
  material?: string | null;
  isDesigned?: boolean;
  size: string;
  quantity?: number;
  description?: string | null;
  imageUrl?: string | null;
  logoImageUrl?: string | null;
};

export type OrderItemPositionInput = {
  id?: string;
  position: Position;
  quantity?: number;
  color?: string | null;
  sortOrder?: number;
};

export type OrderItemTeamInput = {
  id?: string;
  name: string;
  playerColor?: string | null;
  goalkeeperColor?: string | null;
  socksColor?: string | null;
  playerImageUrl?: string | null;
  goalkeeperImageUrl?: string | null;
  fullSetImageUrl?: string | null;
  sortOrder?: number;
};

export type OrderItemSpecialRequirementInput = {
  id?: string;
  piece?: string | null;
  fabric?: string | null;
  fabricColor?: string | null;
  hasReflectiveTape?: boolean;
  reflectiveTapeLocation?: string | null;
  hasSideStripes?: boolean;
  closureType?: string | null;
  closureQuantity?: number | null;
  hasCordon?: boolean;
  hasElastic?: boolean;
  notes?: string | null;
};

export type OrderItemMaterialInput = {
  inventoryItemId: string;
  quantity?: string | number | null;
  note?: string | null;
};

export type OrderItemInput = {
  id?: string;
  orderId: string;
  garmentType?:
    | "JUGADOR"
    | "ARQUERO"
    | "CAPITAN"
    | "JUEZ"
    | "ENTRENADOR"
    | "LIBERO"
    | "OBJETO"
    | null;
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
  clothingImageOneUrl?: string | null;
  clothingImageTwoUrl?: string | null;
  logoImageUrl?: string | null;

  screenPrint?: boolean;
  screenPrintType?: ScreenPrintType | null;
  embroidery?: boolean;
  buttonhole?: boolean;
  snap?: boolean;
  tag?: boolean;
  flag?: boolean;

  gender?: string | null;
  designType?: DesignType | null;
  productionTechnique?: ProductionTechnique | null;
  process?: string | null;
  designerId?: string | null;
  discipline?: string | null;
  hasCordon?: boolean;
  cordonColor?: string | null;
  category?: string | null;
  labelBrand?: string | null;
  neckType?: string | null;
  cuffType?: string | null;
  sleeve?: string | null;
  color?: string | null;

  requiresSocks?: boolean;
  isActive?: boolean;
  manufacturingId?: string | null;

  packaging?: OrderItemPackagingInput[];
  socks?: OrderItemSockInput[];
  materials?: OrderItemMaterialInput[];
  positions?: OrderItemPositionInput[];
  teams?: OrderItemTeamInput[];
  specialRequirements?: OrderItemSpecialRequirementInput[];
  orderConfigurationMode?: OrderConfigurationMode | null;
};
