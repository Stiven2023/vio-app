"use client";

import type { OrderListItem, OrdersOptions } from "../_lib/types";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
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
import NextLink from "next/link";
import {
  BsArrowRepeat,
  BsClockHistory,
  BsCreditCard,
  BsEye,
  BsPencilSquare,
  BsReceipt,
  BsThreeDotsVertical,
  BsTrash,
  BsWindowStack,
} from "react-icons/bs";

import { apiJson, getErrorMessage } from "../_lib/api";
import { usePaginatedApi } from "../_hooks/use-paginated-api";

import { OrderModal } from "./order-modal";
import { OrderStatusModal } from "./order-status-modal";

import { FilterSearch } from "@/app/catalog/_components/ui/filter-search";
import { FilterSelect } from "@/app/catalog/_components/ui/filter-select";
import { Pager } from "@/app/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/catalog/_components/ui/table-skeleton";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@heroui/modal";

const statusOptions: Array<{ value: string; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "PRODUCCION", label: "Producción" },
  { value: "ATRASADO", label: "Atrasado" },
  { value: "FINALIZADO", label: "Finalizado" },
  { value: "ENTREGADO", label: "Entregado" },
  { value: "CANCELADO", label: "Cancelado" },
  { value: "REVISION", label: "Revisión" },
];

