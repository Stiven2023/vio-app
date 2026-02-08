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

const orderTypes: Array<{ value: OrderType; label: string }> = [
  { value: "VN", label: "VN" },
  { value: "VI", label: "VI" },
];

const orderKinds: Array<{ value: OrderKind; label: string }> = [
  { value: "NUEVO", label: "Nuevo" },
  { value: "COMPLETACION", label: "Completación" },
  { value: "REFERENTE", label: "Referente" },
];

const orderStatuses: Array<{ value: OrderStatus; label: string }> = [
  { value: "PENDIENTE", label: "PENDIENTE" },
  { value: "PRODUCCION", label: "PRODUCCION" },
  { value: "ATRASADO", label: "ATRASADO" },
  { value: "FINALIZADO", label: "FINALIZADO" },
  { value: "ENTREGADO", label: "ENTREGADO" },
  { value: "CANCELADO", label: "CANCELADO" },
  { value: "REVISION", label: "REVISION" },
];

const currencies = ["COP", "USD"] as const;

type FormState = {
  clientId: string;
  type: OrderType;
  kind: OrderKind;
  sourceOrderCode: string;
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
    status: "PENDIENTE",
    currency: "COP",
    discount: "0",
    shippingFee: "0",
    ivaEnabled: false,
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setSubmitting(false);
    setForm({
      clientId: order?.clientId ?? "",
      type: (order?.type ?? "VN") as OrderType,
      kind: (order?.kind ?? "NUEVO") as OrderKind,
      sourceOrderCode: order?.sourceOrderCode ?? "",
      status: (order?.status ?? "PENDIENTE") as OrderStatus,
      currency: order?.currency ?? "COP",
      discount: order?.discount ?? "0",
      shippingFee: order?.shippingFee ?? "0",
      ivaEnabled: Boolean(order?.ivaEnabled ?? false),
    });
  }, [isOpen, order]);

  const submit = async () => {
    if (submitting) return;

    const needsSource =
      form.kind === "COMPLETACION" || form.kind === "REFERENTE";

    if (needsSource && !form.sourceOrderCode.trim()) {
      toast.error("Código del pedido origen requerido");

      return;
    }

    const discountPercent = form.discount ? Number(form.discount) : 0;
    const shippingFee = form.shippingFee ? Number(form.shippingFee) : 0;

    if (!Number.isFinite(shippingFee) || shippingFee < 0) {
      toast.error("El flete/envío debe ser un número mayor o igual a 0");

      return;
    }

    if (
      !Number.isFinite(discountPercent) ||
      discountPercent < 0 ||
      discountPercent > 100
    ) {
      toast.error("Descuento debe ser un porcentaje entre 0 y 100");

      return;
    }

    const payload: OrderInput = {
      clientId: form.clientId ? form.clientId : undefined,
      type: form.type,
      kind: form.kind,
      sourceOrderCode: needsSource ? form.sourceOrderCode.trim() : undefined,
      status: form.status,
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
      toast.success(order ? "Pedido actualizado" : "Pedido creado");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} size="3xl" onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>{order ? "Editar pedido" : "Crear pedido"}</ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {order ? (
              <Input isReadOnly label="Código" value={order.orderCode} />
            ) : null}

            <Select
              label="Cliente"
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
              label="Tipo"
              selectedKeys={[form.type]}
              onSelectionChange={(keys) => {
                const first = Array.from(keys)[0];

                setForm((s) => ({ ...s, type: (first as OrderType) ?? "VN" }));
              }}
            >
              {orderTypes.map((t) => (
                <SelectItem key={t.value}>{t.label}</SelectItem>
              ))}
            </Select>

            <Select
              label="Tipo de pedido"
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
                label="Código pedido origen"
                value={form.sourceOrderCode}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, sourceOrderCode: v }))
                }
              />
            ) : null}

            <Select
              isDisabled={!canChangeStatus && Boolean(order)}
              label="Estado"
              selectedKeys={[form.status]}
              onSelectionChange={(keys) => {
                const first = Array.from(keys)[0];

                setForm((s) => ({
                  ...s,
                  status: (first as OrderStatus) ?? "PENDIENTE",
                }));
              }}
            >
              {orderStatuses.map((st) => (
                <SelectItem key={st.value}>{st.label}</SelectItem>
              ))}
            </Select>

            <Input
              isReadOnly
              className="hidden"
              label="Moneda"
              value={form.currency}
            />

            <Select
              label="Moneda"
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
              label="Descuento (%)"
              max={100}
              min={0}
              type="number"
              value={form.discount}
              onValueChange={(v) =>
                setForm((s) => ({ ...s, discount: toPercentString(v) }))
              }
            />

            <Input
              label="Flete / envío"
              min={0}
              type="number"
              value={form.shippingFee}
              onValueChange={(v) =>
                setForm((s) => ({ ...s, shippingFee: toNumberString(v) }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">IVA habilitado</span>
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
            Cancelar
          </Button>
          <Button
            color="primary"
            isDisabled={submitting}
            isLoading={submitting}
            onPress={submit}
          >
            {submitting ? "Guardando..." : order ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
