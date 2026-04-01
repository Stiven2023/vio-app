"use client";

import type {
  CommercialAction,
  OrderHistoryItem,
  OrderListItem,
  OrdersOptions,
  UiLocale,
} from "../_lib/types";

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
  BsHandThumbsUp,
  BsPauseCircle,
  BsReceipt,
  BsThreeDotsVertical,
  BsTrash,
  BsWindowStack,
} from "react-icons/bs";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";

import { apiJson, getErrorMessage } from "../_lib/api";
import {
  getOrderStatusFilterOptions,
  getOrderTypeFilterOptions,
  ORDERS_TAB_COPY,
} from "../_lib/orders-tab.constants";
import {
  calculatePaidPercent,
  canRequestReadyDispatch,
  canTakeCommercialDecision,
  formatOrderCurrency,
  formatOrderDate,
  formatOrderLastUpdate,
  getClientUiLocale,
  resolveDispatchTarget,
} from "../_lib/orders-tab.utils";
import { usePaginatedApi } from "../_hooks/use-paginated-api";

import { OrderModal } from "./order-modal";

import { FilterSearch } from "@/app/erp/catalog/_components/ui/filter-search";
import { FilterSelect } from "@/app/erp/catalog/_components/ui/filter-select";
import { Pager } from "@/app/erp/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import { formatOrderStatusReason } from "@/src/utils/order-status-reason";