export function OrdersTab({
  canCreate,
  canEdit,
  canDelete,
  canChangeStatus,
  canSeeHistory,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  canSeeHistory: boolean;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const endpoint = useMemo(() => {
    const sp = new URLSearchParams();

    const query = q.trim();
    if (query) sp.set("q", query);

    if (status !== "all") sp.set("status", status);

    const qs = sp.toString();

    return `/api/orders${qs ? `?${qs}` : ""}`;
  }, [q, status]);

  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<OrderListItem>(endpoint, 10);

  const [options, setOptions] = useState<OrdersOptions>({
    clients: [],
    products: [],
  });
  const [optionsLoading, setOptionsLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrderListItem | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<OrderListItem | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<
    Array<{ id: string; status: string | null; changedByName: string | null; createdAt: string | null }>
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<OrderListItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setOptionsLoading(true);
    apiJson<OrdersOptions>("/api/orders/options")
      .then((res) => {
        if (active) setOptions(res);
      })
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => {
        if (active) setOptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (q.trim() !== "" || status !== "all") return "Sin resultados";

    return "Sin pedidos";
  }, [loading, q, status]);

  const remove = async () => {
    const o = pendingDelete;

    if (!o) return;
    if (deletingId) return;

    setDeletingId(o.id);
    try {
      await apiJson(`/api/orders`, {
        method: "DELETE",
        body: JSON.stringify({ id: o.id }),
      });
      toast.success("Pedido eliminado");
      setConfirmOpen(false);
      setPendingDelete(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const openHistory = async (order: OrderListItem) => {
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
        `/api/status-history/orders?orderId=${encodeURIComponent(order.id)}&page=1&pageSize=50`,
      );
      setHistoryItems(res.items ?? []);
    } catch {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <FilterSearch
            className="sm:w-72"
            placeholder="Buscar por código…"
            value={q}
            onValueChange={setQ}
          />
          <FilterSelect
            className="sm:w-56"
            label="Estado"
            options={statusOptions}
            value={status}
            onChange={setStatus}
          />
        </div>

        <div className="flex gap-2">
          {canCreate ? (
            <Button
              color="primary"
              isDisabled={optionsLoading}
              onPress={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              Crear pedido
            </Button>
          ) : null}
          <Button variant="flat" onPress={refresh}>
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Pedidos"
          headers={[
            "Código",
            "Cliente",
            "Tipo",
            "Estado",
            "Ultimo cambio",
            "Total",
            "Abono %",
            "Acciones",
          ]}
        />
      ) : (
        <Table aria-label="Pedidos">
          <TableHeader>
            <TableColumn>Código</TableColumn>
            <TableColumn>Cliente</TableColumn>
            <TableColumn>Tipo</TableColumn>
            <TableColumn>Estado</TableColumn>
            <TableColumn>Ultimo cambio</TableColumn>
            <TableColumn>Total</TableColumn>
            <TableColumn>Abono %</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={data?.items ?? []}>
            {(o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.orderCode}</TableCell>
                <TableCell>{o.clientName ?? "-"}</TableCell>
                <TableCell>{o.type}</TableCell>
                <TableCell>{o.status}</TableCell>
                <TableCell className="text-default-600">
                  {(() => {
                    if (!o.lastStatusAt) return "-";
                    const date = new Date(o.lastStatusAt);
                    const label = Number.isNaN(date.getTime())
                      ? o.lastStatusAt
                      : date.toLocaleString("es-CO");

                    return o.lastStatusBy
                      ? `${label} · ${o.lastStatusBy}`
                      : label;
                  })()}
                  {canSeeHistory ? (
                    <div>
                      <Button
                        size="sm"
                        variant="light"
                        onPress={() => openHistory(o)}
                      >
                        Ver historial
                      </Button>
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>{o.total ?? "0"}</TableCell>
                <TableCell>
                  {(() => {
                    const total = Number(o.total ?? 0);
                    const shipping = Number(o.shippingFee ?? 0);
                    const denom = total + shipping;
                    const paid = Number(o.paidTotal ?? 0);

                    if (!Number.isFinite(denom) || denom <= 0) return "0%";
                    if (!Number.isFinite(paid) || paid <= 0) return "0%";

                    const pct = Math.min(
                      100,
                      Math.max(0, (paid / denom) * 100),
                    );

                    return `${pct.toFixed(0)}%`;
                  })()}
                </TableCell>
                <TableCell>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        isDisabled={Boolean(deletingId)}
                        size="sm"
                        variant="flat"
                      >
                        <BsThreeDotsVertical />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Acciones">
                      <DropdownItem
                        key="items"
                        as={NextLink}
                        href={`/orders/${o.id}/items`}
                        startContent={<BsWindowStack />}
                      >
                        Diseños
                      </DropdownItem>

                      <DropdownItem
                        key="detail"
                        as={NextLink}
                        href={`/orders/${o.id}/detail`}
                        startContent={<BsEye />}
                      >
                        Ver detalle
                      </DropdownItem>

                      <DropdownItem
                        key="prefactura"
                        as={NextLink}
                        href={`/orders/${o.id}/prefactura`}
                        startContent={<BsReceipt />}
                      >
                        Prefactura
                      </DropdownItem>

                      <DropdownItem
                        key="payments"
                        as={NextLink}
                        href={`/orders/${o.id}/payments`}
                        startContent={<BsCreditCard />}
                      >
                        Pagos
                      </DropdownItem>

                      <DropdownItem
                        key="history"
                        as={NextLink}
                        href={`/status-history?tab=orders&orderId=${encodeURIComponent(
                          o.id,
                        )}`}
                        startContent={<BsClockHistory />}
                      >
                        Historial
                      </DropdownItem>

                      {canChangeStatus ? (
                        <DropdownItem
                          key="status"
                          startContent={<BsArrowRepeat />}
                          onPress={() => {
                            setStatusTarget(o);
                            setStatusModalOpen(true);
                          }}
                        >
                          Cambiar estado
                        </DropdownItem>
                      ) : null}

                      {canEdit ? (
                        <DropdownItem
                          key="edit"
                          startContent={<BsPencilSquare />}
                          onPress={() => {
                            setEditing(o);
                            setModalOpen(true);
                          }}
                        >
                          Editar
                        </DropdownItem>
                      ) : null}

                      {canDelete ? (
                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          startContent={<BsTrash />}
                          onPress={() => {
                            setPendingDelete(o);
                            setConfirmOpen(true);
                          }}
                        >
                          Eliminar
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

      <OrderModal
        canChangeStatus={canChangeStatus}
        isOpen={modalOpen}
        options={options}
        order={editing}
        onOpenChange={setModalOpen}
        onSaved={refresh}
      />

      <OrderStatusModal
        canChangeStatus={canChangeStatus}
        isOpen={statusModalOpen}
        order={statusTarget}
        onOpenChange={(open) => {
          if (!open) setStatusTarget(null);
          setStatusModalOpen(open);
        }}
        onSaved={refresh}
      />

      <ConfirmActionModal
        cancelLabel="Cancelar"
        confirmLabel="Eliminar"
        description={
          pendingDelete ? `¿Eliminar el pedido ${pendingDelete.orderCode}?` : undefined
        }
        isLoading={deletingId === pendingDelete?.id}
        isOpen={confirmOpen}
        title="Confirmar eliminación"
        onConfirm={remove}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
          setConfirmOpen(open);
        }}
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
