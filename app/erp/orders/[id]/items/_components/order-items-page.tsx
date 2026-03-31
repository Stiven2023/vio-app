"use client";

import type {
  OrderKind,
  OrderListItem,
  Paginated,
} from "@/app/erp/orders/_lib/types";

import { useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Skeleton } from "@heroui/skeleton";
import { Select, SelectItem } from "@heroui/select";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/modal";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import {
  BsClockHistory,
  BsEye,
  BsPencilSquare,
  BsThreeDotsVertical,
  BsTrash,
} from "react-icons/bs";

import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";

type OrderItemRow = {
  id: string;
  orderId: string | null;
  name: string | null;
  designNumber?: number | null;
  quantity: number;
  unitPrice: string | null;
  totalPrice: string | null;
  hasAdditions?: boolean | null;
  additionEvidence?: string | null;
  imageUrl?: string | null;
  status: string | null;
  lastStatusAt?: string | null;
  lastStatusBy?: string | null;
  confectionistName?: string | null;
  createdAt: string | null;
};

type ColumnDef = {
  key: string;
  name: string;
};

export function OrderItemsPage({
  orderId,
  canEdit,
  canAssign,
  canChangeStatus,
  canSeeHistory,
  isAdvisor,
  advisorEmployeeId,
}: {
  orderId: string;
  canEdit: boolean;
  canAssign: boolean;
  canChangeStatus: boolean;
  canSeeHistory: boolean;
  isAdvisor: boolean;
  advisorEmployeeId: string | null;
}) {
  const [order, setOrder] = useState<OrderListItem | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [reloadKey, setReloadKey] = useState(0);
  const [additionsFilter, setAdditionsFilter] = useState<
    "ALL" | "WITH" | "WITHOUT"
  >("ALL");

  const [itemsData, setItemsData] = useState<Paginated<OrderItemRow> | null>(
    null,
  );
  const [loadingItems, setLoadingItems] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<
    Array<{
      id: string;
      status: string | null;
      changedByName: string | null;
      createdAt: string | null;
    }>
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    let active = true;

    setLoadingOrder(true);
    apiJson<OrderListItem>(`/api/orders/${orderId}`)
      .then((o) => {
        if (active) setOrder(o);
      })
      .catch(() => {
        if (active) setOrder(null);
      })
      .finally(() => {
        if (active) setLoadingOrder(false);
      });

    return () => {
      active = false;
    };
  }, [orderId]);

  const endpoint = useMemo(() => {
    const sp = new URLSearchParams();

    sp.set("orderId", orderId);
    sp.set("page", String(page));
    sp.set("pageSize", String(pageSize));
    if (additionsFilter !== "ALL") {
      sp.set("hasAdditions", additionsFilter === "WITH" ? "with" : "without");
    }

    return `/api/orders/items?${sp.toString()}`;
  }, [orderId, page, additionsFilter]);

  useEffect(() => {
    let active = true;

    setLoadingItems(true);
    apiJson<Paginated<OrderItemRow>>(endpoint)
      .then((res) => {
        if (active) setItemsData(res);
      })
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => {
        if (active) setLoadingItems(false);
      });

    return () => {
      active = false;
    };
  }, [endpoint, reloadKey]);

  function refresh() {
    setReloadKey((v) => v + 1);
  }

  const orderKind: OrderKind = order?.kind ?? "NUEVO";
  const canAccessOrder =
    !isAdvisor ||
    (Boolean(advisorEmployeeId) && order?.createdBy === advisorEmployeeId);
  const effectiveCanEdit = canEdit && canAccessOrder;

  // Bloquear modificaciones desde PRODUCCION (montaje) en adelante
  const MONTAJE_LOCKED: Array<string> = [
    "PRODUCCION",
    "ATRASADO",
    "FINALIZADO",
    "ENTREGADO",
    "CANCELADO",
  ];
  const isOrderLocked = MONTAJE_LOCKED.includes(order?.status ?? "");
  const canModify = effectiveCanEdit && !isOrderLocked;

  const columns: ColumnDef[] = [
    { key: "designNum", name: "#" },
    { key: "name", name: "Descripción" },
    { key: "status", name: "Estado" },
    { key: "statusHistory", name: "Último cambio" },
    { key: "quantity", name: "Cantidad" },
    { key: "additions", name: "Adiciones" },
    { key: "actions", name: "Acciones" },
  ];

  const formatHistory = (value?: string | null, by?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    const label = Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString("es-CO");

    return by ? `${label} · ${by}` : label;
  };

  async function onDelete(id: string) {
    if (!canModify) return;

    const ok = window.confirm("¿Eliminar este diseño?");

    if (!ok) return;

    try {
      const res = await fetch(`/api/orders/items/${id}`, { method: "DELETE" });

      if (!res.ok) throw new Error(await res.text());
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }


  async function openHistory(itemId: string) {
    if (!canSeeHistory) return;
    setHistoryOpen(true);
    setHistoryLoading(true);

    try {
      const res = await apiJson<{
        items: Array<{
          id: string;
          status: string | null;
          changedByName: string | null;
          createdAt: string | null;
        }>;
      }>(
        `/api/status-history/order-items?orderItemId=${encodeURIComponent(itemId)}&page=1&pageSize=50`,
      );

      setHistoryItems(res.items ?? []);
    } catch (e) {
      toast.error(getErrorMessage(e));
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  const rows = itemsData?.items ?? [];
  const skeletonRows = Array.from({ length: 6 }, (_, index) => ({
    id: `skeleton-${index}`,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Diseños</h1>
          <p className="text-sm text-default-500">
            {isOrderLocked
              ? "Pedido en montaje o superior. Los diseños no pueden modificarse."
              : "Consulta y gestión de diseños del pedido."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            as={NextLink}
            href={`/orders/${orderId}/items/new`}
            isDisabled={!canModify}
            color="primary"
          >
            Crear nuevo diseño
          </Button>
          <Button as={NextLink} href="/orders" variant="flat">
            Volver
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="font-semibold">Información</div>
            {loadingOrder ? (
              <div className="mt-2 space-y-2">
                <Skeleton className="h-4 w-48 rounded-medium" />
                <Skeleton className="h-3 w-36 rounded-medium" />
              </div>
            ) : (
              <div className="text-sm text-default-500">
                Pedido: {order?.orderCode ?? orderId}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isClient ? (
              <Select
                className="w-52"
                label="Filtro adiciones"
                selectedKeys={[additionsFilter]}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0] as
                    | "ALL"
                    | "WITH"
                    | "WITHOUT"
                    | undefined;
                  const next = first ?? "ALL";

                  setAdditionsFilter(next);
                  setPage(1);
                }}
              >
                <SelectItem key="ALL">Todos</SelectItem>
                <SelectItem key="WITH">Con adiciones</SelectItem>
                <SelectItem key="WITHOUT">Sin adiciones</SelectItem>
              </Select>
            ) : (
              <div className="h-14 w-52 rounded-xl border border-default-200 bg-content1" />
            )}
            <Button
              isDisabled={loadingItems}
              size="sm"
              variant="flat"
              onPress={refresh}
            >
              Refrescar
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {orderKind === "COMPLETACION" ? (
            <div className="text-sm text-default-500">
              En COMPLETACIÓN el backend solo permite ajustar cantidad y
              empaque.
            </div>
          ) : null}
          {isOrderLocked ? (
            <div className="text-sm text-warning">
              El pedido está en montaje o superior. No se permiten
              modificaciones de diseño.
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-semibold">Lista</div>
        </CardHeader>
        <CardBody>
          <Table removeWrapper aria-label="Diseños">
            <TableHeader columns={columns}>
              {(column) => (
                <TableColumn key={column.key}>{column.name}</TableColumn>
              )}
            </TableHeader>
            {loadingItems ? (
              <TableBody items={skeletonRows}>
                {(row) => (
                  <TableRow key={row.id}>
                    {(columnKey) => {
                      if (columnKey === "designNum") {
                        return (
                          <TableCell>
                            <Skeleton className="h-4 w-10 rounded-medium" />
                          </TableCell>
                        );
                      }

                      if (columnKey === "name") {
                        return (
                          <TableCell>
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-40 rounded-medium" />
                              <Skeleton className="h-3 w-24 rounded-medium" />
                            </div>
                          </TableCell>
                        );
                      }

                      if (columnKey === "statusHistory") {
                        return (
                          <TableCell>
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-36 rounded-medium" />
                              <Skeleton className="h-8 w-24 rounded-medium" />
                            </div>
                          </TableCell>
                        );
                      }

                      if (columnKey === "actions") {
                        return (
                          <TableCell>
                            <Skeleton className="h-8 w-10 rounded-medium" />
                          </TableCell>
                        );
                      }

                      return (
                        <TableCell>
                          <Skeleton className="h-4 w-24 rounded-medium" />
                        </TableCell>
                      );
                    }}
                  </TableRow>
                )}
              </TableBody>
            ) : (
              <TableBody emptyContent="Sin diseños" items={rows}>
                {(row) => (
                  <TableRow key={row.id}>
                    {(columnKey) => {
                      const rowIndex = rows.indexOf(row);
                      const designNum = (page - 1) * pageSize + rowIndex + 1;

                      if (columnKey === "designNum") {
                        return (
                          <TableCell>
                            <span className="text-xs font-mono font-semibold text-default-500">
                              D{designNum}
                            </span>
                          </TableCell>
                        );
                      }

                      if (columnKey === "actions") {
                        return (
                          <TableCell>
                            <Dropdown>
                              <DropdownTrigger>
                                <Button size="sm" variant="flat">
                                  <BsThreeDotsVertical />
                                </Button>
                              </DropdownTrigger>
                              <DropdownMenu aria-label="Acciones">
                                <DropdownItem
                                  key="history"
                                  as={NextLink}
                                  href={`/status-history?tab=items&orderItemId=${encodeURIComponent(
                                    row.id,
                                  )}`}
                                  startContent={<BsClockHistory />}
                                >
                                  Historial
                                </DropdownItem>

                                <DropdownItem
                                  key="detail"
                                  as={NextLink}
                                  href={`/orders/${orderId}/items/${row.id}`}
                                  startContent={<BsEye />}
                                >
                                  Ver detalle
                                </DropdownItem>

                                <DropdownItem
                                  key="edit"
                                  as={NextLink}
                                  href={`/orders/${orderId}/items/${row.id}/edit`}
                                  isDisabled={!canModify}
                                  startContent={<BsPencilSquare />}
                                >
                                  Editar
                                </DropdownItem>

                                <DropdownItem
                                  key="delete"
                                  className="text-danger"
                                  isDisabled={!canModify}
                                  startContent={<BsTrash />}
                                  onPress={() => onDelete(row.id)}
                                >
                                  Eliminar
                                </DropdownItem>
                              </DropdownMenu>
                            </Dropdown>
                          </TableCell>
                        );
                      }

                      if (columnKey === "name") {
                        return <TableCell>{String(row.name ?? "-")}</TableCell>;
                      }

                      if (columnKey === "status") {
                        return (
                          <TableCell className="text-default-600">
                            {row.status ?? "-"}
                          </TableCell>
                        );
                      }

                      if (columnKey === "statusHistory") {
                        return (
                          <TableCell className="text-default-600">
                            {formatHistory(row.lastStatusAt, row.lastStatusBy)}
                            {canSeeHistory ? (
                              <div>
                                <Button
                                  size="sm"
                                  variant="light"
                                  onPress={() => openHistory(row.id)}
                                >
                                  Ver historial
                                </Button>
                              </div>
                            ) : null}
                          </TableCell>
                        );
                      }

                      if (columnKey === "additions") {
                        return (
                          <TableCell>
                            {row.hasAdditions
                              ? String(row.additionEvidence ?? "Sí").trim() ||
                                "Sí"
                              : "No"}
                          </TableCell>
                        );
                      }

                      return (
                        <TableCell>
                          {String((row as any)[columnKey] ?? "-")}
                        </TableCell>
                      );
                    }}
                  </TableRow>
                )}
              </TableBody>
            )}
          </Table>

          <div className="mt-3 flex items-center justify-between text-sm text-default-500">
            <div>
              {loadingItems ? (
                <Skeleton className="h-4 w-28 rounded-medium" />
              ) : (
                <>
                  Página {itemsData?.page ?? page} /{" "}
                  {itemsData
                    ? Math.max(1, Math.ceil(itemsData.total / itemsData.pageSize))
                    : 1}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                isDisabled={page <= 1 || loadingItems}
                size="sm"
                variant="flat"
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                isDisabled={!itemsData?.hasNextPage || loadingItems}
                size="sm"
                variant="flat"
                onPress={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Modal isOpen={historyOpen} onOpenChange={setHistoryOpen}>
        <ModalContent>
          <ModalHeader>Historial de estado</ModalHeader>
          <ModalBody>
            {historyLoading ? (
              <div className="space-y-3 py-1">
                {Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={`history-skeleton-${index}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28 rounded-medium" />
                      <Skeleton className="h-3 w-20 rounded-medium" />
                    </div>
                    <Skeleton className="h-3 w-24 rounded-medium" />
                  </div>
                ))}
              </div>
            ) : historyItems.length === 0 ? (
              <div className="text-sm text-default-500">Sin cambios.</div>
            ) : (
              <div className="space-y-2 text-sm">
                {historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{item.status ?? "-"}</div>
                      <div className="text-xs text-default-500">
                        {item.changedByName ?? "Sistema"}
                      </div>
                    </div>
                    <div className="text-xs text-default-500">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleString("es-CO")
                        : "-"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
