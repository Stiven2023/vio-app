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
  BsCheck2Circle,
  BsClockHistory,
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

import { FilterSearch } from "@/app/erp/catalog/_components/ui/filter-search";
import { FilterSelect } from "@/app/erp/catalog/_components/ui/filter-select";
import { Pager } from "@/app/erp/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";

const statusOptions: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "PENDIENTE", label: "Pending" },
  { value: "APROBACION", label: "Approval" },
  { value: "PROGRAMACION", label: "Scheduling" },
  { value: "PRODUCCION", label: "Production" },
  { value: "ATRASADO", label: "Delayed" },
  { value: "FINALIZADO", label: "Completed" },
  { value: "ENTREGADO", label: "Delivered" },
  { value: "CANCELADO", label: "Canceled" },
];

const typeOptions: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "VN", label: "VN" },
  { value: "VI", label: "VI" },
  { value: "VT", label: "VT" },
  { value: "VW", label: "VW" },
];

export function OrdersTab({
  canCreate,
  canEdit,
  canDelete,
  canChangeStatus,
  canSeeHistory,
  isAdvisor,
  advisorEmployeeId,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  canSeeHistory: boolean;
  isAdvisor: boolean;
  advisorEmployeeId: string | null;
}) {
  const formatCurrency = (value: string | number | null | undefined, currency: string | null | undefined) => {
    const amount = Number(value ?? 0);
    const code = String(currency ?? "COP").toUpperCase() === "USD" ? "USD" : "COP";

    if (!Number.isFinite(amount)) return code === "USD" ? "$0.00" : "$0";

    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");

  const endpoint = useMemo(() => {
    const sp = new URLSearchParams();

    const query = q.trim();
    if (query) sp.set("q", query);

    if (status !== "all") sp.set("status", status);
    if (type !== "all") sp.set("type", type);

    const qs = sp.toString();

    return `/api/orders${qs ? `?${qs}` : ""}`;
  }, [q, status, type]);

  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<OrderListItem>(endpoint, 10);

  const [options, setOptions] = useState<OrdersOptions>({
    clients: [],
    products: [],
  });
  const [optionsLoading, setOptionsLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrderListItem | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<
    Array<{ id: string; status: string | null; changedByName: string | null; createdAt: string | null }>
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<OrderListItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [readyOpen, setReadyOpen] = useState(false);
  const [readySubmitting, setReadySubmitting] = useState(false);
  const [readyOrder, setReadyOrder] = useState<OrderListItem | null>(null);

  const resolveTargetStatus = (
    order: OrderListItem,
    paidPercent: number,
  ): { targetStatus: "APROBACION" | "PROGRAMACION" | null; reason: string } => {
    const currentStatus = String(order.status ?? "").trim().toUpperCase();
    const isPaidAtLeast50 = paidPercent >= 50;

    if (["PROGRAMACION", "PRODUCCION", "ATRASADO", "FINALIZADO", "ENTREGADO", "CANCELADO"].includes(currentStatus)) {
      return {
        targetStatus: null,
        reason: `The order is already in ${currentStatus} and does not require this manual dispatch.`,
      };
    }

    if (isPaidAtLeast50) {
      if (currentStatus === "APROBACION") {
        return {
          targetStatus: "PROGRAMACION",
          reason: "Confirmed advance is 50% or more; it will be sent to Scheduling.",
        };
      }

      return {
        targetStatus: "APROBACION",
        reason: "Although the advance is 50% or more, workflow requires passing through Approval before Scheduling.",
      };
    }

    if (currentStatus === "APROBACION") {
      return {
        targetStatus: null,
        reason: "The order is already in Approval. When it meets the rules you can send it to Scheduling.",
      };
    }

    return {
      targetStatus: "APROBACION",
      reason: "With confirmed advance below 50%, the order should be sent to Approval.",
    };
  };

  const canAccessOrder = (order: OrderListItem) => {
    if (!isAdvisor) return true;
    if (!advisorEmployeeId) return false;
    return order.createdBy === advisorEmployeeId;
  };

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
    if (q.trim() !== "" || status !== "all" || type !== "all") return "No results";

    return "No orders";
  }, [loading, q, status, type]);

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
      toast.success("Order disabled");
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

  const openReadyModal = (order: OrderListItem) => {
    setReadyOrder(order);
    setReadyOpen(true);
  };

  const confirmReadyDispatch = async () => {
    if (!readyOrder || readySubmitting || !canChangeStatus) return;

    const total = Number(readyOrder.total ?? 0);
    const shipping = Number(readyOrder.shippingFee ?? 0);
    const paid = Number(readyOrder.paidTotal ?? 0);
    const denominator = Math.max(0, total) + Math.max(0, shipping);
    const paidPercent = denominator > 0 ? Math.max(0, (paid / denominator) * 100) : 0;
    const target = resolveTargetStatus(readyOrder, paidPercent);

    if (!target.targetStatus) {
      toast.error(target.reason);
      return;
    }

    try {
      setReadySubmitting(true);
      await apiJson("/api/orders", {
        method: "PUT",
        body: JSON.stringify({ id: readyOrder.id, status: target.targetStatus }),
      });

      toast.success(
        target.targetStatus === "PROGRAMACION"
          ? "Order sent to Scheduling"
          : "Order sent to Approval",
      );
      setReadyOpen(false);
      setReadyOrder(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setReadySubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <FilterSearch
            className="sm:w-72"
            placeholder="Search by code..."
            value={q}
            onValueChange={setQ}
          />
          <FilterSelect
            className="sm:w-56"
            label="Status"
            options={statusOptions}
            value={status}
            onChange={setStatus}
          />
          <FilterSelect
            className="sm:w-40"
            label="Type"
            options={typeOptions}
            value={type}
            onChange={setType}
          />
        </div>

        <div className="flex gap-2">
          <Button variant="flat" onPress={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Orders"
          headers={[
            "Code",
            "Client",
            "Type",
            "Status",
            "Last update",
            "Total",
            "Paid %",
            "Actions",
          ]}
        />
      ) : (
        <Table aria-label="Orders">
          <TableHeader>
            <TableColumn>Code</TableColumn>
            <TableColumn>Client</TableColumn>
            <TableColumn>Type</TableColumn>
            <TableColumn>Status</TableColumn>
            <TableColumn>Last update</TableColumn>
            <TableColumn>Total</TableColumn>
            <TableColumn>Paid %</TableColumn>
            <TableColumn>Actions</TableColumn>
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
                        View history
                      </Button>
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>{formatCurrency(o.total, o.currency)}</TableCell>
                <TableCell>
                  {(() => {
                    const total = Number(o.total ?? 0);
                    const shipping = Number(o.shippingFee ?? 0);
                    const denom = total + shipping;
                    const paid = Number(o.paidTotal ?? 0);

                    if (!Number.isFinite(denom) || denom <= 0) {
                      return <span className="font-semibold text-danger">0%</span>;
                    }

                    if (!Number.isFinite(paid) || paid <= 0) {
                      return <span className="font-semibold text-danger">0%</span>;
                    }

                    const pct = Math.min(
                      100,
                      Math.max(0, (paid / denom) * 100),
                    );

                    const toneClass =
                      pct >= 50
                        ? "text-success"
                        : pct >= 30
                          ? "text-warning"
                          : "text-danger";

                    return <span className={`font-semibold ${toneClass}`}>{pct.toFixed(0)}%</span>;
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
                        Designs
                      </DropdownItem>

                      {canAccessOrder(o) ? (
                        <DropdownItem
                        key="detail"
                        as={NextLink}
                        href={`/orders/${o.id}/detail`}
                        startContent={<BsEye />}
                        >
                          View details
                        </DropdownItem>
                      ) : null}

                      {canAccessOrder(o) ? (
                        <DropdownItem
                        key="prefactura"
                        as={NextLink}
                        href={`/orders/${o.id}/prefactura`}
                        startContent={<BsReceipt />}
                        >
                          Pre-invoice
                        </DropdownItem>
                      ) : null}

                      {canAccessOrder(o) ? (
                        <DropdownItem
                        key="history"
                        as={NextLink}
                        href={`/status-history?tab=orders&orderId=${encodeURIComponent(
                          o.id,
                        )}`}
                        startContent={<BsClockHistory />}
                        >
                          History
                        </DropdownItem>
                      ) : null}

                      {canEdit && canAccessOrder(o) ? (
                        <DropdownItem
                          key="edit"
                          startContent={<BsPencilSquare />}
                          onPress={() => {
                            setEditing(o);
                            setModalOpen(true);
                          }}
                        >
                          Edit
                        </DropdownItem>
                      ) : null}

                      {canChangeStatus && canAccessOrder(o) ? (
                        <DropdownItem
                          key="ready-dispatch"
                          startContent={<BsCheck2Circle />}
                          onPress={() => openReadyModal(o)}
                        >
                          Order / designs ready
                        </DropdownItem>
                      ) : null}

                      {canDelete && canAccessOrder(o) ? (
                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          startContent={<BsTrash />}
                          onPress={() => {
                            setPendingDelete(o);
                            setConfirmOpen(true);
                          }}
                        >
                          Delete
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
        cancelLabel="Cancel"
        confirmLabel="Delete"
        description={
          pendingDelete ? `Delete order ${pendingDelete.orderCode}?` : undefined
        }
        isLoading={deletingId === pendingDelete?.id}
        isOpen={confirmOpen}
        title="Confirm deletion"
        onConfirm={remove}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
          setConfirmOpen(open);
        }}
      />

      <Modal isOpen={historyOpen} onOpenChange={setHistoryOpen}>
        <ModalContent>
          <ModalHeader>Status history</ModalHeader>
          <ModalBody>
            {historyLoading ? (
              <div className="text-sm text-default-500">Loading...</div>
            ) : historyItems.length === 0 ? (
              <div className="text-sm text-default-500">No changes.</div>
            ) : (
              <div className="space-y-2 text-sm">
                {historyItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{item.status ?? "-"}</div>
                      <div className="text-xs text-default-500">
                        {item.changedByName ?? "System"}
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

      <Modal
        isOpen={readyOpen}
        onOpenChange={(open) => {
          setReadyOpen(open);
          if (!open) setReadyOrder(null);
        }}
      >
        <ModalContent>
          <ModalHeader>Confirm order dispatch</ModalHeader>
          <ModalBody>
            {(() => {
              if (!readyOrder) {
                return (
                  <div className="text-sm text-default-500">Select an order to continue.</div>
                );
              }

              const total = Number(readyOrder.total ?? 0);
              const shipping = Number(readyOrder.shippingFee ?? 0);
              const paid = Number(readyOrder.paidTotal ?? 0);
              const orderTotal = Math.max(0, total) + Math.max(0, shipping);
              const paidPercent = orderTotal > 0 ? Math.max(0, (paid / orderTotal) * 100) : 0;
              const target = resolveTargetStatus(readyOrder, paidPercent);

              return (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-default-500">Order:</span>{" "}
                    <strong>{readyOrder.orderCode}</strong>
                  </div>
                  <div>
                    <span className="text-default-500">Client:</span>{" "}
                    <strong>{readyOrder.clientName ?? "-"}</strong>
                  </div>
                  <div>
                    <span className="text-default-500">Current status:</span>{" "}
                    <strong>{readyOrder.status}</strong>
                  </div>
                  <div>
                    <span className="text-default-500">Order total:</span>{" "}
                    <strong>{formatCurrency(orderTotal, readyOrder.currency)}</strong>
                  </div>
                  <div>
                    <span className="text-default-500">Confirmed paid:</span>{" "}
                    <strong>{formatCurrency(Math.max(0, paid), readyOrder.currency)}</strong>
                  </div>
                  <div>
                    <span className="text-default-500">Paid percentage:</span>{" "}
                    <strong>{paidPercent.toFixed(0)}%</strong>
                  </div>
                  <div>
                    <span className="text-default-500">Destination:</span>{" "}
                    <strong>{target.targetStatus ?? "Not applicable"}</strong>
                  </div>
                  <div className="rounded-medium border border-default-200 bg-default-50 p-2 text-default-700">
                    {target.reason}
                  </div>
                </div>
              );
            })()}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setReadyOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={!readyOrder || readySubmitting}
              isLoading={readySubmitting}
              onPress={confirmReadyDispatch}
            >
              Confirm dispatch
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
