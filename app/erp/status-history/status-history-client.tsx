"use client";

import type { Paginated } from "@/app/erp/catalog/_lib/types";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Tabs, Tab } from "@heroui/tabs";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";

import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";
import { formatOrderStatusReason } from "@/src/utils/order-status-reason";

type OrderHistoryRow = {
  id: string;
  orderId: string | null;
  orderCode: string | null;
  status: string | null;
  changedBy: string | null;
  changedByName: string | null;
  reasonCode: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string | null;
};

type ItemHistoryRow = {
  id: string;
  orderItemId: string | null;
  itemName: string | null;
  orderId: string | null;
  orderCode: string | null;
  status: string | null;
  changedBy: string | null;
  changedByName: string | null;
  createdAt: string | null;
};

type TabKey = "orders" | "items";

type ColumnDef = {
  key: string;
  name: string;
};

const orderStatusColors: Record<
  string,
  "default" | "primary" | "success" | "warning" | "danger"
> = {
  PENDIENTE: "warning",
  APROBACION: "primary",
  PRODUCCION: "primary",
  ATRASADO: "danger",
  FINALIZADO: "success",
  ENTREGADO: "success",
  CANCELADO: "default",
};

const itemStatusColors: Record<
  string,
  "default" | "primary" | "success" | "warning" | "danger"
> = {
  PENDIENTE: "warning",
  APROBACION: "primary",
  PENDIENTE_PRODUCCION: "primary",
  APROBACION_ACTUALIZACION: "warning",
  PENDIENTE_PRODUCCION_ACTUALIZACION: "primary",
  MONTAJE: "primary",
  IMPRESION: "primary",
  SUBLIMACION: "primary",
  CORTE_MANUAL: "primary",
  CORTE_LASER: "primary",
  PENDIENTE_CONFECCION: "primary",
  CONFECCION: "primary",
  EN_BODEGA: "primary",
  EMPAQUE: "primary",
  ENVIADO: "success",
  APROBADO_CAMBIO: "success",
  RECHAZADO_CAMBIO: "danger",
  COMPLETADO: "success",
  CANCELADO: "default",
};

function formatStatus(status: string | null | undefined) {
  if (!status) return "-";
  if (status === "APROBACION_ACTUALIZACION") {
    return "APPROVAL UPDATE";
  }
  if (status === "PENDIENTE_PRODUCCION_ACTUALIZACION") {
    return "SCHEDULING UPDATE";
  }

  return status.replace(/_/g, " ");
}

function formatRelative(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");

  return rtf.format(Math.round(diffSec / 86400), "day");
}

