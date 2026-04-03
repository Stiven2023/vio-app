import type {
  DisenoGroup,
  EstadoProceso,
  OperativeLogRow,
  PedidoGroup,
  ProcessHistoryEntry,
  ProcessQueueRow,
  ProgramacionApiRow,
} from "./mes-types";

import { PROCESO_PREFIX } from "./mes-config";

export function generateTicket(proceso: string, index: number): string {
  if (proceso.toLowerCase() === "montaje") {
    return `MON-${1001 + index}`;
  }

  const prefix =
    PROCESO_PREFIX[proceso.toLowerCase()] ?? proceso.slice(0, 3).toUpperCase();

  return `${prefix}-${1001 + index}`;
}

export function buildProcessTicket(
  proceso: string,
  diseno: DisenoGroup,
  index: number,
): string {
  if (proceso === "montaje") {
    return String(diseno.ticketMontaje || generateTicket("montaje", index));
  }

  if (proceso === "plotter") {
    return String(diseno.ticketPlotter || generateTicket("plotter", index));
  }

  return generateTicket(proceso, index);
}

export function buildProcessTallaKey(
  orderCode: string,
  designName: string,
  size: string,
): string {
  const order = String(orderCode ?? "")
    .trim()
    .toUpperCase();
  const design = String(designName ?? "")
    .trim()
    .toUpperCase();
  const talla = String(size ?? "")
    .trim()
    .toUpperCase();

  return `${order}::${design}::${talla}`;
}

export function buildProcessDesignKey(
  orderCode: string,
  designName: string,
): string {
  const order = String(orderCode ?? "")
    .trim()
    .toUpperCase();
  const design = String(designName ?? "")
    .trim()
    .toUpperCase();

  return `${order}::${design}::*`;
}

export function mergeEstado(
  prev: EstadoProceso | undefined,
  next: EstadoProceso,
): EstadoProceso {
  const rank: Record<EstadoProceso, number> = {
    pendiente: 0,
    en_proceso: 1,
    reponer: 2,
    completado: 3,
  };

  if (!prev) return next;

  return rank[next] >= rank[prev] ? next : prev;
}

export function extractTurnFromTicket(ticket: string): number {
  const match = String(ticket ?? "")
    .toUpperCase()
    .match(/-(\d+)$/);

  if (!match) return Number.POSITIVE_INFINITY;

  const turn = Number(match[1]);

  return Number.isFinite(turn) ? turn : Number.POSITIVE_INFINITY;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("es-CO");
}

export function calcPlazo(
  orderDate: string | null,
  deliveryDate: string | null,
): number {
  if (!orderDate || !deliveryDate) return 0;

  const start = new Date(orderDate).getTime();
  const end = new Date(deliveryDate).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) return 0;

  return Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
}

export function computeEstadoFromOperativeLog(
  row: OperativeLogRow,
): EstadoProceso {
  if (row.isComplete) return "completado";
  if (row.isPartial && row.repoCheck) return "reponer";
  if (Number(row.producedQuantity ?? 0) > 0 || Boolean(row.startAt)) {
    return "en_proceso";
  }

  return "pendiente";
}

