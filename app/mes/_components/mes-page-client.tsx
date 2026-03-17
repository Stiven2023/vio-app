"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Select,
  SelectItem,
  Tabs,
  Tab,
  Divider,
  Tooltip,
} from "@heroui/react";
import {
  MdSearch,
  MdFilterList,
  MdPrint,
  MdRefresh,
  MdExpandMore,
  MdExpandLess,
  MdCheckCircle,
  MdSchedule,
  MdWarning,
  MdError,
  MdTag,
} from "react-icons/md";

import { OperarioWorklogTable } from "@/app/erp/dashboard/role/_components/operario-worklog-table";

// ─── TICKET NUMBER GENERATOR ────────────────────────────────────────────────
const PROCESO_PREFIX: Record<string, string> = {
  montaje: "MO",
  plotter: "PLO",
  sublimacion: "SUB",
  corte: "COR",
  integracion: "INT",
  confeccion: "CON",
  empaque: "EMP",
  despacho: "DES",
};

const PROCESS_ROLE_CONFIG: Record<
  string,
  {
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
  }
> = {
  montaje: { label: "Montaje", role: "OPERARIO_MONTAJE", operationType: "MONTAJE" },
  plotter: { label: "Plotter", role: "OPERARIO_FLOTER", operationType: "PLOTTER" },
  sublimacion: { label: "Sublimación", role: "OPERARIO_SUBLIMACION", operationType: "SUBLIMACION" },
  corte: { label: "Corte", role: "OPERARIO_CORTE_MANUAL", operationType: "CORTE_MANUAL" },
  integracion: {
    label: "Integración",
    role: "OPERARIO_INTEGRACION_CALIDAD",
    operationType: "INTEGRACION",
  },
  confeccion: { label: "Confección", role: "CONFECCIONISTA", operationType: "CONFECCION" },
  empaque: { label: "Empaque", role: "EMPAQUE", operationType: "EMPAQUE" },
  despacho: { label: "Despacho", role: "OPERARIO_DESPACHO", operationType: "DESPACHO" },
};

function generateTicket(proceso: string, index: number): string {
  if (proceso.toLowerCase() === "montaje") {
    return `MON-${1001 + index}`;
  }

  const prefix =
    PROCESO_PREFIX[proceso.toLowerCase()] ?? proceso.slice(0, 3).toUpperCase();

  return `${prefix}-${1001 + index}`;
}

function buildProcessTicket(proceso: string, diseno: DisenoGroup, index: number): string {
  if (proceso === "montaje") {
    return String(diseno.ticketMontaje || generateTicket("montaje", index));
  }

  if (proceso === "plotter") {
    return String(diseno.ticketPlotter || generateTicket("plotter", index));
  }

  return generateTicket(proceso, index);
}

// ─── TYPES ───────────────────────────────────────────────────────────────────
type EstadoProceso = "pendiente" | "en_proceso" | "completado" | "reponer";

interface TallaRow {
  talla: string;
  cantidad: number;
  estado: EstadoProceso;
  responsable?: string;
  fechaInicio?: string;
  fechaFin?: string;
  observacion?: string;
}

interface DisenoGroup {
  diseno: number;
  detalle: string;
  tela: string;
  genero: string;
  ticketMontaje: string;
  ticketPlotter: string;
  tallas: TallaRow[];
}

interface PedidoGroup {
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

type ProgramacionApiRow = {
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
};

type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

type OperativeLogRow = {
  orderCode: string;
  designName: string;
  size: string | null;
  producedQuantity: number;
  isComplete: boolean;
  isPartial: boolean;
  repoCheck: boolean;
  startAt: string | null;
};

function buildProcessTallaKey(orderCode: string, designName: string, size: string): string {
  const order = String(orderCode ?? "").trim().toUpperCase();
  const design = String(designName ?? "").trim().toUpperCase();
  const talla = String(size ?? "").trim().toUpperCase();

  return `${order}::${design}::${talla}`;
}

function mergeEstado(prev: EstadoProceso | undefined, next: EstadoProceso): EstadoProceso {
  const rank: Record<EstadoProceso, number> = {
    pendiente: 0,
    en_proceso: 1,
    reponer: 2,
    completado: 3,
  };

  if (!prev) return next;
  return rank[next] >= rank[prev] ? next : prev;
}

function extractTurnFromTicket(ticket: string): number {
  const match = String(ticket ?? "").toUpperCase().match(/-(\d+)$/);
  if (!match) return Number.POSITIVE_INFINITY;

  const turn = Number(match[1]);
  return Number.isFinite(turn) ? turn : Number.POSITIVE_INFINITY;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("es-CO");
}

function calcPlazo(orderDate: string | null, deliveryDate: string | null): number {
  if (!orderDate || !deliveryDate) return 0;

  const start = new Date(orderDate).getTime();
  const end = new Date(deliveryDate).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) return 0;

