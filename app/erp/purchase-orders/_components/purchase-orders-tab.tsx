"use client";

import type { PurchaseOrderListRow } from "../_lib/types";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import NextLink from "next/link";
import { Button } from "@heroui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { BsThreeDotsVertical } from "react-icons/bs";

import { apiJson, getErrorMessage } from "../_lib/api";

import { usePaginatedApi } from "@/app/erp/catalog/_hooks/use-paginated-api";
import { Pager } from "@/app/erp/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";

type HistoryRow = {
  id: string;
  action: string;
  notes: string | null;
  performedByName: string | null;
  createdAt: string | null;
};

type LogisticsRouteRow = {
  id: string;
  routeType: string;
  partyType: string;
  partyLabel: string | null;
  driverLabel: string | null;
  vehiclePlate: string | null;
  originArea: string;
  destinationArea: string;
  status: string | null;
  scheduledAt: string | null;
  createdAt: string | null;
};

type RouteOptionsResponse = {
  suppliers?: Array<{ id: string; name: string; supplierCode?: string | null }>;
  confectionists?: Array<{
    id: string;
    name: string;
    confectionistCode?: string | null;
  }>;
  packers?: Array<{ id: string; name: string; packerCode?: string | null }>;
  messengers?: Array<{ id: string; name: string; code?: string | null }>;
  drivers?: Array<{ id: string; name: string; code?: string | null }>;
  dispatchers?: Array<{ id: string; name: string; code?: string | null }>;
};

type ShipmentRow = {
  id: string;
  mode: "INTERNAL" | "CLIENT";
  fromArea: string;
  toArea: string;
  recipientName: string | null;
  sentBy: string;
  orderCode: string;
  designName: string;
  isReceived: boolean;
  createdAt: string | null;
};