export function OrdersTab({
  canCreate,
  canEdit,
  canDelete,
  canChangeStatus,
  canCommercialDecision,
  canSeeHistory,
  isAdvisor,
  advisorEmployeeId,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  canCommercialDecision: boolean;
  canSeeHistory: boolean;
  isAdvisor: boolean;
  advisorEmployeeId: string | null;
}) {
  const [uiLocale, setUiLocale] = useState<UiLocale>("en");

  useEffect(() => {
    const readLocale = () => setUiLocale(getClientUiLocale());

    readLocale();

    const onLocaleChange = () => readLocale();

    window.addEventListener("viomar:locale-change", onLocaleChange);

    return () => {
      window.removeEventListener("viomar:locale-change", onLocaleChange);
    };
  }, []);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const copy = ORDERS_TAB_COPY[uiLocale];
  const statusOptions = useMemo(
    () => getOrderStatusFilterOptions(uiLocale),
    [uiLocale],
  );
  const typeOptions = useMemo(() => getOrderTypeFilterOptions(uiLocale), [uiLocale]);

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
  const [historyItems, setHistoryItems] = useState<OrderHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<OrderListItem | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [readyOpen, setReadyOpen] = useState(false);
  const [readySubmitting, setReadySubmitting] = useState(false);
  const [readyOrder, setReadyOrder] = useState<OrderListItem | null>(null);
  const [commercialOpen, setCommercialOpen] = useState(false);
  const [commercialSubmitting, setCommercialSubmitting] = useState(false);
  const [commercialOrder, setCommercialOrder] = useState<OrderListItem | null>(
    null,
  );
  const [commercialAction, setCommercialAction] =
    useState<CommercialAction>("APPROVE");
  const [commercialNote, setCommercialNote] = useState("");

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
    if (q.trim() !== "" || status !== "all" || type !== "all")
      return copy.emptyResults;

    return copy.emptyOrders;
  }, [copy.emptyOrders, copy.emptyResults, loading, q, status, type]);

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
      toast.success(copy.deleteSuccess);
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
        items: OrderHistoryItem[];
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

  const openCommercialModal = (
    order: OrderListItem,
    action: CommercialAction,
  ) => {
    setCommercialOrder(order);
    setCommercialAction(action);
    setCommercialNote("");
    setCommercialOpen(true);
  };

  const submitCommercialDecision = async () => {
    if (!commercialOrder || commercialSubmitting || !canCommercialDecision)
      return;

    try {
      setCommercialSubmitting(true);

      await apiJson(`/api/orders/${commercialOrder.id}/commercial-approval`, {
        method: "POST",
        body: JSON.stringify({
          action: commercialAction,
          note: commercialNote.trim() || null,
        }),
      });

      toast.success(
        commercialAction === "APPROVE"
          ? copy.commercial.successApprove
          : copy.commercial.successWait,
      );
      setCommercialOpen(false);
      setCommercialOrder(null);
      setCommercialNote("");
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCommercialSubmitting(false);
    }
  };

  const confirmReadyDispatch = async () => {
    if (!readyOrder || readySubmitting || !canChangeStatus) return;

    try {
      setReadySubmitting(true);
      const result = await apiJson<{
        changed: boolean;
        fromStatus: string;
        toStatus: "APROBACION" | "PROGRAMACION" | null;
        reason: string;
      }>(`/api/orders/${readyOrder.id}/request-scheduling`, {
        method: "POST",
      });

      if (!result.toStatus) {
        toast.error(result.reason || copy.readyDispatch.noDestination);

        return;
      }

      toast.success(
        result.toStatus === "PROGRAMACION"
          ? copy.readyDispatch.successToScheduling
          : copy.readyDispatch.successToApproval,
      );

      if (!result.changed && result.reason) {
        toast(result.reason);
      }

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
            placeholder={copy.searchPlaceholder}
            value={q}
            onValueChange={setQ}
          />
          <FilterSelect
            className="sm:w-56"
            label={copy.statusLabel}
            options={statusOptions}
            value={status}
            onChange={setStatus}
          />
          <FilterSelect
            className="sm:w-40"
            label={copy.typeLabel}
            options={typeOptions}
            value={type}
            onChange={setType}
          />
        </div>

        <div className="flex gap-2">
          <Button variant="flat" onPress={refresh}>
            {copy.refresh}
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel={copy.tableAriaLabel}
          headers={copy.tableHeaders}
        />
      ) : (
        <Table aria-label={copy.tableAriaLabel}>
          <TableHeader>
            {copy.tableHeaders.map((header) => (
              <TableColumn key={header}>{header}</TableColumn>
            ))}
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={data?.items ?? []}>
            {(o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.orderCode}</TableCell>
                <TableCell>{o.clientName ?? "-"}</TableCell>
                <TableCell>{o.type}</TableCell>
                <TableCell>{formatOrderDate(o.deliveryDate)}</TableCell>
                <TableCell>{o.status}</TableCell>
                <TableCell className="text-default-600">
                  {(() => {
                    if (!o.lastStatusAt) return "-";
                    const label = formatOrderLastUpdate({
                      id: o.id,
                      status: o.status,
                      changedByName: o.lastStatusBy ?? null,
                      reasonCode: null,
                      meta: null,
                      createdAt: o.lastStatusAt,
                    });

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
                            {copy.history.viewHistory}
                      </Button>
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>{formatOrderCurrency(o.total, o.currency)}</TableCell>
                <TableCell>
                  {(() => {
                    const pct = calculatePaidPercent(o);

                    const toneClass =
                      pct >= 50
                        ? "text-success"
                        : pct >= 30
                          ? "text-warning"
                          : "text-danger";

                    return (
                      <span className={`font-semibold ${toneClass}`}>
                        {pct.toFixed(0)}%
                      </span>
                    );
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
                    <DropdownMenu aria-label={copy.actionsAriaLabel}>
                      <DropdownItem
                        key="items"
                        as={NextLink}
                        href={`/orders/${o.id}/items`}
                        startContent={<BsWindowStack />}
                      >
                        {copy.actions.designs}
                      </DropdownItem>

                      {canAccessOrder(o) ? (
                        <DropdownItem
                          key="detail"
                          as={NextLink}
                          href={`/orders/${o.id}/detail`}
                          startContent={<BsEye />}
                        >
                          {copy.actions.viewDetails}
                        </DropdownItem>
                      ) : null}

                      {canAccessOrder(o) ? (
                        <DropdownItem
                          key="prefactura"
                          as={NextLink}
                          href={`/orders/${o.id}/prefactura`}
                          startContent={<BsReceipt />}
                        >
                          {copy.actions.preInvoice}
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
                          {copy.actions.history}
                        </DropdownItem>
                      ) : null}

                      {canChangeStatus &&
                      canAccessOrder(o) &&
                      canRequestReadyDispatch(o.status) ? (
                        <DropdownItem
                          key="ready-dispatch"
                          startContent={<BsCheck2Circle />}
                          onPress={() => openReadyModal(o)}
                        >
                          {copy.actions.ready}
                        </DropdownItem>
                      ) : null}

                      {canCommercialDecision &&
                      canAccessOrder(o) &&
                      canTakeCommercialDecision(o.status) ? (
                        <DropdownItem
                          key="commercial-approve"
                          startContent={<BsHandThumbsUp />}
                          onPress={() => openCommercialModal(o, "APPROVE")}
                        >
                          {copy.actions.commercialApprove}
                        </DropdownItem>
                      ) : null}

                      {canCommercialDecision &&
                      canAccessOrder(o) &&
                      canTakeCommercialDecision(o.status) ? (
                        <DropdownItem
                          key="commercial-wait"
                          startContent={<BsPauseCircle />}
                          onPress={() =>
                            openCommercialModal(o, "WAIT_FOR_PAYMENT")
                          }
                        >
                          {copy.actions.waitForPayment}
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
                          {copy.actions.delete}
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
        cancelLabel={copy.confirmDelete.cancel}
        confirmLabel={copy.confirmDelete.confirm}
        description={
          pendingDelete
            ? copy.confirmDelete.description(pendingDelete.orderCode)
            : undefined
        }
        isLoading={deletingId === pendingDelete?.id}
        isOpen={confirmOpen}
        title={copy.confirmDelete.title}
        onConfirm={remove}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
          setConfirmOpen(open);
        }}
      />

      <Modal disableAnimation isOpen={historyOpen} onOpenChange={setHistoryOpen}>
        <ModalContent>
          <ModalHeader>{copy.history.title}</ModalHeader>
          <ModalBody>
            {historyLoading ? (
              <div className="text-sm text-default-500">{copy.history.loading}</div>
            ) : historyItems.length === 0 ? (
              <div className="text-sm text-default-500">{copy.history.empty}</div>
            ) : (
              <div className="space-y-2 text-sm">
                {historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{item.status ?? "-"}</div>
                      {item.reasonCode ? (
                        <div className="text-xs text-default-600">
                          {formatOrderStatusReason(item.reasonCode, uiLocale)}
                        </div>
                      ) : null}
                      {item.meta ? (
                        <div className="text-xs text-default-500">
                          {[
                            item.meta.fromStatus
                              ? `${copy.history.from}: ${String(item.meta.fromStatus)}`
                              : null,
                            item.meta.toStatus
                              ? `${copy.history.to}: ${String(item.meta.toStatus)}`
                              : null,
                            item.meta.paidPercent !== undefined &&
                            item.meta.paidPercent !== null
                              ? `${copy.history.paid}: ${Number(item.meta.paidPercent).toFixed(0)}%`
                              : null,
                            item.meta.prefacturaId
                              ? `${copy.history.pref}: ${String(item.meta.prefacturaId)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" • ") || copy.history.noMetadata
                          }
                        </div>
                      ) : null}
                      <div className="text-xs text-default-500">
                        {item.changedByName ?? copy.history.changedBySystem}
                      </div>
                    </div>
                    <div className="text-xs text-default-500">
                      {formatOrderLastUpdate(item)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal
        disableAnimation
        isOpen={readyOpen}
        onOpenChange={(open) => {
          setReadyOpen(open);
          if (!open) setReadyOrder(null);
        }}
      >
        <ModalContent>
          <ModalHeader>{copy.readyDispatch.title}</ModalHeader>
          <ModalBody>
            {(() => {
              if (!readyOrder) {
                return (
                  <div className="text-sm text-default-500">
                    {copy.readyDispatch.selectOrder}
                  </div>
                );
              }

              const total = Number(readyOrder.total ?? 0);
              const shipping = Number(readyOrder.shippingFee ?? 0);
              const paid = Number(readyOrder.paidTotal ?? 0);
              const orderTotal = Math.max(0, total) + Math.max(0, shipping);
              const paidPercent = calculatePaidPercent(readyOrder);
              const target = resolveDispatchTarget(
                readyOrder,
                paidPercent,
                uiLocale,
              );

              return (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-default-500">{copy.readyDispatch.order}:</span>{" "}
                    <strong>{readyOrder.orderCode}</strong>
                  </div>
                  <div>
                    <span className="text-default-500">{copy.readyDispatch.client}:</span>{" "}
                    <strong>{readyOrder.clientName ?? "-"}</strong>
                  </div>
                  <div>
                    <span className="text-default-500">{copy.readyDispatch.currentStatus}:</span>{" "}
                    <strong>{readyOrder.status}</strong>
                  </div>
                  <div>
                    <span className="text-default-500">{copy.readyDispatch.orderTotal}:</span>{" "}
                    <strong>
                      {formatOrderCurrency(orderTotal, readyOrder.currency)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-default-500">{copy.readyDispatch.confirmedPaid}:</span>{" "}
                    <strong>
                      {formatOrderCurrency(Math.max(0, paid), readyOrder.currency)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-default-500">{copy.readyDispatch.paidPercent}:</span>{" "}
                    <strong>{paidPercent.toFixed(0)}%</strong>
                  </div>
                  <div>
                    <span className="text-default-500">{copy.readyDispatch.destination}:</span>{" "}
                    <strong>
                      {target.targetStatus ?? copy.readyDispatch.destinationNotApplicable}
                    </strong>
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
              {copy.readyDispatch.cancel}
            </Button>
            <Button
              color="primary"
              isDisabled={!readyOrder || readySubmitting}
              onPress={confirmReadyDispatch}
            >
              {readySubmitting
                ? copy.readyDispatch.confirming
                : copy.readyDispatch.confirm}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        disableAnimation
        isOpen={commercialOpen}
        onOpenChange={(open) => {
          setCommercialOpen(open);
          if (!open) {
            setCommercialOrder(null);
            setCommercialNote("");
          }
        }}
      >
        <ModalContent>
          <ModalHeader>
            {commercialAction === "APPROVE"
              ? copy.commercial.titleApprove
              : copy.commercial.titleWait}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-default-500">{copy.commercial.order}:</span>{" "}
                <strong>{commercialOrder?.orderCode ?? "-"}</strong>
              </div>
              <div>
                <span className="text-default-500">{copy.commercial.client}:</span>{" "}
                <strong>{commercialOrder?.clientName ?? "-"}</strong>
              </div>
              <div>
                <span className="text-default-500">{copy.commercial.currentStatus}:</span>{" "}
                <strong>{commercialOrder?.status ?? "-"}</strong>
              </div>
              <div className="rounded-medium border border-default-200 bg-default-50 p-2 text-default-700">
                {commercialAction === "APPROVE"
                  ? copy.commercial.bodyApprove
                  : copy.commercial.bodyWait}
              </div>
              <textarea
                className="min-h-24 w-full rounded-medium border border-default-300 bg-content1 px-3 py-2 text-sm outline-none"
                placeholder={copy.commercial.notePlaceholder}
                value={commercialNote}
                onChange={(event) => setCommercialNote(event.target.value)}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setCommercialOpen(false)}>
              {copy.commercial.cancel}
            </Button>
            <Button
              color="primary"
              isDisabled={!commercialOrder || commercialSubmitting}
              onPress={submitCommercialDecision}
            >
              {commercialSubmitting ? copy.commercial.saving : copy.commercial.save}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
