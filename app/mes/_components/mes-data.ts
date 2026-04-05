import type {
  EstadoProceso,
  MontajeAssignment,
  OperativeLogRow,
  PaginatedResponse,
  PedidoGroup,
  ProcessHistoryEntry,
  ProgramacionApiRow,
} from "./mes-types";

import {
  buildProcessDesignKey,
  buildPedidoGroups,
  buildProcessTallaKey,
  computeEstadoFromOperativeLog,
  mergeEstado,
} from "./mes-utils";

const OPERATION_LABELS: Record<string, string> = {
  MONTAJE: "Montaje",
  PLOTTER: "Plotter",
  SUBLIMACION: "Sublimacion",
  CALANDRA: "Calandra",
  CORTE_LASER: "Corte",
  CORTE_MANUAL: "Corte",
  CONFECCION: "Confeccion",
  EMPAQUE: "Empaque",
  INTEGRACION: "Integracion",
  DESPACHO: "Despacho",
};

const STATUS_TO_PROCESS_LABEL: Record<string, string> = {
  PENDIENTE_PRODUCCION: "Montaje",
  PENDIENTE_PRODUCCION_ACTUALIZACION: "Montaje",
  MONTAJE: "Montaje",
  IMPRESION: "Plotter",
  SUBLIMACION: "Sublimacion",
  CORTE_MANUAL: "Corte",
  CORTE_LASER: "Corte",
  PENDIENTE_CONFECCION: "Confeccion",
  CONFECCION: "Confeccion",
  EN_BODEGA: "Integracion",
  EMPAQUE: "Empaque",
  ENVIADO: "Despacho",
  COMPLETADO: "Completado",
};

const STATUS_RANK: Record<string, number> = {
  PENDIENTE_PRODUCCION: 5,
  PENDIENTE_PRODUCCION_ACTUALIZACION: 5,
  MONTAJE: 10,
  IMPRESION: 20,
  SUBLIMACION: 30,
  CORTE_MANUAL: 40,
  CORTE_LASER: 40,
  PENDIENTE_CONFECCION: 50,
  CONFECCION: 60,
  EN_BODEGA: 70,
  EMPAQUE: 80,
  ENVIADO: 90,
  COMPLETADO: 100,
};

const MES_CACHE_TTL_MS = 30_000;

type MesCacheEntry<T> = {
  expiresAt: number;
  value?: T;
  promise?: Promise<T>;
};

const PROCESS_ITEM_STATUS_FILTERS: Record<string, string[]> = {
  montaje: [
    "PENDIENTE_PRODUCCION",
    "PENDIENTE_PRODUCCION_ACTUALIZACION",
    "MONTAJE",
  ],
  plotter: ["IMPRESION"],
  sublimacion: ["SUBLIMACION"],
  corte: ["CORTE_MANUAL", "CORTE_LASER"],
  confeccion: ["PENDIENTE_CONFECCION", "CONFECCION"],
  integracion: ["EN_BODEGA"],
  empaque: ["EMPAQUE"],
  despacho: ["ENVIADO"],
};

const mesDataCache = new Map<string, MesCacheEntry<unknown>>();

async function getMesCachedValue<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = MES_CACHE_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const cached = mesDataCache.get(key) as MesCacheEntry<T> | undefined;

  if (cached?.value !== undefined && cached.expiresAt > now) {
    return cached.value;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = loader()
    .then((value) => {
      mesDataCache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });

      return value;
    })
    .catch((error) => {
      mesDataCache.delete(key);
      throw error;
    });

  mesDataCache.set(key, {
    expiresAt: now + ttlMs,
    promise,
  });

  return promise;
}

export function invalidateMesDataCache(prefix?: string) {
  if (!prefix) {
    mesDataCache.clear();
    return;
  }

  for (const key of mesDataCache.keys()) {
    if (key.startsWith(prefix)) {
      mesDataCache.delete(key);
    }
  }
}

function mapOperationTypeLabel(value: string | null | undefined): string {
  const key = String(value ?? "")
    .trim()
    .toUpperCase();

  return OPERATION_LABELS[key] ?? (key || "Unknown");
}

function mapStatusToProcessLabel(value: string | null | undefined): string {
  const key = String(value ?? "")
    .trim()
    .toUpperCase();

  return STATUS_TO_PROCESS_LABEL[key] ?? (key || "Not started");
}

function mapStatusRank(value: string | null | undefined): number {
  const key = String(value ?? "")
    .trim()
    .toUpperCase();

  return STATUS_RANK[key] ?? 0;
}