function formatMoney(value: string | null) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export function PurchaseOrdersTab({ canFinalize }: { canFinalize: boolean }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] =
    useState<PurchaseOrderListRow | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryRow[]>([]);
  const [routeItems, setRouteItems] = useState<LogisticsRouteRow[]>([]);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [routeOptions, setRouteOptions] = useState<RouteOptionsResponse>({});
  const [savingRoute, setSavingRoute] = useState(false);
  const [routeForm, setRouteForm] = useState({
    routeType: "COMPRA_APROBADA",
    partyType: "PROVEEDOR",
    partyId: "",
    partyLabel: "",
    driverLabel: "",
    vehiclePlate: "",
    originArea: "VIOMAR",
    destinationArea: "BODEGA_PRINCIPAL",
    scheduledAt: "",
    notes: "",
  });

  const endpoint = useMemo(() => "/api/purchase-orders", []);

  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<PurchaseOrderListRow>(endpoint, 10);

  const emptyContent = useMemo(() => {
    if (loading) return "";

    return "Sin órdenes";
  }, [loading]);

  const finalize = async (id: string) => {
    if (!canFinalize) {
      toast.error("No tienes permiso para registrar entrada");

      return;
    }

    try {
      await apiJson(`/api/purchase-orders/${id}`, {
        method: "PUT",
        body: JSON.stringify({ action: "FINALIZAR" }),
      });
      toast.success("Orden finalizada");
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const approveCosts = async (id: string) => {
    try {
      await apiJson(`/api/purchase-orders/${id}`, {
        method: "PUT",
        body: JSON.stringify({ action: "APROBAR_COSTOS" }),
      });
      toast.success("Orden aprobada por costos (vigencia 5 días)");
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const rejectCosts = async (id: string) => {
    const reason = window.prompt("Motivo del rechazo en costos:");

    if (!reason?.trim()) return;

    try {
      await apiJson(`/api/purchase-orders/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          action: "RECHAZAR_COSTOS",
          reason: reason.trim(),
        }),
      });
      toast.success("Orden rechazada en costos");
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const startRoute = async (id: string) => {
    try {
      await apiJson(`/api/purchase-orders/${id}`, {
        method: "PUT",
        body: JSON.stringify({ action: "INICIAR_RUTA" }),
      });
      toast.success("Ruta logística iniciada");
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const openHistory = async (row: PurchaseOrderListRow) => {
    try {
      const res = await apiJson<{ items: HistoryRow[] }>(
        `/api/purchase-orders/${row.id}/history`,
      );

      setSelectedOrder(row);
      setHistoryItems(Array.isArray(res.items) ? res.items : []);
      setHistoryOpen(true);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const openRoutes = async (row: PurchaseOrderListRow) => {
    try {
      const [routesRes, optionsRes, shipmentsRes] = await Promise.all([
        apiJson<{ items: LogisticsRouteRow[] }>(
          `/api/purchase-orders/${row.id}/routes`,
        ),
        apiJson<RouteOptionsResponse>("/api/purchase-orders/options"),
        apiJson<{ items: ShipmentRow[] }>(
          `/api/shipments?q=${encodeURIComponent(row.purchaseOrderCode ?? "")}&page=1&pageSize=12`,
        ),
      ]);

      setSelectedOrder(row);
      setRouteItems(Array.isArray(routesRes.items) ? routesRes.items : []);
      setRouteOptions(optionsRes ?? {});
      setShipments(Array.isArray(shipmentsRes.items) ? shipmentsRes.items : []);
      setRouteOpen(true);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const thirdPartySummary = useMemo(
    () => [
      {
        key: "despacho",
        label: "Despacho",
        items: routeOptions.dispatchers ?? [],
      },
      {
        key: "empaque",
        label: "Empaque",
        items: routeOptions.packers ?? [],
      },
      {
        key: "mensajeros",
        label: "Mensajeros",
        items: routeOptions.messengers ?? [],
      },
      {
        key: "conductores",
        label: "Conductores",
        items: routeOptions.drivers ?? [],
      },
    ],
    [
      routeOptions.dispatchers,
      routeOptions.drivers,
      routeOptions.messengers,
      routeOptions.packers,
    ],
  );

  const currentPartyOptions = useMemo(() => {
    if (routeForm.partyType === "PROVEEDOR")
      return routeOptions.suppliers ?? [];
    if (routeForm.partyType === "CONFECCIONISTA")
      return routeOptions.confectionists ?? [];
    if (routeForm.partyType === "EMPAQUE") return routeOptions.packers ?? [];
    if (routeForm.partyType === "MENSAJERO")
      return routeOptions.messengers ?? [];
    if (routeForm.partyType === "CONDUCTOR") return routeOptions.drivers ?? [];
    if (routeForm.partyType === "DESPACHO")
      return routeOptions.dispatchers ?? [];

    return [];
  }, [routeForm.partyType, routeOptions]);

  const createRoute = async () => {
    if (!selectedOrder) return;

    try {
      setSavingRoute(true);
      await apiJson(`/api/purchase-orders/${selectedOrder.id}/routes`, {
        method: "POST",
        body: JSON.stringify(routeForm),
      });
      const routesRes = await apiJson<{ items: LogisticsRouteRow[] }>(
        `/api/purchase-orders/${selectedOrder.id}/routes`,
      );

      setRouteItems(Array.isArray(routesRes.items) ? routesRes.items : []);
      toast.success("Ruta logística creada");
      setRouteForm((prev) => ({
        ...prev,
        partyId: "",
        partyLabel: "",
        notes: "",
      }));
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSavingRoute(false);
    }
  };

  const openPdf = (id: string) => {
    window.open(
      `/api/exports/purchase-orders/${id}/pdf`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div />
        <div className="flex gap-2">
          <Button as={NextLink} color="primary" href="/erp/purchase-orders/new">
            Nueva orden
          </Button>
          <Button
            as={NextLink}
            href="/erp/purchase-orders/coordination"
            variant="flat"
          >
            Centro coordinación
          </Button>
          <Button variant="flat" onPress={refresh}>
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Órdenes de compra"
          headers={[
            "Código",
            "Proveedor",
            "Total",
            "Estado",
            "Creada",
            "Acciones",
          ]}
        />
      ) : (
        <Table aria-label="Órdenes de compra">
          <TableHeader>
            <TableColumn>Código</TableColumn>
            <TableColumn>Proveedor</TableColumn>
            <TableColumn>Total</TableColumn>
            <TableColumn>Estado</TableColumn>
            <TableColumn>Creada</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={data?.items ?? []}>
            {(row) => (
              <TableRow key={row.id}>
                <TableCell>{row.purchaseOrderCode ?? "-"}</TableCell>
                <TableCell>{row.supplierName ?? "-"}</TableCell>
                <TableCell>{formatMoney(row.total)}</TableCell>
                <TableCell>{row.status ?? "-"}</TableCell>
                <TableCell>
                  {row.createdAt
                    ? new Date(row.createdAt).toLocaleString()
                    : "-"}
                </TableCell>
                <TableCell>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button size="sm" variant="flat">
                        <BsThreeDotsVertical />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Acciones">
                      <DropdownItem key="pdf" onPress={() => openPdf(row.id)}>
                        Ver PDF
                      </DropdownItem>
                      <DropdownItem
                        key="history"
                        onPress={() => openHistory(row)}
                      >
                        Ver historial
                      </DropdownItem>
                      <DropdownItem
                        key="routes"
                        onPress={() => openRoutes(row)}
                      >
                        Gestionar rutas
                      </DropdownItem>
                      {row.status === "PENDIENTE" ||
                      row.status === "RECHAZADA" ? (
                        <DropdownItem
                          key="edit"
                          as={NextLink}
                          href={`/erp/purchase-orders/${row.id}/edit`}
                        >
                          Editar orden
                        </DropdownItem>
                      ) : null}
                      {row.status === "PENDIENTE" ? (
                        <DropdownItem
                          key="approve"
                          onPress={() => approveCosts(row.id)}
                        >
                          Aprobar en costos
                        </DropdownItem>
                      ) : null}
                      {row.status === "PENDIENTE" ||
                      row.status === "APROBADA" ? (
                        <DropdownItem
                          key="reject"
                          onPress={() => rejectCosts(row.id)}
                        >
                          Rechazar en costos
                        </DropdownItem>
                      ) : null}
                      {row.status === "APROBADA" ? (
                        <DropdownItem
                          key="start-route"
                          onPress={() => startRoute(row.id)}
                        >
                          Iniciar ruta
                        </DropdownItem>
                      ) : null}
                      {row.status === "APROBADA" ||
                      row.status === "EN_PROCESO" ? (
                        <DropdownItem
                          key="finalize"
                          onPress={() => finalize(row.id)}
                        >
                          Finalizar (registrar entrada)
                        </DropdownItem>
                      ) : null}
                    </DropdownMenu>
                  </Dropdown>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {data ? <Pager data={data} page={page} onChange={setPage} /> : null}

      <Modal isOpen={historyOpen} size="3xl" onOpenChange={setHistoryOpen}>
        <ModalContent>
          <ModalHeader>
            Historial de orden {selectedOrder?.purchaseOrderCode ?? ""}
          </ModalHeader>
          <ModalBody>
            <Table aria-label="Historial de compras">
              <TableHeader>
                <TableColumn>Fecha</TableColumn>
                <TableColumn>Acción</TableColumn>
                <TableColumn>Responsable</TableColumn>
                <TableColumn>Notas</TableColumn>
              </TableHeader>
              <TableBody emptyContent="Sin historial" items={historyItems}>
                {(item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleString()
                        : "-"}
                    </TableCell>
                    <TableCell>{item.action}</TableCell>
                    <TableCell>{item.performedByName ?? "-"}</TableCell>
                    <TableCell>{item.notes ?? "-"}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setHistoryOpen(false)}>
              Cerrar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={routeOpen} size="5xl" onOpenChange={setRouteOpen}>
        <ModalContent>
          <ModalHeader>
            Rutas de coordinación - {selectedOrder?.purchaseOrderCode ?? ""}
          </ModalHeader>
          <ModalBody className="space-y-4">
            <div className="rounded-xl border border-default-200 bg-default-50 p-4">
              <h4 className="text-sm font-semibold text-default-800">
                Terceros disponibles
              </h4>
              <p className="mt-1 text-xs text-default-600">
                Despacho, empaque, mensajeros y conductores cargados para
                coordinación.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {thirdPartySummary.map((group) => (
                  <div
                    key={group.key}
                    className="rounded-lg border border-default-200 bg-white p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-default-700">
                        {group.label}
                      </span>
                      <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs font-medium text-default-700">
                        {group.items.length}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {group.items.slice(0, 4).map((item) => (
                        <p
                          key={item.id}
                          className="truncate text-xs text-default-600"
                        >
                          {item.name}
                        </p>
                      ))}
                      {group.items.length === 0 ? (
                        <p className="text-xs text-default-400">
                          Sin registros
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-default-200 bg-default-50 p-4">
              <h4 className="text-sm font-semibold text-default-800">
                Envíos relacionados
              </h4>
              <p className="mt-1 text-xs text-default-600">
                Últimos envíos vinculados al código de orden para seguimiento
                operativo.
              </p>
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                {shipments.length === 0 ? (
                  <p className="text-xs text-default-500">
                    No hay envíos asociados a esta orden.
                  </p>
                ) : (
                  shipments.map((shipment) => (
                    <div
                      key={shipment.id}
                      className="rounded-lg border border-default-200 bg-white px-3 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-3 text-default-700">
                        <span className="font-medium">
                          {shipment.mode === "CLIENT" ? "Cliente" : "Interno"}
                        </span>
                        <span
                          className={
                            shipment.isReceived
                              ? "text-success"
                              : "text-warning"
                          }
                        >
                          {shipment.isReceived ? "Recibido" : "Pendiente"}
                        </span>
                      </div>
                      <p className="mt-1 text-default-600">
                        {shipment.fromArea} -&gt; {shipment.toArea} ·{" "}
                        {shipment.designName}
                      </p>
                      <p className="text-default-500">
                        Envía: {shipment.sentBy} · Destino:{" "}
                        {shipment.recipientName ?? "-"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Select
                label="Tipo de ruta"
                selectedKeys={new Set([routeForm.routeType])}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0];

                  setRouteForm((prev) => ({
                    ...prev,
                    routeType: first ? String(first) : prev.routeType,
                  }));
                }}
              >
                <SelectItem key="COMPRA_APROBADA">Compra aprobada</SelectItem>
                <SelectItem key="DESPACHO_CLIENTE">Despacho cliente</SelectItem>
                <SelectItem key="LLEVADA_CONFECCION">
                  Llevada confección
                </SelectItem>
                <SelectItem key="RETORNO_CONFECCION">
                  Retorno confección
                </SelectItem>
              </Select>

              <Select
                label="Actor responsable"
                selectedKeys={new Set([routeForm.partyType])}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0];
                  const value = first ? String(first) : "PROVEEDOR";

                  setRouteForm((prev) => ({
                    ...prev,
                    partyType: value,
                    partyId: "",
                    partyLabel: "",
                  }));
                }}
              >
                <SelectItem key="PROVEEDOR">Proveedor</SelectItem>
                <SelectItem key="CONFECCIONISTA">Confeccionista</SelectItem>
                <SelectItem key="EMPAQUE">Empaque</SelectItem>
                <SelectItem key="MENSAJERO">Mensajero</SelectItem>
                <SelectItem key="CONDUCTOR">Conductor</SelectItem>
                <SelectItem key="DESPACHO">Despacho</SelectItem>
              </Select>

              <Select
                items={currentPartyOptions.map((option) => ({
                  id: option.id,
                  name: option.name,
                }))}
                label="Tercero"
                selectedKeys={
                  routeForm.partyId ? new Set([routeForm.partyId]) : new Set([])
                }
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0];
                  const value = first ? String(first) : "";
                  const selected = currentPartyOptions.find(
                    (option) => option.id === value,
                  );

                  setRouteForm((prev) => ({
                    ...prev,
                    partyId: value,
                    partyLabel: selected?.name ? String(selected.name) : "",
                  }));
                }}
              >
                {(item) => <SelectItem key={item.id}>{item.name}</SelectItem>}
              </Select>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Input
                label="Origen"
                value={routeForm.originArea}
                onValueChange={(value) =>
                  setRouteForm((prev) => ({ ...prev, originArea: value }))
                }
              />
              <Input
                label="Destino"
                value={routeForm.destinationArea}
                onValueChange={(value) =>
                  setRouteForm((prev) => ({ ...prev, destinationArea: value }))
                }
              />
              <Input
                label="Fecha/Hora programada"
                type="datetime-local"
                value={routeForm.scheduledAt}
                onValueChange={(value) =>
                  setRouteForm((prev) => ({ ...prev, scheduledAt: value }))
                }
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Input
                label="Conductor"
                value={routeForm.driverLabel}
                onValueChange={(value) =>
                  setRouteForm((prev) => ({ ...prev, driverLabel: value }))
                }
              />
              <Input
                label="Placa"
                value={routeForm.vehiclePlate}
                onValueChange={(value) =>
                  setRouteForm((prev) => ({ ...prev, vehiclePlate: value }))
                }
              />
              <Input
                label="Notas"
                value={routeForm.notes}
                onValueChange={(value) =>
                  setRouteForm((prev) => ({ ...prev, notes: value }))
                }
              />
            </div>

            <div className="flex justify-end">
              <Button
                color="primary"
                isLoading={savingRoute}
                onPress={createRoute}
              >
                Crear ruta
              </Button>
            </div>

            <Table aria-label="Rutas logísticas">
              <TableHeader>
                <TableColumn>Fecha</TableColumn>
                <TableColumn>Tipo</TableColumn>
                <TableColumn>Actor</TableColumn>
                <TableColumn>Trayecto</TableColumn>
                <TableColumn>Conductor/Placa</TableColumn>
                <TableColumn>Estado</TableColumn>
              </TableHeader>
              <TableBody emptyContent="Sin rutas" items={routeItems}>
                {(item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleString()
                        : "-"}
                    </TableCell>
                    <TableCell>{item.routeType}</TableCell>
                    <TableCell>{item.partyLabel ?? item.partyType}</TableCell>
                    <TableCell>
                      {item.originArea} → {item.destinationArea}
                    </TableCell>
                    <TableCell>
                      {item.driverLabel ?? "-"} / {item.vehiclePlate ?? "-"}
                    </TableCell>
                    <TableCell>{item.status ?? "-"}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setRouteOpen(false)}>
              Cerrar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
