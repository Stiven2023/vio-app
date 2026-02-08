"use client";

import type { Paginated } from "@/app/catalog/_lib/types";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Tabs, Tab } from "@heroui/tabs";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";

import { apiJson, getErrorMessage } from "@/app/catalog/_lib/api";

type OrderHistoryRow = {
  id: string;
  orderId: string | null;
  orderCode: string | null;
  status: string | null;
  changedBy: string | null;
  changedByName: string | null;
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

export function StatusHistoryClient() {
  const [tab, setTab] = useState<TabKey>("orders");

  const [orderId, setOrderId] = useState("");
  const [orderItemId, setOrderItemId] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [dataOrders, setDataOrders] = useState<Paginated<OrderHistoryRow> | null>(
    null,
  );
  const [dataItems, setDataItems] = useState<Paginated<ItemHistoryRow> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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

  return (
    <div className="space-y-3">
      <Tabs
        aria-label="Historial de estados"
        selectedKey={tab}
        onSelectionChange={(k) => {
          setTab(k as TabKey);
          setPage(1);
        }}
      >
        <Tab key="orders" title="Pedidos" />
        <Tab key="items" title="Diseños" />
      </Tabs>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {tab === "orders" ? (
            <Input
              className="sm:w-96"
              label="Order ID (opcional)"
              value={orderId}
              onValueChange={setOrderId}
            />
          ) : (
            <Input
              className="sm:w-96"
              label="Order Item ID (opcional)"
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
            Refrescar
          </Button>
        </div>
      </div>

      <Table removeWrapper aria-label="Historial">
        <TableHeader>
          {tab === "orders" ? (
            <>
              <TableColumn>Pedido</TableColumn>
              <TableColumn>Estado</TableColumn>
              <TableColumn>Usuario</TableColumn>
              <TableColumn>Fecha</TableColumn>
            </>
          ) : (
            <>
              <TableColumn>Pedido</TableColumn>
              <TableColumn>Diseño</TableColumn>
              <TableColumn>Estado</TableColumn>
              <TableColumn>Usuario</TableColumn>
              <TableColumn>Fecha</TableColumn>
            </>
          )}
        </TableHeader>
        <TableBody
          emptyContent={loading ? "" : "Sin historial"}
          items={data?.items ?? []}
        >
          {(row: any) => (
            <TableRow key={row.id}>
              {tab === "orders" ? (
                <>
                  <TableCell>{row.orderCode ?? row.orderId ?? "-"}</TableCell>
                  <TableCell>{row.status ?? "-"}</TableCell>
                  <TableCell>{row.changedByName ?? "-"}</TableCell>
                  <TableCell>{row.createdAt ?? "-"}</TableCell>
                </>
              ) : (
                <>
                  <TableCell>{row.orderCode ?? row.orderId ?? "-"}</TableCell>
                  <TableCell className="text-default-600">
                    {row.itemName ?? row.orderItemId ?? "-"}
                  </TableCell>
                  <TableCell>{row.status ?? "-"}</TableCell>
                  <TableCell>{row.changedByName ?? "-"}</TableCell>
                  <TableCell>{row.createdAt ?? "-"}</TableCell>
                </>
              )}
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="mt-3 flex items-center justify-between text-sm text-default-500">
        <div>
          Página {data?.page ?? page} / {maxPage}
        </div>
        <div className="flex gap-2">
          <Button
            isDisabled={page <= 1 || loading}
            size="sm"
            variant="flat"
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <Button
            isDisabled={!data?.hasNextPage || loading}
            size="sm"
            variant="flat"
            onPress={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
