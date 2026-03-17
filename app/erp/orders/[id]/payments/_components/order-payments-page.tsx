"use client";

import type { OrderListItem } from "@/app/erp/orders/_lib/types";

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

import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";
import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";
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
  bankId?: string | null;
  transferBank?: string | null;
  bankCode?: string | null;
  bankName?: string | null;
  bankAccountRef?: string | null;
  transferCurrency?: string | null;
  status: PaymentStatus | null;
  proofImageUrl?: string | null;
  createdAt: string | null;
};

type BankOption = {
  id: string;
  code: string;
  name: string;
  accountRef: string;
  isActive: boolean | null;
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
  bankId: string;
  transferCurrency: "COP" | "USD";
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
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [formErrors, setFormErrors] = useState<{
    amount?: string;
    depositAmount?: string;
    bankId?: string;
    transferCurrency?: string;
  }>({});
  const [form, setForm] = useState<FormState>({
    amount: "",
    depositAmount: "",
    referenceCode: "",
    method: "EFECTIVO",
    bankId: "",
    transferCurrency: "COP",
  });

  useEffect(() => {
    apiJson<{ items: BankOption[] }>("/api/banks?page=1&pageSize=200")
      .then((res) => {
        setBanks((res.items ?? []).filter((bank) => bank.isActive !== false));
      })
      .catch(() => setBanks([]));
  }, []);

  const selectedBank = useMemo(
    () => banks.find((bank) => bank.id === form.bankId) ?? null,
    [banks, form.bankId],
  );

  const formatter = useMemo(() => {
    const orderCurrency = (order?.currency ?? "COP").toUpperCase();
    const currency =
      form.method === "TRANSFERENCIA"
        ? form.transferCurrency
        : orderCurrency === "USD"
          ? "USD"
          : "COP";

    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "COP",
    });
  }, [order?.currency, form.method, form.transferCurrency]);

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
    const nextTransferErrors: { bankId?: string; transferCurrency?: string } = {};

    const amount = form.amount ? Number(form.amount) : 0;

    if (!Number.isFinite(amount) || amount <= 0) {
      nextErrors.amount = "Amount must be greater than 0";
      setFormErrors(nextErrors);
      toast.error(nextErrors.amount);
      (document.getElementById("payment-amount") as HTMLInputElement | null)?.focus();
      return;
    }

    const deposit = form.depositAmount ? Number(form.depositAmount) : amount;
    if (!Number.isFinite(deposit) || deposit <= 0) {
      nextErrors.depositAmount = "Deposit amount must be greater than 0";
      setFormErrors(nextErrors);
      toast.error(nextErrors.depositAmount);
      (document.getElementById("payment-deposit") as HTMLInputElement | null)?.focus();
      return;
    }

    if (form.method === "TRANSFERENCIA") {
      if (!form.bankId.trim()) {
        nextTransferErrors.bankId = "Bank is required for transfer payments";
      } else if (!selectedBank) {
        nextTransferErrors.bankId = "Select a valid bank";
      }

      if (!form.transferCurrency) {
        nextTransferErrors.transferCurrency = "Currency is required for transfer payments";
      }

      if (form.transferCurrency === "USD" && selectedBank?.code !== "VIO_EXT") {
        nextTransferErrors.transferCurrency = "USD is only allowed with bank code VIO-EXT.";
      }

      if (selectedBank?.code === "VIO_EXT" && form.transferCurrency !== "USD") {
        nextTransferErrors.transferCurrency = "With bank code VIO-EXT, only USD is allowed.";
      }

      if (nextTransferErrors.bankId || nextTransferErrors.transferCurrency) {
        setFormErrors({ ...nextErrors, ...nextTransferErrors });
        toast.error(nextTransferErrors.bankId ?? nextTransferErrors.transferCurrency ?? "Complete transfer fields");
        return;
      }
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
          bankId: form.method === "TRANSFERENCIA" ? form.bankId : null,
          transferCurrency: form.method === "TRANSFERENCIA" ? form.transferCurrency : null,
          proofImageUrl,
        }),
      });

      toast.success("Payment created");
      setModalOpen(false);
      setForm({
        amount: "",
        depositAmount: "",
        referenceCode: "",
        method: "EFECTIVO",
        bankId: "",
        transferCurrency: "COP",
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
      toast.success("Payment deleted");
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
      toast.success(status === "PAGADO" ? "Payment marked as deposited" : "Payment marked as not deposited");
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const columns = useMemo<ColumnDef[]>(
    () => [
      { key: "createdAt", name: "Date" },
      { key: "referenceCode", name: "Reference" },
      { key: "method", name: "Method" },
      { key: "bank", name: "Bank" },
      { key: "status", name: "Status" },
      { key: "depositAmount", name: "Deposit" },
      { key: "amount", name: "Amount" },
      { key: "proof", name: "Proof" },
      { key: "actions", name: "Actions" },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-default-600 mt-1">Create and review order payments.</p>
        </div>

        <div className="flex gap-2">
          <Button isDisabled={loading} variant="flat" onPress={refresh}>
            Refresh
          </Button>
          {canCreate ? (
            <Button color="primary" onPress={() => setModalOpen(true)}>
              Add payment
            </Button>
          ) : null}
        </div>
      </div>

      {order ? (
        <Card>
          <CardBody>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <div className="text-xs text-default-500">Order</div>
                <div className="font-medium">{order.orderCode}</div>
              </div>
              <div>
                <div className="text-xs text-default-500">Client</div>
                <div className="font-medium">{order.clientName ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs text-default-500">Type</div>
                <div className="font-medium">
                  {order.type} · {order.kind ?? "NEW"}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-medium border border-default-200 p-3">
                <div className="text-xs text-default-500">Order total</div>
                <div className="font-semibold">{formatMoney(orderTotalValue)}</div>
              </div>
              <div className="rounded-medium border border-default-200 p-3">
                <div className="text-xs text-default-500">Required payment for 50%</div>
                <div className="font-semibold">{formatMoney(requiredFor50Value)}</div>
              </div>
              <div className="rounded-medium border border-default-200 p-3">
                <div className="text-xs text-default-500">Remaining</div>
                <div className="font-semibold">{formatMoney(remainingValue)}</div>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="flex items-center justify-between">
        <div className="text-sm text-default-600">
          {data ? `Total payments: ${data.total}` : ""}
        </div>
        <div className="text-sm text-default-600">
          Page {page}
          {data ? ` / ${Math.max(1, Math.ceil(data.total / data.pageSize))}` : ""}
        </div>
      </div>

      <Table removeWrapper aria-label="Payments">
        <TableHeader columns={columns}>
          {(c: ColumnDef) => <TableColumn key={c.key}>{c.name}</TableColumn>}
        </TableHeader>
        <TableBody emptyContent={loading ? "" : "No payments"} items={data?.items ?? []}>
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
                if (columnKey === "bank") {
                  const bankLabel = [p.bankCode, p.bankName].filter(Boolean).join(" - ") || p.transferBank || "-";
                  return (
                    <TableCell>
                      {p.method === "TRANSFERENCIA" ? (
                        <div className="flex flex-col">
                          <span>{bankLabel}</span>
                          <span className="text-xs text-default-500">
                            {p.bankAccountRef ? `Account: ${p.bankAccountRef}` : "Account: -"}
                          </span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  );
                }
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
                          View
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
                          <DropdownMenu aria-label="Actions">
                            {canApprove ? (
                              <DropdownItem
                                key="confirm"
                                onPress={() => updatePaymentStatus(p.id, "PAGADO")}
                              >
                                DEPOSITED
                              </DropdownItem>
                            ) : null}
                            {canApprove ? (
                              <DropdownItem
                                key="not-arrived"
                                onPress={() => updatePaymentStatus(p.id, "ANULADO")}
                              >
                                NOT DEPOSITED
                              </DropdownItem>
                            ) : null}
                            <DropdownItem
                              key="delete"
                              className="text-danger"
                              startContent={<BsTrash />}
                              isDisabled={!canEdit}
                              onPress={() => removePayment(p.id)}
                            >
                              VOID
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
            Previous
          </Button>
          <Button
            isDisabled={!data.hasNextPage || loading}
            variant="flat"
            onPress={() => setPage((p) => p + 1)}
          >
            Next
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
          <ModalHeader>Add payment</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-medium border border-default-200 p-3">
                <div className="text-xs text-default-500">Order total</div>
                <div className="font-semibold">{formatMoney(orderTotalValue)}</div>
              </div>
              <div className="rounded-medium border border-default-200 p-3">
                <div className="text-xs text-default-500">Required payment for 50%</div>
                <div className="font-semibold">{formatMoney(requiredFor50Value)}</div>
              </div>
              <div className="rounded-medium border border-default-200 p-3">
                <div className="text-xs text-default-500">Remaining</div>
                <div className="font-semibold">{formatMoney(remainingValue)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NumberInput
                id="payment-amount"
                hideStepper
                isInvalid={Boolean(formErrors.amount)}
                errorMessage={formErrors.amount}
                label="Amount"
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
                label="Deposit amount"
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
                label="Reference code"
                value={form.referenceCode}
                onValueChange={(v) => setForm((s) => ({ ...s, referenceCode: v }))}
              />
              <Select
                isRequired={form.method === "TRANSFERENCIA"}
                isInvalid={Boolean(formErrors.bankId)}
                errorMessage={formErrors.bankId}
                label="Bank"
                selectedKeys={form.bankId ? [form.bankId] : []}
                onSelectionChange={(keys) => {
                  const first = String(Array.from(keys)[0] ?? "");
                  const bank = banks.find((row) => row.id === first);

                  setForm((s) => ({
                    ...s,
                    bankId: first,
                    transferCurrency:
                      bank?.code === "VIO_EXT"
                        ? "USD"
                        : s.transferCurrency === "USD"
                          ? "COP"
                          : s.transferCurrency,
                  }));
                  setFormErrors((prev) => ({ ...prev, bankId: undefined, transferCurrency: undefined }));
                }}
              >
                {banks.map((bank) => (
                  <SelectItem key={bank.id}>{`${bank.code} - ${bank.name}`}</SelectItem>
                ))}
              </Select>
              <Select
                isRequired={form.method === "TRANSFERENCIA"}
                isInvalid={Boolean(formErrors.transferCurrency)}
                errorMessage={formErrors.transferCurrency}
                label="Currency"
                selectedKeys={[form.transferCurrency]}
                onSelectionChange={(keys) => {
                  const first = String(Array.from(keys)[0] ?? "COP").toUpperCase();

                  setForm((s) => ({
                    ...s,
                    transferCurrency: first === "USD" ? "USD" : "COP",
                    bankId:
                      first === "USD"
                        ? (banks.find((bank) => bank.code === "VIO_EXT")?.id ?? "")
                        : selectedBank?.code === "VIO_EXT"
                          ? ""
                          : s.bankId,
                  }));
                  setFormErrors((prev) => ({ ...prev, bankId: undefined, transferCurrency: undefined }));
                }}
              >
                <SelectItem key="COP" isDisabled={selectedBank?.code === "VIO_EXT"}>COP</SelectItem>
                <SelectItem key="USD" isDisabled={selectedBank?.code !== "VIO_EXT"}>USD</SelectItem>
              </Select>
              <Select
                label="Method"
                selectedKeys={[form.method]}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0] as PaymentMethod | undefined;

                  setForm((s) => ({
                    ...s,
                    method: first ?? "EFECTIVO",
                    transferCurrency:
                      (first ?? "EFECTIVO") === "TRANSFERENCIA" ? s.transferCurrency : "COP",
                  }));
                }}
              >
                {methodOptions.map((m) => (
                  <SelectItem key={m.value}>{m.label}</SelectItem>
                ))}
              </Select>
              <Input
                isReadOnly
                label="Status"
                value="NOT DEPOSITED"
              />

              <div className="sm:col-span-2">
                <div className="text-sm text-default-600 mb-1">
                  Soporte de validación (opcional, no requerido para efectivo)
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
                    Drag an image here, select one, or paste with Ctrl+V.
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
                      alt="Payment proof preview"
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
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={submitting}
              isLoading={submitting}
              onPress={createPayment}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {!canCreate && !canEdit ? (
        <div className="text-xs text-default-500">
          You do not have permission to create/edit payments.
        </div>
      ) : null}
    </div>
  );
}