  return Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
}

async function fetchProgramacionRows(params: URLSearchParams): Promise<ProgramacionApiRow[]> {
  const rows: ProgramacionApiRow[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage && page <= 50) {
    const query = new URLSearchParams(params);
    query.set("page", String(page));

    const response = await fetch(`/api/programacion/items?${query.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to load programacion items (${response.status})`);
    }

    const payload = (await response.json()) as PaginatedResponse<ProgramacionApiRow>;
    const chunk = Array.isArray(payload.items) ? payload.items : [];

    rows.push(...chunk);
    hasNextPage = Boolean(payload.hasNextPage);
    page += 1;
  }

  return rows;
}

async function fetchOperationStatusByTalla(
  operationType: string,
): Promise<Map<string, EstadoProceso>> {
  const statusMap = new Map<string, EstadoProceso>();
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage && page <= 50) {
    const query = new URLSearchParams({
      page: String(page),
      pageSize: "200",
      roleArea: "OPERARIOS",
      operationType,
    });

    const response = await fetch(`/api/dashboard/operative-logs?${query.toString()}`);
    if (!response.ok) break;

    const payload = (await response.json()) as PaginatedResponse<OperativeLogRow>;
    const items = Array.isArray(payload.items) ? payload.items : [];

    for (const row of items) {
      const talla = String(row.size ?? "").trim() || "UNICA";
      const key = buildProcessTallaKey(row.orderCode, row.designName, talla);
      if (key === "::::") continue;

      let next: EstadoProceso = "pendiente";
      if (row.isComplete) next = "completado";
      else if (row.isPartial && row.repoCheck) next = "reponer";
      else if (Number(row.producedQuantity ?? 0) > 0 || Boolean(row.startAt)) {
        next = "en_proceso";
      }

      const prev = statusMap.get(key);
      statusMap.set(key, mergeEstado(prev, next));
    }

    hasNextPage = Boolean(payload.hasNextPage);
    page += 1;
  }

  return statusMap;
}

function buildProgramacionQueryParams() {
  const common = new URLSearchParams({
    process: "PRODUCCION",
    groupBy: "ITEM",
    pageSize: "200",
  });

  const generalParams = new URLSearchParams(common);
  generalParams.set("view", "GENERAL");
  generalParams.set("orderStatus", "PROGRAMACION");

  const actualizacionParams = new URLSearchParams(common);
  actualizacionParams.set("view", "ACTUALIZACION");
  actualizacionParams.set("actualizacionQueue", "PROGRAMACION");

  return { generalParams, actualizacionParams };
}

async function fetchMesPedidos(operationType: string): Promise<PedidoGroup[]> {
  const { generalParams, actualizacionParams } = buildProgramacionQueryParams();

  const [generalRows, actualizacionRows, operationStatusByTalla] = await Promise.all([
    fetchProgramacionRows(generalParams),
    fetchProgramacionRows(actualizacionParams),
    fetchOperationStatusByTalla(operationType),
  ]);

  const mergedRows = [...generalRows, ...actualizacionRows];

  return buildPedidoGroups(mergedRows, operationStatusByTalla);
}

