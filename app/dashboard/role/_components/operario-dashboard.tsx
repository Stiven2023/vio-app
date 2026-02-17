"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import { toast } from "react-hot-toast";

import {
  getAllowedNextStatuses,
  getAllowedStatusesForRole,
} from "@/src/utils/role-status";
import { apiJson, getErrorMessage } from "@/app/orders/_lib/api";
import { Pager } from "@/app/catalog/_components/ui/pager";

type OperarioItem = {
  id: string;
  orderId: string | null;
  orderCode: string | null;
  clientName: string | null;
  name: string | null;
  quantity: number;
  status: string | null;
  imageUrl?: string | null;
  createdAt: string | null;
  confectionistName?: string | null;
  materials?: Array<{
    orderItemId: string | null;
    inventoryItemId: string | null;
    itemName: string | null;
    quantity: string | null;
    note: string | null;
  }>;
};

type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

type ConfectionistLoad = {
  id: string | null;
  name: string | null;
  activeCount: number;
  latestAssigned: string | null;
};

type InventoryEntry = {
  id: string;
  itemName: string | null;
  supplierName: string | null;
  quantity: string | null;
  createdAt: string | null;
};

type InventoryOutput = {
  id: string;
  itemName: string | null;
  orderItemName: string | null;
  quantity: string | null;
  reason: string | null;
  createdAt: string | null;
};

