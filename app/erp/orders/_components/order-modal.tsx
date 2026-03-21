"use client";

import type {
  OrderInput,
  OrderListItem,
  OrdersOptions,
  OrderStatus,
  OrderType,
  OrderKind,
} from "../_lib/types";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";

import { apiJson, getErrorMessage } from "../_lib/api";

import { ConfirmActionModal } from "@/components/confirm-action-modal";
import {
  calculateOrderPaymentPercent,
  getAllowedNextOrderStatuses,
  requiresApprovalBeforeProgramming,
} from "@/src/utils/order-workflow";

const orderTypes: Array<{ value: OrderType; label: string }> = [
  { value: "VN", label: "VN" },
  { value: "VI", label: "VI" },
  { value: "VT", label: "VT" },
  { value: "VW", label: "VW" },
];

const orderKinds: Array<{ value: OrderKind; label: string }> = [
  { value: "NUEVO", label: "New" },
  { value: "COMPLETACION", label: "Completion" },
  { value: "REFERENTE", label: "Referent" },
];

const orderStatuses: Array<{ value: OrderStatus; label: string }> = [
  { value: "PENDIENTE", label: "PENDIENTE" },
  { value: "APROBACION", label: "APROBACION" },
  { value: "PROGRAMACION", label: "PROGRAMACION" },
  { value: "PRODUCCION", label: "PRODUCCION" },
  { value: "ATRASADO", label: "ATRASADO" },
  { value: "FINALIZADO", label: "FINALIZADO" },
  { value: "ENTREGADO", label: "ENTREGADO" },
  { value: "CANCELADO", label: "CANCELADO" },
];

const currencies = ["COP", "USD"] as const;

type FormState = {
  clientId: string;
  type: OrderType;
  kind: OrderKind;
  sourceOrderCode: string;
  provisionalCode: string;
  status: OrderStatus;
  currency: string;
  discount: string;
  shippingFee: string;
  ivaEnabled: boolean;
};

function toNumberString(v: string) {
  const s = String(v ?? "").trim();

  if (!s) return "";
  const n = Number(s);

  return Number.isNaN(n) ? "" : String(n);
}

function toPercentString(v: string) {
  const s = String(v ?? "").trim();

  if (!s) return "";
  const n = Number(s);

  if (!Number.isFinite(n)) return "";

  const clamped = Math.min(100, Math.max(0, n));

  return String(clamped);
}