function buildPedidoGroups(
  rows: ProgramacionApiRow[],
  operationStatusByTalla: Map<string, EstadoProceso>,
): PedidoGroup[] {
  const byOrder = new Map<
    string,
    {
      pedido: PedidoGroup;
      disenosByItem: Map<string, DisenoGroup>;
    }
  >();

  for (const row of rows) {
    const orderCode = String(row.orderCode ?? "").trim();
    if (!orderCode) continue;

    const existing = byOrder.get(orderCode);

    if (!existing) {
      const pedido: PedidoGroup = {
        pedido: orderCode,
        cliente: row.clientName ?? "-",
        fechaPedido: formatDate(row.orderDate),
        fechaEntrega: formatDate(row.deliveryDate),
        vendedor: row.sellerName ?? "-",
        plazo: calcPlazo(row.orderDate, row.deliveryDate),
        estado: "EN PROCESO",
        disenos: [],
        expanded: false,
      };

      byOrder.set(orderCode, {
        pedido,
        disenosByItem: new Map<string, DisenoGroup>(),
      });
    }

    const orderEntry = byOrder.get(orderCode);
    if (!orderEntry) continue;

    const itemId = String(row.orderItemId ?? row.id ?? "").trim();
    if (!itemId) continue;

    let diseno = orderEntry.disenosByItem.get(itemId);
    if (!diseno) {
      const idx = orderEntry.disenosByItem.size;
      diseno = {
        diseno: row.designNumber ?? idx + 1,
        detalle: row.design ?? "Sin detalle",
        tela: row.fabric ?? "-",
        genero: row.gender ?? "-",
        ticketMontaje: String(row.ticketMontaje ?? "").trim() || "SIN TICKET",
        ticketPlotter: String(row.ticketPlotter ?? "").trim() || "SIN TICKET",
        tallas: [],
      };
      orderEntry.disenosByItem.set(itemId, diseno);
    }

    const qty = Number(row.quantity ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const talla = row.talla ?? "UNICA";
    const tallaKey = buildProcessTallaKey(orderCode, diseno.detalle, talla);

    diseno.tallas.push({
      talla,
      cantidad: qty,
      estado: operationStatusByTalla.get(tallaKey) ?? "pendiente",
    });
  }

  return Array.from(byOrder.values())
    .map((entry) => {
      const disenos = Array.from(entry.disenosByItem.values()).sort(
        (a, b) => a.diseno - b.diseno,
      );
      const allComplete = disenos.every((d) =>
        d.tallas.every((t) => t.estado === "completado"),
      );
      const estado: PedidoGroup["estado"] = allComplete
        ? "COMPLETADO"
        : "EN PROCESO";

      return {
        ...entry.pedido,
        estado,
        disenos,
      };
    })
    .sort((a, b) => b.pedido.localeCompare(a.pedido));
}

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const mockData: PedidoGroup[] = [
  {
    pedido: "VN-013875",
    cliente: "BARCA ACADEMIA",
    fechaPedido: "30/01/2026",
    fechaEntrega: "06/02/2026",
    vendedor: "NATALIA",
    plazo: 7,
    estado: "SIN TRAMITAR",
    expanded: true,
    disenos: [
      {
        diseno: 1,
        detalle: "CORTAVIENTOS",
        tela: "NOVAK",
        genero: "MASCULINO",
        ticketMontaje: generateTicket("montaje", 0),
        ticketPlotter: generateTicket("plotter", 0),
        tallas: [{ talla: "T/6", cantidad: 1, estado: "pendiente" }],
      },
    ],
  },
  {
    pedido: "VN-013818",
    cliente: "CLUB DEPORTIVO BRASILIA",
    fechaPedido: "22/01/2026",
    fechaEntrega: "14/02/2026",
    vendedor: "MAURICIO",
    plazo: 23,
    estado: "EN PROCESO",
    expanded: true,
    disenos: [
      {
        diseno: 1,
        detalle: "CORTAVIENTOS",
        tela: "NOVAK",
        genero: "MASCULINO",
        ticketMontaje: generateTicket("montaje", 1),
        ticketPlotter: generateTicket("plotter", 1),
        tallas: [
          {
            talla: "T/6",
            cantidad: 6,
            estado: "completado",
            responsable: "Laura M.",
            fechaInicio: "23/01",
            fechaFin: "24/01",
          },
          {
            talla: "T/8",
            cantidad: 22,
            estado: "completado",
            responsable: "Laura M.",
            fechaInicio: "23/01",
            fechaFin: "24/01",
          },
          {
            talla: "T/10",
            cantidad: 22,
            estado: "en_proceso",
            responsable: "Carlos R.",
            fechaInicio: "25/01",
          },
          {
            talla: "T/12",
            cantidad: 30,
            estado: "en_proceso",
            responsable: "Carlos R.",
            fechaInicio: "25/01",
          },
          { talla: "T/14", cantidad: 30, estado: "pendiente" },
          { talla: "T/16", cantidad: 30, estado: "pendiente" },
          { talla: "T/S", cantidad: 30, estado: "pendiente" },
          { talla: "T/M", cantidad: 30, estado: "pendiente" },
          { talla: "T/L", cantidad: 25, estado: "pendiente" },
          { talla: "T/XL", cantidad: 20, estado: "pendiente" },
          {
            talla: "T/2XL",
            cantidad: 5,
            estado: "reponer",
            observacion: "Arruga en papel",
          },
        ],
      },
      {
        diseno: 2,
        detalle: "SUDADERA BOLSILLO LATERAL",
        tela: "NOVAK",
        genero: "MASCULINO",
        ticketMontaje: generateTicket("montaje", 2),
        ticketPlotter: generateTicket("plotter", 2),
        tallas: [
          {
            talla: "T/6",
            cantidad: 6,
            estado: "en_proceso",
            responsable: "Ana G.",
            fechaInicio: "26/01",
          },
          { talla: "T/8", cantidad: 22, estado: "pendiente" },
          { talla: "T/10", cantidad: 22, estado: "pendiente" },
          { talla: "T/12", cantidad: 30, estado: "pendiente" },
          { talla: "T/14", cantidad: 30, estado: "pendiente" },
          { talla: "T/16", cantidad: 30, estado: "pendiente" },
        ],
      },
    ],
  },
  {
    pedido: "VN-013795",
    cliente: "ACADEMIA FÚTBOL ELITE",
    fechaPedido: "18/01/2026",
    fechaEntrega: "10/02/2026",
    vendedor: "CARLOS",
    plazo: 15,
    estado: "TARDE",
    expanded: false,
    disenos: [
      {
        diseno: 1,
        detalle: "CAMISETA MANGA CORTA",
        tela: "PERFORMANCE DRY",
        genero: "MIXTO",
        ticketMontaje: generateTicket("montaje", 3),
        ticketPlotter: generateTicket("plotter", 3),
        tallas: [
          {
            talla: "T/S",
            cantidad: 10,
            estado: "completado",
            responsable: "Luis P.",
          },
          {
            talla: "T/M",
            cantidad: 25,
            estado: "completado",
            responsable: "Luis P.",
          },
          {
            talla: "T/L",
            cantidad: 20,
            estado: "reponer",
            observacion: "Falla sublimación",
          },
          { talla: "T/XL", cantidad: 8, estado: "pendiente" },
        ],
      },
    ],
  },
];

// ─── ESTADO CHIP ─────────────────────────────────────────────────────────────
const estadoConfig: Record<
  EstadoProceso,
  {
    label: string;
    color: "success" | "primary" | "default" | "danger";
    icon: React.ReactNode;
  }
> = {
  completado: {
    label: "Completado",
    color: "success",
    icon: <MdCheckCircle size={12} />,
  },
  en_proceso: {
    label: "En proceso",
    color: "primary",
    icon: <MdSchedule size={12} />,
  },
  pendiente: {
    label: "Pendiente",
    color: "default",
    icon: <MdSchedule size={12} />,
  },
  reponer: {
    label: "Reponer",
    color: "danger",
    icon: <MdWarning size={12} />,
  },
};

const pedidoEstadoConfig: Record<
  string,
  { color: "success" | "primary" | "warning" | "danger" | "default" }
> = {
  "SIN TRAMITAR": { color: "default" },
  "EN PROCESO": { color: "primary" },
  COMPLETADO: { color: "success" },
  TARDE: { color: "danger" },
};

// ─── TICKET BADGE ─────────────────────────────────────────────────────────────
function TicketBadge({ ticket, proceso }: { ticket: string; proceso: string }) {
  const colors: Record<string, string> = {
    MO: "bg-violet-600 dark:bg-violet-500",
    MON: "bg-violet-600 dark:bg-violet-500",
    PLO: "bg-cyan-600 dark:bg-cyan-500",
    SUB: "bg-orange-500 dark:bg-orange-400",
    COR: "bg-rose-600 dark:bg-rose-500",
    INT: "bg-teal-600 dark:bg-teal-500",
    CON: "bg-indigo-600 dark:bg-indigo-500",
    EMP: "bg-amber-600 dark:bg-amber-500",
    DES: "bg-emerald-600 dark:bg-emerald-500",
  };
  const prefix = String(ticket.split("-")[0] ?? "").toUpperCase();
  const bg = colors[prefix] ?? "bg-gray-600";

  return (
    <Tooltip content={`Ticket de ${proceso}`} placement="left">
      <div
        className={`absolute -top-2 -right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full shadow-lg text-white text-[10px] font-bold tracking-wide ${bg}`}
      >
        <MdTag size={10} />
        {ticket}
      </div>
    </Tooltip>
  );
}

function extractMontajeTurn(ticket: string): number {
  const match = String(ticket ?? "").toUpperCase().match(/^MON-(\d+)$/);
  if (!match) return Number.POSITIVE_INFINITY;

  const turn = Number(match[1]);
  return Number.isFinite(turn) ? turn : Number.POSITIVE_INFINITY;
}

// ─── DISEÑO CARD ──────────────────────────────────────────────────────────────
function DisenoCard({ diseno }: { diseno: DisenoGroup }) {
  const total = diseno.tallas.reduce((s, t) => s + t.cantidad, 0);
  const completadas = diseno.tallas
    .filter((t) => t.estado === "completado")
    .reduce((s, t) => s + t.cantidad, 0);
  const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;

  return (
    <Card className="relative border border-divider shadow-sm mb-3" radius="sm">
      <CardHeader className="pb-1 pt-3 px-4 flex flex-col items-start gap-0">
        <div className="flex items-center gap-2 w-full">
          <span className="text-xs font-semibold uppercase tracking-widest text-default-400">
            Diseño {diseno.diseno}
          </span>
          <Chip
            className="ml-auto text-[10px]"
            color="default"
            size="sm"
            variant="flat"
          >
            {pct}% completado
          </Chip>
        </div>
        <p className="text-sm font-bold text-foreground mt-0.5">
          {diseno.detalle}
        </p>
        <div className="flex gap-3 mt-1">
          <span className="text-xs text-default-400">
            Tela:{" "}
            <span className="text-foreground font-medium">{diseno.tela}</span>
          </span>
          <span className="text-xs text-default-400">
            Género:{" "}
            <span className="text-foreground font-medium">{diseno.genero}</span>
          </span>
          <span className="text-xs text-default-400">
            Total:{" "}
            <span className="text-foreground font-bold">{total} uds</span>
          </span>
        </div>
        <div className="w-full h-1 bg-default-100 rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-success rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Chip className="text-[10px] h-5 font-bold" color="secondary" size="sm" variant="flat">
            Montaje: {diseno.ticketMontaje}
          </Chip>
        </div>
      </CardHeader>

      <Divider />

      <CardBody className="px-2 py-2">
        <Table
          removeWrapper
          aria-label={`Tallas diseño ${diseno.diseno}`}
          classNames={{
            th: "bg-default-50 dark:bg-default-100 text-default-500 text-[11px] h-7 uppercase tracking-wide",
            td: "py-1.5 text-xs",
          }}
        >
          <TableHeader>
            <TableColumn>Talla</TableColumn>
            <TableColumn>Cantidad</TableColumn>
            <TableColumn>Estado</TableColumn>
            <TableColumn>Responsable</TableColumn>
            <TableColumn>Fecha inicio</TableColumn>
            <TableColumn>Fecha fin</TableColumn>
            <TableColumn>Observación</TableColumn>
          </TableHeader>
          <TableBody>
            {diseno.tallas.map((talla, ti) => {
              const cfg = estadoConfig[talla.estado];

              return (
                <TableRow key={ti}>
                  <TableCell>
                    <span className="font-semibold text-foreground">
                      {talla.talla}
                    </span>
                  </TableCell>
                  <TableCell>{talla.cantidad}</TableCell>
                  <TableCell>
                    <Chip
                      className="text-[10px] h-5"
                      color={cfg.color}
                      size="sm"
                      startContent={cfg.icon}
                      variant="flat"
                    >
                      {cfg.label}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <span className="text-default-500">
                      {talla.responsable ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-default-500">
                      {talla.fechaInicio ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-default-500">
                      {talla.fechaFin ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {talla.observacion ? (
                      <Chip
                        className="text-[10px] h-5"
                        color="warning"
                        size="sm"
                        variant="dot"
                      >
                        {talla.observacion}
                      </Chip>
                    ) : (
                      <span className="text-default-300">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="flex justify-end mt-2 pr-2">
          <span className="text-[10px] text-default-400">Ticket único de montaje por diseño</span>
        </div>
      </CardBody>
    </Card>
  );
}

// ─── PEDIDO SECTION ───────────────────────────────────────────────────────────
function PedidoSection({
  pedido,
  onToggle,
}: {
  pedido: PedidoGroup;
  onToggle: () => void;
}) {
  const cfg = pedidoEstadoConfig[pedido.estado];
  const totalUds = pedido.disenos
    .flatMap((d) => d.tallas)
    .reduce((s, t) => s + t.cantidad, 0);

  return (
    <Card
      className="mb-4 border border-divider shadow-sm overflow-visible"
      radius="md"
    >
      <CardHeader
        className="flex items-center gap-3 cursor-pointer hover:bg-default-50 dark:hover:bg-default-100 transition-colors px-4 py-3"
        onClick={onToggle}
      >
        <button className="text-default-400 shrink-0">
          {pedido.expanded ? (
            <MdExpandLess size={20} />
          ) : (
            <MdExpandMore size={20} />
          )}
        </button>

        <div className="flex flex-col">
          <span className="text-sm font-bold text-foreground leading-tight">
            {pedido.pedido}
          </span>
          <span className="text-xs text-default-400">{pedido.cliente}</span>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
          <span className="text-xs text-default-400">
            Vendedor:{" "}
            <span className="text-foreground font-medium">
              {pedido.vendedor}
            </span>
          </span>
          <Divider className="h-4" orientation="vertical" />
          <span className="text-xs text-default-400">
            Plazo:{" "}
            <span className="text-foreground font-medium">{pedido.plazo}d</span>
          </span>
          <Divider className="h-4" orientation="vertical" />
          <span className="text-xs text-default-400">
            Entrega:{" "}
            <span className="text-foreground font-medium">
              {pedido.fechaEntrega}
            </span>
          </span>
          <Divider className="h-4" orientation="vertical" />
          <span className="text-xs text-default-400">
            Total:{" "}
            <span className="text-foreground font-bold">{totalUds} uds</span>
          </span>
          <Chip
            className="text-[10px]"
            color={cfg.color}
            size="sm"
            variant="flat"
          >
            {pedido.estado}
          </Chip>
          <Chip
            className="text-[10px] font-mono"
            color="default"
            size="sm"
            variant="bordered"
          >
            {pedido.disenos.length} diseño
            {pedido.disenos.length !== 1 ? "s" : ""}
          </Chip>
        </div>
      </CardHeader>

      {pedido.expanded && (
        <CardBody className="pt-0 px-3 pb-3">
          <Divider className="mb-3" />
          {pedido.disenos.map((d, i) => (
            <DisenoCard key={i} diseno={d} />
          ))}
        </CardBody>
      )}
    </Card>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function MesPageClient() {
  const [data, setData] = useState<PedidoGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [activeProceso, setActiveProceso] = useState("programacion");
  const [selectedMontajeTicket, setSelectedMontajeTicket] = useState<{
    pedido: string;
    detalle: string;
    totalUnidades: number;
    ticketMontaje: string;
    tallas: TallaRow[];
  } | null>(null);
  const activeProcessConfig =
    PROCESS_ROLE_CONFIG[activeProceso] ?? PROCESS_ROLE_CONFIG.montaje;

  const reloadMesPedidos = useCallback(async () => {
    const pedidos = await fetchMesPedidos(activeProcessConfig.operationType);

    return pedidos.length > 0 ? pedidos : mockData;
  }, [activeProcessConfig.operationType]);

  // Load orders from programacion and programacion actualizacion queues.
  useEffect(() => {
    const loadProgramacionOrders = async () => {
      try {
        setLoading(true);
        const pedidos = await reloadMesPedidos();

        setData(pedidos);
      } catch (error) {
        console.error("Error loading programming orders:", error);
        setData(mockData); // Fallback to mock on error
      } finally {
        setLoading(false);
      }
    };

    loadProgramacionOrders();
  }, [reloadMesPedidos]);

  const filtered = useMemo(() => {
    return data.filter((p) => {
      const matchSearch =
        p.pedido.toLowerCase().includes(search.toLowerCase()) ||
        p.cliente.toLowerCase().includes(search.toLowerCase());
      const matchEstado = filterEstado === "todos" || p.estado === filterEstado;

      return matchSearch && matchEstado;
    });
  }, [data, search, filterEstado]);

  const togglePedido = (idx: number) => {
    setData((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, expanded: !p.expanded } : p)),
    );
  };

  const stats = useMemo(() => {
    const total = data.length;
    const enProceso = data.filter((p) => p.estado === "EN PROCESO").length;
    const tarde = data.filter((p) => p.estado === "TARDE").length;
    const completado = data.filter((p) => p.estado === "COMPLETADO").length;

    return { total, enProceso, tarde, completado };
  }, [data]);

  const processQueue = useMemo(() => {
    const queue = data
      .flatMap((pedido) =>
        pedido.disenos.map((diseno, idx) => {
          const tallasPendientes = diseno.tallas.filter((t) => t.estado !== "completado");
          const totalUnidades = diseno.tallas.reduce((sum, t) => sum + t.cantidad, 0);
          const unidadesPendientes = tallasPendientes.reduce(
            (sum, t) => sum + t.cantidad,
            0,
          );
          const ticket = buildProcessTicket(activeProceso, diseno, idx);
          return {
            pedido: pedido.pedido,
            cliente: pedido.cliente,
            diseno: diseno.diseno,
            detalle: diseno.detalle,
            ticket: String(ticket),
            tallas: diseno.tallas,
            totalUnidades,
            totalTallasPendientes: tallasPendientes.length,
            unidadesPendientes,
            turno: extractTurnFromTicket(String(ticket)),
          };
        }),
      )
      .filter((row) => Number.isFinite(row.turno) && row.totalTallasPendientes > 0);

    queue.sort((a, b) => a.turno - b.turno);
    return queue;
  }, [data, activeProceso]);

  const nextProcessTurn = processQueue[0] ?? null;

  const handleMontajeSaved = () => {
    setSelectedMontajeTicket(null);

    void (async () => {
      try {
        const pedidos = await reloadMesPedidos();
        setData(pedidos);
      } catch {
        // Keep previous state if refresh fails.
      }
    })();
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:px-8">
      {/* ── HEADER ── */}
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">M.E.S.</h1>
        <p className="text-sm text-default-500">
          Seguimiento de producción en tiempo real para Manufacturing Execution System.
        </p>
      </header>

      {/* ── STATS BAR ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total pedidos",
            value: stats.total,
            color: "text-foreground",
          },
          {
            label: "En proceso",
            value: stats.enProceso,
            color: "text-primary",
          },
          { label: "Tardíos", value: stats.tarde, color: "text-danger" },
          {
            label: "Completados",
            value: stats.completado,
            color: "text-success",
          },
        ].map((s) => (
          <Card
            key={s.label}
            className="border border-divider"
            radius="sm"
            shadow="none"
          >
            <CardBody className="py-2 px-3">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-default-400">{s.label}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* ── TABS PROCESOS ── */}
      <section className="rounded-medium border border-default-200 bg-content1 p-2">
        <Tabs
          classNames={{
            tabList: "gap-0 overflow-x-auto",
            cursor: "bg-primary",
          }}
          selectedKey={activeProceso}
          size="sm"
          variant="underlined"
          onSelectionChange={(k) => setActiveProceso(k as string)}
        >
          {[
            { key: "programacion", label: "Programación" },
            { key: "montaje", label: "Montaje" },
            { key: "plotter", label: "Plotter" },
            { key: "sublimacion", label: "Sublimación" },
            { key: "corte", label: "Corte" },
            { key: "integracion", label: "Integración" },
            { key: "confeccion", label: "Confección" },
            { key: "empaque", label: "Empaque" },
            { key: "despacho", label: "Despacho" },
          ].map((tab) => (
            <Tab
              key={tab.key}
              title={
                <span className="text-xs px-1">
                  {tab.key !== "programacion" && (
                    <span className="mr-1 text-[9px] font-mono text-default-400">
                      [
                      {PROCESO_PREFIX[tab.key] ??
                        tab.key.slice(0, 3).toUpperCase()}
                      ]
                    </span>
                  )}
                  {tab.label}
                </span>
              }
            />
          ))}
        </Tabs>
      </section>

      <Divider className="opacity-60" />

      {/* ── CONTENIDO: PROGRAMACION ── */}
      {activeProceso === "programacion" && (
        <section className="rounded-medium border border-default-200 bg-content1 p-4">
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <Input
              className="max-w-xs"
              placeholder="Buscar pedido o cliente…"
              radius="sm"
              size="sm"
              startContent={<MdSearch className="text-default-400" />}
              value={search}
              variant="bordered"
              onValueChange={setSearch}
            />
            <Select
              className="max-w-[160px]"
              placeholder="Estado"
              radius="sm"
              selectedKeys={[filterEstado]}
              size="sm"
              startContent={<MdFilterList className="text-default-400" />}
              variant="bordered"
              onSelectionChange={(keys) =>
                setFilterEstado(Array.from(keys)[0] as string)
              }
            >
              <SelectItem key="todos">Todos</SelectItem>
              <SelectItem key="SIN TRAMITAR">Sin tramitar</SelectItem>
              <SelectItem key="EN PROCESO">En proceso</SelectItem>
              <SelectItem key="COMPLETADO">Completado</SelectItem>
              <SelectItem key="TARDE">Tarde</SelectItem>
            </Select>

            <div className="flex gap-2 ml-auto">
              <Button
                radius="sm"
                size="sm"
                startContent={<MdRefresh />}
                variant="flat"
                onPress={() => {
                  setSearch("");
                  setFilterEstado("todos");
                }}
              >
                Limpiar
              </Button>
              <Button
                color="primary"
                radius="sm"
                size="sm"
                startContent={<MdPrint />}
                variant="flat"
              >
                Exportar
              </Button>
            </div>
          </div>

          {loading ? (
            <Card
              className="border border-dashed border-divider"
              radius="md"
              shadow="none"
            >
              <CardBody className="py-12 flex items-center justify-center">
                <div className="text-center text-default-400">
                  <MdSchedule className="mx-auto mb-2 animate-spin" size={36} />
                  <p className="text-sm">Cargando pedidos en programación...</p>
                </div>
              </CardBody>
            </Card>
          ) : filtered.length === 0 ? (
            <Card
              className="border border-dashed border-divider"
              radius="md"
              shadow="none"
            >
              <CardBody className="py-12 flex items-center justify-center">
                <div className="text-center text-default-400">
                  <MdError className="mx-auto mb-2 opacity-40" size={36} />
                  <p className="text-sm">No se encontraron pedidos</p>
                </div>
              </CardBody>
            </Card>
          ) : (
            filtered.map((pedido) => {
              const realIdx = data.findIndex((p) => p.pedido === pedido.pedido);

              return (
                <PedidoSection
                  key={pedido.pedido}
                  pedido={pedido}
                  onToggle={() => togglePedido(realIdx)}
                />
              );
            })
          )}
        </section>
      )}

      {/* ── CONTENIDO: PROCESOS OPERATIVOS ── */}
      {activeProceso !== "programacion" && (
        <section className="space-y-4 rounded-medium border border-default-200 bg-content1 p-4">
          {nextProcessTurn ? (
            <Card className="border border-divider" radius="sm" shadow="none">
              <CardBody className="py-3 px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip color="secondary" size="sm" variant="flat">
                    Turno que sigue en {activeProcessConfig.label.toLowerCase()}: {nextProcessTurn.ticket}
                  </Chip>
                  <span className="text-xs text-default-400">Pedido:</span>
                  <span className="text-xs font-medium">{nextProcessTurn.pedido}</span>
                  <span className="text-xs text-default-400">Diseño:</span>
                  <span className="text-xs font-medium">{nextProcessTurn.diseno}</span>
                </div>
              </CardBody>
            </Card>
          ) : null}

          {processQueue.length === 0 ? (
            <Card className="border border-dashed border-divider" radius="md" shadow="none">
              <CardBody className="py-10 text-center text-default-400">
                <MdError className="mx-auto mb-2 opacity-40" size={32} />
                <p className="text-sm">No hay tickets de {activeProcessConfig.label.toLowerCase()} para mostrar</p>
              </CardBody>
            </Card>
          ) : (
            <div className="rounded-medium border border-default-200 p-2">
              <Table aria-label={`Cola de ${activeProcessConfig.label.toLowerCase()}`} removeWrapper>
              <TableHeader>
                <TableColumn>Turno</TableColumn>
                <TableColumn>Ticket</TableColumn>
                <TableColumn>Pedido</TableColumn>
                <TableColumn>Cliente</TableColumn>
                <TableColumn>Diseño</TableColumn>
                <TableColumn>Total uds</TableColumn>
                <TableColumn>Pendiente tallas</TableColumn>
                <TableColumn>Acción</TableColumn>
              </TableHeader>
              <TableBody items={processQueue}>
                {(row) => (
                  <TableRow key={`${row.pedido}-${row.diseno}-${row.ticket}`}>
                    <TableCell>{row.turno}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Chip color="secondary" size="sm" variant="flat">
                          {row.ticket}
                        </Chip>
                        {nextProcessTurn?.ticket === row.ticket ? (
                          <Chip color="warning" size="sm" variant="flat">
                            Siguiente
                          </Chip>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{row.pedido}</TableCell>
                    <TableCell>{row.cliente}</TableCell>
                    <TableCell>{`Diseño ${row.diseno}`}</TableCell>
                    <TableCell>{row.totalUnidades}</TableCell>
                    <TableCell>
                      <Chip color="warning" size="sm" variant="flat">
                        {row.totalTallasPendientes} tallas · {row.unidadesPendientes} uds
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <Button
                        color="primary"
                        size="sm"
                        variant={
                          selectedMontajeTicket?.ticketMontaje === row.ticket
                            ? "solid"
                            : "flat"
                        }
                        isDisabled={nextProcessTurn?.ticket !== row.ticket}
                        onPress={() =>
                          setSelectedMontajeTicket({
                            pedido: row.pedido,
                            detalle: row.detalle,
                            totalUnidades: row.totalUnidades,
                            ticketMontaje: row.ticket,
                            tallas: row.tallas,
                          })
                        }
                      >
                        Atender ticket
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          )}

          {selectedMontajeTicket ? (
            <Card className="border border-divider" radius="sm" shadow="none">
              <CardHeader>
                <div>
                  <div className="text-lg font-semibold">Producción - {activeProcessConfig.label}</div>
                  <div className="text-sm text-default-500">
                    Ticket {selectedMontajeTicket.ticketMontaje} · Pedido {selectedMontajeTicket.pedido}
                  </div>
                </div>
              </CardHeader>
              <CardBody>
                <OperarioWorklogTable
                  role={activeProcessConfig.role}
                  onSaved={handleMontajeSaved}
                  prefill={{
                    orderCode: selectedMontajeTicket.pedido,
                    designName: selectedMontajeTicket.detalle,
                    quantityOp: selectedMontajeTicket.totalUnidades,
                    tallas: (selectedMontajeTicket.tallas ?? [])
                      .filter((item) => item.estado !== "completado")
                      .map((item) => ({
                        talla: item.talla,
                        cantidad: item.cantidad,
                      })),
                  }}
                />
              </CardBody>
            </Card>
          ) : null}
        </section>
      )}
    </div>
  );
}
