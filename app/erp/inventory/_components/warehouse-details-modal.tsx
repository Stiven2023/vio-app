"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { Tab, Tabs } from "@heroui/tabs";

import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";
import { DetailModal } from "@/app/erp/catalog/_components/ui/detail-modal";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";

import type { WarehouseRow } from "./warehouse-modal";

type WarehouseProductRow = {
  stockId: string;
  inventoryItemId: string | null;
  variantId: string | null;
  itemCode: string | null;
  itemName: string | null;
  variantSku: string | null;
  variantColor: string | null;
  variantSize: string | null;
  availableQty: string | null;
  reservedQty: string | null;
  minStock: string | null;
  lastUpdated: string | null;
};

type WarehouseMoveRow = {
  id: string;
  createdAt: string | null;
  quantity: string | null;
  reason: string | null;
  notes: string | null;
  itemCode: string | null;
  itemName: string | null;
  variantSku?: string | null;
  variantColor?: string | null;
  variantSize?: string | null;
  fromWarehouseCode?: string | null;
  fromWarehouseName?: string | null;
  toWarehouseCode?: string | null;
  toWarehouseName?: string | null;
};

type WarehouseDetailsResponse = {
  warehouse: WarehouseRow;
  products: WarehouseProductRow[];
  entries: WarehouseMoveRow[];
  outputs: WarehouseMoveRow[];
};

type WarehousesPaginated = {
  items: WarehouseRow[];
};

type TransferRequestRow = {
  id: string;
  inventoryItemId: string | null;
  variantId: string | null;
  itemCode: string | null;
  itemName: string | null;
  variantSku: string | null;
  quantity: string | null;
  notes: string | null;
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  requestedAt: string | null;
  status?: "PENDIENTE" | "APROBADA" | "RECHAZADA";
};

type TransferRequestsResponse = {
  items: TransferRequestRow[];
};

