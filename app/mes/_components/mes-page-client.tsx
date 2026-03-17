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
  fetchMontajeAssignments,
} from "@/app/mes/_components/mes-data";
import { buildProcessQueue } from "@/app/mes/_components/mes-utils";
import { useSessionStore } from "@/store/session";

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
  const [montajeAssignments, setMontajeAssignments] = useState<
    Map<string, MontajeAssignment>
  >(new Map());

  const sessionUser = useSessionStore((state) => state.user);
  const currentUserId = String(sessionUser?.id ?? "").trim();
  const activeProcessConfig =
    PROCESS_ROLE_CONFIG[activeProceso] ?? PROCESS_ROLE_CONFIG.montaje;

  const mesOrderStatuses = useMemo(() => {
    if (activeProceso === "programacion") return ["PROGRAMACION"];
    if (activeProceso === "montaje") return ["PROGRAMACION", "PRODUCCION"];

    return ["PRODUCCION"];
  }, [activeProceso]);

  const reloadMesPedidos = useCallback(async () => {
    const pedidos = await fetchMesPedidos(
      activeProcessConfig.operationType,
      mesOrderStatuses,
    );

    return pedidos;
  }, [activeProcessConfig.operationType, mesOrderStatuses]);

  const reloadMontajeAssignments = useCallback(async () => {
    if (activeProceso !== "montaje") {
      return new Map<string, MontajeAssignment>();
    }

    return fetchMontajeAssignments();
  }, [activeProceso]);

  const refreshData = useCallback(async () => {
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
        toast.error(
          "No se pudo identificar el usuario activo para tomar el pedido.",
        );

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
            `No fue posible tomar el pedido (${response.status})`;

          throw new Error(message);
        }

        await refreshData();
        setSelectedMontajeTicket({
          pedido: row.pedido,
          detalle: row.detalle,
          totalUnidades: row.totalUnidades,
          ticketMontaje: row.ticket,
          tallas: row.tallas,
        });
        toast.success("Pedido tomado en montaje");
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "No fue posible tomar el pedido";

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
        toast.error("No se pudieron cargar los datos de MES");
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
      const matchEstado = filterEstado === "todos" || p.estado === filterEstado;

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
    void refreshData();
  };

  const togglePedido = (idx: number) => {
    setData((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, expanded: !p.expanded } : p)),
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:px-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">M.E.S.</h1>
        <p className="text-sm text-default-500">
          Seguimiento de produccion en tiempo real para Manufacturing Execution
          System.
        </p>
      </header>

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
          { label: "Tardios", value: stats.tarde, color: "text-danger" },
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
            { key: "programacion", label: "Programacion" },
            { key: "montaje", label: "Montaje" },
            { key: "plotter", label: "Plotter" },
            { key: "sublimacion", label: "Sublimacion" },
            { key: "corte", label: "Corte" },
            { key: "integracion", label: "Integracion" },
            { key: "confeccion", label: "Confeccion" },
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

      {activeProceso === "programacion" ? (
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
                  <p className="text-sm">Cargando pedidos en programacion...</p>
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
      ) : (
        <section className="space-y-4 rounded-medium border border-default-200 bg-content1 p-4">
          {nextProcessTurn ? (
            <Card className="border border-divider" radius="sm" shadow="none">
              <CardBody className="py-3 px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip color="secondary" size="sm" variant="flat">
                    Turno que sigue en {activeProcessConfig.label.toLowerCase()}
                    : {nextProcessTurn.ticket}
                  </Chip>
                  <span className="text-xs text-default-400">Pedido:</span>
                  <span className="text-xs font-medium">
                    {nextProcessTurn.pedido}
                  </span>
                  <span className="text-xs text-default-400">Diseno:</span>
                  <span className="text-xs font-medium">
                    {nextProcessTurn.diseno}
                  </span>
                </div>
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
                  No hay tickets de {activeProcessConfig.label.toLowerCase()}{" "}
                  para mostrar
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
                  <TableColumn>Turno</TableColumn>
                  <TableColumn>Ticket</TableColumn>
                  <TableColumn>Pedido</TableColumn>
                  <TableColumn>Cliente</TableColumn>
                  <TableColumn>Diseno</TableColumn>
                  <TableColumn>Total uds</TableColumn>
                  <TableColumn>Pendiente tallas</TableColumn>
                  <TableColumn>Accion</TableColumn>
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
                      nextProcessTurn?.ticket === row.ticket;

                    return (
                      <TableRow
                        key={`${row.pedido}-${row.diseno}-${row.ticket}`}
                      >
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
                        <TableCell>{`Diseno ${row.diseno}`}</TableCell>
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
                                    totalUnidades: row.totalUnidades,
                                    ticketMontaje: row.ticket,
                                    tallas: row.tallas,
                                  })
                                }
                              >
                                Atender pedido
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
                                nextProcessTurn?.ticket !== row.ticket
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
                                  totalUnidades: row.totalUnidades,
                                  ticketMontaje: row.ticket,
                                  tallas: row.tallas,
                                })
                              }
                            >
                              Atender ticket
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
                <div>
                  <MontajeAssignmentHeader
                    activeProceso={activeProceso}
                    assignment={
                      montajeAssignments.get(selectedMontajeTicket.pedido) ??
                      null
                    }
                    currentUserId={currentUserId}
                  />
                  <div className="text-lg font-semibold">
                    Produccion - {activeProcessConfig.label}
                  </div>
                  <div className="text-sm text-default-500">
                    Ticket {selectedMontajeTicket.ticketMontaje} · Pedido{" "}
                    {selectedMontajeTicket.pedido}
                  </div>
                </div>
              </CardHeader>
              <CardBody>
                <OperarioWorklogTable
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
                  role={activeProcessConfig.role}
                  onSaved={handleMontajeSaved}
                />
              </CardBody>
            </Card>
          ) : null}
        </section>
      )}
    </div>
  );
}
