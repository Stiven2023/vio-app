"use client";

import type {
  MontajeAssignment,
  PedidoGroup,
  ProcessQueueRow,
  TallaRow,
} from "@/app/mes/_components/mes-types";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
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
  PROCESS_ROLE_CONFIG,
  PROCESO_PREFIX,
} from "@/app/mes/_components/mes-config";
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

  const sessionUser = useSessionStore((state) => state.user);
  const currentUserId = String(sessionUser?.id ?? "").trim();
  const currentUserRole = String(sessionUser?.role ?? "").trim();
  const isLider =
    currentUserRole === "LIDER_OPERACIONAL" ||
    currentUserRole === "ADMINISTRADOR";
  const activeProcessConfig =
    PROCESS_ROLE_CONFIG[activeProceso] ?? PROCESS_ROLE_CONFIG.montaje;
  const usesTicketFlow = [
    "montaje",
    "plotter",
    "sublimacion",
    "corte",
    "integracion",
  ].includes(activeProceso);
  const usesTurnGate = usesTicketFlow && activeProceso !== "corte";

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
      if (!currentUserId) {
        toast.error("Could not identify the active user to take the order.");

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
            observations: sessionUser?.name || currentUserId,
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
        toast.success("Pedido tomado en montaje");
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Could not take the order";

        toast.error(message);
      }
    },
    [currentUserId, refreshData, sessionUser?.name],
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await refreshData();
      } catch {
        setData([]);
        setMontajeAssignments(new Map());
        toast.error("Could not load MES data");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [refreshData]);

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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:px-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">M.E.S.</h1>
        <p className="text-sm text-default-500">
          Real-time production tracking for the Manufacturing Execution System.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total orders",
            value: stats.total,
            color: "text-foreground",
          },
          {
            label: "In progress",
            value: stats.enProceso,
            color: "text-primary",
          },
          { label: "Late", value: stats.tarde, color: "text-danger" },
          {
            label: "Completed",
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
            ...(isLider ? [{ key: "workflow", label: "Workflow" }] : []),
            { key: "programacion", label: "Scheduling" },
            { key: "montaje", label: "Montaje" },
            { key: "plotter", label: "Plotter" },
            { key: "sublimacion", label: "Sublimation" },
            { key: "corte", label: "Cutting" },
            { key: "integracion", label: "Integration" },
            { key: "confeccion", label: "Sewing" },
            { key: "empaque", label: "Packing" },
            { key: "despacho", label: "Dispatch" },
          ].map((tab) => (
            <Tab
              key={tab.key}
              title={
                <span className="text-xs px-1">
                  {tab.key !== "programacion" && tab.key !== "workflow" && (
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

      {activeProceso === "workflow" ? (
        <MesProductionQueueTab />
      ) : activeProceso === "programacion" ? (
        <section className="rounded-medium border border-default-200 bg-content1 p-4">
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <Input
              className="max-w-xs"
              placeholder="Search order or client..."
              radius="sm"
              size="sm"
              startContent={<MdSearch className="text-default-400" />}
              value={search}
              variant="bordered"
              onValueChange={setSearch}
            />
            <Select
              className="max-w-[160px]"
              placeholder="Status"
              radius="sm"
              selectedKeys={[filterEstado]}
              size="sm"
              startContent={<MdFilterList className="text-default-400" />}
              variant="bordered"
              onSelectionChange={(keys) =>
                setFilterEstado(Array.from(keys)[0] as string)
              }
            >
              <SelectItem key="all">All</SelectItem>
              <SelectItem key="SIN TRAMITAR">Not started</SelectItem>
              <SelectItem key="EN PROCESO">In progress</SelectItem>
              <SelectItem key="COMPLETADO">Completed</SelectItem>
              <SelectItem key="TARDE">Late</SelectItem>
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
                Clear
              </Button>
              <Button
                color="primary"
                radius="sm"
                size="sm"
                startContent={<MdPrint />}
                variant="flat"
              >
                Export
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
                  <p className="text-sm">Loading orders in scheduling...</p>
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
                  <p className="text-sm">No orders found</p>
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
                    Next turn in {activeProcessConfig.label.toLowerCase()}:{" "}
                    {nextProcessTurn.ticket}
                  </Chip>
                  <span className="text-xs text-default-400">Order:</span>
                  <span className="text-xs font-medium">
                    {nextProcessTurn.pedido}
                  </span>
                  <span className="text-xs text-default-400">Design:</span>
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
                  <TableColumn>{usesTicketFlow ? "Turn" : "Orden"}</TableColumn>
                  <TableColumn>{usesTicketFlow ? "Ticket" : "Seguimiento"}</TableColumn>
                  <TableColumn>Order</TableColumn>
                  <TableColumn>Client</TableColumn>
                  <TableColumn>Detalle</TableColumn>
                  <TableColumn>Total units</TableColumn>
                  <TableColumn>Pending sizes</TableColumn>
                  <TableColumn>Action</TableColumn>
                </TableHeader>
                <TableBody items={processQueue}>
                  {(row) => {
                    const assignment =
                      montajeAssignments.get(row.pedido) ?? null;
                    const isMontaje = activeProceso === "montaje";
                    const isTakenByOther =
                      isMontaje &&
                      Boolean(
                        assignment?.userId &&
                          currentUserId &&
                          assignment.userId !== currentUserId,
                      );
                    const isTakenByMe =
                      isMontaje &&
                      Boolean(
                        assignment?.userId &&
                          currentUserId &&
                          assignment.userId === currentUserId,
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
                                    Next
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
                            {row.totalTallasPendientes} sizes ·{" "}
                            {row.unidadesPendientes} units
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
                                {isTakenByMe ? "Order taken" : "Take order"}
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
                                Handle order
                              </Button>
                              {isTakenByOther ? (
                                <Chip color="warning" size="sm" variant="flat">
                                  Taken by{" "}
                                  {assignment?.userLabel ?? "another operator"}
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
                        Produccion - {activeProcessConfig.label}
                      </div>
                      <div className="text-sm text-default-500">
                        {usesTicketFlow
                          ? `Ticket ${selectedMontajeTicket.ticketMontaje} · Order ${selectedMontajeTicket.pedido}`
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

                <div className="rounded-medium border border-default-200 p-3">
                  <p className="mb-2 text-xs font-semibold text-default-600">
                    Tags por diseno (ej. picada parcial)
                  </p>
                  <div className="space-y-3">
                    {selectedEnvioItems.length > 0 ? (
                      selectedEnvioItems.map((design) => (
                        <MesItemTagsPanel
                          key={design.orderItemId}
                          designName={design.name}
                          orderId={selectedMontajeTicket.pedido}
                          orderItemId={design.orderItemId}
                        />
                      ))
                    ) : (
                      <p className="text-xs text-default-500">
                        Sin orderItemId en la selección actual; no se pueden asignar tags por diseño.
                      </p>
                    )}
                  </div>
                </div>

                <OperarioWorklogTable
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