export function WarehouseDetailsModal({
  warehouse,
  isOpen,
  onOpenChange,
  onChanged,
}: {
  warehouse: WarehouseRow | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<WarehouseDetailsResponse | null>(null);

  const [allWarehouses, setAllWarehouses] = useState<WarehouseRow[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  const [transferStockId, setTransferStockId] = useState("");
  const [transferToWarehouseId, setTransferToWarehouseId] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [requestingTransfer, setRequestingTransfer] = useState(false);

  const [requestFromWarehouseId, setRequestFromWarehouseId] = useState("");
  const [requestStockId, setRequestStockId] = useState("");
  const [requestQty, setRequestQty] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [requestSourceProducts, setRequestSourceProducts] = useState<WarehouseProductRow[]>([]);

  const [pendingIncoming, setPendingIncoming] = useState<TransferRequestRow[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<TransferRequestRow[]>([]);
  const [resolvedIncoming, setResolvedIncoming] = useState<TransferRequestRow[]>([]);
  const [resolvedOutgoing, setResolvedOutgoing] = useState<TransferRequestRow[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [cancelingRequestId, setCancelingRequestId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailItems, setDetailItems] = useState<Array<{ label: string; value: string }>>([]);

  const fetchDetails = async () => {
    if (!warehouse?.id) return;

    setLoading(true);
    try {
      const res = await apiJson<WarehouseDetailsResponse>(
        `/api/warehouses/${warehouse.id}/details`,
      );
      setDetails(res);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setDetails(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !warehouse?.id) return;

    setTransferStockId("");
    setTransferToWarehouseId("");
    setTransferQty("");
    setTransferNotes("");
    setRequestFromWarehouseId("");
    setRequestStockId("");
    setRequestQty("");
    setRequestNotes("");
    setRequestSourceProducts([]);

    fetchDetails();
  }, [isOpen, warehouse?.id]);

  const fetchTransferRequests = async () => {
    if (!warehouse?.id) return;

    setLoadingRequests(true);
    try {
      const [incoming, outgoing, incomingResolved, outgoingResolved] = await Promise.all([
        apiJson<TransferRequestsResponse>(
          `/api/warehouse-transfers?warehouseId=${warehouse.id}&scope=incoming&status=pending`,
        ),
        apiJson<TransferRequestsResponse>(
          `/api/warehouse-transfers?warehouseId=${warehouse.id}&scope=outgoing&status=pending`,
        ),
        apiJson<TransferRequestsResponse>(
          `/api/warehouse-transfers?warehouseId=${warehouse.id}&scope=incoming&status=resolved`,
        ),
        apiJson<TransferRequestsResponse>(
          `/api/warehouse-transfers?warehouseId=${warehouse.id}&scope=outgoing&status=resolved`,
        ),
      ]);

      setPendingIncoming(incoming.items ?? []);
      setPendingOutgoing(outgoing.items ?? []);
      setResolvedIncoming(incomingResolved.items ?? []);
      setResolvedOutgoing(outgoingResolved.items ?? []);
    } catch {
      setPendingIncoming([]);
      setPendingOutgoing([]);
      setResolvedIncoming([]);
      setResolvedOutgoing([]);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setLoadingWarehouses(true);

    apiJson<WarehousesPaginated>("/api/warehouses?page=1&pageSize=300")
      .then((res) => {
        if (!active) return;
        setAllWarehouses(res.items ?? []);
      })
      .catch(() => {
        if (!active) return;
        setAllWarehouses([]);
      })
      .finally(() => {
        if (active) setLoadingWarehouses(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !warehouse?.id) return;
    fetchTransferRequests();
  }, [isOpen, warehouse?.id]);

  useEffect(() => {
    if (!isOpen || !requestFromWarehouseId) {
      setRequestSourceProducts([]);
      setRequestStockId("");
      return;
    }

    let active = true;

    apiJson<WarehouseDetailsResponse>(`/api/warehouses/${requestFromWarehouseId}/details`)
      .then((res) => {
        if (!active) return;
        const candidates = (res.products ?? []).filter(
          (row) => Number(String(row.availableQty ?? "0")) > 0,
        );
        setRequestSourceProducts(candidates);
      })
      .catch(() => {
        if (!active) return;
        setRequestSourceProducts([]);
      });

    return () => {
      active = false;
    };
  }, [isOpen, requestFromWarehouseId]);

  const transferCandidates = useMemo(() => {
    const rows = details?.products ?? [];

    return rows.filter((p) => Number(String(p.availableQty ?? "0")) > 0);
  }, [details?.products]);

  const destinationWarehouses = useMemo(() => {
    if (!warehouse?.id) return [];

    return allWarehouses.filter((w) => w.id !== warehouse.id && w.isActive);
  }, [allWarehouses, warehouse?.id]);

  const requestSourceWarehouses = useMemo(() => {
    if (!warehouse?.id) return [];

    return allWarehouses.filter((w) => w.id !== warehouse.id && w.isActive);
  }, [allWarehouses, warehouse?.id]);

  const warehouseNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of allWarehouses) {
      map.set(w.id, `${w.code} - ${w.name}`);
    }
    return map;
  }, [allWarehouses]);

  const submitTransfer = async () => {
    if (!warehouse?.id) return;
    if (transferring) return;

    if (!transferStockId) {
      toast.error("Selecciona un item");
      return;
    }

    const selectedStock = transferCandidates.find((row) => row.stockId === transferStockId);
    if (!selectedStock?.inventoryItemId) {
      toast.error("No se pudo resolver el item a trasladar");
      return;
    }

    if (!transferToWarehouseId) {
      toast.error("Selecciona bodega destino");
      return;
    }

    const qty = Number(transferQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Cantidad invalida");
      return;
    }

    try {
      setTransferring(true);
      await apiJson("/api/warehouse-transfers", {
        method: "POST",
        body: JSON.stringify({
          inventoryItemId: selectedStock.inventoryItemId,
          variantId: selectedStock.variantId ?? undefined,
          fromWarehouseId: warehouse.id,
          toWarehouseId: transferToWarehouseId,
          quantity: qty,
          notes: transferNotes.trim() || undefined,
        }),
      });

      toast.success("Traslado registrado");
      setTransferQty("");
      setTransferNotes("");
      await fetchDetails();
      onChanged();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTransferring(false);
    }
  };

  const submitTransferRequest = async () => {
    if (!warehouse?.id) return;
    if (requestingTransfer) return;

    if (!requestFromWarehouseId) {
      toast.error("Selecciona bodega origen");
      return;
    }

    if (!requestStockId) {
      toast.error("Selecciona item de la bodega origen");
      return;
    }

    const selectedStock = requestSourceProducts.find((row) => row.stockId === requestStockId);
    if (!selectedStock?.inventoryItemId) {
      toast.error("No se pudo resolver el item a solicitar");
      return;
    }

    const qty = Number(requestQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Cantidad invalida");
      return;
    }

    try {
      setRequestingTransfer(true);
      await apiJson("/api/warehouse-transfers", {
        method: "POST",
        body: JSON.stringify({
          inventoryItemId: selectedStock.inventoryItemId,
          variantId: selectedStock.variantId ?? undefined,
          fromWarehouseId: requestFromWarehouseId,
          toWarehouseId: warehouse.id,
          quantity: qty,
          notes: requestNotes.trim() || undefined,
          isRequest: true,
        }),
      });

      toast.success("Solicitud de traslado creada");
      setRequestQty("");
      setRequestNotes("");
      await fetchTransferRequests();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRequestingTransfer(false);
    }
  };

  const approveTransferRequest = async (requestId: string) => {
    if (!requestId || approvingRequestId) return;

    try {
      setApprovingRequestId(requestId);
      await apiJson("/api/warehouse-transfers", {
        method: "PUT",
        body: JSON.stringify({ id: requestId }),
      });

      toast.success("Solicitud aprobada y traslado ejecutado");
      await Promise.all([fetchTransferRequests(), fetchDetails()]);
      onChanged();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setApprovingRequestId(null);
    }
  };

  const rejectTransferRequest = async (requestId: string) => {
    if (!requestId || rejectingRequestId) return;

    try {
      setRejectingRequestId(requestId);
      await apiJson("/api/warehouse-transfers", {
        method: "PATCH",
        body: JSON.stringify({ id: requestId }),
      });

      toast.success("Solicitud rechazada");
      await fetchTransferRequests();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRejectingRequestId(null);
    }
  };

  const cancelTransferRequest = async (requestId: string) => {
    if (!requestId || cancelingRequestId) return;

    try {
      setCancelingRequestId(requestId);
      await apiJson("/api/warehouse-transfers", {
        method: "DELETE",
        body: JSON.stringify({ id: requestId }),
      });

      toast.success("Solicitud cancelada");
      await fetchTransferRequests();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCancelingRequestId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} size="5xl" onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          {warehouse ? `Detalle bodega: ${warehouse.name}` : "Detalle de bodega"}
        </ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-default-200 p-3 md:grid-cols-4">
            <div>
              <p className="text-xs text-default-500">Codigo</p>
              <p className="font-medium">{warehouse?.code ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-default-500">Ciudad</p>
              <p className="font-medium">{warehouse?.city ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-default-500">Tipo</p>
              <p className="font-medium">
                {warehouse?.isVirtual
                  ? "Virtual"
                  : warehouse?.isExternal
                    ? "Externa"
                    : "Fisica"}
              </p>
            </div>
            <div>
              <p className="text-xs text-default-500">Estado</p>
              <p className="font-medium">{warehouse?.isActive ? "Activa" : "Inactiva"}</p>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-default-200 p-3">
            <p className="text-sm font-semibold">Traslado a otra bodega</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <Select
                isDisabled={loading || transferring}
                label="Item"
                selectedKeys={transferStockId ? new Set([transferStockId]) : new Set([])}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0];
                  setTransferStockId(first ? String(first) : "");
                }}
                items={transferCandidates}
              >
                {(item) => (
                  <SelectItem key={item.stockId}>
                    {`${item.itemCode ?? "SIN-COD"} - ${item.itemName ?? "Item"}${item.variantSku ? ` / ${item.variantSku}` : ""} (Disp: ${item.availableQty ?? "0"})`}
                  </SelectItem>
                )}
              </Select>

              <Select
                isDisabled={loadingWarehouses || transferring}
                label="Bodega destino"
                selectedKeys={
                  transferToWarehouseId ? new Set([transferToWarehouseId]) : new Set([])
                }
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0];
                  setTransferToWarehouseId(first ? String(first) : "");
                }}
                items={destinationWarehouses}
              >
                {(w) => (
                  <SelectItem key={w.id}>{`${w.code} - ${w.name}`}</SelectItem>
                )}
              </Select>

              <Input
                isDisabled={transferring}
                label="Cantidad"
                type="number"
                value={transferQty}
                onValueChange={setTransferQty}
              />

              <Input
                isDisabled={transferring}
                label="Nota (opcional)"
                value={transferNotes}
                onValueChange={setTransferNotes}
              />
            </div>
            <div>
              <Button color="primary" isLoading={transferring} onPress={submitTransfer}>
                Trasladar
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-default-200 p-3">
            <p className="text-sm font-semibold">Solicitar traslado hacia esta bodega</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <Select
                isDisabled={loadingWarehouses || requestingTransfer}
                label="Bodega origen"
                selectedKeys={
                  requestFromWarehouseId ? new Set([requestFromWarehouseId]) : new Set([])
                }
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0];
                  setRequestFromWarehouseId(first ? String(first) : "");
                }}
                items={requestSourceWarehouses}
              >
                {(w) => <SelectItem key={w.id}>{`${w.code} - ${w.name}`}</SelectItem>}
              </Select>

              <Select
                isDisabled={!requestFromWarehouseId || requestingTransfer}
                label="Item en bodega origen"
                selectedKeys={requestStockId ? new Set([requestStockId]) : new Set([])}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0];
                  setRequestStockId(first ? String(first) : "");
                }}
                items={requestSourceProducts}
              >
                {(item) => (
                  <SelectItem key={item.stockId}>
                    {`${item.itemCode ?? "SIN-COD"} - ${item.itemName ?? "Item"}${item.variantSku ? ` / ${item.variantSku}` : ""} (Disp: ${item.availableQty ?? "0"})`}
                  </SelectItem>
                )}
              </Select>

              <Input
                isDisabled={requestingTransfer}
                label="Cantidad"
                type="number"
                value={requestQty}
                onValueChange={setRequestQty}
              />

              <Input
                isDisabled={requestingTransfer}
                label="Nota (opcional)"
                value={requestNotes}
                onValueChange={setRequestNotes}
              />
            </div>
            <div>
              <Button
                color="secondary"
                isLoading={requestingTransfer}
                onPress={submitTransferRequest}
              >
                Solicitar traslado
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-default-200 p-3">
            <p className="text-sm font-semibold">Solicitudes pendientes</p>

            <div>
              <p className="mb-2 text-xs font-medium text-default-500">
                Solicitudes que esta bodega debe despachar
              </p>
              <Table aria-label="Solicitudes pendientes salientes" removeWrapper>
                <TableHeader>
                  <TableColumn>Item</TableColumn>
                  <TableColumn>Cantidad</TableColumn>
                  <TableColumn>Destino</TableColumn>
                  <TableColumn>Estado</TableColumn>
                  <TableColumn>Solicitada</TableColumn>
                  <TableColumn>Accion</TableColumn>
                </TableHeader>
                <TableBody
                  emptyContent={loadingRequests ? "Cargando..." : "Sin solicitudes"}
                  items={pendingOutgoing}
                >
                  {(row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {`${row.itemCode ?? "SIN-COD"} - ${row.itemName ?? "Item"}${row.variantSku ? ` / ${row.variantSku}` : ""}`}
                      </TableCell>
                      <TableCell>{row.quantity ?? "0"}</TableCell>
                      <TableCell>
                        {row.toWarehouseId
                          ? (warehouseNameById.get(row.toWarehouseId) ?? row.toWarehouseId)
                          : "-"}
                      </TableCell>
                      <TableCell>{row.status ?? "PENDIENTE"}</TableCell>
                      <TableCell>
                        {row.requestedAt ? new Date(row.requestedAt).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            color="primary"
                            isLoading={approvingRequestId === row.id}
                            size="sm"
                            onPress={() => approveTransferRequest(row.id)}
                          >
                            Aprobar
                          </Button>
                          <Button
                            color="danger"
                            isLoading={rejectingRequestId === row.id}
                            size="sm"
                            variant="flat"
                            onPress={() => rejectTransferRequest(row.id)}
                          >
                            Rechazar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-default-500">
                Solicitudes hechas para esta bodega
              </p>
              <Table aria-label="Solicitudes pendientes entrantes" removeWrapper>
                <TableHeader>
                  <TableColumn>Item</TableColumn>
                  <TableColumn>Cantidad</TableColumn>
                  <TableColumn>Origen</TableColumn>
                  <TableColumn>Estado</TableColumn>
                  <TableColumn>Solicitada</TableColumn>
                  <TableColumn>Accion</TableColumn>
                </TableHeader>
                <TableBody
                  emptyContent={loadingRequests ? "Cargando..." : "Sin solicitudes"}
                  items={pendingIncoming}
                >
                  {(row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {`${row.itemCode ?? "SIN-COD"} - ${row.itemName ?? "Item"}${row.variantSku ? ` / ${row.variantSku}` : ""}`}
                      </TableCell>
                      <TableCell>{row.quantity ?? "0"}</TableCell>
                      <TableCell>
                        {row.fromWarehouseId
                          ? (warehouseNameById.get(row.fromWarehouseId) ?? row.fromWarehouseId)
                          : "-"}
                      </TableCell>
                      <TableCell>{row.status ?? "PENDIENTE"}</TableCell>
                      <TableCell>
                        {row.requestedAt ? new Date(row.requestedAt).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          color="warning"
                          isLoading={cancelingRequestId === row.id}
                          size="sm"
                          variant="flat"
                          onPress={() => cancelTransferRequest(row.id)}
                        >
                          Cancelar
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-default-500">
                Historial de solicitudes resueltas (esta bodega)
              </p>
              <Table aria-label="Solicitudes resueltas" removeWrapper>
                <TableHeader>
                  <TableColumn>Item</TableColumn>
                  <TableColumn>Cantidad</TableColumn>
                  <TableColumn>Tipo</TableColumn>
                  <TableColumn>Contraparte</TableColumn>
                  <TableColumn>Estado</TableColumn>
                </TableHeader>
                <TableBody
                  emptyContent={loadingRequests ? "Cargando..." : "Sin historial"}
                  items={[
                    ...(resolvedOutgoing ?? []).map((row) => ({
                      ...row,
                      direction: "SALIENTE" as const,
                    })),
                    ...(resolvedIncoming ?? []).map((row) => ({
                      ...row,
                      direction: "ENTRANTE" as const,
                    })),
                  ]}
                >
                  {(row) => (
                    <TableRow key={`${row.direction}-${row.id}`}>
                      <TableCell>
                        {`${row.itemCode ?? "SIN-COD"} - ${row.itemName ?? "Item"}${row.variantSku ? ` / ${row.variantSku}` : ""}`}
                      </TableCell>
                      <TableCell>{row.quantity ?? "0"}</TableCell>
                      <TableCell>{row.direction}</TableCell>
                      <TableCell>
                        {row.direction === "SALIENTE"
                          ? (row.toWarehouseId
                              ? (warehouseNameById.get(row.toWarehouseId) ?? row.toWarehouseId)
                              : "-")
                          : (row.fromWarehouseId
                              ? (warehouseNameById.get(row.fromWarehouseId) ?? row.fromWarehouseId)
                              : "-")}
                      </TableCell>
                      <TableCell>{row.status ?? "-"}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <Tabs aria-label="Detalle bodega" variant="underlined">
            <Tab key="products" title="Inventario">
              {loading ? (
                <TableSkeleton
                  ariaLabel="Inventario por bodega"
                  headers={["Item", "SKU", "Disponible", "Reservado", "Minimo", "Actualizado"]}
                />
              ) : (
                <Table aria-label="Inventario por bodega">
                  <TableHeader>
                    <TableColumn>Item</TableColumn>
                    <TableColumn>SKU</TableColumn>
                    <TableColumn>Disponible</TableColumn>
                    <TableColumn>Reservado</TableColumn>
                    <TableColumn>Minimo</TableColumn>
                    <TableColumn>Actualizado</TableColumn>
                    <TableColumn>Accion</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="Sin productos" items={details?.products ?? []}>
                    {(row) => (
                      <TableRow key={row.stockId}>
                        <TableCell>{`${row.itemCode ?? "SIN-COD"} - ${row.itemName ?? "Item"}`}</TableCell>
                        <TableCell>{row.variantSku ?? "-"}</TableCell>
                        <TableCell>{row.availableQty ?? "0"}</TableCell>
                        <TableCell>{row.reservedQty ?? "0"}</TableCell>
                        <TableCell>{row.minStock ?? "0"}</TableCell>
                        <TableCell>
                          {row.lastUpdated ? new Date(row.lastUpdated).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="flat"
                            onPress={() => {
                              setDetailTitle("Detalle de inventario en bodega");
                              setDetailItems([
                                { label: "Item", value: `${row.itemCode ?? "SIN-COD"} - ${row.itemName ?? "Item"}` },
                                {
                                  label: "Variante",
                                  value: row.variantSku
                                    ? `${row.variantSku}${row.variantColor ? ` - ${row.variantColor}` : ""}${row.variantSize ? ` - ${row.variantSize}` : ""}`
                                    : "-",
                                },
                                { label: "Disponible", value: row.availableQty ?? "0" },
                                { label: "Reservado", value: row.reservedQty ?? "0" },
                                { label: "Minimo", value: row.minStock ?? "0" },
                                {
                                  label: "Actualizado",
                                  value: row.lastUpdated ? new Date(row.lastUpdated).toLocaleString() : "-",
                                },
                              ]);
                              setDetailOpen(true);
                            }}
                          >
                            Ver mas
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </Tab>

            <Tab key="entries" title="Entradas">
              {loading ? (
                <TableSkeleton
                  ariaLabel="Entradas bodega"
                  headers={["Fecha", "Item", "SKU", "Cantidad", "Origen", "Motivo", "Nota"]}
                />
              ) : (
                <Table aria-label="Entradas bodega">
                  <TableHeader>
                    <TableColumn>Fecha</TableColumn>
                    <TableColumn>Item</TableColumn>
                    <TableColumn>SKU</TableColumn>
                    <TableColumn>Cantidad</TableColumn>
                    <TableColumn>Origen</TableColumn>
                    <TableColumn>Motivo</TableColumn>
                    <TableColumn>Nota</TableColumn>
                    <TableColumn>Accion</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="Sin entradas" items={details?.entries ?? []}>
                    {(row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          {row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell>{`${row.itemCode ?? "SIN-COD"} - ${row.itemName ?? "Item"}`}</TableCell>
                        <TableCell>{row.variantSku ?? "-"}</TableCell>
                        <TableCell>{row.quantity ?? "0"}</TableCell>
                        <TableCell>
                          {row.fromWarehouseCode
                            ? `${row.fromWarehouseCode} - ${row.fromWarehouseName ?? ""}`
                            : "N/A"}
                        </TableCell>
                        <TableCell>{row.reason ?? "-"}</TableCell>
                        <TableCell>{row.notes ?? "-"}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="flat"
                            onPress={() => {
                              setDetailTitle("Detalle de entrada");
                              setDetailItems([
                                { label: "Fecha", value: row.createdAt ? new Date(row.createdAt).toLocaleString() : "-" },
                                { label: "Item", value: `${row.itemCode ?? "SIN-COD"} - ${row.itemName ?? "Item"}` },
                                {
                                  label: "Variante",
                                  value: row.variantSku
                                    ? `${row.variantSku}${row.variantColor ? ` - ${row.variantColor}` : ""}${row.variantSize ? ` - ${row.variantSize}` : ""}`
                                    : "-",
                                },
                                { label: "Cantidad", value: row.quantity ?? "0" },
                                {
                                  label: "Origen",
                                  value: row.fromWarehouseCode
                                    ? `${row.fromWarehouseCode} - ${row.fromWarehouseName ?? ""}`
                                    : "N/A",
                                },
                                { label: "Motivo", value: row.reason ?? "-" },
                                { label: "Nota", value: row.notes ?? "-" },
                              ]);
                              setDetailOpen(true);
                            }}
                          >
                            Ver mas
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </Tab>

            <Tab key="outputs" title="Salidas">
              {loading ? (
                <TableSkeleton
                  ariaLabel="Salidas bodega"
                  headers={["Fecha", "Item", "SKU", "Cantidad", "Destino", "Motivo", "Nota"]}
                />
              ) : (
                <Table aria-label="Salidas bodega">
                  <TableHeader>
                    <TableColumn>Fecha</TableColumn>
                    <TableColumn>Item</TableColumn>
                    <TableColumn>SKU</TableColumn>
                    <TableColumn>Cantidad</TableColumn>
                    <TableColumn>Destino</TableColumn>
                    <TableColumn>Motivo</TableColumn>
                    <TableColumn>Nota</TableColumn>
                    <TableColumn>Accion</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="Sin salidas" items={details?.outputs ?? []}>
                    {(row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          {row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell>{`${row.itemCode ?? "SIN-COD"} - ${row.itemName ?? "Item"}`}</TableCell>
                        <TableCell>{row.variantSku ?? "-"}</TableCell>
                        <TableCell>{row.quantity ?? "0"}</TableCell>
                        <TableCell>
                          {row.toWarehouseCode
                            ? `${row.toWarehouseCode} - ${row.toWarehouseName ?? ""}`
                            : "N/A"}
                        </TableCell>
                        <TableCell>{row.reason ?? "-"}</TableCell>
                        <TableCell>{row.notes ?? "-"}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="flat"
                            onPress={() => {
                              setDetailTitle("Detalle de salida");
                              setDetailItems([
                                { label: "Fecha", value: row.createdAt ? new Date(row.createdAt).toLocaleString() : "-" },
                                { label: "Item", value: `${row.itemCode ?? "SIN-COD"} - ${row.itemName ?? "Item"}` },
                                {
                                  label: "Variante",
                                  value: row.variantSku
                                    ? `${row.variantSku}${row.variantColor ? ` - ${row.variantColor}` : ""}${row.variantSize ? ` - ${row.variantSize}` : ""}`
                                    : "-",
                                },
                                { label: "Cantidad", value: row.quantity ?? "0" },
                                {
                                  label: "Destino",
                                  value: row.toWarehouseCode
                                    ? `${row.toWarehouseCode} - ${row.toWarehouseName ?? ""}`
                                    : "N/A",
                                },
                                { label: "Motivo", value: row.reason ?? "-" },
                                { label: "Nota", value: row.notes ?? "-" },
                              ]);
                              setDetailOpen(true);
                            }}
                          >
                            Ver mas
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </Tab>
          </Tabs>

          <DetailModal
            isOpen={detailOpen}
            title={detailTitle}
            items={detailItems}
            onOpenChange={setDetailOpen}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
