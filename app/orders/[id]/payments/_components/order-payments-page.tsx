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

type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "CREDITO";
type PaymentStatus = "PENDIENTE" | "PARCIAL" | "PAGADO" | "ANULADO";

type PaymentRow = {
  id: string;
  orderId: string | null;
  amount: string | null;
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

const statusOptions: Array<{ value: PaymentStatus; label: string }> = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "PARCIAL", label: "Parcial" },
  { value: "PAGADO", label: "Pagado" },
  { value: "ANULADO", label: "Anulado" },
];

type FormState = {
  amount: string;
  method: PaymentMethod;
  status: PaymentStatus;
};

function toNumberString(v: string) {
  const s = String(v ?? "").trim();

  if (!s) return "";
  const n = Number(s);

  return Number.isNaN(n) ? "" : String(n);
}

export function OrderPaymentsPage({
  orderId,
  canCreate,
  canEdit,
}: {
  orderId: string;
  canCreate: boolean;
  canEdit: boolean;
}) {
  const [order, setOrder] = useState<OrderListItem | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);

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
  const [form, setForm] = useState<FormState>({
    amount: "",
    method: "EFECTIVO",
    status: "PENDIENTE",
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

    const amount = form.amount ? Number(form.amount) : 0;

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }

    try {
      setSubmitting(true);

      const proofImageUrl = proofFile
        ? await uploadProofToCloudinary(proofFile)
        : null;

      await apiJson(`/api/orders/${orderId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          method: form.method,
          status: form.status,
          proofImageUrl,
        }),
      });

      toast.success("Pago registrado");
      setModalOpen(false);
      setForm({ amount: "", method: "EFECTIVO", status: "PENDIENTE" });
      setProofFile(null);
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

  const columns = useMemo<ColumnDef[]>(
    () => [
      { key: "createdAt", name: "Fecha" },
      { key: "method", name: "Método" },
      { key: "status", name: "Estado" },
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
                if (columnKey === "status") return <TableCell>{p.status ?? "-"}</TableCell>;
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
                      {canEdit ? (
                        <Dropdown>
                          <DropdownTrigger>
                            <Button size="sm" variant="flat">
                              <BsThreeDotsVertical />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu aria-label="Acciones">
                            <DropdownItem
                              key="delete"
                              className="text-danger"
                              startContent={<BsTrash />}
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

      <Modal isOpen={modalOpen} size="xl" onOpenChange={setModalOpen}>
        <ModalContent>
          <ModalHeader>Registrar pago</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Monto"
                value={form.amount}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, amount: toNumberString(v) }))
                }
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
              <Select
                label="Estado"
                selectedKeys={[form.status]}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0] as PaymentStatus | undefined;

                  setForm((s) => ({ ...s, status: first ?? "PENDIENTE" }));
                }}
              >
                {statusOptions.map((s) => (
                  <SelectItem key={s.value}>{s.label}</SelectItem>
                ))}
              </Select>

              <div className="sm:col-span-2">
                <div className="text-sm text-default-600 mb-1">
                  Imagen de validación (opcional)
                </div>
                <input
                  accept="image/*"
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;

                    setProofFile(f);
                  }}
                />
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