export function buildPedidoGroups(
  rows: ProgramacionApiRow[],
  operationStatusByTalla: Map<string, EstadoProceso>,
  currentProcessByDesign?: Map<string, string>,
  processHistoryByDesign?: Map<string, ProcessHistoryEntry[]>,
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
        orderItemId: itemId,
        diseno: row.designNumber ?? idx + 1,
        detalle: row.design ?? "Sin detalle",
        tela: row.fabric ?? "-",
        genero: row.gender ?? "-",
        ticketMontaje: String(row.ticketMontaje ?? "").trim() || "SIN TICKET",
        ticketPlotter: String(row.ticketPlotter ?? "").trim() || "SIN TICKET",
        currentProcess:
          currentProcessByDesign?.get(
            buildProcessDesignKey(orderCode, row.design ?? ""),
          ) ?? "Sin iniciar",
        processHistory:
          processHistoryByDesign?.get(
            buildProcessDesignKey(orderCode, row.design ?? ""),
          ) ?? [],
        tallas: [],
      };
      orderEntry.disenosByItem.set(itemId, diseno);
    }

    const qty = Number(row.quantity ?? 0);

    if (!Number.isFinite(qty) || qty <= 0) continue;

    const talla = row.talla ?? "UNICA";
    const tallaKey = buildProcessTallaKey(orderCode, diseno.detalle, talla);
    const designKey = buildProcessDesignKey(orderCode, diseno.detalle);

    diseno.tallas.push({
      talla,
      cantidad: qty,
      estado:
        operationStatusByTalla.get(tallaKey) ??
        operationStatusByTalla.get(designKey) ??
        "pendiente",
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

export function buildProcessQueue(
  data: PedidoGroup[],
  activeProceso: string,
): ProcessQueueRow[] {
  const process = String(activeProceso ?? "")
    .trim()
    .toLowerCase();
  const pedidoLevelProcesses = new Set([
    "montaje",
    "plotter",
    "integracion",
    "confeccion",
    "empaque",
    "despacho",
  ]);
  const isPedidoLevel = pedidoLevelProcesses.has(process);
  const isSublimacionLevel = process === "sublimacion";

  const queue = data.flatMap((pedido, pedidoIdx) => {
    if (isPedidoLevel) {
      const allTallas = pedido.disenos.flatMap((diseno) => diseno.tallas);
      const tallasPendientes = allTallas.filter((t) => t.estado !== "completado");
      const totalUnidades = allTallas.reduce((sum, t) => sum + t.cantidad, 0);
      const unidadesPendientes = tallasPendientes.reduce(
        (sum, t) => sum + t.cantidad,
        0,
      );
      const ticket =
        process === "confeccion" || process === "empaque" || process === "despacho"
          ? `SEG-${pedido.pedido}`
          : generateTicket(process, pedidoIdx);
      const turno =
        process === "confeccion" || process === "empaque" || process === "despacho"
          ? pedidoIdx + 1
          : extractTurnFromTicket(ticket);

      return [
        {
          pedido: pedido.pedido,
          cliente: pedido.cliente,
          diseno: 0,
          detalle: "PEDIDO COMPLETO",
          ticket,
          defaultDesignName:
            pedido.disenos.find((d) => String(d.detalle ?? "").trim())?.detalle ??
            "PEDIDO COMPLETO",
          tallas: allTallas,
          designDetails: pedido.disenos.map((diseno) => ({
            diseno: diseno.diseno,
            detalle: diseno.detalle,
            orderItemId: diseno.orderItemId,
            tallas: diseno.tallas,
          })),
          totalUnidades,
          totalTallasPendientes: tallasPendientes.length,
          unidadesPendientes,
          turno,
        },
      ];
    }

    if (isSublimacionLevel) {
      return pedido.disenos.flatMap((diseno, disenoIdx) =>
        diseno.tallas
          .filter((t) => t.estado !== "completado")
          .map((talla, tallaIdx) => {
            const turnIndex = pedidoIdx * 1000 + disenoIdx * 100 + tallaIdx;
            const ticket = generateTicket(process, turnIndex);

            return {
              pedido: pedido.pedido,
              cliente: pedido.cliente,
              diseno: diseno.diseno,
              detalle: `${diseno.detalle} · Talla ${talla.talla}`,
              orderItemId: diseno.orderItemId,
              ticket,
              defaultDesignName: diseno.detalle,
              tallas: [talla],
              designDetails: [
                {
                  diseno: diseno.diseno,
                  detalle: diseno.detalle,
                  orderItemId: diseno.orderItemId,
                  tallas: [talla],
                },
              ],
              totalUnidades: talla.cantidad,
              totalTallasPendientes: 1,
              unidadesPendientes: talla.cantidad,
              turno: extractTurnFromTicket(ticket),
            };
          }),
      );
    }

    return pedido.disenos.map((diseno, idx) => {
      const tallasPendientes = diseno.tallas.filter(
        (t) => t.estado !== "completado",
      );
      const totalUnidades = diseno.tallas.reduce((sum, t) => sum + t.cantidad, 0);
      const unidadesPendientes = tallasPendientes.reduce(
        (sum, t) => sum + t.cantidad,
        0,
      );
      const ticket = buildProcessTicket(process, diseno, pedidoIdx * 100 + idx);

      return {
        pedido: pedido.pedido,
        cliente: pedido.cliente,
        diseno: diseno.diseno,
        detalle: diseno.detalle,
        orderItemId: diseno.orderItemId,
        ticket: String(ticket),
        defaultDesignName: diseno.detalle,
        tallas: diseno.tallas,
        designDetails: [
          {
            diseno: diseno.diseno,
            detalle: diseno.detalle,
            orderItemId: diseno.orderItemId,
            tallas: diseno.tallas,
          },
        ],
        totalUnidades,
        totalTallasPendientes: tallasPendientes.length,
        unidadesPendientes,
        turno: extractTurnFromTicket(String(ticket)),
      };
    });
  });

  const filtered = queue.filter((row) => row.totalTallasPendientes > 0);

  filtered.sort((a, b) => a.turno - b.turno);

  return filtered;
}
