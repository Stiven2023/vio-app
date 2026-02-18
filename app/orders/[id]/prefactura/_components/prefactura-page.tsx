"use client";

import type { OrderListItem } from "@/app/orders/_lib/types";

import { useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@heroui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";

import { apiJson } from "@/app/orders/_lib/api";

type PrefacturaLine = {
  id: string;
  name: string | null;
  quantity: number;
  unitPrice: string | null;
  totalPrice: string | null;
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

export function PrefacturaPage({ orderId }: { orderId: string }) {
  const [data, setData] = useState<PrefacturaResponse | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    apiJson<PrefacturaResponse>(`/api/orders/${orderId}/prefactura`)
      .then(setData)
      .catch(() => setData(null));

    apiJson<{ items: PaymentRow[] }>(
      `/api/orders/${orderId}/payments?page=1&pageSize=200`,
    )
      .then((res) => setPayments(res.items ?? []))
      .catch(() => setPayments([]));
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
            Descargar prefactura
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
                <div className="text-xs text-default-500">Descuento (%)</div>
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
