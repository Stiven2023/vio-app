"use client";

import type {
  MesAccessSelection,
  MontajeAssignment,
  PedidoGroup,
  ProcessQueueRow,
  TallaRow,
} from "@/app/mes/_components/mes-types";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { toast } from "react-hot-toast";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Input,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import {
  MdError,
  MdFilterList,
  MdPrint,
  MdRefresh,
  MdSchedule,
  MdSearch,
} from "react-icons/md";

import { OperarioWorklogTable } from "@/app/erp/dashboard/role/_components/operario-worklog-table";
import {
  getMesAccessProcessOption,
  PROCESS_ROLE_CONFIG,
  PROCESO_PREFIX,
} from "@/app/mes/_components/mes-config";
import { MesAccessGate } from "@/app/mes/_components/mes-access-gate";
import {
  PedidoSection,
  MontajeAssignmentHeader,
} from "@/app/mes/_components/mes-cards";
import {
  fetchMesPedidos,
  fetchMesPreprocessOrderRank,
  fetchMontajeAssignments,
  invalidateMesDataCache,
} from "@/app/mes/_components/mes-data";
import { buildProcessQueue } from "@/app/mes/_components/mes-utils";
import { useSessionStore } from "@/store/session";
import { MesProductionQueueTab } from "@/app/mes/_components/mes-production-queue-tab";
import { MontajeExcelDownload } from "@/app/mes/_components/mes-montaje-excel";
import { PlotterRepoWizard } from "@/app/mes/_components/mes-plotter-repo-wizard";
import { DespachoLegalStatusAlert } from "@/app/mes/_components/mes-despacho-legal";
import {
  MesEnvioModal,
  type EnvioArea,
} from "@/app/mes/_components/mes-envio-modal";
import { MesEnvioStatusCard } from "@/app/mes/_components/mes-envio-status-card";
import { MesItemTagsPanel } from "@/app/mes/_components/mes-item-tags-panel";
import { MesDesignOverviewPanel } from "@/app/mes/_components/mes-design-overview-panel";
import { MesVisualPreview } from "@/app/mes/_components/mes-visual-preview";

const MES_ACCESS_STORAGE_KEY = "mes:access-selection:v1";

function buildMesAccessObservation(selection: MesAccessSelection | null) {
  if (!selection) {
    return null;
  }

  const parts = [
    `[MES_ACCESS_EMAIL] ${selection.email}`,
    `[MES_ACCESS_EMPLEADO] ${selection.employeeName}`,
  ];

  if (selection.machineName) {
    parts.push(`[MES_ACCESS_MAQUINA] ${selection.machineName}`);
  }

  return parts.join(" | ");
}