export function StatusHistoryClient() {
  const [tab, setTab] = useState<TabKey>("orders");
  const [uiLocale, setUiLocale] = useState<"en" | "es">("en");

  const [orderId, setOrderId] = useState("");
  const [orderItemId, setOrderItemId] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [dataOrders, setDataOrders] =
    useState<Paginated<OrderHistoryRow> | null>(null);
  const [dataItems, setDataItems] = useState<Paginated<ItemHistoryRow> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const readLocale = () => {
      const fromStorage =
        typeof window !== "undefined"
          ? window.localStorage.getItem("preferredLanguage")
          : null;
      const fromCookie =
        typeof document !== "undefined"
          ? document.cookie
              .split(";")
              .map((part) => part.trim())
              .find((part) => part.startsWith("NEXT_LOCALE="))
              ?.split("=")[1] ?? null
          : null;
      const fromHtml =
        typeof document !== "undefined"
          ? document.documentElement.lang
          : null;
      const value = String(fromStorage || fromCookie || fromHtml || "en")
        .trim()
        .toLowerCase();

      setUiLocale(value.startsWith("es") ? "es" : "en");
    };

    readLocale();

    const onLocaleChange = () => readLocale();

    window.addEventListener("viomar:locale-change", onLocaleChange);

    return () => {
      window.removeEventListener("viomar:locale-change", onLocaleChange);
    };
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = String(sp.get("tab") ?? "").trim();
    const oid = String(sp.get("orderId") ?? "").trim();
    const oiid = String(sp.get("orderItemId") ?? "").trim();

    if (t === "items") setTab("items");
    if (oid) setOrderId(oid);
    if (oiid) setOrderItemId(oiid);
  }, []);

  const endpoint = useMemo(() => {
    const sp = new URLSearchParams();

    sp.set("page", String(page));
    sp.set("pageSize", String(pageSize));

    if (tab === "orders") {
      if (orderId.trim()) sp.set("orderId", orderId.trim());

      return `/api/status-history/orders?${sp.toString()}`;
    }

    if (orderItemId.trim()) sp.set("orderItemId", orderItemId.trim());

    return `/api/status-history/order-items?${sp.toString()}`;
  }, [orderId, orderItemId, page, tab]);

  useEffect(() => {
    let active = true;

    setLoading(true);
    apiJson<any>(endpoint)
      .then((res) => {
        if (!active) return;
        if (tab === "orders") setDataOrders(res);
        else setDataItems(res);
      })
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [endpoint, reloadKey, tab]);

  const data = tab === "orders" ? dataOrders : dataItems;
  const maxPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const columns: ColumnDef[] = useMemo(() => {
    if (tab === "orders") {
      return [
        { key: "order", name: "Order" },
        { key: "status", name: "Status" },
        { key: "reason", name: "Reason" },
        { key: "user", name: "User" },
        { key: "date", name: "Date" },
      ];
    }

    return [
      { key: "order", name: "Order" },
      { key: "item", name: "Design" },
      { key: "status", name: "Status" },
      { key: "user", name: "User" },
      { key: "date", name: "Date" },
    ];
  }, [tab]);

  return (
    <div className="space-y-3">
      <Tabs
        aria-label="Status history"
        selectedKey={tab}
        onSelectionChange={(k) => {
          setTab(k as TabKey);
          setPage(1);
        }}
      >
        <Tab key="orders" title="Orders" />
        <Tab key="items" title="Designs" />
      </Tabs>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {tab === "orders" ? (
            <Input
              className="sm:w-96"
              label="Order ID (optional)"
              value={orderId}
              onValueChange={setOrderId}
            />
          ) : (
            <Input
              className="sm:w-96"
              label="Order Item ID (optional)"
              value={orderItemId}
              onValueChange={setOrderItemId}
            />
          )}
        </div>

        <div className="flex gap-2">
          <Button
            isDisabled={loading}
            variant="flat"
            onPress={() => setReloadKey((v) => v + 1)}
          >
            Refresh
          </Button>
        </div>
      </div>

      <Table removeWrapper aria-label="History">
        <TableHeader columns={columns}>
          {(column) => (
            <TableColumn key={column.key}>{column.name}</TableColumn>
          )}
        </TableHeader>
        <TableBody
          emptyContent={loading ? "" : "No history"}
          items={data?.items ?? []}
        >
          {(row: any) => (
            <TableRow key={row.id}>
              {(columnKey) => {
                if (columnKey === "order") {
                  return (
                    <TableCell>{row.orderCode ?? row.orderId ?? "-"}</TableCell>
                  );
                }

                if (columnKey === "item") {
                  return (
                    <TableCell className="text-default-600">
                      {row.itemName ?? row.orderItemId ?? "-"}
                    </TableCell>
                  );
                }

                if (columnKey === "status") {
                  const raw = String(row.status ?? "-");
                  const map =
                    tab === "orders" ? orderStatusColors : itemStatusColors;
                  const color = map[raw] ?? "default";

                  return (
                    <TableCell>
                      <Chip color={color} size="sm" variant="flat">
                        {formatStatus(raw)}
                      </Chip>
                    </TableCell>
                  );
                }

                if (columnKey === "user") {
                  return <TableCell>{row.changedByName ?? "System"}</TableCell>;
                }

                if (columnKey === "reason") {
                  const pairs = [
                    row?.meta?.fromStatus
                      ? `from: ${String(row.meta.fromStatus)}`
                      : null,
                    row?.meta?.toStatus
                      ? `to: ${String(row.meta.toStatus)}`
                      : null,
                    row?.meta?.paidPercent !== undefined &&
                    row?.meta?.paidPercent !== null
                      ? `paid: ${Number(row.meta.paidPercent).toFixed(0)}%`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" • ");

                  return (
                    <TableCell>
                      <div className="text-sm">
                        {formatOrderStatusReason(row.reasonCode, uiLocale)}
                      </div>
                      <div className="text-xs text-default-500">
                        {pairs || "Sin metadatos"}
                      </div>
                    </TableCell>
                  );
                }

                if (columnKey === "date") {
                  return (
                    <TableCell>
                      <div className="text-sm">
                        {formatRelative(row.createdAt)}
                      </div>
                      <div className="text-xs text-default-500">
                        {row.createdAt
                          ? new Date(row.createdAt).toLocaleString()
                          : "-"}
                      </div>
                    </TableCell>
                  );
                }

                return <TableCell>-</TableCell>;
              }}
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="mt-3 flex items-center justify-between text-sm text-default-500">
        <div>
          Page {data?.page ?? page} / {maxPage}
        </div>
        <div className="flex gap-2">
          <Button
            isDisabled={page <= 1 || loading}
            size="sm"
            variant="flat"
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            isDisabled={!data?.hasNextPage || loading}
            size="sm"
            variant="flat"
            onPress={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
