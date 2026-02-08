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
  BsClockHistory,
  BsCreditCard,
  BsPencilSquare,
  BsReceipt,
  BsThreeDotsVertical,
  BsTrash,
  BsWindowStack,
} from "react-icons/bs";

import { apiJson, getErrorMessage } from "../_lib/api";
import { usePaginatedApi } from "../_hooks/use-paginated-api";

import { OrderModal } from "./order-modal";

import { FilterSearch } from "@/app/catalog/_components/ui/filter-search";
import { FilterSelect } from "@/app/catalog/_components/ui/filter-select";
import { Pager } from "@/app/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/catalog/_components/ui/table-skeleton";
import { ConfirmActionModal } from "@/components/confirm-action-modal";

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
}: {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
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
    </div>
  );
}
