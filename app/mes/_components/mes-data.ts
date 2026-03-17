import type {
  EstadoProceso,
  MontajeAssignment,
  OperativeLogRow,
  PaginatedResponse,
  PedidoGroup,
  ProgramacionApiRow,
} from "./mes-types";
import {
  buildPedidoGroups,
  buildProcessTallaKey,
  computeEstadoFromOperativeLog,
  mergeEstado,
} from "./mes-utils";

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

export async function fetchOperationStatusByTalla(
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

      const prev = statusMap.get(key);
      statusMap.set(key, mergeEstado(prev, computeEstadoFromOperativeLog(row)));
    }

    hasNextPage = Boolean(payload.hasNextPage);
    page += 1;
  }

  return statusMap;
}

export async function fetchMesPedidos(
  operationType: string,
  orderStatuses: string[],
): Promise<PedidoGroup[]> {
  const { generalParamsList, actualizacionParamsList } =
    buildProgramacionQueryParams(orderStatuses);

  const [generalRowsChunks, actualizacionRowsChunks, operationStatusByTalla] = await Promise.all([
    Promise.all(generalParamsList.map((params) => fetchProgramacionRows(params).catch(() => []))),
    Promise.all(actualizacionParamsList.map((params) => fetchProgramacionRows(params).catch(() => []))),
    fetchOperationStatusByTalla(operationType),
  ]);

  const generalRows = generalRowsChunks.flat();
  const actualizacionRows = actualizacionRowsChunks.flat();

  return buildPedidoGroups([...generalRows, ...actualizacionRows], operationStatusByTalla);
}

export async function fetchMontajeAssignments(): Promise<Map<string, MontajeAssignment>> {
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

    const response = await fetch(`/api/dashboard/operative-logs?${query.toString()}`);
    if (!response.ok) break;

    const payload = (await response.json()) as PaginatedResponse<OperativeLogRow>;
    const items = Array.isArray(payload.items) ? payload.items : [];

    for (const row of items) {
      const orderCode = String(row.orderCode ?? "").trim();
      if (!orderCode || assignments.has(orderCode)) continue;

      const rawLabel = String(row.observations ?? "").trim();
      assignments.set(orderCode, {
        orderCode,
        userId: row.createdByUserId ?? null,
        userLabel: rawLabel || row.createdByUserId || "Operario",
        takenAt: row.startAt ?? row.createdAt ?? null,
      });
    }

    hasNextPage = Boolean(payload.hasNextPage);
    page += 1;
  }

  return assignments;
}
