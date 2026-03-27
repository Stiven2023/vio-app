export type EstadoProceso =
  | "pendiente"
  | "en_proceso"
  | "completado"
  | "reponer";

export interface TallaRow {
  talla: string;
  cantidad: number;
  estado: EstadoProceso;
  responsable?: string;
  fechaInicio?: string;
  fechaFin?: string;
  observacion?: string;
}

export interface ProcessHistoryEntry {
  operationType: string;
  state: "COMPLETADO" | "EN_PROCESO" | "PARCIAL";
  at: string | null;
  notes: string | null;
  producedQuantity: number;
}

export interface DisenoGroup {
  orderItemId?: string;
  diseno: number;
  detalle: string;
  tela: string;
  genero: string;
  ticketMontaje: string;
  ticketPlotter: string;
  currentProcess?: string;
  processHistory?: ProcessHistoryEntry[];
  tallas: TallaRow[];
}

export interface PedidoGroup {
  pedido: string;
  cliente: string;
  fechaPedido: string;
  fechaEntrega: string;
  vendedor: string;
  plazo: number;
  estado: "SIN TRAMITAR" | "EN PROCESO" | "COMPLETADO" | "TARDE";
  disenos: DisenoGroup[];
  expanded: boolean;
}

export type ProgramacionApiRow = {
  id: string;
  orderItemId: string;
  orderCode: string;
  orderDate: string | null;
  clientName: string | null;
  deliveryDate: string | null;
  sellerName: string | null;
  designNumber: number | null;
  design: string | null;
  ticketMontaje: string | null;
  ticketPlotter: string | null;
  talla: string | null;
  quantity: number | null;
  fabric: string | null;
  gender: string | null;
  itemStatus: string | null;
};

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

export type OperativeLogRow = {
  id: string;
  orderCode: string;
  designName: string;
  details: string | null;
  size: string | null;
  producedQuantity: number;
  isComplete: boolean;
  isPartial: boolean;
  repoCheck: boolean;
  observations: string | null;
  startAt: string | null;
  endAt: string | null;
  operationType: string | null;
  createdAt: string | null;
  createdByUserId: string | null;
};

export type MontajeAssignment = {
  orderCode: string;
  userId: string | null;
  userLabel: string;
  takenAt: string | null;
};

export type ProcessRoleConfig = {
  label: string;
  role: string;
  operationType:
    | "MONTAJE"
    | "PLOTTER"
    | "SUBLIMACION"
    | "CALANDRA"
    | "CORTE_LASER"
    | "CORTE_MANUAL"
    | "CONFECCION"
    | "EMPAQUE"
    | "INTEGRACION"
    | "DESPACHO";
};

export type ProcessQueueRow = {
  pedido: string;
  cliente: string;
  diseno: number;
  detalle: string;
  orderItemId?: string;
  ticket: string;
  defaultDesignName?: string;
  tallas: TallaRow[];
  designDetails?: Array<{
    diseno: number;
    detalle: string;
    orderItemId?: string;
    tallas: TallaRow[];
  }>;
  totalUnidades: number;
  totalTallasPendientes: number;
  unidadesPendientes: number;
  turno: number;
};