export default function MesPageClient() {
  const [data, setData] = useState<PedidoGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [activeProceso, setActiveProceso] = useState("programacion");
  const [selectedMontajeTicket, setSelectedMontajeTicket] = useState<{
    pedido: string;
    detalle: string;
    defaultDesignName?: string;
    totalUnidades: number;
    ticketMontaje: string;
    orderItemId?: string;
    tallas: TallaRow[];
    designDetails?: Array<{
      diseno: number;
      detalle: string;
      orderItemId?: string;
      tallas: TallaRow[];
    }>;
    clientId?: string | null;
  } | null>(null);
  const [montajeAssignments, setMontajeAssignments] = useState<
    Map<string, MontajeAssignment>
  >(new Map());
  const [plotterRepoOpen, setPlotterRepoOpen] = useState(false);
  const [plotterRepoQty, setPlotterRepoQty] = useState<{
    expected: number;
    produced: number;
  }>({ expected: 0, produced: 0 });
  const [envioModalOpen, setEnvioModalOpen] = useState(false);
  const [envioConfig, setEnvioConfig] = useState<{
    origenArea: EnvioArea;
    destinoArea: EnvioArea;
    origenLabel: string;
    destinoLabel: string;
  } | null>(null);
  const [accessSelection, setAccessSelection] = useState<MesAccessSelection | null>(null);
  const [accessReady, setAccessReady] = useState(false);

  const sessionUser = useSessionStore((state) => state.user);
  const verifySession = useSessionStore((state) => state.verifySession);
  const currentUserId = String(sessionUser?.id ?? "").trim();
  const currentEmployeeId = String(sessionUser?.employeeId ?? "").trim();
  const activeProcessConfig =
    PROCESS_ROLE_CONFIG[activeProceso] ?? PROCESS_ROLE_CONFIG.montaje;
  const currentProcessLabel = accessSelection?.processLabel ?? activeProcessConfig.label;
  const usesTicketFlow = [
    "montaje",
    "plotter",
    "sublimacion",
    "corte",
    "integracion",
  ].includes(activeProceso);
  const usesTurnGate = usesTicketFlow && activeProceso !== "corte";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(MES_ACCESS_STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw) as MesAccessSelection;

        if (parsed?.processKey && parsed?.mesProcess) {
          setAccessSelection(parsed);
          setActiveProceso(parsed.mesProcess);
        }
      } else if (
        sessionUser?.sessionType === "mes" &&
        sessionUser.mesAccess &&
        sessionUser.employeeId &&
        sessionUser.name
      ) {
        const processOption = getMesAccessProcessOption(sessionUser.mesAccess.processKey);

        setAccessSelection({
          email: String(sessionUser.email ?? "").trim().toLowerCase(),
          processKey: sessionUser.mesAccess.processKey as MesAccessSelection["processKey"],
          processLabel: processOption?.label ?? sessionUser.mesAccess.processKey,
          mesProcess: sessionUser.mesAccess.mesProcess as MesAccessSelection["mesProcess"],
          operationType: sessionUser.mesAccess.operationType as MesAccessSelection["operationType"],
          machineId: sessionUser.mesAccess.machineId ?? null,
          machineName: sessionUser.mesAccess.machineName ?? null,
          employeeId: sessionUser.employeeId,
          employeeName: sessionUser.name,
          employeeRole: sessionUser.role ?? null,
          employeeEmail: sessionUser.email ?? null,
        });
        setActiveProceso(sessionUser.mesAccess.mesProcess);
      } else if (
        String(sessionUser?.role ?? "").trim().toUpperCase() === "CONFECCIONISTA" &&
        sessionUser?.employeeId &&
        sessionUser?.name
      ) {
        setAccessSelection({
          email: String(sessionUser.email ?? "").trim().toLowerCase(),
          processKey: "confeccion",
          processLabel: "Confección",
          mesProcess: "confeccion",
          operationType: "CONFECCION",
          machineId: null,
          machineName: null,
          employeeId: sessionUser.employeeId,
          employeeName: sessionUser.name,
          employeeRole: sessionUser.role ?? null,
          employeeEmail: sessionUser.email ?? null,
        });
        setActiveProceso("confeccion");
      }
    } catch {
      window.localStorage.removeItem(MES_ACCESS_STORAGE_KEY);
    } finally {
      setAccessReady(true);
    }
  }, [sessionUser]);

  const handleAccessSubmit = useCallback(async (selection: MesAccessSelection) => {
    await verifySession();
    setAccessSelection(selection);
    setActiveProceso(selection.mesProcess);
    setSelectedMontajeTicket(null);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        MES_ACCESS_STORAGE_KEY,
        JSON.stringify(selection),
      );
    }
  }, [verifySession]);

  const resetAccessSelection = useCallback(() => {
    setAccessSelection(null);
    setSelectedMontajeTicket(null);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(MES_ACCESS_STORAGE_KEY);
    }
  }, []);

  const mesOrderStatuses = useMemo(() => {
    if (activeProceso === "programacion") return ["PROGRAMACION"];
    if (activeProceso === "montaje") return ["PROGRAMACION", "PRODUCCION"];

    return ["PRODUCCION"];
  }, [activeProceso]);

  const reloadMesPedidos = useCallback(async () => {
    const pedidos = await fetchMesPedidos(
      activeProcessConfig.operationType,
      mesOrderStatuses,
      {
        activeProceso,
        includeActualizacion: activeProceso !== "programacion",
      },
    );
    if (activeProceso !== "programacion") {
      return pedidos;
    }

    const preprocessRank = await fetchMesPreprocessOrderRank({
      confirmedOnly: false,
    });

    return [...pedidos].sort((a, b) => {
      const aRank = preprocessRank.get(a.pedido);
      const bRank = preprocessRank.get(b.pedido);

      if (aRank === undefined && bRank === undefined) {
        return b.pedido.localeCompare(a.pedido);
      }
      if (aRank === undefined) return 1;
      if (bRank === undefined) return -1;
      if (aRank !== bRank) return aRank - bRank;

      return b.pedido.localeCompare(a.pedido);
    });
  }, [activeProcessConfig.operationType, activeProceso, mesOrderStatuses]);

  const reloadMontajeAssignments = useCallback(async () => {
    if (activeProceso !== "montaje") {
      return new Map<string, MontajeAssignment>();
    }

    return fetchMontajeAssignments();
  }, [activeProceso]);

  const refreshData = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      invalidateMesDataCache();
    }

    const [pedidos, assignments] = await Promise.all([
      reloadMesPedidos(),
      reloadMontajeAssignments(),
    ]);

    setData(pedidos);
    setMontajeAssignments(assignments);
  }, [reloadMesPedidos, reloadMontajeAssignments]);

  const takeMontajeOrder = useCallback(
    async (row: ProcessQueueRow) => {
      if (!currentUserId && !currentEmployeeId) {
        toast.error("No se pudo identificar el operario activo para tomar el pedido.");

        return;
      }

      try {
        const response = await fetch("/api/dashboard/operative-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            takeOrder: true,
            roleArea: "OPERARIOS",
            operationType: "MONTAJE",
            orderCode: row.pedido,
            designName: row.detalle,
            observations:
              buildMesAccessObservation(accessSelection) ??
              sessionUser?.name ??
              currentEmployeeId ??
              currentUserId,
            processCode: "P",
            quantityOp: 0,
            producedQuantity: 0,
          }),
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            String(payload?.message ?? "").trim() ||
            `Could not take the order (${response.status})`;

          throw new Error(message);
        }

        await refreshData(true);
        setSelectedMontajeTicket({
          pedido: row.pedido,
          detalle: row.detalle,
          defaultDesignName: row.defaultDesignName,
          totalUnidades: row.totalUnidades,
          ticketMontaje: row.ticket,
          orderItemId: row.orderItemId,
          tallas: row.tallas,
          designDetails: row.designDetails,
        });
        toast.success("Pedido tomado para montaje");
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "No se pudo tomar el pedido";

        toast.error(message);
      }
    },
    [accessSelection, currentEmployeeId, currentUserId, refreshData, sessionUser?.name],
  );

  useEffect(() => {
    if (!accessReady || !accessSelection) {
      setLoading(false);
      setData([]);
      setMontajeAssignments(new Map());

      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        await refreshData();
      } catch {
        setData([]);
        setMontajeAssignments(new Map());
        toast.error("Error al cargar datos del MES");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [accessReady, accessSelection, refreshData]);

  const filtered = useMemo(() => {
    return data.filter((p) => {
      const matchSearch =
        p.pedido.toLowerCase().includes(search.toLowerCase()) ||
        p.cliente.toLowerCase().includes(search.toLowerCase());
      const matchEstado = filterEstado === "all" || p.estado === filterEstado;

      return matchSearch && matchEstado;
    });
  }, [data, search, filterEstado]);

  const stats = useMemo(() => {
    const total = data.length;
    const enProceso = data.filter((p) => p.estado === "EN PROCESO").length;
    const tarde = data.filter((p) => p.estado === "TARDE").length;
    const completado = data.filter((p) => p.estado === "COMPLETADO").length;

    return { total, enProceso, tarde, completado };
  }, [data]);

  const processQueue = useMemo(
    () => buildProcessQueue(data, activeProceso),
    [data, activeProceso],
  );

  const nextProcessTurn = processQueue[0] ?? null;

  const handleMontajeSaved = () => {
    setSelectedMontajeTicket(null);
    void refreshData(true);
  };

  const togglePedido = (idx: number) => {
    setData((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, expanded: !p.expanded } : p)),
    );
  };

  const selectedEnvioItems = useMemo(() => {
    if (!selectedMontajeTicket) return [];

    const details =
      selectedMontajeTicket.designDetails?.length
        ? selectedMontajeTicket.designDetails
        : [
            {
              diseno: 0,
              detalle: selectedMontajeTicket.detalle,
              orderItemId: selectedMontajeTicket.orderItemId,
              tallas: selectedMontajeTicket.tallas,
            },
          ];

    return details
      .filter((detail) => String(detail.orderItemId ?? "").trim())
      .map((detail) => ({
        orderItemId: String(detail.orderItemId),
        name:
          detail.diseno > 0
            ? `Diseno ${detail.diseno} - ${detail.detalle}`
            : detail.detalle,
        quantity: (detail.tallas ?? []).reduce((sum, t) => sum + t.cantidad, 0),
      }));
  }, [selectedMontajeTicket]);

  const openEnvioByProcess = useCallback(() => {
    if (!selectedMontajeTicket) return;

    if (activeProceso === "integracion") {
      setEnvioConfig({
        origenArea: "INTEGRACION",
        destinoArea: "CONFECCION_EXTERNA",
        origenLabel: "Integracion / Viomar",
        destinoLabel: "Confeccionista",
      });
      setEnvioModalOpen(true);
      return;
    }

    if (activeProceso === "confeccion") {
      setEnvioConfig({
        origenArea: "CONFECCION_EXTERNA",
        destinoArea: "VIOMAR",
        origenLabel: "Confeccionista",
        destinoLabel: "Viomar",
      });
      setEnvioModalOpen(true);
      return;
    }

    if (activeProceso === "despacho") {
      setEnvioConfig({
        origenArea: "DESPACHO",
        destinoArea: "DESPACHO",
        origenLabel: "Despacho Viomar",
        destinoLabel: "Cliente final",
      });
      setEnvioModalOpen(true);
    }
  }, [activeProceso, selectedMontajeTicket]);

  if (!accessReady) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:px-8">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">M.E.S.</h1>
          <p className="text-sm text-default-500">
            Seguimiento en tiempo real de producción para el Sistema de Ejecución de Manufactura.
          </p>
        </header>
      </div>
    );
  }

  if (!accessSelection) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:px-8">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">M.E.S.</h1>
          <p className="text-sm text-default-500">
            Seguimiento en tiempo real de producción para el Sistema de Ejecución de Manufactura.
          </p>
        </header>

        <MesVisualPreview />

        <MesAccessGate onSubmit={handleAccessSubmit} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:px-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">M.E.S.</h1>
        <p className="text-sm text-default-500">
          Seguimiento en tiempo real de producción para el Sistema de Ejecución de Manufactura.
        </p>
      </header>

      <MesVisualPreview />

      <Card className="border border-primary-200 bg-primary-50" radius="sm" shadow="none">
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-primary-900">
              Acceso operativo activo
            </div>
            <div className="text-xs text-primary-800">
              {accessSelection.email} · {accessSelection.processLabel} · {accessSelection.employeeName}
              {accessSelection.machineName ? ` · ${accessSelection.machineName}` : ""}
            </div>
          </div>
          <Button color="primary" size="sm" variant="flat" onPress={resetAccessSelection}>
            Cambiar acceso
          </Button>
        </CardBody>
      </Card>

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
          { label: "Tarde", value: stats.tarde, color: "text-danger" },
          {
            label: "Completado",
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

      <section className="rounded-medium border border-default-200 bg-content1 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-default-500">
              Proceso operativo seleccionado
            </div>
            <div className="text-sm font-medium text-foreground">
              {currentProcessLabel}
            </div>
          </div>
          <div className="text-xs text-default-400">
            [{PROCESO_PREFIX[activeProceso] ?? activeProceso.slice(0, 3).toUpperCase()}]
          </div>
        </div>
      </section>

      <Divider className="opacity-60" />

      {activeProceso === "workflow" ? (
        <MesProductionQueueTab />
      ) : activeProceso === "programacion" ? (
        <section className="rounded-medium border border-default-200 bg-content1 p-4">
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <Input
              className="max-w-xs"
              placeholder="Buscar pedido o cliente..."
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
              <SelectItem key="all">Todos</SelectItem>
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
                  setFilterEstado("all");
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
                  showProcessTracking
                  onToggle={() => togglePedido(realIdx)}
                />
              );
            })
          )}
        </section>
      ) : (
        <section className="space-y-4 rounded-medium border border-default-200 bg-content1 p-4">
          {usesTurnGate && nextProcessTurn ? (
            <Card className="border border-divider" radius="sm" shadow="none">
              <CardBody className="py-3 px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip color="secondary" size="sm" variant="flat">
                    Siguiente turno en {activeProcessConfig.label.toLowerCase()}:{" "}
                    {nextProcessTurn.ticket}
                  </Chip>
                  <span className="text-xs text-default-400">Pedido:</span>
                  <span className="text-xs font-medium">
                    {nextProcessTurn.pedido}
                  </span>
                  <span className="text-xs text-default-400">Diseño:</span>
                  <span className="text-xs font-medium">
                    {nextProcessTurn.diseno}
                  </span>
                </div>
              </CardBody>
            </Card>
          ) : null}

          {!usesTicketFlow ? (
            <Card className="border border-default-200" radius="sm" shadow="none">
              <CardBody className="py-2 px-3 text-xs text-default-600">
                Seguimiento sin ticket: desde Confección en adelante se registra por pedido y avance del área.
              </CardBody>
            </Card>
          ) : null}

          {processQueue.length === 0 ? (
            <Card
              className="border border-dashed border-divider"
              radius="md"
              shadow="none"
            >
              <CardBody className="py-10 text-center text-default-400">
                <MdError className="mx-auto mb-2 opacity-40" size={32} />
                <p className="text-sm">
                  No hay registros para {activeProcessConfig.label.toLowerCase()}
                </p>
              </CardBody>
            </Card>
          ) : (
            <div className="rounded-medium border border-default-200 p-2">
              <Table
                removeWrapper
                aria-label={`Cola de ${activeProcessConfig.label.toLowerCase()}`}
              >
                <TableHeader>
                  <TableColumn>{usesTicketFlow ? "Turno" : "Orden"}</TableColumn>
                  <TableColumn>{usesTicketFlow ? "Ticket" : "Seguimiento"}</TableColumn>
                  <TableColumn>Pedido</TableColumn>
                  <TableColumn>Cliente</TableColumn>
                  <TableColumn>Detalle</TableColumn>
                  <TableColumn>Total unidades</TableColumn>
                  <TableColumn>Tallas pendientes</TableColumn>
                  <TableColumn>Acción</TableColumn>
                </TableHeader>
                <TableBody items={processQueue}>
                  {(row) => {
                    const assignment =
                      montajeAssignments.get(row.pedido) ?? null;
                    const isMontaje = activeProceso === "montaje";
                    const isTakenByOther =
                      isMontaje &&
                      Boolean(
                        (assignment?.employeeId &&
                          currentEmployeeId &&
                          assignment.employeeId !== currentEmployeeId) ||
                          (!assignment?.employeeId &&
                            assignment?.userId &&
                            currentUserId &&
                            assignment.userId !== currentUserId),
                      );
                    const isTakenByMe =
                      isMontaje &&
                      Boolean(
                        (assignment?.employeeId &&
                          currentEmployeeId &&
                          assignment.employeeId === currentEmployeeId) ||
                          (!assignment?.employeeId &&
                            assignment?.userId &&
                            currentUserId &&
                            assignment.userId === currentUserId),
                      );
                    const canTakePedido =
                      isMontaje &&
                      !assignment &&
                      (!usesTurnGate || nextProcessTurn?.ticket === row.ticket);

                    return (
                      <TableRow
                        key={`${row.pedido}-${row.diseno}-${row.ticket}`}
                      >
                        <TableCell>
                          {usesTicketFlow ? row.turno : row.pedido}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {usesTicketFlow ? (
                              <>
                                <Chip color="secondary" size="sm" variant="flat">
                                  {row.ticket}
                                </Chip>
                                {usesTurnGate && nextProcessTurn?.ticket === row.ticket ? (
                                  <Chip color="warning" size="sm" variant="flat">
                                    Siguiente
                                  </Chip>
                                ) : null}
                              </>
                            ) : (
                              <Chip color="default" size="sm" variant="flat">
                                SIN TICKET
                              </Chip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{row.pedido}</TableCell>
                        <TableCell>{row.cliente}</TableCell>
                        <TableCell>{row.detalle}</TableCell>
                        <TableCell>{row.totalUnidades}</TableCell>
                        <TableCell>
                          <Chip color="warning" size="sm" variant="flat">
                            {row.totalTallasPendientes} tallas ·{" "}
                            {row.unidadesPendientes} uds
                          </Chip>
                        </TableCell>
                        <TableCell>
                          {isMontaje ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                color={isTakenByMe ? "success" : "primary"}
                                isDisabled={!canTakePedido}
                                size="sm"
                                variant={isTakenByMe ? "flat" : "solid"}
                                onPress={() => takeMontajeOrder(row)}
                              >
                                {isTakenByMe ? "Pedido tomado" : "Tomar pedido"}
                              </Button>
                              <Button
                                color="primary"
                                isDisabled={!isTakenByMe}
                                size="sm"
                                variant={
                                  selectedMontajeTicket?.ticketMontaje ===
                                  row.ticket
                                    ? "solid"
                                    : "flat"
                                }
                                onPress={() =>
                                  setSelectedMontajeTicket({
                                    pedido: row.pedido,
                                    detalle: row.detalle,
                                    defaultDesignName: row.defaultDesignName,
                                    totalUnidades: row.totalUnidades,
                                    ticketMontaje: row.ticket,
                                    orderItemId: row.orderItemId,
                                    tallas: row.tallas,
                                    designDetails: row.designDetails,
                                  })
                                }
                              >
                                Gestionar pedido
                              </Button>
                              {isTakenByOther ? (
                                <Chip color="warning" size="sm" variant="flat">
                                  Tomado por{" "}
                                  {assignment?.userLabel ?? "otro operario"}
                                </Chip>
                              ) : null}
                            </div>
                          ) : (
                            <Button
                              color="primary"
                              isDisabled={
                                usesTicketFlow
                                  ? usesTurnGate
                                    ? nextProcessTurn?.ticket !== row.ticket
                                    : false
                                  : false
                              }
                              size="sm"
                              variant={
                                selectedMontajeTicket?.ticketMontaje ===
                                row.ticket
                                  ? "solid"
                                  : "flat"
                              }
                              onPress={() =>
                                setSelectedMontajeTicket({
                                  pedido: row.pedido,
                                  detalle: row.detalle,
                                  defaultDesignName: row.defaultDesignName,
                                  totalUnidades: row.totalUnidades,
                                  ticketMontaje: row.ticket,
                                  orderItemId: row.orderItemId,
                                  tallas: row.tallas,
                                  designDetails: row.designDetails,
                                })
                              }
                            >
                              {usesTicketFlow
                                ? "Atender ticket"
                                : "Registrar seguimiento"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  }}
                </TableBody>
              </Table>
            </div>
          )}

          {selectedMontajeTicket ? (
            <Card className="border border-divider" radius="sm" shadow="none">
              <CardHeader>
                <div className="w-full">
                  <MontajeAssignmentHeader
                    activeProceso={activeProceso}
                    assignment={
                      montajeAssignments.get(selectedMontajeTicket.pedido) ??
                      null
                    }
                    currentUserId={currentUserId}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-lg font-semibold">
                        Produccion - {currentProcessLabel}
                      </div>
                      <div className="text-sm text-default-500">
                        {usesTicketFlow
                          ? `Ticket ${selectedMontajeTicket.ticketMontaje} · Pedido ${selectedMontajeTicket.pedido}`
                          : `Seguimiento · Pedido ${selectedMontajeTicket.pedido}`}
                      </div>
                    </div>
                    {activeProceso === "montaje" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <MontajeExcelDownload
                          designName="PEDIDO COMPLETO"
                          label="Descargar pedido completo"
                          orderCode={selectedMontajeTicket.pedido}
                          tallas={selectedMontajeTicket.tallas}
                        />
                        {(
                          selectedMontajeTicket.designDetails?.length
                            ? selectedMontajeTicket.designDetails
                            : [
                                {
                                  diseno: 0,
                                  detalle: selectedMontajeTicket.detalle,
                                  tallas: selectedMontajeTicket.tallas,
                                },
                              ]
                        ).map((design) => (
                          <MontajeExcelDownload
                            key={`${selectedMontajeTicket.pedido}-${design.diseno}-${design.detalle}`}
                            designName={`${
                              design.diseno > 0 ? `Diseno ${design.diseno} - ` : ""
                            }${design.detalle}`}
                            label={`Descargar diseno ${design.diseno > 0 ? design.diseno : ""}`.trim()}
                            orderCode={selectedMontajeTicket.pedido}
                            tallas={design.tallas}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                {activeProceso === "montaje" &&
                (selectedMontajeTicket.designDetails?.length ?? 0) > 0 ? (
                  <div className="rounded-medium border border-default-200 p-3">
                    <p className="mb-2 text-sm font-semibold text-default-700">
                      Disenos y tallas del pedido
                    </p>
                    <div className="space-y-2">
                      {selectedMontajeTicket.designDetails?.map((design) => (
                        <div
                          key={`${selectedMontajeTicket.pedido}-${design.diseno}-${design.detalle}`}
                          className="rounded-medium border border-default-100 px-3 py-2"
                        >
                          <p className="text-xs font-medium text-default-700">
                            {design.diseno > 0
                              ? `Diseno ${design.diseno}: ${design.detalle}`
                              : design.detalle}
                          </p>
                          <p className="mt-1 text-xs text-default-500">
                            {(design.tallas ?? [])
                              .map((t) => `${t.talla}: ${t.cantidad}`)
                              .join(" | ") || "Sin tallas"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {activeProceso === "despacho" &&
                  selectedMontajeTicket.clientId && (
                    <DespachoLegalStatusAlert
                      clientId={selectedMontajeTicket.clientId}
                    />
                  )}
                {activeProceso === "plotter" && (
                  <div className="rounded-medium border border-warning-200 bg-warning-50 px-3 py-2">
                    <p className="text-xs text-warning-700">
                      Plotter opera por pedido y puede solicitar reposición por
                      diseño, talla, prenda completa o parcial de pieza.
                    </p>
                  </div>
                )}
                {activeProceso === "sublimacion" && (
                  <div className="rounded-medium border border-warning-200 bg-warning-50 px-3 py-2">
                    <p className="text-xs text-warning-700">
                      Sublimación opera por pedido, diseño y talla; también
                      permite ticket de reposición completo o parcial.
                    </p>
                  </div>
                )}
                {activeProceso === "corte" && (
                  <div className="rounded-medium border border-primary-200 bg-primary-50 px-3 py-2">
                    <p className="text-xs text-primary-700">
                      Corte manual (picada) trabaja por diseño y puede avanzar
                      en paralelo con montaje sin bloqueo por turno.
                    </p>
                  </div>
                )}
                {activeProceso === "integracion" && (
                  <div className="rounded-medium border border-warning-200 bg-warning-50 px-3 py-2">
                    <p className="text-xs text-warning-700">
                      Integración valida insumos y piezas; si falta algo, se
                      notifica a compras y bodega para continuar el seguimiento.
                    </p>
                  </div>
                )}
                {activeProceso === "confeccion" && (
                  <div className="rounded-medium border border-default-200 bg-default-50 px-3 py-2">
                    <p className="text-xs text-default-700">
                      Confección registra avance por pedido y puede solicitar
                      reposición o insumos por faltante o daño.
                    </p>
                  </div>
                )}
                {activeProceso === "empaque" && (
                  <div className="rounded-medium border border-default-200 bg-default-50 px-3 py-2">
                    <p className="text-xs text-default-700">
                      Empaque registra avance por pedido y puede solicitar
                      reposición o insumos por faltante o daño.
                    </p>
                  </div>
                )}
                {activeProceso === "despacho" && (
                  <div className="rounded-medium border border-default-200 bg-default-50 px-3 py-2">
                    <p className="text-xs text-default-700">
                      Despacho permite entrega completa o parcial con aprobación
                      de vendedor, cartera y contabilidad.
                    </p>
                  </div>
                )}

                {[
                  "integracion",
                  "confeccion",
                  "despacho",
                ].includes(activeProceso) ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-medium border border-default-200 bg-content2 px-3 py-2">
                    <Button
                      color="primary"
                      isDisabled={selectedEnvioItems.length === 0}
                      size="sm"
                      variant="flat"
                      onPress={openEnvioByProcess}
                    >
                      {activeProceso === "integracion"
                        ? "Enviar a confeccionista"
                        : activeProceso === "confeccion"
                          ? "Registrar retorno a Viomar"
                          : "Registrar envio de despacho"}
                    </Button>
                    <span className="text-xs text-default-500">
                      {selectedEnvioItems.length} disenos seleccionables para envio
                    </span>
                  </div>
                ) : null}

                <MesEnvioStatusCard
                  areaFilter={
                    activeProceso === "integracion"
                      ? "INTEGRACION"
                      : activeProceso === "confeccion"
                        ? "CONFECCION_EXTERNA"
                        : activeProceso === "despacho"
                          ? "DESPACHO"
                          : undefined
                  }
                  orderId={selectedMontajeTicket.pedido}
                />

                <MesDesignOverviewPanel items={selectedEnvioItems} />

                <div className="rounded-medium border border-default-200 p-3">
                  <p className="mb-2 text-xs font-semibold text-default-600">
                    Tags por diseno (ej. picada parcial)
                  </p>
                  <div className="space-y-3">
                    {selectedEnvioItems.length > 0 ? (
                      selectedEnvioItems.map((design) => (
                        <div key={design.orderItemId} className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-medium border border-default-100 px-2 py-1">
                            <div className="text-xs text-default-600">{design.name}</div>
                            <Button
                              as={NextLink}
                              href={`/mes/designs/${design.orderItemId}`}
                              rel="noreferrer"
                              size="sm"
                              target="_blank"
                              variant="flat"
                            >
                              Abrir detalle
                            </Button>
                          </div>
                          <MesItemTagsPanel
                            designName={design.name}
                            orderId={selectedMontajeTicket.pedido}
                            orderItemId={design.orderItemId}
                          />
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-default-500">
                        Sin orderItemId en la selección actual; no se pueden asignar tags por diseño.
                      </p>
                    )}
                  </div>
                </div>

                <OperarioWorklogTable
                  mesAccessSelection={accessSelection}
                  prefill={{
                    orderCode: selectedMontajeTicket.pedido,
                    designName:
                      selectedMontajeTicket.defaultDesignName ||
                      selectedMontajeTicket.detalle,
                    quantityOp: selectedMontajeTicket.totalUnidades,
                    tallas: (selectedMontajeTicket.tallas ?? [])
                      .filter((item) => item.estado !== "completado")
                      .map((item) => ({
                        talla: item.talla,
                        cantidad: item.cantidad,
                      })),
                  }}
                  role={activeProcessConfig.role}
                  onSaved={handleMontajeSaved}
                />
              </CardBody>
            </Card>
          ) : null}

          {/* Plotter reposition wizard - opens when quantity mismatch detected */}
          <PlotterRepoWizard
            designName={selectedMontajeTicket?.detalle ?? ""}
            expectedQty={plotterRepoQty.expected}
            isOpen={plotterRepoOpen}
            orderCode={selectedMontajeTicket?.pedido ?? ""}
            producedQty={plotterRepoQty.produced}
            size={null}
            onClose={() => setPlotterRepoOpen(false)}
            onRepoGenerated={(ticketRef) => {
              setPlotterRepoOpen(false);
              toast.success(
                `Ticket de reposición ${ticketRef} generado para Plotter`,
              );
            }}
          />

          {selectedMontajeTicket && envioConfig ? (
            <MesEnvioModal
              availableItems={selectedEnvioItems}
              destinoArea={envioConfig.destinoArea}
              destinoLabel={envioConfig.destinoLabel}
              isOpen={envioModalOpen}
              orderId={selectedMontajeTicket.pedido}
              origenArea={envioConfig.origenArea}
              origenLabel={envioConfig.origenLabel}
              onCreated={() => {
                void refreshData(true);
              }}
              onOpenChange={setEnvioModalOpen}
            />
          ) : null}
        </section>
      )}
    </div>
  );
}