export function OrderModal({
  order,
  options,
  canChangeStatus,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  order: OrderListItem | null;
  options: OrdersOptions;
  canChangeStatus: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    clientId: "",
    type: "VN",
    kind: "NUEVO",
    sourceOrderCode: "",
    provisionalCode: "",
    status: "PENDIENTE",
    currency: "COP",
    discount: "0",
    shippingFee: "0",
    ivaEnabled: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [approvalFallbackOpen, setApprovalFallbackOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setSubmitting(false);
    setApprovalFallbackOpen(false);
    setForm({
      clientId: order?.clientId ?? "",
      type: (order?.type ?? "VN") as OrderType,
      kind: (order?.kind ?? "NUEVO") as OrderKind,
      sourceOrderCode: order?.sourceOrderCode ?? "",
      provisionalCode: order?.provisionalCode ?? "",
      status: (order?.status ?? "PENDIENTE") as OrderStatus,
      currency: order?.currency ?? "COP",
      discount: order?.discount ?? "0",
      shippingFee: order?.shippingFee ?? "0",
      ivaEnabled: Boolean(order?.ivaEnabled ?? false),
    });
  }, [isOpen, order]);

  const paymentPercent = calculateOrderPaymentPercent({
    total: order?.total,
    shippingFee: order?.shippingFee,
    paidTotal: order?.paidTotal,
  });

  const allowedStatuses = order
    ? [order.status, ...getAllowedNextOrderStatuses(order.status)].filter(
        (value, index, array) => array.indexOf(value) === index,
      )
    : ["PENDIENTE", "APROBACION"];

  const submitPayload = async (forcedStatus?: OrderStatus) => {
    const needsSource =
      form.kind === "COMPLETACION" || form.kind === "REFERENTE";

    if (needsSource && !form.sourceOrderCode.trim()) {
      toast.error("Source order code is required");

      return;
    }

    const discountPercent = form.discount ? Number(form.discount) : 0;
    const shippingFee = form.shippingFee ? Number(form.shippingFee) : 0;

    if (!Number.isFinite(shippingFee) || shippingFee < 0) {
      toast.error("Shipping fee must be a number greater than or equal to 0");

      return;
    }

    if (
      !Number.isFinite(discountPercent) ||
      discountPercent < 0 ||
      discountPercent > 100
    ) {
      toast.error("Discount must be a percentage between 0 and 100");

      return;
    }

    const payload: OrderInput = {
      clientId: form.clientId ? form.clientId : undefined,
      type: form.type,
      kind: form.kind,
      sourceOrderCode: needsSource ? form.sourceOrderCode.trim() : undefined,
      provisionalCode: form.provisionalCode.trim() || undefined,
      status: forcedStatus ?? form.status,
      ivaEnabled: form.ivaEnabled,
      discount: toPercentString(form.discount) || "0",
      currency: form.currency || "COP",
      shippingFee: toNumberString(form.shippingFee) || "0",
    };

    try {
      setSubmitting(true);
      await apiJson(`/api/orders`, {
        method: order ? "PUT" : "POST",
        body: JSON.stringify(order ? { id: order.id, ...payload } : payload),
      });
      toast.success(order ? "Order updated" : "Order created");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (submitting) return;

    if (
      order &&
      form.status === "PROGRAMACION" &&
      requiresApprovalBeforeProgramming(paymentPercent)
    ) {
      setApprovalFallbackOpen(true);

      return;
    }

    await submitPayload();
  };

  return (
    <>
      <Modal isOpen={isOpen} size="3xl" onOpenChange={onOpenChange}>
        <ModalContent>
          <ModalHeader>{order ? "Edit order" : "Create order"}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {order ? (
                <Input isReadOnly label="Code" value={order.orderCode} />
              ) : null}

              <Select
                label="Client"
                selectedKeys={form.clientId ? [form.clientId] : []}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0];

                  setForm((s) => ({ ...s, clientId: String(first ?? "") }));
                }}
              >
                {options.clients.map((c) => (
                  <SelectItem key={c.id}>{c.name}</SelectItem>
                ))}
              </Select>

              <Select
                label="Type"
                selectedKeys={[form.type]}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0];

                  setForm((s) => ({
                    ...s,
                    type: (first as OrderType) ?? "VN",
                  }));
                }}
              >
                {orderTypes.map((t) => (
                  <SelectItem key={t.value}>{t.label}</SelectItem>
                ))}
              </Select>

              <Select
                label="Order type"
                selectedKeys={[form.kind]}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0] as OrderKind | undefined;
                  const next = first ?? "NUEVO";

                  setForm((s) => ({
                    ...s,
                    kind: next,
                    sourceOrderCode: next === "NUEVO" ? "" : s.sourceOrderCode,
                  }));
                }}
              >
                {orderKinds.map((k) => (
                  <SelectItem key={k.value}>{k.label}</SelectItem>
                ))}
              </Select>

              {form.kind === "COMPLETACION" || form.kind === "REFERENTE" ? (
                <Input
                  label="Source order code"
                  value={form.sourceOrderCode}
                  onValueChange={(v) =>
                    setForm((s) => ({ ...s, sourceOrderCode: v }))
                  }
                />
              ) : null}

              <Input
                description="Optional. Used to identify the order before operational approval."
                label="Provisional code"
                value={form.provisionalCode}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, provisionalCode: v }))
                }
              />

              <Select
                isDisabled={!canChangeStatus && Boolean(order)}
                label="Status"
                selectedKeys={[form.status]}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0];

                  setForm((s) => ({
                    ...s,
                    status: (first as OrderStatus) ?? "PENDIENTE",
                  }));
                }}
              >
                {orderStatuses
                  .filter((st) => allowedStatuses.includes(st.value))
                  .map((st) => (
                    <SelectItem key={st.value}>{st.label}</SelectItem>
                  ))}
              </Select>

              <Input
                isReadOnly
                className="hidden"
                label="Currency"
                value={form.currency}
              />

              <Select
                label="Currency"
                selectedKeys={[form.currency]}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0];

                  setForm((s) => ({ ...s, currency: String(first ?? "COP") }));
                }}
              >
                {currencies.map((c) => (
                  <SelectItem key={c}>{c}</SelectItem>
                ))}
              </Select>

              <Input
                label="Discount (%)"
                max={100}
                min={0}
                type="number"
                value={form.discount}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, discount: toPercentString(v) }))
                }
              />

              <Input
                label="Shipping fee"
                min={0}
                type="number"
                value={form.shippingFee}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, shippingFee: toNumberString(v) }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">VAT enabled</span>
              <Switch
                isSelected={form.ivaEnabled}
                onValueChange={(v) => setForm((s) => ({ ...s, ivaEnabled: v }))}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={submitting}
              variant="flat"
              onPress={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={submitting}
              isLoading={submitting}
              onPress={submit}
            >
              {submitting ? "Saving..." : order ? "Save" : "Create"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmActionModal
        cancelLabel="Cancel"
        confirmLabel="Send to approval"
        description="The advance is below 50%. The order cannot move to scheduling yet. If you continue, it will be sent to APPROVAL to decide whether it can proceed or should wait for a new payment."
        isLoading={submitting}
        isOpen={approvalFallbackOpen}
        title="Advance below 50%"
        onConfirm={() => submitPayload("APROBACION")}
        onOpenChange={setApprovalFallbackOpen}
      />
    </>
  );
}