export function OperarioDashboard({ role }: { role: string }) {
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Paginated<OperarioItem> | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<Record<string, string>>({});

  const [confectionLoad, setConfectionLoad] = useState<ConfectionistLoad[]>([]);
  const [loadingLoad, setLoadingLoad] = useState(false);

  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [outputs, setOutputs] = useState<InventoryOutput[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);

  const allowedStatuses = useMemo(() => getAllowedStatusesForRole(role), [role]);

  useEffect(() => {
    let active = true;

    setLoading(true);
    apiJson<Paginated<OperarioItem>>(`/api/dashboard/operario-items?page=${page}`)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page]);

  useEffect(() => {
    let active = true;

    if (role !== "OPERARIO_INTEGRACION") return;

    setLoadingLoad(true);
    apiJson<{ items: ConfectionistLoad[] }>("/api/dashboard/confectionist-load")
      .then((res) => {
        if (active) setConfectionLoad(res.items ?? []);
      })
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => {
        if (active) setLoadingLoad(false);
      });

    return () => {
      active = false;
    };
  }, [role]);

  useEffect(() => {
    let active = true;

    if (role !== "OPERARIO_INVENTARIO") return;

    setLoadingInventory(true);
    Promise.all([
      apiJson<{ items: InventoryEntry[] }>(
        "/api/inventory-entries?page=1&pageSize=5",
      ),
      apiJson<{ items: InventoryOutput[] }>(
        "/api/inventory-outputs?page=1&pageSize=5",
      ),
    ])
      .then(([entriesRes, outputsRes]) => {
        if (!active) return;
        setEntries(entriesRes.items ?? []);
        setOutputs(outputsRes.items ?? []);
      })
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => {
        if (active) setLoadingInventory(false);
      });

    return () => {
      active = false;
    };
  }, [role]);

  const grouped = useMemo(() => {
    const map = new Map<string, { orderCode: string; clientName: string; items: OperarioItem[] }>();

    for (const item of data?.items ?? []) {
      const key = item.orderId ?? "-";
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(key, {
          orderCode: item.orderCode ?? "-",
          clientName: item.clientName ?? "-",
          items: [item],
        });
      }
    }

    return Array.from(map.entries());
  }, [data]);

  const maxLoad = Math.max(
    1,
    ...confectionLoad.map((row) => Number(row.activeCount || 0)),
  );

  const updateStatus = async (itemId: string) => {
    const next = pendingStatus[itemId];
    if (!next) return;
    if (savingId) return;

    try {
      setSavingId(itemId);
      await apiJson(`/api/orders/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify({ status: next }),
      });
      toast.success("Estado actualizado");
      setPendingStatus((prev) => ({ ...prev, [itemId]: "" }));
      setPage(1);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Pedidos en proceso</div>
            <div className="text-sm text-default-500">
              Solo se muestran Diseños en estados permitidos para tu rol.
            </div>
          </div>
          {loading ? <Spinner size="sm" /> : null}
        </CardHeader>
        <CardBody className="space-y-4">
          {grouped.length === 0 && !loading ? (
            <div className="text-sm text-default-500">Sin pedidos pendientes.</div>
          ) : null}
          {grouped.map(([orderId, group]) => (
            <details key={orderId} className="rounded-medium border border-default-200">
              <summary className="cursor-pointer list-none px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm text-default-500">Pedido</div>
                    <div className="font-semibold">{group.orderCode}</div>
                  </div>
                  <div>
                    <div className="text-sm text-default-500">Cliente</div>
                    <div className="font-medium">{group.clientName}</div>
                  </div>
                  <div className="text-xs text-default-400">
                    {group.items.length} Diseños
                  </div>
                </div>
              </summary>
              <div className="border-t border-default-200 px-4 py-4 space-y-4">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-medium border border-default-200 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{item.name ?? "-"}</div>
                        <div className="text-xs text-default-500">
                          Estado: {item.status ?? "-"}
                        </div>
                        <div className="text-xs text-default-500">
                          Cantidad: {item.quantity}
                        </div>
                        {item.confectionistName ? (
                          <div className="text-xs text-default-500">
                            Confeccionista: {item.confectionistName}
                          </div>
                        ) : null}
                      </div>
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name ?? "Diseño"}
                          className="h-16 w-16 rounded-medium object-cover"
                        />
                      ) : null}
                    </div>

                    {item.materials && item.materials.length > 0 ? (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-default-500">
                          Insumos requeridos
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-default-500">
                          {item.materials.map((mat, index) => (
                            <div key={`${mat.inventoryItemId ?? index}`}>-
                              {mat.itemName ?? "Item"} ({mat.quantity ?? "-"})
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <Select
                        aria-label="Estado"
                        className="min-w-[220px]"
                        selectedKeys={
                          pendingStatus[item.id]
                            ? [pendingStatus[item.id]]
                            : item.status
                            ? [item.status]
                            : []
                        }
                        onSelectionChange={(keys) => {
                          const first = Array.from(keys)[0];
                          if (!first) return;
                          setPendingStatus((prev) => ({
                            ...prev,
                            [item.id]: String(first),
                          }));
                        }}
                      >
                        {(getAllowedNextStatuses(role, item.status ?? "")
                          .filter((status) => allowedStatuses.includes(status))
                          .length
                          ? getAllowedNextStatuses(role, item.status ?? "")
                          : item.status
                            ? [item.status]
                            : []
                        ).map((status) => (
                          <SelectItem key={status}>
                            {status.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </Select>
                      <Button
                        size="sm"
                        color="primary"
                        isLoading={savingId === item.id}
                        onPress={() => updateStatus(item.id)}
                      >
                        Actualizar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
          {data ? (
            <Pager
              data={data}
              page={data.page}
              onChange={setPage}
            />
          ) : null}
        </CardBody>
      </Card>

      {role === "OPERARIO_INTEGRACION" ? (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Carga de confeccionistas</div>
              <div className="text-sm text-default-500">
                Pedidos asignados sin finalizar.
              </div>
            </div>
            {loadingLoad ? <Spinner size="sm" /> : null}
          </CardHeader>
          <CardBody className="space-y-3">
            {confectionLoad.length === 0 && !loadingLoad ? (
              <div className="text-sm text-default-500">Sin datos.</div>
            ) : null}
            {confectionLoad.map((row) => {
              const count = Number(row.activeCount || 0);
              const percent = Math.round((count / maxLoad) * 100);

              return (
                <div key={row.id ?? row.name ?? "-"}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{row.name ?? "-"}</span>
                    <span className="text-default-500">{count} pedidos</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-default-200">
                    <div
                      className="h-2 rounded-full bg-success"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      ) : null}

      {role === "OPERARIO_INVENTARIO" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Entradas recientes</div>
                <div className="text-sm text-default-500">Ultimos movimientos.</div>
              </div>
              {loadingInventory ? <Spinner size="sm" /> : null}
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              {entries.length === 0 && !loadingInventory ? (
                <div className="text-default-500">Sin registros.</div>
              ) : null}
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{entry.itemName ?? "Item"}</div>
                    <div className="text-xs text-default-500">
                      {entry.supplierName ?? "Sin proveedor"}
                    </div>
                  </div>
                  <div className="text-default-500">+{entry.quantity ?? "0"}</div>
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Salidas recientes</div>
                <div className="text-sm text-default-500">Ultimos consumos.</div>
              </div>
              {loadingInventory ? <Spinner size="sm" /> : null}
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              {outputs.length === 0 && !loadingInventory ? (
                <div className="text-default-500">Sin registros.</div>
              ) : null}
              {outputs.map((output) => (
                <div key={output.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{output.itemName ?? "Item"}</div>
                    <div className="text-xs text-default-500">
                      {output.orderItemName ?? "Sin Diseño"}
                    </div>
                  </div>
                  <div className="text-default-500">-{output.quantity ?? "0"}</div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
