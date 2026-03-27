export type DesignGalleryImage = {
  key: string;
  label: string;
  url: string;
  source: "ORDER_ITEM" | "TEAM" | "MOLDING";
  teamName: string | null;
};

export type DesignSizeBreakdown = {
  size: string;
  groupedQuantity: number;
  individualQuantity: number;
  totalQuantity: number;
  mode: "AGRUPADO" | "INDIVIDUAL" | "MIXTO";
};

export type DesignPackagingPerson = {
  size: string;
  quantity: number;
  personName: string | null;
  personNumber: string | null;
  teamId: string | null;
  position: string | null;
};

export type DesignTeamView = {
  id: string;
  name: string;
  playerColor: string | null;
  goalkeeperColor: string | null;
  socksColor: string | null;
  playerImageUrl: string | null;
  goalkeeperImageUrl: string | null;
  fullSetImageUrl: string | null;
  sortOrder: number;
};

export type AppliedMoldingSummary = {
  id: string;
  combinationOrder: number;
  moldingTemplateId: string | null;
  moldingCode: string | null;
  version: number | null;
  garmentType: string | null;
  garmentSubtype: string | null;
  fabric: string | null;
  color: string | null;
  process: string | null;
  neckType: string | null;
  sesgoType: string | null;
  sesgoColor: string | null;
  zipperLocation: string | null;
  zipperColor: string | null;
  zipperSizeCm: string | null;
  hasProtection: boolean;
  hasEntretela: boolean;
  hasInnerLining: boolean;
  observations: string | null;
};

export type PurchaseHintRequirement = {
  key: string;
  label: string;
  value: string | null;
  details: string | null;
  source: "RULE" | "ORDER_ITEM" | "MOLDING" | "SPECIAL_REQUIREMENT";
  status: "INFO" | "REQUIRED" | "WARNING" | "DISABLED";
};

export type PurchaseHintView = {
  orderId: string;
  orderItemId: string;
  orderCode: string;
  designName: string;
  qtyTotal: number;
  sizesBreakdown: DesignSizeBreakdown[];
  process: string | null;
  designType: string | null;
  productionTechnique: string | null;
  fabric: string | null;
  color: string | null;
  garmentType: string | null;
  garmentSubtype: string | null;
  moldingTemplateCode: string | null;
  moldingTemplateVersion: number | null;
  teamsEnabled: boolean;
  multiTeamDisabled: boolean;
  teamCount: number;
  pendingInsumosParametrization: boolean;
  notes: string[];
  requirements: PurchaseHintRequirement[];
};

export type DesignFullView = {
  orderId: string;
  orderItemId: string;
  orderCode: string;
  designName: string;
  quantity: number;
  process: string | null;
  designType: string | null;
  productionTechnique: string | null;
  garmentType: string | null;
  fabric: string | null;
  color: string | null;
  images: DesignGalleryImage[];
  teamsEnabled: boolean;
  teamsDisabledReason: string | null;
  teams: DesignTeamView[];
  positions: Array<{
    id: string;
    position: string;
    quantity: number;
    color: string | null;
    sortOrder: number;
  }>;
  packaging: {
    sizesBreakdown: DesignSizeBreakdown[];
    personalized: DesignPackagingPerson[];
  };
  specialRequirements: Array<{
    id: string;
    piece: string | null;
    fabric: string | null;
    fabricColor: string | null;
    hasReflectiveTape: boolean;
    reflectiveTapeLocation: string | null;
    hasSideStripes: boolean;
    notes: string | null;
  }>;
  appliedMoldings: AppliedMoldingSummary[];
  purchaseHints: PurchaseHintView;
};