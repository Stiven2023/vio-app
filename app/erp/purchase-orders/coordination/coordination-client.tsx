"use client";

import type { PurchaseOrderListRow } from "../_lib/types";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
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
import { toast } from "react-hot-toast";

import { apiJson, getErrorMessage } from "../_lib/api";

type RouteOptionsResponse = {
  packers?: Array<{ id: string; name: string }>;
  envios?: Array<{ id: string; name: string }>;
  dispatchers?: Array<{ id: string; name: string }>;
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
};

type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  isActive: boolean | null;
};

type WarehouseProductRow = {
  stockId: string;
  inventoryItemId: string | null;
  variantId: string | null;
  itemCode: string | null;
  itemName: string | null;
  variantSku: string | null;
  availableQty: string | null;
};

type WarehouseDetailsResponse = {
  products: WarehouseProductRow[];
};

const actorMap: Record<string, string> = {
  ALL: "Todos",
  DESPACHO: "Despacho",
  EMPAQUE: "Empaque",
  ENVIOS: "Envíos",
};

function withinFiveDays(dateIso: string | null) {
  if (!dateIso) return false;

  const ms = new Date(dateIso).getTime();

  if (Number.isNaN(ms)) return false;

  return ms - Date.now() <= 5 * 24 * 60 * 60 * 1000;
}

