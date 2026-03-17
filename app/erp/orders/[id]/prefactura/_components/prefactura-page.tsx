"use client";

import type { OrderListItem } from "@/app/erp/orders/_lib/types";

import { useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input, Textarea } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { toast } from "react-hot-toast";

import { apiJson } from "@/app/erp/orders/_lib/api";

type PrefacturaLine = {
  id: string;
  name: string | null;
  quantity: number;
  unitPrice: string | null;
  totalPrice: string | null;
};

type PrefacturaAdvanceConvenio = {
  id: string;
  prefacturaCode: string;
  status: string;
  advanceRequired: string | null;
  advanceReceived: string | null;
  advanceStatus: string | null;
  advanceDate: string | null;
  hasConvenio: boolean | null;
  convenioType: string | null;
  convenioNotes: string | null;
  convenioExpiresAt: string | null;
};

type PrefacturaResponse = {
  order: OrderListItem & {
    clientNit?: string | null;
    clientPriceType?: string | null;
  };
  lines: PrefacturaLine[];
  totals: {
    subtotal: number;
    discountPercent: number;
    discountAmount: number;
    totalAfterDiscount: number;
    shippingFee: number;
    grandTotal: number;
    paidTotal: number;
    paidPercent: number;
    remaining: number;
  };
  prefactura: PrefacturaAdvanceConvenio | null;
};

type PaymentRow = {
  id: string;
  orderId: string | null;
  amount: string | null;
  method: string | null;
  status: string | null;
  proofImageUrl?: string | null;
  createdAt: string | null;
};

type AnticipoDraft = {
  advanceRequired: string;
  advanceReceived: string;
  advanceStatus: string;
  advanceDate: string;
};

type ConvenioDraft = {
  hasConvenio: boolean;
  convenioType: string;
  convenioNotes: string;
  convenioExpiresAt: string;
};

const ADVANCE_STATUS_OPTIONS = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "PARCIAL", label: "Parcial" },
  { value: "RECIBIDO", label: "Recibido" },
];

function advanceStatusColor(s: string | null | undefined) {
  if (s === "RECIBIDO") return "success";
  if (s === "PARCIAL") return "warning";
  return "default";
}