export function buildProgramacionQueryParams(orderStatuses: string[]) {
  const statuses = orderStatuses.length > 0 ? orderStatuses : ["PROGRAMACION"];
  const actualizacionQueues = ["APROBACION", "PROGRAMACION"] as const;
  const common = new URLSearchParams({
    process: "PRODUCCION",
    groupBy: "ITEM",
    pageSize: "200",
  });

  const generalParamsList = statuses.map((status) => {
    const generalParams = new URLSearchParams(common);

    generalParams.set("view", "GENERAL");
    generalParams.set("orderStatus", status);

    return generalParams;
  });

  const actualizacionParamsList = actualizacionQueues.map((queue) => {
    const actualizacionParams = new URLSearchParams(common);

    actualizacionParams.set("view", "ACTUALIZACION");
    actualizacionParams.set("actualizacionQueue", queue);

    return actualizacionParams;
  });

  return { generalParamsList, actualizacionParamsList };
}

export async function fetchProgramacionRows(
  params: URLSearchParams,
): Promise<ProgramacionApiRow[]> {
  const cacheKey = `programacion:${params.toString()}`;

  return getMesCachedValue(cacheKey, async () => {
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

      const payload =
        (await response.json()) as PaginatedResponse<ProgramacionApiRow>;
      const chunk = Array.isArray(payload.items) ? payload.items : [];

      rows.push(...chunk);
      hasNextPage = Boolean(payload.hasNextPage);
      page += 1;
    }

    return rows;
  });
}

export async function fetchMesPreprocessOrderRank(options?: {
  confirmedOnly?: boolean;
}): Promise<Map<string, number>> {
  const confirmedOnly = options?.confirmedOnly ?? false;
  const cacheKey = `preprocess-rank:${confirmedOnly ? "confirmed" : "all"}`;

  return getMesCachedValue(cacheKey, async () => {
    const rankByOrderCode = new Map<string, number>();

    try {
      const response = await fetch("/api/mes/production-queue", {
        cache: "no-store",
      });

      if (!response.ok) return rankByOrderCode;

      const payload = (await response.json()) as {
        items?: Array<{
          orderCode?: string | null;
          finalOrder?: number | null;
          confirmedAt?: string | null;
        }>;
      };
      const items = Array.isArray(payload?.items) ? payload.items : [];

      for (const row of items) {
        const orderCode = String(row?.orderCode ?? "").trim();
        const finalOrder = Number(row?.finalOrder ?? Number.POSITIVE_INFINITY);
        const isConfirmed = Boolean(String(row?.confirmedAt ?? "").trim());

        if (confirmedOnly && !isConfirmed) continue;

        if (!orderCode || !Number.isFinite(finalOrder)) continue;

        const prev = rankByOrderCode.get(orderCode);

        if (prev === undefined || finalOrder < prev) {
          rankByOrderCode.set(orderCode, finalOrder);
        }
      }
    } catch {
      return rankByOrderCode;
    }

    return rankByOrderCode;
  });
}

export async function fetchOperationStatusByTalla(
  operationType: string,
): Promise<Map<string, EstadoProceso>> {
  const cacheKey = `operation-status:${operationType}`;

  return getMesCachedValue(cacheKey, async () => {
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

      const response = await fetch(
        `/api/dashboard/operative-logs?${query.toString()}`,
      );

      if (!response.ok) break;

      const payload =
        (await response.json()) as PaginatedResponse<OperativeLogRow>;
      const items = Array.isArray(payload.items) ? payload.items : [];

      for (const row of items) {
        const talla = String(row.size ?? "").trim();
        const key = talla
          ? buildProcessTallaKey(row.orderCode, row.designName, talla)
          : buildProcessDesignKey(row.orderCode, row.designName);

        if (key === "::::") continue;

        const prev = statusMap.get(key);

        statusMap.set(
          key,
          mergeEstado(prev, computeEstadoFromOperativeLog(row)),
        );
      }

      hasNextPage = Boolean(payload.hasNextPage);
      page += 1;
    }

    return statusMap;
  });
}

export async function fetchProcessHistoryByDesign(): Promise<
  Map<string, ProcessHistoryEntry[]>
> {
  return getMesCachedValue("process-history:design", async () => {
    const historyByDesign = new Map<string, ProcessHistoryEntry[]>();
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage && page <= 50) {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: "200",
        includeAssignments: "0",
      });

      const response = await fetch(
        `/api/dashboard/operative-logs?${query.toString()}`,
      );

      if (!response.ok) break;

      const payload =
        (await response.json()) as PaginatedResponse<OperativeLogRow>;
      const items = Array.isArray(payload.items) ? payload.items : [];

      for (const row of items) {
        const orderCode = String(row.orderCode ?? "").trim();
        const designName = String(row.designName ?? "").trim();
        const operationType = String(row.operationType ?? "")
          .trim()
          .toUpperCase();

        if (!orderCode || !designName || !operationType) continue;

        const key = buildProcessDesignKey(orderCode, designName);
        const current = historyByDesign.get(key) ?? [];

        current.push({
          operationType: mapOperationTypeLabel(operationType),
          state: row.isComplete
            ? "COMPLETADO"
            : row.isPartial
              ? "PARCIAL"
              : "EN_PROCESO",
          at: row.endAt ?? row.startAt ?? row.createdAt ?? null,
          notes: row.observations ?? null,
          producedQuantity: Number(row.producedQuantity ?? 0),
        });

        historyByDesign.set(key, current);
      }

      hasNextPage = Boolean(payload.hasNextPage);
      page += 1;
    }

    for (const [key, history] of historyByDesign.entries()) {
      history.sort((a, b) => {
        const aTs = a.at ? new Date(a.at).getTime() : 0;
        const bTs = b.at ? new Date(b.at).getTime() : 0;

        return bTs - aTs;
      });

      historyByDesign.set(key, history.slice(0, 12));
    }

    return historyByDesign;
  });
}

