"use client";

import type { OrderKind, OrderListItem, Paginated } from "@/app/orders/_lib/types";

import { useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@heroui/modal";
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
  BsArrowRepeat,
  BsClockHistory,
  BsEye,
  BsPencilSquare,
  BsPersonPlus,
  BsThreeDotsVertical,
  BsTrash,
} from "react-icons/bs";
import { ConfectionAssignModal } from "./confection-assign-modal";
import {
  OrderItemStatusModal,
  type OrderItemStatusTarget,
} from "./order-item-status-modal";

import { apiJson, getErrorMessage } from "@/app/orders/_lib/api";

type OrderItemRow = {
  id: string;
  orderId: string | null;
  name: string | null;
  quantity: number;
  unitPrice: string | null;
  totalPrice: string | null;
  imageUrl?: string | null;
  status: OrderItemStatusTarget["status"] | null;
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
}: {
  orderId: string;
  canEdit: boolean;
  canAssign: boolean;
  canChangeStatus: boolean;
  canSeeHistory: boolean;
}) {
  const [order, setOrder] = useState<OrderListItem | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [reloadKey, setReloadKey] = useState(0);

  const [itemsData, setItemsData] = useState<Paginated<OrderItemRow> | null>(
    null,
  );
  const [loadingItems, setLoadingItems] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<OrderItemStatusTarget | null>(
    null,
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<
    Array<{ id: string; status: string | null; changedByName: string | null; createdAt: string | null }>
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

    return `/api/orders/items?${sp.toString()}`;
  }, [orderId, page]);

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
  const canCreate = canEdit && orderKind === "NUEVO";

  const columns: ColumnDef[] = [
    { key: "name", name: "Diseño" },
    { key: "image", name: "Imagen" },
    { key: "statusHistory", name: "Ultimo cambio" },
    { key: "confectionist", name: "Confeccionista" },
    { key: "quantity", name: "Cantidad" },
    { key: "unitPrice", name: "Unit" },
    { key: "totalPrice", name: "Total" },
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

  // creación ahora es en página dedicada

  async function onDelete(id: string) {
    if (!canEdit) return;

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

  function openAssign(id: string) {
    if (!canAssign) return;
    setAssigningId(id);
    setAssignOpen(true);
  }

  function openStatus(item: OrderItemRow) {
    if (!canChangeStatus) return;
    setStatusTarget({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      status: item.status ?? "PENDIENTE",
    });
    setStatusOpen(true);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Diseños</h1>
          <p className="text-sm text-default-500">
            En COMPLETACIÓN/REFERENTE, los diseños se copian del pedido origen.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            as={NextLink}
            href={`/orders/${orderId}/items/new`}
            isDisabled={!canCreate}
            variant="flat"
          >
            Nuevo diseño
          </Button>
          <Button as={NextLink} href="/orders" variant="flat">
            Volver
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Información</div>
            <div className="text-sm text-default-500">
              Pedido: {orderId} {loadingOrder ? "(cargando...)" : null}
              <span className="ml-2">Kind: {orderKind}</span>
            </div>
          </div>
          <Button
            isDisabled={loadingItems}
            size="sm"
            variant="flat"
            onPress={refresh}
          >
            Refrescar
          </Button>
        </CardHeader>
        <CardBody>
          {orderKind === "COMPLETACION" ? (
            <div className="text-sm text-default-500">
              En COMPLETACIÓN el backend solo permite ajustar cantidad y empaque.
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-semibold">Lista</div>
        </CardHeader>
        <CardBody>
          {loadingItems ? <div>Cargando...</div> : null}

          <Table removeWrapper aria-label="Diseños">
            <TableHeader columns={columns}>
              {(column) => (
                <TableColumn key={column.key}>{column.name}</TableColumn>
              )}
            </TableHeader>
            <TableBody emptyContent="Sin diseños" items={rows}>
              {(row) => (
                <TableRow key={row.id}>
                  {(columnKey) => {
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
                                key="assign"
                                isDisabled={!canAssign}
                                startContent={<BsPersonPlus />}
                                onPress={() => openAssign(row.id)}
                              >
                                Asignar
                              </DropdownItem>

                              <DropdownItem
                                key="status"
                                isDisabled={!canChangeStatus}
                                startContent={<BsArrowRepeat />}
                                onPress={() => openStatus(row)}
                              >
                                Cambiar estado
                              </DropdownItem>

                              <DropdownItem
                                key="edit"
                                as={NextLink}
                                href={`/orders/${orderId}/items/${row.id}/edit`}
                                isDisabled={!canEdit}
                                startContent={<BsPencilSquare />}
                              >
                                Editar
                              </DropdownItem>

                              <DropdownItem
                                key="delete"
                                className="text-danger"
                                isDisabled={!canEdit}
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

                    if (columnKey === "confectionist") {
                      return (
                        <TableCell className="text-default-600">
                          {row.confectionistName ?? "-"}
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

                    if (columnKey === "image") {
                      return (
                        <TableCell>
                          {row.imageUrl ? (
                            <img
                              alt="Imagen del diseño"
                              className="h-10 w-10 rounded-small border border-default-200 object-cover"
                              src={row.imageUrl}
                            />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      );
                    }

                    return (
                      <TableCell>{String((row as any)[columnKey] ?? "-")}</TableCell>
                    );
                  }}
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-3 flex items-center justify-between text-sm text-default-500">
            <div>
              Página {itemsData?.page ?? page} /{" "}
              {itemsData
                ? Math.max(1, Math.ceil(itemsData.total / itemsData.pageSize))
                : 1}
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

      <ConfectionAssignModal
        isOpen={assignOpen}
        orderItemId={assigningId}
        onOpenChange={(open) => {
          if (!open) setAssigningId(null);
          setAssignOpen(open);
        }}
        onSaved={() => {
          refresh();
        }}
      />

      <OrderItemStatusModal
        canChangeStatus={canChangeStatus}
        isOpen={statusOpen}
        orderItem={statusTarget}
        onOpenChange={(open) => {
          if (!open) setStatusTarget(null);
          setStatusOpen(open);
        }}
        onSaved={refresh}
      />

      <Modal isOpen={historyOpen} onOpenChange={setHistoryOpen}>
        <ModalContent>
          <ModalHeader>Historial de estado</ModalHeader>
          <ModalBody>
            {historyLoading ? (
              <div className="text-sm text-default-500">Cargando...</div>
            ) : historyItems.length === 0 ? (
              <div className="text-sm text-default-500">Sin cambios.</div>
            ) : (
              <div className="space-y-2 text-sm">
                {historyItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
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
