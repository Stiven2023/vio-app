"use client";

import type { OrderListItem } from "@/app/orders/_lib/types";

import { useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
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
  order: OrderListItem & { clientNit?: string | null };
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

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderListItem | null>(null);
  const [prefactura, setPrefactura] = useState<PrefacturaResponse | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  useEffect(() => {
    apiJson<OrderListItem>(`/api/orders/${orderId}`)
      .then(setOrder)
      .catch(() => setOrder(null));

    apiJson<PrefacturaResponse>(`/api/orders/${orderId}/prefactura`)
      .then(setPrefactura)
      .catch(() => setPrefactura(null));

    apiJson<{ items: PaymentRow[] }>(
      `/api/orders/${orderId}/payments?page=1&pageSize=200`,
    )
      .then((res) => setPayments(res.items ?? []))
      .catch(() => setPayments([]));
  }, [orderId]);

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

  const lineCount = prefactura?.lines?.length ?? 0;
  const totalQty = prefactura?.lines?.reduce(
    (acc, line) => acc + Number(line.quantity ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Detalle del pedido</h1>
          <p className="text-default-600 mt-1">Informacion completa del pedido.</p>
        </div>
        <div className="flex gap-2">
          <Button as={NextLink} href={`/orders/${orderId}/items`} variant="flat">
            Ver Diseños
          </Button>
          <Button as={NextLink} href={`/orders/${orderId}/payments`} variant="flat">
            Ver pagos
          </Button>
          <Button as={NextLink} href="/orders" variant="flat">
            Volver
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="font-semibold">Resumen</div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <div className="text-xs text-default-500">Pedido</div>
              <div className="font-medium">{order?.orderCode ?? "-"}</div>
              <div className="text-sm text-default-600">
                {order?.type ?? "-"} · {order?.kind ?? "NUEVO"}
              </div>
            </div>
            <div>
              <div className="text-xs text-default-500">Cliente</div>
              <div className="font-medium">{order?.clientName ?? "-"}</div>
              <div className="text-sm text-default-600">
                NIT/ID: {(prefactura?.order as any)?.clientNit ?? "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-default-500">Estado</div>
              <div className="font-medium">{order?.status ?? "-"}</div>
              <div className="text-sm text-default-600">
                Moneda: {order?.currency ?? "COP"}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {prefactura ? (
        <Card>
          <CardHeader>
            <div className="font-semibold">Totales</div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <div className="text-xs text-default-500">Subtotal</div>
                <div className="font-medium">
                  {formatMoney(prefactura.totals.subtotal)}
                </div>
              </div>
              <div>
                <div className="text-xs text-default-500">Descuento</div>
                <div className="font-medium">
                  {String(prefactura.totals.discountPercent)}%
                </div>
                <div className="text-sm text-default-600">
                  -{formatMoney(prefactura.totals.discountAmount)}
                </div>
              </div>
              <div>
                <div className="text-xs text-default-500">Flete</div>
                <div className="font-medium">
                  {formatMoney(prefactura.totals.shippingFee)}
                </div>
              </div>
              <div>
                <div className="text-xs text-default-500">Abonado</div>
                <div className="font-medium">
                  {formatMoney(prefactura.totals.paidTotal)}
                </div>
              </div>
              <div>
                <div className="text-xs text-default-500">Saldo</div>
                <div className="font-medium">
                  {formatMoney(prefactura.totals.remaining)}
                </div>
              </div>
              <div>
                <div className="text-xs text-default-500">Total final</div>
                <div className="text-lg font-semibold">
                  {formatMoney(prefactura.totals.grandTotal)}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="font-semibold">Diseños</div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <div className="text-xs text-default-500">Diseños</div>
              <div className="font-medium">{lineCount}</div>
            </div>
            <div>
              <div className="text-xs text-default-500">Cantidad total</div>
              <div className="font-medium">{totalQty ?? 0}</div>
            </div>
            <div>
              <div className="text-xs text-default-500">Ver lista</div>
              <Button
                as={NextLink}
                href={`/orders/${orderId}/items`}
                size="sm"
                variant="flat"
              >
                Ir a Diseños
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-semibold">Pagos</div>
        </CardHeader>
        <CardBody>
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
                      <img
                        alt="Soporte de pago"
                        className="h-10 w-10 rounded-small border border-default-200 object-cover"
                        src={p.proofImageUrl}
                      />
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
    </div>
  );
}