export function PurchaseOrdersCoordinationClient() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PurchaseOrderListRow[]>([]);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [options, setOptions] = useState<RouteOptionsResponse>({});
  const [actor, setActor] = useState("ALL");
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [transferFromWarehouseId, setTransferFromWarehouseId] = useState("");
  const [transferToWarehouseId, setTransferToWarehouseId] = useState("");
  const [transferStockId, setTransferStockId] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [sourceProducts, setSourceProducts] = useState<WarehouseProductRow[]>(
    [],
  );
  const [loadingSourceProducts, setLoadingSourceProducts] = useState(false);
  const [submittingTransferRequest, setSubmittingTransferRequest] =
    useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [ordersRes, optionsRes, shipmentsRes] = await Promise.all([
        apiJson<{ items: PurchaseOrderListRow[] }>(
          "/api/purchase-orders?page=1&pageSize=120",
        ),
        apiJson<RouteOptionsResponse>("/api/purchase-orders/options"),
        apiJson<{ items: ShipmentRow[] }>("/api/shipments?page=1&pageSize=100"),
      ]);

      setOrders(Array.isArray(ordersRes.items) ? ordersRes.items : []);
      setOptions(optionsRes ?? {});
      setShipments(Array.isArray(shipmentsRes.items) ? shipmentsRes.items : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    let active = true;

    setLoadingWarehouses(true);
    apiJson<{ items: WarehouseRow[] }>("/api/warehouses?page=1&pageSize=300")
      .then((res) => {
        if (!active) return;

        setWarehouses(Array.isArray(res.items) ? res.items : []);
      })
      .catch(() => {
        if (!active) return;

        setWarehouses([]);
      })
      .finally(() => {
        if (active) setLoadingWarehouses(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!transferFromWarehouseId) {
      setSourceProducts([]);
      setTransferStockId("");

      return;
    }

    let active = true;

    setLoadingSourceProducts(true);
    apiJson<WarehouseDetailsResponse>(
      `/api/warehouses/${transferFromWarehouseId}/details`,
    )
      .then((res) => {
        if (!active) return;

        const products = (res.products ?? []).filter(
          (row) =>
            Number(String(row.availableQty ?? "0")) > 0 &&
            Boolean(row.variantId) &&
            Boolean(row.inventoryItemId),
        );

        setSourceProducts(products);
      })
      .catch(() => {
        if (!active) return;

        setSourceProducts([]);
      })
      .finally(() => {
        if (active) setLoadingSourceProducts(false);
      });

    return () => {
      active = false;
    };
  }, [transferFromWarehouseId]);

  const orderStats = useMemo(() => {
    const approved = orders.filter(
      (order) => order.status === "APROBADA",
    ).length;
    const inProcess = orders.filter(
      (order) => order.status === "EN_PROCESO",
    ).length;
    const expiring = orders.filter((order) =>
      withinFiveDays(order.approvalExpiresAt),
    ).length;
    const pendingRoutes = orders.filter(
      (order) => order.status === "APROBADA" || order.status === "EN_PROCESO",
    ).length;

    return { approved, inProcess, expiring, pendingRoutes };
  }, [orders]);

  const actorCount = useMemo(() => {
    return {
      DESPACHO: options.dispatchers?.length ?? 0,
      EMPAQUE: options.packers?.length ?? 0,
      ENVIOS: options.envios?.length ?? 0,
    };
  }, [options]);

  const filteredOrders = useMemo(() => {
    if (actor === "ALL") return orders;

    return orders.filter((order) => {
      if (actor === "DESPACHO") {
        return order.status === "EN_PROCESO" || order.status === "APROBADA";
      }

      if (actor === "EMPAQUE") return order.status === "EN_PROCESO";
      if (actor === "ENVIOS") return order.status === "EN_PROCESO";

      return true;
    });
  }, [actor, orders]);

  const sourceWarehouseOptions = useMemo(
    () => warehouses.filter((row) => row.isActive !== false),
    [warehouses],
  );

  const destinationWarehouseOptions = useMemo(
    () =>
      warehouses.filter(
        (row) => row.isActive !== false && row.id !== transferFromWarehouseId,
      ),
    [warehouses, transferFromWarehouseId],
  );

  const submitTransferRequest = async () => {
    if (submittingTransferRequest) return;
    if (!transferFromWarehouseId) {
      toast.error("Selecciona bodega origen");

      return;
    }
    if (!transferToWarehouseId) {
      toast.error("Selecciona bodega destino");

      return;
    }
    if (!transferStockId) {
      toast.error("Selecciona item/variante");

      return;
    }

    const selected = sourceProducts.find(
      (row) => row.stockId === transferStockId,
    );

    if (!selected?.inventoryItemId || !selected.variantId) {
      toast.error("No se pudo resolver el item a solicitar");

      return;
    }

    const qty = Number(transferQty);

    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Cantidad invalida");

      return;
    }

    try {
      setSubmittingTransferRequest(true);
      await apiJson("/api/warehouse-transfers", {
        method: "POST",
        body: JSON.stringify({
          inventoryItemId: selected.inventoryItemId,
          variantId: selected.variantId,
          fromWarehouseId: transferFromWarehouseId,
          toWarehouseId: transferToWarehouseId,
          quantity: qty,
          notes: transferNotes.trim() || undefined,
          isRequest: true,
        }),
      });

      toast.success("Solicitud de traslado creada");
      setTransferQty("");
      setTransferNotes("");
      setTransferStockId("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmittingTransferRequest(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-sky-200 bg-gradient-to-r from-sky-100 via-white to-cyan-100 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700">
          Compras
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-default-900">
          Centro de coordinación
        </h1>
        <p className="mt-1 text-sm text-default-600">
          Seguimiento operativo de aprobación, logística, terceros y envíos del
          ciclo de compras.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-default-200 bg-content1 p-4">
          <p className="text-xs uppercase tracking-wide text-default-500">
            Aprobadas
          </p>
          <p className="mt-2 text-2xl font-semibold">{orderStats.approved}</p>
        </div>
        <div className="rounded-2xl border border-default-200 bg-content1 p-4">
          <p className="text-xs uppercase tracking-wide text-default-500">
            En proceso
          </p>
          <p className="mt-2 text-2xl font-semibold">{orderStats.inProcess}</p>
        </div>
        <div className="rounded-2xl border border-default-200 bg-content1 p-4">
          <p className="text-xs uppercase tracking-wide text-default-500">
            Próximas a vencer
          </p>
          <p className="mt-2 text-2xl font-semibold">{orderStats.expiring}</p>
        </div>
        <div className="rounded-2xl border border-default-200 bg-content1 p-4">
          <p className="text-xs uppercase tracking-wide text-default-500">
            Rutas activas
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {orderStats.pendingRoutes}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-default-200 bg-content1 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-default-700">
            Equipo tercero
          </h3>
          <Select
            className="w-full sm:w-60"
            label="Filtrar actor"
            selectedKeys={new Set([actor])}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];

              setActor(first ? String(first) : "ALL");
            }}
          >
            {Object.entries(actorMap).map(([key, label]) => (
              <SelectItem key={key}>{label}</SelectItem>
            ))}
          </Select>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(actorCount).map(([key, count]) => (
            <div
              key={key}
              className="rounded-xl border border-default-200 bg-default-50 p-3"
            >
              <p className="text-xs uppercase tracking-wide text-default-500">
                {actorMap[key]}
              </p>
              <p className="mt-1 text-lg font-semibold text-default-800">
                {count}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-default-200 bg-content1 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-default-700">
              Coordinación de traslados e ingresos
            </h3>
            <p className="mt-1 text-xs text-default-500">
              Solicitudes de bodega con origen/destino y reparto de ingresos por
              orden de compra.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              as={Link}
              href="/erp/compras/bodega"
              size="sm"
              variant="flat"
            >
              Solicitar traslado
            </Button>
            <Button
              as={Link}
              color="primary"
              href="/erp/purchase-orders"
              size="sm"
            >
              Repartir ingresos OC
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
          <Select
            isDisabled={loadingWarehouses || submittingTransferRequest}
            isLoading={loadingWarehouses}
            items={sourceWarehouseOptions}
            label="Bodega origen"
            selectedKeys={
              transferFromWarehouseId
                ? new Set([transferFromWarehouseId])
                : new Set([])
            }
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];

              setTransferFromWarehouseId(first ? String(first) : "");
              setTransferToWarehouseId("");
            }}
          >
            {(row) => (
              <SelectItem
                key={row.id}
              >{`${row.code} - ${row.name}`}</SelectItem>
            )}
          </Select>

          <Select
            isDisabled={!transferFromWarehouseId || submittingTransferRequest}
            items={destinationWarehouseOptions}
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
            {(row) => (
              <SelectItem
                key={row.id}
              >{`${row.code} - ${row.name}`}</SelectItem>
            )}
          </Select>

          <Select
            isDisabled={!transferFromWarehouseId || submittingTransferRequest}
            isLoading={loadingSourceProducts}
            items={sourceProducts}
            label="Item / variante"
            selectedKeys={
              transferStockId ? new Set([transferStockId]) : new Set([])
            }
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];

              setTransferStockId(first ? String(first) : "");
            }}
          >
            {(row) => (
              <SelectItem key={row.stockId}>
                {`${row.itemCode ?? "SIN-COD"} - ${row.itemName ?? "Item"}${row.variantSku ? ` / ${row.variantSku}` : ""} (Disp: ${row.availableQty ?? "0"})`}
              </SelectItem>
            )}
          </Select>

          <Input
            isDisabled={submittingTransferRequest}
            label="Cantidad"
            type="number"
            value={transferQty}
            onValueChange={setTransferQty}
          />

          <Input
            isDisabled={submittingTransferRequest}
            label="Nota (opcional)"
            value={transferNotes}
            onValueChange={setTransferNotes}
          />
        </div>

        <div className="mt-3">
          <Button
            color="primary"
            isDisabled={loadingWarehouses || loadingSourceProducts || submittingTransferRequest}
            onPress={() => void submitTransferRequest()}
          >
            {submittingTransferRequest ? "Creando..." : "Crear solicitud de traslado"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-default-200 bg-content1 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-default-700">
            Órdenes coordinadas
          </h3>
          <Button
            isDisabled={loading}
            variant="flat"
            onPress={() => void load()}
          >
            {loading ? "Cargando..." : "Refrescar"}
          </Button>
        </div>

        <Table aria-label="Órdenes coordinadas">
          <TableHeader>
            <TableColumn>Código</TableColumn>
            <TableColumn>Proveedor</TableColumn>
            <TableColumn>Estado</TableColumn>
            <TableColumn>Vigencia</TableColumn>
            <TableColumn>Total</TableColumn>
          </TableHeader>
          <TableBody
            emptyContent={loading ? "" : "Sin órdenes"}
            items={filteredOrders}
          >
            {(order) => (
              <TableRow key={order.id}>
                <TableCell>{order.purchaseOrderCode ?? "-"}</TableCell>
                <TableCell>{order.supplierName ?? "-"}</TableCell>
                <TableCell>
                  <Chip
                    color={
                      order.status === "FINALIZADA"
                        ? "success"
                        : order.status === "RECHAZADA"
                          ? "danger"
                          : "warning"
                    }
                    size="sm"
                  >
                    {order.status ?? "-"}
                  </Chip>
                </TableCell>
                <TableCell>
                  {order.approvalExpiresAt
                    ? new Date(order.approvalExpiresAt).toLocaleString()
                    : "-"}
                </TableCell>
                <TableCell>
                  {new Intl.NumberFormat("es-CO", {
                    style: "currency",
                    currency: "COP",
                    maximumFractionDigits: 0,
                  }).format(Number(order.total ?? 0))}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-2xl border border-default-200 bg-content1 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-default-700">
          Envíos recientes
        </h3>
        <div className="mt-3 grid gap-2">
          {shipments.slice(0, 8).map((shipment) => (
            <div
              key={shipment.id}
              className="rounded-xl border border-default-200 bg-default-50 px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">
                  {shipment.orderCode} · {shipment.designName}
                </span>
                <Chip
                  color={shipment.isReceived ? "success" : "warning"}
                  size="sm"
                >
                  {shipment.isReceived ? "Recibido" : "Pendiente"}
                </Chip>
              </div>
              <p className="mt-1 text-xs text-default-600">
                {shipment.fromArea} -&gt; {shipment.toArea} · Envía{" "}
                {shipment.sentBy} · Destino {shipment.recipientName ?? "-"}
              </p>
            </div>
          ))}
          {shipments.length === 0 ? (
            <p className="text-sm text-default-500">Sin envíos registrados.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