export function PrefacturaPage({ orderId }: { orderId: string }) {
  const [data, setData] = useState<PrefacturaResponse | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Anticipo modal state
  const [anticipoOpen, setAnticipo] = useState(false);
  const [anticipoDraft, setAnticipoD] = useState<AnticipoDraft>({
    advanceRequired: "0",
    advanceReceived: "0",
    advanceStatus: "PENDIENTE",
    advanceDate: "",
  });
  const [anticipoSaving, setAnticipaSaving] = useState(false);

  // Convenio modal state
  const [convenioOpen, setConvenio] = useState(false);
  const [convenioDraft, setConvenioD] = useState<ConvenioDraft>({
    hasConvenio: false,
    convenioType: "",
    convenioNotes: "",
    convenioExpiresAt: "",
  });
  const [convenioSaving, setConvenioSaving] = useState(false);

  const loadData = () => {
    apiJson<PrefacturaResponse>(`/api/orders/${orderId}/prefactura`)
      .then(setData)
      .catch(() => setData(null));
  };

  useEffect(() => {
    loadData();

    apiJson<{ items: PaymentRow[] }>(
      `/api/orders/${orderId}/payments?page=1&pageSize=200`,
    )
      .then((res) => setPayments(res.items ?? []))
      .catch(() => setPayments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const companyName = useMemo(
    () => process.env.NEXT_PUBLIC_COMPANY_NAME ?? "VIOMAR",
    [],
  );
  const companyNit = useMemo(
    () => process.env.NEXT_PUBLIC_COMPANY_NIT ?? "-",
    [],
  );

  const formatter = useMemo(() => {
    const currency = (data?.order?.currency ?? "COP").toUpperCase();

    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "COP",
    });
  }, [data?.order?.currency]);

  const formatMoney = (v: string | number | null | undefined) => {
    const n = typeof v === "number" ? v : Number(String(v ?? "0"));

    return formatter.format(Number.isFinite(n) ? n : 0);
  };

  const openAnticipo = () => {
    const pf = data?.prefactura;

    setAnticipoD({
      advanceRequired: String(pf?.advanceRequired ?? "0"),
      advanceReceived: String(pf?.advanceReceived ?? "0"),
      advanceStatus: pf?.advanceStatus ?? "PENDIENTE",
      advanceDate: pf?.advanceDate
        ? new Date(pf.advanceDate).toISOString().slice(0, 10)
        : "",
    });
    setAnticipo(true);
  };

  const saveAnticipo = async () => {
    const pf = data?.prefactura;

    if (!pf) {
      toast.error("No hay prefactura asociada a este pedido");
      return;
    }

    setAnticipaSaving(true);
    try {
      await apiJson(`/api/prefacturas/${pf.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          advanceRequired: Number(anticipoDraft.advanceRequired) || 0,
          advanceReceived: Number(anticipoDraft.advanceReceived) || 0,
          advanceStatus: anticipoDraft.advanceStatus,
          advanceDate: anticipoDraft.advanceDate || null,
        }),
      });
      toast.success("Anticipo actualizado");
      setAnticipo(false);
      loadData();
    } catch {
      toast.error("No se pudo guardar el anticipo");
    } finally {
      setAnticipaSaving(false);
    }
  };

  const openConvenio = () => {
    const pf = data?.prefactura;

    setConvenioD({
      hasConvenio: Boolean(pf?.hasConvenio),
      convenioType: pf?.convenioType ?? "",
      convenioNotes: pf?.convenioNotes ?? "",
      convenioExpiresAt: pf?.convenioExpiresAt
        ? String(pf.convenioExpiresAt).slice(0, 10)
        : "",
    });
    setConvenio(true);
  };

  const saveConvenio = async () => {
    const pf = data?.prefactura;

    if (!pf) {
      toast.error("No hay prefactura asociada a este pedido");
      return;
    }

    setConvenioSaving(true);
    try {
      await apiJson(`/api/prefacturas/${pf.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          hasConvenio: convenioDraft.hasConvenio,
          convenioType: convenioDraft.convenioType || null,
          convenioNotes: convenioDraft.convenioNotes || null,
          convenioExpiresAt: convenioDraft.convenioExpiresAt || null,
        }),
      });
      toast.success("Convenio actualizado");
      setConvenio(false);
      loadData();
    } catch {
      toast.error("No se pudo guardar el convenio");
    } finally {
      setConvenioSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Prefactura</h1>
          <p className="text-default-600 mt-1">
            Resumen de diseños, cantidades y valores del pedido.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            as={NextLink}
            href={`/api/exports/orders/${orderId}/prefactura-excel`}
            variant="flat"
          >
            Descargar prefactura Excel
          </Button>
          <Button
            as={NextLink}
            href={`/api/exports/orders/${orderId}/prefactura-pdf`}
            variant="flat"
          >
            Descargar prefactura PDF
          </Button>
          <Button
            as={NextLink}
            href={`/api/exports/orders/${orderId}/excel`}
            variant="flat"
          >
            Descargar pedido
          </Button>
          <Button as={NextLink} href="/orders" variant="flat">
            Volver
          </Button>
          {data?.order?.id ? (
            <Button
              as={NextLink}
              href={`/orders/${data.order.id}/items`}
              variant="flat"
            >
              Ver diseños
            </Button>
          ) : null}
        </div>
      </div>

      {data ? (
        <Card>
          <CardBody>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <div className="text-xs text-default-500">Empresa</div>
                <div className="font-medium">{companyName}</div>
                <div className="text-sm text-default-600">
                  NIT: {companyNit}
                </div>
              </div>
              <div>
                <div className="text-xs text-default-500">Cliente</div>
                <div className="font-medium">
                  {data.order.clientName ?? "-"}
                </div>
                <div className="text-sm text-default-600">
                  NIT/ID: {(data.order as any).clientNit ?? "-"}
                </div>
                <div className="text-sm text-default-600">
                  Tipo precio COP: {(data.order as any).clientPriceType === "AUTORIZADO"
                    ? "Cliente autorizado"
                    : (data.order as any).clientPriceType === "MAYORISTA"
                      ? "Cliente mayorista"
                      : (data.order as any).clientPriceType === "COLANTA"
                        ? "Cliente Colanta"
                        : (data.order as any).clientPriceType === "VIOMAR"
                          ? "Cliente Viomar"
                          : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-default-500">Pedido</div>
                <div className="font-medium">{data.order.orderCode}</div>
                <div className="text-sm text-default-600">
                  {data.order.type} · {data.order.kind ?? "NUEVO"} ·{" "}
                  {data.order.currency ?? "COP"}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Table removeWrapper aria-label="Prefactura">
        <TableHeader>
          <TableColumn>Diseño</TableColumn>
          <TableColumn>Cantidad</TableColumn>
          <TableColumn>Unitario</TableColumn>
          <TableColumn>Total</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent={data ? "Sin diseños" : "Cargando..."}
          items={data?.lines ?? []}
        >
          {(l) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium">{l.name ?? "-"}</TableCell>
              <TableCell>{String(l.quantity ?? 0)}</TableCell>
              <TableCell>{formatMoney(l.unitPrice)}</TableCell>
              <TableCell>{formatMoney(l.totalPrice)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {data ? (
        <Card>
          <CardBody>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <div className="text-xs text-default-500">Subtotal</div>
                <div className="font-medium">
                  {formatMoney(data.totals.subtotal)}
                </div>
              </div>
              <div>
                <div className="text-xs text-default-500">Descuento diseños/items (%)</div>
                <div className="font-medium">
                  {String(data.totals.discountPercent)}
                </div>
                <div className="text-sm text-default-600">
                  -{formatMoney(data.totals.discountAmount)}
                </div>
              </div>
              <div>
                <div className="text-xs text-default-500">Flete / envío</div>
                <div className="font-medium">
                  {formatMoney(data.totals.shippingFee)}
                </div>
              </div>
              <div>
                <div className="text-xs text-default-500">Abonado</div>
                <div className="font-medium">
                  {formatMoney(data.totals.paidTotal)}
                </div>
                <div className="text-sm text-default-600">
                  {`${(Number.isFinite(data.totals.paidPercent) ? data.totals.paidPercent : 0).toFixed(0)}%`}
                </div>
              </div>
              <div>
                <div className="text-xs text-default-500">Saldo</div>
                <div className="font-medium">
                  {formatMoney(data.totals.remaining)}
                </div>
              </div>
              <div className="sm:col-span-3">
                <div className="text-xs text-default-500">Total final</div>
                <div className="text-lg font-semibold">
                  {formatMoney(data.totals.grandTotal)}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* Anticipo */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Anticipo</div>
              <div className="text-xs text-default-500">
                Monto pactado y recibido como anticipo del pedido.
              </div>
            </div>
            <Button size="sm" variant="flat" onPress={openAnticipo}>
              Editar
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <div className="text-xs text-default-500">Requerido</div>
              <div className="font-medium">
                {formatMoney(data?.prefactura?.advanceRequired)}
              </div>
            </div>
            <div>
              <div className="text-xs text-default-500">Recibido</div>
              <div className="font-medium">
                {formatMoney(data?.prefactura?.advanceReceived)}
              </div>
            </div>
            <div>
              <div className="text-xs text-default-500">Estado</div>
              <Chip
                color={advanceStatusColor(data?.prefactura?.advanceStatus)}
                size="sm"
                variant="flat"
              >
                {data?.prefactura?.advanceStatus ?? "PENDIENTE"}
              </Chip>
            </div>
            <div>
              <div className="text-xs text-default-500">Fecha</div>
              <div className="font-medium text-sm">
                {data?.prefactura?.advanceDate
                  ? new Date(data.prefactura.advanceDate).toLocaleDateString("es-CO")
                  : "-"}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Convenio */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Convenio comercial</div>
              <div className="text-xs text-default-500">
                Acuerdos o condiciones especiales pactadas con el cliente.
              </div>
            </div>
            <Button size="sm" variant="flat" onPress={openConvenio}>
              Editar
            </Button>
          </div>
          {data?.prefactura?.hasConvenio ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <div className="text-xs text-default-500">Tipo</div>
                <div className="font-medium text-sm">
                  {data.prefactura.convenioType ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-default-500">Vence</div>
                <div className="font-medium text-sm">
                  {data.prefactura.convenioExpiresAt
                    ? new Date(data.prefactura.convenioExpiresAt).toLocaleDateString("es-CO")
                    : "-"}
                </div>
              </div>
              <div className="sm:col-span-3">
                <div className="text-xs text-default-500">Observaciones</div>
                <div className="text-sm whitespace-pre-wrap">
                  {data.prefactura.convenioNotes ?? "-"}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-default-500">Sin convenio registrado.</div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="text-sm font-semibold">Pagos</div>
          <div className="text-xs text-default-500 mb-2">
            Soportes cargados para este pedido.
          </div>
          <Table removeWrapper aria-label="Pagos">
            <TableHeader>
              <TableColumn>Fecha</TableColumn>
              <TableColumn>Metodo</TableColumn>
              <TableColumn>Estado</TableColumn>
              <TableColumn>Monto</TableColumn>
              <TableColumn>Soporte</TableColumn>
            </TableHeader>
            <TableBody emptyContent="Sin pagos" items={payments}>
              {(p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.createdAt ? new Date(p.createdAt).toLocaleString() : "-"}
                  </TableCell>
                  <TableCell>{p.method ?? "-"}</TableCell>
                  <TableCell>{p.status ?? "-"}</TableCell>
                  <TableCell>{formatMoney(p.amount)}</TableCell>
                  <TableCell>
                    {p.proofImageUrl ? (
                      <button
                        className="h-10 w-10 overflow-hidden rounded-small border border-default-200"
                        type="button"
                        onClick={() => setPreviewUrl(p.proofImageUrl ?? null)}
                      >
                        <img
                          alt="Soporte de pago"
                          className="h-full w-full object-cover"
                          src={p.proofImageUrl}
                        />
                      </button>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Modal: Editar anticipo */}
      <Modal isOpen={anticipoOpen} onOpenChange={setAnticipo}>
        <ModalContent>
          <ModalHeader>Editar anticipo</ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <Input
                label="Monto requerido"
                min={0}
                type="number"
                value={anticipoDraft.advanceRequired}
                onValueChange={(v) =>
                  setAnticipoD((s) => ({ ...s, advanceRequired: v }))
                }
              />
              <Input
                label="Monto recibido"
                min={0}
                type="number"
                value={anticipoDraft.advanceReceived}
                onValueChange={(v) =>
                  setAnticipoD((s) => ({ ...s, advanceReceived: v }))
                }
              />
              <Select
                label="Estado anticipo"
                selectedKeys={[anticipoDraft.advanceStatus]}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0];

                  setAnticipoD((s) => ({
                    ...s,
                    advanceStatus: String(first ?? "PENDIENTE"),
                  }));
                }}
              >
                {ADVANCE_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value}>{o.label}</SelectItem>
                ))}
              </Select>
              <Input
                label="Fecha del anticipo"
                type="date"
                value={anticipoDraft.advanceDate}
                onValueChange={(v) =>
                  setAnticipoD((s) => ({ ...s, advanceDate: v }))
                }
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={anticipoSaving}
              variant="flat"
              onPress={() => setAnticipo(false)}
            >
              Cancelar
            </Button>
            <Button
              color="primary"
              isDisabled={anticipoSaving}
              isLoading={anticipoSaving}
              onPress={saveAnticipo}
            >
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal: Editar convenio */}
      <Modal isOpen={convenioOpen} onOpenChange={setConvenio}>
        <ModalContent>
          <ModalHeader>Editar convenio comercial</ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Tiene convenio</span>
                <Switch
                  isSelected={convenioDraft.hasConvenio}
                  onValueChange={(v) =>
                    setConvenioD((s) => ({ ...s, hasConvenio: v }))
                  }
                />
              </div>
              {convenioDraft.hasConvenio ? (
                <>
                  <Input
                    label="Tipo de convenio"
                    value={convenioDraft.convenioType}
                    onValueChange={(v) =>
                      setConvenioD((s) => ({ ...s, convenioType: v }))
                    }
                  />
                  <Textarea
                    label="Notas / observaciones"
                    value={convenioDraft.convenioNotes}
                    onValueChange={(v) =>
                      setConvenioD((s) => ({ ...s, convenioNotes: v }))
                    }
                  />
                  <Input
                    label="Fecha de vencimiento"
                    type="date"
                    value={convenioDraft.convenioExpiresAt}
                    onValueChange={(v) =>
                      setConvenioD((s) => ({ ...s, convenioExpiresAt: v }))
                    }
                  />
                </>
              ) : null}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={convenioSaving}
              variant="flat"
              onPress={() => setConvenio(false)}
            >
              Cancelar
            </Button>
            <Button
              color="primary"
              isDisabled={convenioSaving}
              isLoading={convenioSaving}
              onPress={saveConvenio}
            >
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={Boolean(previewUrl)}
        size="3xl"
        onOpenChange={(open) => {
          if (!open) setPreviewUrl(null);
        }}
      >
        <ModalContent>
          <ModalHeader>Soporte de pago</ModalHeader>
          <ModalBody>
            {previewUrl ? (
              <img
                alt="Soporte de pago"
                className="max-h-[70vh] w-full rounded-medium border border-default-200 object-contain"
                src={previewUrl}
              />
            ) : null}
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