export async function fetchMesPedidos(
  operationType: string,
  orderStatuses: string[],
  options?: { includeActualizacion?: boolean; activeProceso?: string },
): Promise<PedidoGroup[]> {
  const includeActualizacion = options?.includeActualizacion ?? true;
  const activeProceso = String(options?.activeProceso ?? "")
    .trim()
    .toLowerCase();
  const cacheKey = `mes-pedidos:${operationType}:${activeProceso}:${orderStatuses.join(",")}:${includeActualizacion ? "with-actualizacion" : "general-only"}`;

  return getMesCachedValue(cacheKey, async () => {
    const { generalParamsList, actualizacionParamsList } =
      buildProgramacionQueryParams(orderStatuses);

    const [
      generalRowsChunks,
      actualizacionRowsChunks,
      operationStatusByTalla,
      processHistoryByDesign,
    ] = await Promise.all([
      Promise.all(
        generalParamsList.map((params) =>
          fetchProgramacionRows(params).catch(() => []),
        ),
      ),
      includeActualizacion
        ? Promise.all(
            actualizacionParamsList.map((params) =>
              fetchProgramacionRows(params).catch(() => []),
            ),
          )
        : Promise.resolve([[] as ProgramacionApiRow[]]),
      fetchOperationStatusByTalla(operationType),
      fetchProcessHistoryByDesign().catch(
        () => new Map<string, ProcessHistoryEntry[]>(),
      ),
    ]);

    const allowedItemStatuses = new Set(
      PROCESS_ITEM_STATUS_FILTERS[activeProceso] ?? [],
    );
    const shouldFilterByItemStatus = allowedItemStatuses.size > 0;
    const generalRows = generalRowsChunks.flat().filter((row) => {
      if (!shouldFilterByItemStatus) return true;

      return allowedItemStatuses.has(
        String(row.itemStatus ?? "").trim().toUpperCase(),
      );
    });
    const actualizacionRows = actualizacionRowsChunks.flat().filter((row) => {
      if (!shouldFilterByItemStatus) return true;

      return allowedItemStatuses.has(
        String(row.itemStatus ?? "").trim().toUpperCase(),
      );
    });
    const currentProcessByDesign = new Map<string, string>();
    const currentProcessRankByDesign = new Map<string, number>();

    for (const row of [...generalRows, ...actualizacionRows]) {
      const key = buildProcessDesignKey(row.orderCode, row.design ?? "");
      const label = mapStatusToProcessLabel(row.itemStatus);
      const rank = mapStatusRank(row.itemStatus);
      const prevRank = currentProcessRankByDesign.get(key) ?? -1;

      if (rank >= prevRank) {
        currentProcessRankByDesign.set(key, rank);
        currentProcessByDesign.set(key, label);
      }
    }

    return buildPedidoGroups(
      [...generalRows, ...actualizacionRows],
      operationStatusByTalla,
      currentProcessByDesign,
      processHistoryByDesign,
    );
  });
}

export async function fetchMontajeAssignments(): Promise<
  Map<string, MontajeAssignment>
> {
  return getMesCachedValue("montaje-assignments", async () => {
    const assignments = new Map<string, MontajeAssignment>();
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage && page <= 30) {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: "200",
        roleArea: "OPERARIOS",
        operationType: "MONTAJE",
        includeAssignments: "1",
        assignmentType: "TAKE_ORDER",
      });

      const response = await fetch(
        `/api/dashboard/operative-logs?${query.toString()}`,
      );

      if (!response.ok) break;

      const payload =
        (await response.json()) as PaginatedResponse<OperativeLogRow>;
      const items = Array.isArray(payload.items) ? payload.items : [];

      for (const row of items) {
        const orderCode = String(row.orderCode ?? "").trim();

        if (!orderCode || assignments.has(orderCode)) continue;

        const rawLabel = String(row.observations ?? "").trim();

        assignments.set(orderCode, {
          orderCode,
          userId: row.createdByUserId ?? null,
          employeeId: row.operatorEmployeeId ?? null,
          userLabel:
            row.operatorName ||
            rawLabel ||
            row.operatorEmployeeId ||
            row.createdByUserId ||
            "Operario",
          takenAt: row.startAt ?? row.createdAt ?? null,
        });
      }

      hasNextPage = Boolean(payload.hasNextPage);
      page += 1;
    }

    return assignments;
  });
}
