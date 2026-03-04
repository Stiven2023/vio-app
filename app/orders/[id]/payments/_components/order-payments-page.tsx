"use client";

import type { OrderListItem } from "@/app/orders/_lib/types";

import { useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import { Input } from "@heroui/input";
import { NumberInput } from "@heroui/react";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { BsThreeDotsVertical, BsTrash } from "react-icons/bs";

import { apiJson, getErrorMessage } from "@/app/orders/_lib/api";
import { usePaginatedApi } from "@/app/orders/_hooks/use-paginated-api";
import { normalizePaymentStatusLabel } from "@/src/utils/payment-status";

type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "CREDITO";
type PaymentStatus = "PENDIENTE" | "PARCIAL" | "PAGADO" | "ANULADO";

type PaymentRow = {
  id: string;
  orderId: string | null;
  amount: string | null;
  depositAmount?: string | null;
  referenceCode?: string | null;
  method: PaymentMethod | null;
  status: PaymentStatus | null;
  proofImageUrl?: string | null;
  createdAt: string | null;
};

type ColumnDef = {
  key: string;
  name: string;
};

const methodOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "CREDITO", label: "Crédito" },
];

type FormState = {
  amount: string;
  depositAmount: string;
  referenceCode: string;
  method: PaymentMethod;
};

