"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Tab, Tabs } from "@heroui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";

import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";
import { DetailModal } from "@/app/erp/catalog/_components/ui/detail-modal";

type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  isVirtual: boolean | null;
  isExternal: boolean | null;
  isActive: boolean | null;
};

type WarehouseProductRow = {
  stockId: string;
  inventoryItemId: string | null;
  variantId: string | null;
  itemCode: string | null;
  itemName: string | null;
  variantSku: string | null;
  variantColor?: string | null;
  variantSize?: string | null;
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

type TransferRequestRow = {
  id: string;
  inventoryItemId: string | null;
  variantId: string | null;
  itemCode: string | null;
  itemName: string | null;
  variantSku: string | null;
  quantity: string | null;
  notes: string | null;
  status?: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  requestedAt: string | null;
  requesterEmployeeCode: string | null;
  requesterEmployeeName: string | null;
  approverEmployeeCode: string | null;
  approverEmployeeName: string | null;
};

type TransferRequestsResponse = {
  items: TransferRequestRow[];
};

type WarehouseDetailsResponse = {
  warehouse: WarehouseRow;
  products: WarehouseProductRow[];
  entries: WarehouseMoveRow[];
  outputs: WarehouseMoveRow[];
};

export function WarehouseDetailsClient({ id }: { id: string }) {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<WarehouseDetailsResponse | null>(null);
  const [allWarehouses, setAllWarehouses] = useState<WarehouseRow[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  const [transferStockId, setTransferStockId] = useState("");
  const [transferToWarehouseId, setTransferToWarehouseId] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferring, setTransferring] = useState(false);

  const [requestFromWarehouseId, setRequestFromWarehouseId] = useState("");
  const [requestStockId, setRequestStockId] = useState("");
  const [requestQty, setRequestQty] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [requestSourceProducts, setRequestSourceProducts] = useState<
    WarehouseProductRow[]
  >([]);
  const [requestingTransfer, setRequestingTransfer] = useState(false);

  const [pendingIncoming, setPendingIncoming] = useState<TransferRequestRow[]>(
    [],
  );
  const [pendingOutgoing, setPendingOutgoing] = useState<TransferRequestRow[]>(
    [],
  );
  const [resolvedIncoming, setResolvedIncoming] = useState<
    TransferRequestRow[]
  >([]);
  const [resolvedOutgoing, setResolvedOutgoing] = useState<
    TransferRequestRow[]
  >([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(
    null,
  );
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(
    null,
  );
  const [cancelingRequestId, setCancelingRequestId] = useState<string | null>(
    null,
  );
  const [productDetail, setProductDetail] =
    useState<WarehouseProductRow | null>(null);
  const [entryDetail, setEntryDetail] = useState<WarehouseMoveRow | null>(null);
  const [outputDetail, setOutputDetail] = useState<WarehouseMoveRow | null>(
    null,
  );

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await apiJson<WarehouseDetailsResponse>(
        `/api/warehouses/${id}/details`,
      );

      setDetails(res);
    } catch {
      setDetails(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    setLoadingWarehouses(true);
    apiJson<{ items: WarehouseRow[] }>("/api/warehouses?page=1&pageSize=300")
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
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const fetchTransferRequests = async () => {
    setLoadingRequests(true);
    try {
      const [incoming, outgoing, incomingResolved, outgoingResolved] =
        await Promise.all([
          apiJson<TransferRequestsResponse>(
            `/api/warehouse-transfers?warehouseId=${id}&scope=incoming&status=pending`,
          ),
          apiJson<TransferRequestsResponse>(
            `/api/warehouse-transfers?warehouseId=${id}&scope=outgoing&status=pending`,
          ),
          apiJson<TransferRequestsResponse>(
            `/api/warehouse-transfers?warehouseId=${id}&scope=incoming&status=resolved`,
          ),
          apiJson<TransferRequestsResponse>(
            `/api/warehouse-transfers?warehouseId=${id}&scope=outgoing&status=resolved`,
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
    fetchTransferRequests();
  }, [id]);

  useEffect(() => {
    if (!requestFromWarehouseId) {
      setRequestSourceProducts([]);
      setRequestStockId("");

      return;
    }

    let active = true;

    apiJson<WarehouseDetailsResponse>(
      `/api/warehouses/${requestFromWarehouseId}/details`,
    )
      .then((res) => {
        if (!active) return;
        const candidates = (res.products ?? []).filter(
          (row) =>
            Number(String(row.availableQty ?? "0")) > 0 &&
            Boolean(row.variantId),
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
  }, [requestFromWarehouseId]);

  const transferCandidates = useMemo(() => {
    const rows = details?.products ?? [];

    return rows.filter(
      (p) => Number(String(p.availableQty ?? "0")) > 0 && Boolean(p.variantId),
    );
  }, [details?.products]);

  const destinationWarehouses = useMemo(
    () => allWarehouses.filter((w) => w.id !== id && w.isActive),
    [allWarehouses, id],
  );

  const requestSourceWarehouses = useMemo(
    () => allWarehouses.filter((w) => w.id !== id && w.isActive),
    [allWarehouses, id],
  );

  const warehouseNameById = useMemo(() => {
    const map = new Map<string, string>();

    for (const w of allWarehouses) {
      map.set(w.id, `${w.code} - ${w.name}`);
    }

    return map;
  }, [allWarehouses]);

  const productGroups = useMemo(() => {
    const rows = details?.products ?? [];
    const groups = new Map<
      string,
      {
        key: string;
        itemCode: string;
        itemName: string;
        rows: WarehouseProductRow[];
      }
    >();

    const toNumber = (value: string | null | undefined) => {
      const n = Number(String(value ?? "0"));

      return Number.isFinite(n) ? n : 0;
    };

    for (const row of rows) {
      const groupKey =
        row.inventoryItemId ??
        `${row.itemCode ?? "SIN-COD"}::${row.itemName ?? "Item"}`;

      const current = groups.get(groupKey);

      if (current) {
        current.rows.push(row);
        continue;
      }

      groups.set(groupKey, {
        key: groupKey,
        itemCode: row.itemCode ?? "SIN-COD",
        itemName: row.itemName ?? "Item",
        rows: [row],
      });
    }

    return Array.from(groups.values())
      .map((group) => {
        const totals = group.rows.reduce(
          (acc, row) => ({
            available: acc.available + toNumber(row.availableQty),
            reserved: acc.reserved + toNumber(row.reservedQty),
            min: acc.min + toNumber(row.minStock),
          }),
          { available: 0, reserved: 0, min: 0 },
        );

        const lastUpdated = group.rows.reduce<string | null>((latest, row) => {
          if (!row.lastUpdated) return latest;
          if (!latest) return row.lastUpdated;

          return new Date(row.lastUpdated).getTime() >
            new Date(latest).getTime()
            ? row.lastUpdated
            : latest;
        }, null);

        const variantRows = [...group.rows].sort((a, b) => {
          const aSku = a.variantSku ?? "";
          const bSku = b.variantSku ?? "";

          if (!aSku && bSku) return 1;
          if (aSku && !bSku) return -1;

          return aSku.localeCompare(bSku);
        });

        return {
          ...group,
          totals,
          lastUpdated,
          rows: variantRows,
        };
      })
      .sort((a, b) =>
        `${a.itemCode} ${a.itemName}`.localeCompare(
          `${b.itemCode} ${b.itemName}`,
        ),
      );
  }, [details?.products]);

  const submitTransfer = async () => {
    if (transferring) return;
    if (!transferStockId) return toast.error("Selecciona un item");

    const selectedStock = transferCandidates.find(
      (row) => row.stockId === transferStockId,
    );

    if (!selectedStock?.inventoryItemId) {
      return toast.error("No se pudo resolver el item a trasladar");
    }

    if (!transferToWarehouseId) return toast.error("Selecciona bodega destino");

    const qty = Number(transferQty);

    if (!Number.isFinite(qty) || qty <= 0)
      return toast.error("Cantidad invalida");

    try {
      setTransferring(true);
      await apiJson("/api/warehouse-transfers", {
        method: "POST",
        body: JSON.stringify({
          inventoryItemId: selectedStock.inventoryItemId,
          variantId: selectedStock.variantId ?? undefined,
          fromWarehouseId: id,
          toWarehouseId: transferToWarehouseId,
          quantity: qty,
          notes: transferNotes.trim() || undefined,
        }),
      });

      toast.success("Traslado registrado");
      setTransferQty("");
      setTransferNotes("");
      await fetchDetails();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTransferring(false);
    }
  };

  const submitTransferRequest = async () => {
    if (requestingTransfer) return;
    if (!requestFromWarehouseId) return toast.error("Selecciona bodega origen");
    if (!requestStockId)
      return toast.error("Selecciona item de la bodega origen");

    const selectedStock = requestSourceProducts.find(
      (row) => row.stockId === requestStockId,
    );

    if (!selectedStock?.inventoryItemId) {
      return toast.error("No se pudo resolver el item a solicitar");
    }

    const qty = Number(requestQty);

    if (!Number.isFinite(qty) || qty <= 0)
      return toast.error("Cantidad invalida");

    try {
      setRequestingTransfer(true);
      await apiJson("/api/warehouse-transfers", {
        method: "POST",
        body: JSON.stringify({
          inventoryItemId: selectedStock.inventoryItemId,
          variantId: selectedStock.variantId ?? undefined,
          fromWarehouseId: requestFromWarehouseId,
          toWarehouseId: id,
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
    <div className="container mx-auto max-w-7xl pt-16 px-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Detalle de bodega</h1>
          <p className="text-default-600 mt-1">
            {details
              ? `${details.warehouse.code} - ${details.warehouse.name}`
              : "Cargando detalle..."}
          </p>
        </div>
        <Button as={Link} href="/erp/compras/bodega" variant="flat">
          Volver
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-default-200 p-3 md:grid-cols-4">
        <div>
          <p className="text-xs text-default-500">Codigo</p>
          <p className="font-medium">{details?.warehouse.code ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs text-default-500">Ciudad</p>
          <p className="font-medium">{details?.warehouse.city ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs text-default-500">Tipo</p>
          <p className="font-medium">
            {details?.warehouse.isVirtual
              ? "Virtual"
              : details?.warehouse.isExternal
                ? "Externa"
                : "Fisica"}
          </p>
        </div>
        <div>
          <p className="text-xs text-default-500">Estado</p>
          <p className="font-medium">
            {details?.warehouse.isActive ? "Activa" : "Inactiva"}
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-default-200 p-3">
        <p className="text-sm font-semibold">Traslado a otra bodega</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Select
            isDisabled={loading || transferring}
            items={transferCandidates}
            label="Item"
            selectedKeys={
              transferStockId ? new Set([transferStockId]) : new Set([])
            }
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];

              setTransferStockId(first ? String(first) : "");
            }}
          >
            {(item) => (
              <SelectItem key={item.stockId}>
                {`${item.itemCode ?? "SIN-COD"} - ${item.itemName ?? "Item"}${item.variantSku ? ` / ${item.variantSku}` : ""} (Disp: ${item.availableQty ?? "0"})`}
              </SelectItem>
            )}
          </Select>

          <Select
            isDisabled={loadingWarehouses || transferring}
            items={destinationWarehouses}
            label="Bodega destino"
            selectedKeys={
              transferToWarehouseId
                ? new Set([transferToWarehouseId])
                : new Set([])
            }
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];

              setTransferToWarehouseId(first ? String(first) : "");
            }}
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
          <Button
            color="primary"
            isDisabled={transferring}
            onPress={submitTransfer}
          >
            {transferring ? "Trasladando..." : "Trasladar"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-default-200 p-3">
        <p className="text-sm font-semibold">
          Solicitar traslado hacia esta bodega
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Select
            isDisabled={loadingWarehouses || requestingTransfer}
            items={requestSourceWarehouses}
            label="Bodega origen"
            selectedKeys={
              requestFromWarehouseId
                ? new Set([requestFromWarehouseId])
                : new Set([])
            }
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];

              setRequestFromWarehouseId(first ? String(first) : "");
            }}
          >
            {(w) => (
              <SelectItem key={w.id}>{`${w.code} - ${w.name}`}</SelectItem>
            )}
          </Select>

          <Select
            isDisabled={!requestFromWarehouseId || requestingTransfer}
            items={requestSourceProducts}
            label="Item en bodega origen"
            selectedKeys={
              requestStockId ? new Set([requestStockId]) : new Set([])
            }
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];

              setRequestStockId(first ? String(first) : "");
            }}
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
            isDisabled={requestingTransfer}
            onPress={submitTransferRequest}
          >
            {requestingTransfer ? "Solicitando..." : "Solicitar traslado"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-default-200 p-3">
        <p className="text-sm font-semibold">Solicitudes pendientes</p>

        <div>
          <p className="mb-2 text-xs font-medium text-default-500">
            Solicitudes que esta bodega debe despachar
          </p>
          <Table removeWrapper aria-label="Solicitudes pendientes salientes">
            <TableHeader>
              <TableColumn>Item</TableColumn>
              <TableColumn>Cantidad</TableColumn>
              <TableColumn>Destino</TableColumn>
              <TableColumn>Solicita</TableColumn>
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
                      ? (warehouseNameById.get(row.toWarehouseId) ??
                        row.toWarehouseId)
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {row.requesterEmployeeCode || row.requesterEmployeeName
                      ? `${row.requesterEmployeeCode ?? ""}${row.requesterEmployeeCode && row.requesterEmployeeName ? " - " : ""}${row.requesterEmployeeName ?? ""}`
                      : "-"}
                  </TableCell>
                  <TableCell>{row.status ?? "PENDIENTE"}</TableCell>
                  <TableCell>
                    {row.requestedAt
                      ? new Date(row.requestedAt).toLocaleString()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        color="primary"
                        isDisabled={approvingRequestId === row.id}
                        size="sm"
                        onPress={() => approveTransferRequest(row.id)}
                      >
                        {approvingRequestId === row.id ? "Aprobando..." : "Aprobar"}
                      </Button>
                      <Button
                        color="danger"
                        isDisabled={rejectingRequestId === row.id}
                        size="sm"
                        variant="flat"
                        onPress={() => rejectTransferRequest(row.id)}
                      >
                        {rejectingRequestId === row.id ? "Rechazando..." : "Rechazar"}
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
          <Table removeWrapper aria-label="Solicitudes pendientes entrantes">
            <TableHeader>
              <TableColumn>Item</TableColumn>
              <TableColumn>Cantidad</TableColumn>
              <TableColumn>Origen</TableColumn>
              <TableColumn>Solicita</TableColumn>
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
                      ? (warehouseNameById.get(row.fromWarehouseId) ??
                        row.fromWarehouseId)
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {row.requesterEmployeeCode || row.requesterEmployeeName
                      ? `${row.requesterEmployeeCode ?? ""}${row.requesterEmployeeCode && row.requesterEmployeeName ? " - " : ""}${row.requesterEmployeeName ?? ""}`
                      : "-"}
                  </TableCell>
                  <TableCell>{row.status ?? "PENDIENTE"}</TableCell>
                  <TableCell>
                    {row.requestedAt
                      ? new Date(row.requestedAt).toLocaleString()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      color="warning"
                      isDisabled={cancelingRequestId === row.id}
                      size="sm"
                      variant="flat"
                      onPress={() => cancelTransferRequest(row.id)}
                    >
                      {cancelingRequestId === row.id ? "Cancelando..." : "Cancelar"}
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
          <Table removeWrapper aria-label="Solicitudes resueltas">
            <TableHeader>
              <TableColumn>Item</TableColumn>
              <TableColumn>Cantidad</TableColumn>
              <TableColumn>Tipo</TableColumn>
              <TableColumn>Contraparte</TableColumn>
              <TableColumn>Solicita</TableColumn>
              <TableColumn>Aprueba</TableColumn>
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
                      ? row.toWarehouseId
                        ? (warehouseNameById.get(row.toWarehouseId) ??
                          row.toWarehouseId)
                        : "-"
                      : row.fromWarehouseId
                        ? (warehouseNameById.get(row.fromWarehouseId) ??
                          row.fromWarehouseId)
                        : "-"}
                  </TableCell>
                  <TableCell>
                    {row.requesterEmployeeCode || row.requesterEmployeeName
                      ? `${row.requesterEmployeeCode ?? ""}${row.requesterEmployeeCode && row.requesterEmployeeName ? " - " : ""}${row.requesterEmployeeName ?? ""}`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {row.approverEmployeeCode || row.approverEmployeeName
                      ? `${row.approverEmployeeCode ?? ""}${row.approverEmployeeCode && row.approverEmployeeName ? " - " : ""}${row.approverEmployeeName ?? ""}`
                      : "-"}
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
            <p className="py-8 text-center text-default-500">Cargando...</p>
          ) : productGroups.length === 0 ? (
            <p className="py-8 text-center text-default-500">Sin productos</p>
          ) : (
            <div className="space-y-3">
              {productGroups.map((group) => (
                <details
                  key={group.key}
                  className="rounded-lg border border-default-200 bg-content1"
                >
                  <summary className="cursor-pointer list-none px-4 py-3">
                    <div className="font-medium">{`${group.itemCode} - ${group.itemName}`}</div>
                    <p className="mt-1 text-xs text-default-500">
                      {`Variantes: ${group.rows.length} | Disponible total: ${group.totals.available.toFixed(2)} | Reservado total: ${group.totals.reserved.toFixed(2)} | Minimo total: ${group.totals.min.toFixed(2)}${group.lastUpdated ? ` | Actualizado: ${new Date(group.lastUpdated).toLocaleString()}` : ""}`}
                    </p>
                  </summary>
                  <div className="px-3 pb-3">
                    <Table
                      aria-label={`Inventario por variantes de ${group.itemCode}`}
                    >
                      <TableHeader>
                        <TableColumn>SKU</TableColumn>
                        <TableColumn>Color</TableColumn>
                        <TableColumn>Talla</TableColumn>
                        <TableColumn>Disponible</TableColumn>
                        <TableColumn>Reservado</TableColumn>
                        <TableColumn>Minimo</TableColumn>
                        <TableColumn>Actualizado</TableColumn>
                        <TableColumn>Acciones</TableColumn>
                      </TableHeader>
                      <TableBody items={group.rows}>
                        {(row) => (
                          <TableRow key={row.stockId}>
                            <TableCell>
                              {row.variantSku ?? "VARIANTE-REQUERIDA"}
                            </TableCell>
                            <TableCell>{row.variantColor ?? "-"}</TableCell>
                            <TableCell>{row.variantSize ?? "-"}</TableCell>
                            <TableCell>{row.availableQty ?? "0"}</TableCell>
                            <TableCell>{row.reservedQty ?? "0"}</TableCell>
                            <TableCell>{row.minStock ?? "0"}</TableCell>
                            <TableCell>
                              {row.lastUpdated
                                ? new Date(row.lastUpdated).toLocaleString()
                                : "-"}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="flat"
                                onPress={() => setProductDetail(row)}
                              >
                                Ver independencia SKU
                              </Button>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </details>
              ))}
            </div>
          )}
        </Tab>

        <Tab key="entries" title="Entradas">
          <Table aria-label="Entradas bodega">
            <TableHeader>
              <TableColumn>Fecha</TableColumn>
              <TableColumn>Item</TableColumn>
              <TableColumn>SKU</TableColumn>
              <TableColumn>Cantidad</TableColumn>
              <TableColumn>Origen</TableColumn>
              <TableColumn>Motivo</TableColumn>
              <TableColumn>Nota</TableColumn>
              <TableColumn>Acciones</TableColumn>
            </TableHeader>
            <TableBody
              emptyContent={loading ? "Cargando..." : "Sin entradas"}
              items={details?.entries ?? []}
            >
              {(row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleString()
                      : "-"}
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
                      onPress={() => setEntryDetail(row)}
                    >
                      Ver independencia SKU
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Tab>

        <Tab key="outputs" title="Salidas">
          <Table aria-label="Salidas bodega">
            <TableHeader>
              <TableColumn>Fecha</TableColumn>
              <TableColumn>Item</TableColumn>
              <TableColumn>SKU</TableColumn>
              <TableColumn>Cantidad</TableColumn>
              <TableColumn>Destino</TableColumn>
              <TableColumn>Motivo</TableColumn>
              <TableColumn>Nota</TableColumn>
              <TableColumn>Acciones</TableColumn>
            </TableHeader>
            <TableBody
              emptyContent={loading ? "Cargando..." : "Sin salidas"}
              items={details?.outputs ?? []}
            >
              {(row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleString()
                      : "-"}
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
                      onPress={() => setOutputDetail(row)}
                    >
                      Ver independencia SKU
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Tab>
      </Tabs>

      <DetailModal
        isOpen={Boolean(productDetail)}
        items={
          productDetail
            ? [
                {
                  label: "Item",
                  value: `${productDetail.itemCode ?? "SIN-COD"} - ${productDetail.itemName ?? "Item"}`,
                },
                {
                  label: "Variante SKU",
                  value: productDetail.variantSku
                    ? `${productDetail.variantSku}${productDetail.variantColor ? ` - ${productDetail.variantColor}` : ""}${productDetail.variantSize ? ` - ${productDetail.variantSize}` : ""}`
                    : "VARIANTE-REQUERIDA",
                },
                {
                  label: "Disponible",
                  value: productDetail.availableQty ?? "0",
                },
                { label: "Reservado", value: productDetail.reservedQty ?? "0" },
                { label: "Minimo", value: productDetail.minStock ?? "0" },
                {
                  label: "Ultima actualizacion",
                  value: productDetail.lastUpdated
                    ? new Date(productDetail.lastUpdated).toLocaleString()
                    : "-",
                },
              ]
            : []
        }
        title="Independizacion SKU - Inventario"
        onOpenChange={(open) => {
          if (!open) setProductDetail(null);
        }}
      />

      <DetailModal
        isOpen={Boolean(entryDetail)}
        items={
          entryDetail
            ? [
                {
                  label: "Item",
                  value: `${entryDetail.itemCode ?? "SIN-COD"} - ${entryDetail.itemName ?? "Item"}`,
                },
                {
                  label: "Variante SKU",
                  value: entryDetail.variantSku
                    ? `${entryDetail.variantSku}${entryDetail.variantColor ? ` - ${entryDetail.variantColor}` : ""}${entryDetail.variantSize ? ` - ${entryDetail.variantSize}` : ""}`
                    : "-",
                },
                { label: "Cantidad", value: entryDetail.quantity ?? "0" },
                {
                  label: "Origen",
                  value: entryDetail.fromWarehouseCode
                    ? `${entryDetail.fromWarehouseCode} - ${entryDetail.fromWarehouseName ?? ""}`
                    : "N/A",
                },
                { label: "Motivo", value: entryDetail.reason ?? "-" },
                { label: "Nota", value: entryDetail.notes ?? "-" },
                {
                  label: "Fecha",
                  value: entryDetail.createdAt
                    ? new Date(entryDetail.createdAt).toLocaleString()
                    : "-",
                },
              ]
            : []
        }
        title="Independizacion SKU - Entrada"
        onOpenChange={(open) => {
          if (!open) setEntryDetail(null);
        }}
      />

      <DetailModal
        isOpen={Boolean(outputDetail)}
        items={
          outputDetail
            ? [
                {
                  label: "Item",
                  value: `${outputDetail.itemCode ?? "SIN-COD"} - ${outputDetail.itemName ?? "Item"}`,
                },
                {
                  label: "Variante SKU",
                  value: outputDetail.variantSku
                    ? `${outputDetail.variantSku}${outputDetail.variantColor ? ` - ${outputDetail.variantColor}` : ""}${outputDetail.variantSize ? ` - ${outputDetail.variantSize}` : ""}`
                    : "-",
                },
                { label: "Cantidad", value: outputDetail.quantity ?? "0" },
                {
                  label: "Destino",
                  value: outputDetail.toWarehouseCode
                    ? `${outputDetail.toWarehouseCode} - ${outputDetail.toWarehouseName ?? ""}`
                    : "N/A",
                },
                { label: "Motivo", value: outputDetail.reason ?? "-" },
                { label: "Nota", value: outputDetail.notes ?? "-" },
                {
                  label: "Fecha",
                  value: outputDetail.createdAt
                    ? new Date(outputDetail.createdAt).toLocaleString()
                    : "-",
                },
              ]
            : []
        }
        title="Independizacion SKU - Salida"
        onOpenChange={(open) => {
          if (!open) setOutputDetail(null);
        }}
      />
    </div>
  );
}