type PaymentsResponse = {
  items: PaymentRow[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
  orderTotal?: string | null;
  paidTotal?: string | null;
};

function toAmountString(v: number | string | null | undefined) {
  const raw = String(v ?? "").trim().replace(/,/g, ".");
  if (!raw) return "";
  const n = Number(raw);
  return Number.isFinite(n) ? String(n) : "";
}

function toNumberInputValue(v: string) {
  const n = Number(String(v ?? "").replace(/,/g, "."));
  return Number.isFinite(n) ? n : 0;
}

function getPastedImageFile(e: React.ClipboardEvent<HTMLElement>) {
  const items = e.clipboardData?.items;
  if (!items) return null;

  for (const item of Array.from(items)) {
    if (String(item.type ?? "").startsWith("image/")) {
      return item.getAsFile();
    }
  }

  return null;
}

export function OrderPaymentsPage({
  orderId,
  canApprove,
  canCreate,
  canEdit,
}: {
  orderId: string;
  canApprove: boolean;
  canCreate: boolean;
  canEdit: boolean;
}) {
  const [order, setOrder] = useState<OrderListItem | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    apiJson<OrderListItem>(`/api/orders/${orderId}`)
      .then(setOrder)
      .catch(() => setOrder(null));
  }, [orderId]);

  const endpoint = useMemo(() => `/api/orders/${orderId}/payments`, [orderId]);

  const { data, loading, page, setPage, refresh } = usePaginatedApi<PaymentRow>(
    endpoint,
    10,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    amount?: string;
    depositAmount?: string;
  }>({});
  const [form, setForm] = useState<FormState>({
    amount: "",
    depositAmount: "",
    referenceCode: "",
    method: "EFECTIVO",
  });

  const formatter = useMemo(() => {
    const currency = (order?.currency ?? "COP").toUpperCase();

    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "COP",
    });
  }, [order?.currency]);

  const formatMoney = (v: string | number | null | undefined) => {
    const n = typeof v === "number" ? v : Number(String(v ?? "0"));

    return formatter.format(Number.isFinite(n) ? n : 0);
  };

  const paymentsResponse = data as PaymentsResponse | null;
  const orderTotalValue = useMemo(() => {
    const fromApi = Number(paymentsResponse?.orderTotal ?? "NaN");
    if (Number.isFinite(fromApi)) return Math.max(0, fromApi);
    const fromOrder = Number(order?.total ?? "0");
    return Number.isFinite(fromOrder) ? Math.max(0, fromOrder) : 0;
  }, [order?.total, paymentsResponse?.orderTotal]);

  const paidTotalValue = useMemo(() => {
    const fromApi = Number(paymentsResponse?.paidTotal ?? "NaN");
    if (Number.isFinite(fromApi)) return Math.max(0, fromApi);
    return 0;
  }, [paymentsResponse?.paidTotal]);

  const requiredFor50Value = useMemo(() => {
    const minFor50 = orderTotalValue * 0.5;
    return Math.max(0, minFor50 - paidTotalValue);
  }, [orderTotalValue, paidTotalValue]);

  const remainingValue = useMemo(
    () => Math.max(0, orderTotalValue - paidTotalValue),
    [orderTotalValue, paidTotalValue],
  );

  useEffect(() => {
    if (!proofFile) {
      setProofPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(proofFile);
    setProofPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [proofFile]);

  const uploadProofToCloudinary = async (file: File) => {
    const sig = await apiJson<{
      cloudName: string;
      apiKey: string;
      timestamp: number;
      signature: string;
      params: Record<string, string>;
    }>("/api/uploads/cloudinary-signature", {
      method: "POST",
      body: JSON.stringify({ folder: `payments/${orderId}` }),
    });

    const formData = new FormData();

    formData.append("file", file);
    formData.append("api_key", sig.apiKey);
    formData.append("timestamp", String(sig.timestamp));
    formData.append("signature", sig.signature);
    Object.entries(sig.params ?? {}).forEach(([k, v]) => formData.append(k, v));

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => "");

      throw new Error(text || `Upload failed (${uploadRes.status})`);
    }

    const json = (await uploadRes.json()) as { secure_url?: string };

    if (!json.secure_url) throw new Error("Cloudinary no devolvió secure_url");

    return json.secure_url;
  };

  const createPayment = async () => {
    if (!canCreate) return;
    if (submitting) return;

    const nextErrors: { amount?: string; depositAmount?: string } = {};

    const amount = form.amount ? Number(form.amount) : 0;

    if (!Number.isFinite(amount) || amount <= 0) {
      nextErrors.amount = "El monto debe ser mayor a 0";
      setFormErrors(nextErrors);
      toast.error(nextErrors.amount);
      (document.getElementById("payment-amount") as HTMLInputElement | null)?.focus();
      return;
    }

    const deposit = form.depositAmount ? Number(form.depositAmount) : amount;
    if (!Number.isFinite(deposit) || deposit <= 0) {
      nextErrors.depositAmount = "La consignación total debe ser mayor a 0";
      setFormErrors(nextErrors);
      toast.error(nextErrors.depositAmount);
      (document.getElementById("payment-deposit") as HTMLInputElement | null)?.focus();
      return;
    }

    setFormErrors({});

    try {
      setSubmitting(true);

      const proofImageUrl = proofFile
        ? await uploadProofToCloudinary(proofFile)
        : null;

      await apiJson(`/api/orders/${orderId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          depositAmount: form.depositAmount ? Number(form.depositAmount) : amount,
          referenceCode: form.referenceCode.trim() || null,
          method: form.method,
          proofImageUrl,
        }),
      });

      toast.success("Pago registrado");
      setModalOpen(false);
      setForm({
        amount: "",
        depositAmount: "",
        referenceCode: "",
        method: "EFECTIVO",
      });
      setFormErrors({});
      setProofFile(null);
      setProofPreviewUrl(null);
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const removePayment = async (paymentId: string) => {
    if (!canEdit) return;

    try {
      await apiJson(`/api/orders/${orderId}/payments/${paymentId}`, {
        method: "DELETE",
      });
      toast.success("Pago eliminado");
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const updatePaymentStatus = async (
    paymentId: string,
    status: Extract<PaymentStatus, "PAGADO" | "ANULADO">,
  ) => {
    if (!canApprove) return;

    try {
      await apiJson(`/api/orders/${orderId}/payments/${paymentId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      toast.success(status === "PAGADO" ? "Pago confirmado" : "Pago marcado como no llegó");
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const columns = useMemo<ColumnDef[]>(
    () => [
      { key: "createdAt", name: "Fecha" },
      { key: "referenceCode", name: "Referencia" },
      { key: "method", name: "Método" },
      { key: "status", name: "Estado" },
      { key: "depositAmount", name: "Consignación" },
      { key: "amount", name: "Monto" },
      { key: "proof", name: "Soporte" },
      { key: "actions", name: "Acciones" },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pagos</h1>
          <p className="text-default-600 mt-1">Registra y consulta pagos del pedido.</p>
        </div>

        <div className="flex gap-2">
          <Button as={NextLink} href="/orders" variant="flat">
            Volver
          </Button>
          <Button isDisabled={loading} variant="flat" onPress={refresh}>
            Refrescar
          </Button>
          {canCreate ? (
            <Button color="primary" onPress={() => setModalOpen(true)}>
              Registrar pago
            </Button>
          ) : null}
        </div>
      </div>

      {order ? (
        <Card>
          <CardBody>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <div className="text-xs text-default-500">Pedido</div>
                <div className="font-medium">{order.orderCode}</div>
              </div>
              <div>
                <div className="text-xs text-default-500">Cliente</div>
                <div className="font-medium">{order.clientName ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs text-default-500">Tipo</div>
                <div className="font-medium">
                  {order.type} · {order.kind ?? "NUEVO"}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-medium border border-default-200 p-3">
                <div className="text-xs text-default-500">Total pedido</div>
                <div className="font-semibold">{formatMoney(orderTotalValue)}</div>
              </div>
              <div className="rounded-medium border border-default-200 p-3">
                <div className="text-xs text-default-500">Abono necesario para 50%</div>
                <div className="font-semibold">{formatMoney(requiredFor50Value)}</div>
              </div>
              <div className="rounded-medium border border-default-200 p-3">
                <div className="text-xs text-default-500">Restante</div>
                <div className="font-semibold">{formatMoney(remainingValue)}</div>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="flex items-center justify-between">
        <div className="text-sm text-default-600">
          {data ? `Total pagos: ${data.total}` : ""}
        </div>
        <div className="text-sm text-default-600">
          Página {page}
          {data ? ` / ${Math.max(1, Math.ceil(data.total / data.pageSize))}` : ""}
        </div>
      </div>

      <Table removeWrapper aria-label="Pagos">
        <TableHeader columns={columns}>
          {(c: ColumnDef) => <TableColumn key={c.key}>{c.name}</TableColumn>}
        </TableHeader>
        <TableBody emptyContent={loading ? "" : "Sin pagos"} items={data?.items ?? []}>
          {(p) => (
            <TableRow key={p.id}>
              {(columnKey) => {
                if (columnKey === "createdAt") {
                  return (
                    <TableCell>
                      {p.createdAt ? new Date(p.createdAt).toLocaleString() : "-"}
                    </TableCell>
                  );
                }

                if (columnKey === "method") return <TableCell>{p.method ?? "-"}</TableCell>;
                if (columnKey === "status") {
                  return <TableCell>{normalizePaymentStatusLabel(p.status)}</TableCell>;
                }
                if (columnKey === "referenceCode") return <TableCell>{p.referenceCode ?? "-"}</TableCell>;
                if (columnKey === "depositAmount") return <TableCell>{formatMoney(p.depositAmount)}</TableCell>;
                if (columnKey === "amount") return <TableCell>{formatMoney(p.amount)}</TableCell>;

                if (columnKey === "proof") {
                  return (
                    <TableCell>
                      {p.proofImageUrl ? (
                        <Button
                          as={NextLink}
                          href={p.proofImageUrl}
                          size="sm"
                          target="_blank"
                          variant="flat"
                        >
                          Ver
                        </Button>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  );
                }

                if (columnKey === "actions") {
                  return (
                    <TableCell>
                      {canEdit || canApprove ? (
                        <Dropdown>
                          <DropdownTrigger>
                            <Button size="sm" variant="flat">
                              <BsThreeDotsVertical />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu aria-label="Acciones">
                            {canApprove ? (
                              <DropdownItem
                                key="confirm"
                                onPress={() => updatePaymentStatus(p.id, "PAGADO")}
                              >
                                Confirmar pago
                              </DropdownItem>
                            ) : null}
                            {canApprove ? (
                              <DropdownItem
                                key="not-arrived"
                                onPress={() => updatePaymentStatus(p.id, "ANULADO")}
                              >
                                Marcar no llegó
                              </DropdownItem>
                            ) : null}
                            <DropdownItem
                              key="delete"
                              className="text-danger"
                              startContent={<BsTrash />}
                              isDisabled={!canEdit}
                              onPress={() => removePayment(p.id)}
                            >
                              Eliminar
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  );
                }

                return <TableCell>-</TableCell>;
              }}
            </TableRow>
          )}
        </TableBody>
      </Table>

      {data ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            isDisabled={page <= 1 || loading}
            variant="flat"
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <Button
            isDisabled={!data.hasNextPage || loading}
            variant="flat"
            onPress={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      ) : null}

      <Modal
        isOpen={modalOpen}
        size="xl"
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setProofFile(null);
            setProofPreviewUrl(null);
          }
        }}
      >
        <ModalContent>
          <ModalHeader>Registrar pago</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-medium border border-default-200 p-3">
                <div className="text-xs text-default-500">Total pedido</div>
                <div className="font-semibold">{formatMoney(orderTotalValue)}</div>
              </div>
              <div className="rounded-medium border border-default-200 p-3">
                <div className="text-xs text-default-500">Abono necesario para 50%</div>
                <div className="font-semibold">{formatMoney(requiredFor50Value)}</div>
              </div>
              <div className="rounded-medium border border-default-200 p-3">
                <div className="text-xs text-default-500">Restante</div>
                <div className="font-semibold">{formatMoney(remainingValue)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NumberInput
                id="payment-amount"
                hideStepper
                isInvalid={Boolean(formErrors.amount)}
                errorMessage={formErrors.amount}
                label="Monto"
                value={toNumberInputValue(form.amount)}
                formatOptions={{
                  style: "currency",
                  currency: (order?.currency ?? "COP").toUpperCase() === "USD" ? "USD" : "COP",
                  maximumFractionDigits: 2,
                }}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, amount: toAmountString(v) }))
                }
              />
              <NumberInput
                id="payment-deposit"
                hideStepper
                isInvalid={Boolean(formErrors.depositAmount)}
                errorMessage={formErrors.depositAmount}
                label="Consignación total"
                value={toNumberInputValue(form.depositAmount)}
                formatOptions={{
                  style: "currency",
                  currency: (order?.currency ?? "COP").toUpperCase() === "USD" ? "USD" : "COP",
                  maximumFractionDigits: 2,
                }}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, depositAmount: toAmountString(v) }))
                }
              />
              <Input
                label="Código de referencia"
                value={form.referenceCode}
                onValueChange={(v) => setForm((s) => ({ ...s, referenceCode: v }))}
              />
              <Select
                label="Método"
                selectedKeys={[form.method]}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0] as PaymentMethod | undefined;

                  setForm((s) => ({ ...s, method: first ?? "EFECTIVO" }));
                }}
              >
                {methodOptions.map((m) => (
                  <SelectItem key={m.value}>{m.label}</SelectItem>
                ))}
              </Select>
              <Input
                isReadOnly
                label="Estado"
                value="Por confirmar"
              />

              <div className="sm:col-span-2">
                <div className="text-sm text-default-600 mb-1">
                  Imagen de validación (opcional)
                </div>
                <div
                  className="rounded-medium border border-dashed border-default-300 bg-default-50 p-3"
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0] ?? null;
                    setProofFile(file);
                  }}
                  onPaste={(e) => {
                    const file = getPastedImageFile(e);
                    if (!file) return;
                    e.preventDefault();
                    setProofFile(file);
                  }}
                  tabIndex={0}
                >
                  <p className="text-xs text-default-500 mb-2">
                    Arrastra una imagen aquí, selecciónala o pégala con Ctrl+V.
                  </p>
                  <input
                    accept="image/*"
                    type="file"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setProofFile(f);
                    }}
                  />
                </div>
                {proofPreviewUrl ? (
                  <div className="mt-2 overflow-hidden rounded-medium border border-default-200">
                    <img
                      alt="Preview soporte de pago"
                      className="h-40 w-full object-contain bg-default-50"
                      src={proofPreviewUrl}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              color="primary"
              isDisabled={submitting}
              isLoading={submitting}
              onPress={createPayment}
            >
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {!canCreate && !canEdit ? (
        <div className="text-xs text-default-500">
          No tienes permisos para crear/editar pagos.
        </div>
      ) : null}
    </div>
  );
}
