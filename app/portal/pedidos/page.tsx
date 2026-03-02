"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/modal";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";

import { AlertToast } from "@/components/alert-toast";

type ExternalOrder = {
  id: string;
  orderCode: string;
  status: string;
  type: string;
  kind?: string | null;
  currency?: string | null;
  total: string | null;
  createdAt: string | null;
  clientCode: string | null;
  clientName: string | null;
};

type ExternalOrderItem = {
  id: string;
  name: string | null;
  quantity: number | null;
  status: string | null;
  process: string | null;
  imageUrl: string | null;
  fabric: string | null;
  color: string | null;
  unitPrice?: string | null;
  totalPrice?: string | null;
  observations?: string | null;
};

type ExternalPayment = {
  id: string;
  amount: string | null;
  depositAmount: string | null;
  method: string | null;
  status: string | null;
  referenceCode: string | null;
  proofImageUrl: string | null;
  createdAt: string | null;
};

type ExternalTotals = {
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

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function renderStatusChip(status: string | null | undefined) {
  const normalized = String(status ?? "").trim().toUpperCase();

  if (normalized === "APROBACION_INICIAL") {
    return (
      <span className="inline-flex rounded-full bg-warning-100 px-2 py-0.5 text-xs font-semibold text-warning-700">
        Aprobación inicial
      </span>
    );
  }

  if (normalized === "PRODUCCION") {
    return (
      <span className="inline-flex rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary">
        Producción
      </span>
    );
  }

  return <span>{status ?? "-"}</span>;
}

export default function PortalPedidosPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [orders, setOrders] = useState<ExternalOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ExternalOrder | null>(null);
  const [items, setItems] = useState<ExternalOrderItem[]>([]);
  const [payments, setPayments] = useState<ExternalPayment[]>([]);
  const [totals, setTotals] = useState<ExternalTotals | null>(null);
  const [paymentPreviewUrl, setPaymentPreviewUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const formatter = useMemo(() => {
    const currency = (selectedOrder?.currency ?? "COP").toUpperCase();

    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "COP",
    });
  }, [selectedOrder?.currency]);

  const formatMoney = (value: string | number | null | undefined) => {
    const amount = typeof value === "number" ? value : Number(String(value ?? "0"));
    return formatter.format(Number.isFinite(amount) ? amount : 0);
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const me = await fetch("/api/external-auth/me", { credentials: "include" });
      if (!me.ok) {
        const text = await me.text();
        setToast({
          message: text || "No tienes acceso al portal de pedidos.",
          type: "error",
        });
        router.push("/login");
        return;
      }

      const res = await fetch(`/api/external/orders`, {
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        setToast({ message: text || "No se pudieron consultar pedidos.", type: "error" });
        return;
      }

      const data = (await res.json()) as { items: ExternalOrder[] };
      const rows = data.items ?? [];
      setOrders(rows);

      if (rows.length > 0) {
        void loadOrderDetail(rows[0].orderCode);
      } else {
        setSelectedOrder(null);
        setItems([]);
        setPayments([]);
        setTotals(null);
      }
    } catch {
      setToast({ message: "No se pudieron consultar pedidos.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadOrderDetail = async (code: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/external/orders/${encodeURIComponent(code)}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        setToast({ message: text || "No se pudo consultar el pedido.", type: "error" });
        return;
      }

      const data = (await res.json()) as {
        order: ExternalOrder;
        items: ExternalOrderItem[];
        payments: ExternalPayment[];
        totals: ExternalTotals;
      };

      setSelectedOrder(data.order);
      setItems(data.items ?? []);
      setPayments(data.payments ?? []);
      setTotals(data.totals ?? null);
    } catch {
      setToast({ message: "No se pudo consultar el pedido.", type: "error" });
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6 space-y-6">
      {toast ? <AlertToast message={toast.message} type={toast.type} /> : null}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Portal de pedidos y diseños</h1>
          <p className="text-default-600 mt-1">Consulta avance, prefactura, diseños y pagos realizados.</p>
        </div>
        <Button
          color="danger"
          variant="light"
          onPress={async () => {
            await fetch("/api/external-auth/logout", { method: "POST", credentials: "include" });
            router.push("/login");
          }}
        >
          Cerrar sesión
        </Button>
      </div>

      <div className="rounded-medium border border-default-200 bg-content1 p-3">
        <Table aria-label="Pedidos del cliente" removeWrapper>
          <TableHeader>
            <TableColumn>PEDIDO</TableColumn>
            <TableColumn>CLIENTE</TableColumn>
            <TableColumn>ESTADO</TableColumn>
            <TableColumn>TIPO</TableColumn>
            <TableColumn>TOTAL</TableColumn>
            <TableColumn>FECHA</TableColumn>
            <TableColumn>ACCIÓN</TableColumn>
          </TableHeader>
          <TableBody emptyContent={loading ? "Cargando..." : "Sin pedidos"} items={orders}>
            {(row) => (
              <TableRow key={row.id}>
                <TableCell>{row.orderCode}</TableCell>
                <TableCell>{row.clientName ?? row.clientCode ?? "-"}</TableCell>
                <TableCell>{renderStatusChip(row.status)}</TableCell>
                <TableCell>{row.type}</TableCell>
                <TableCell>{formatMoney(row.total)}</TableCell>
                <TableCell>{formatDate(row.createdAt)}</TableCell>
                <TableCell>
                  <Button size="sm" variant="flat" onPress={() => void loadOrderDetail(row.orderCode)}>
                    Ver detalles
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {selectedOrder ? (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Pedido {selectedOrder.orderCode}</h2>

          <Card>
            <CardHeader>
              <div className="font-semibold">Resumen (tipo prefactura)</div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-default-500">Cliente</div>
                  <div className="font-medium">{selectedOrder.clientName ?? selectedOrder.clientCode ?? "-"}</div>
                  <div className="text-sm text-default-600">{selectedOrder.clientCode ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-default-500">Pedido</div>
                  <div className="font-medium">{selectedOrder.orderCode}</div>
                  <div className="text-sm text-default-600">
                    {selectedOrder.type} · {selectedOrder.kind ?? "NUEVO"} · {selectedOrder.currency ?? "COP"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-default-500">Estado</div>
                  <div className="font-medium">{renderStatusChip(selectedOrder.status)}</div>
                  <div className="text-sm text-default-600">Fecha: {formatDate(selectedOrder.createdAt)}</div>
                </div>
              </div>
            </CardBody>
          </Card>

          {totals ? (
            <Card>
              <CardHeader>
                <div className="font-semibold">Totales</div>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <div className="text-xs text-default-500">Subtotal</div>
                    <div className="font-medium">{formatMoney(totals.subtotal)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-default-500">Descuento (%)</div>
                    <div className="font-medium">{totals.discountPercent.toFixed(0)}%</div>
                    <div className="text-sm text-default-600">-{formatMoney(totals.discountAmount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-default-500">Flete</div>
                    <div className="font-medium">{formatMoney(totals.shippingFee)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-default-500">Abonado</div>
                    <div className="font-medium">{formatMoney(totals.paidTotal)}</div>
                    <div className="text-sm text-default-600">{totals.paidPercent.toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-default-500">Saldo</div>
                    <div className="font-medium">{formatMoney(totals.remaining)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-default-500">Total final</div>
                    <div className="text-lg font-semibold">{formatMoney(totals.grandTotal)}</div>
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
              {items.length === 0 ? (
                <p className="text-sm text-default-500">Sin diseños</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((item) => (
                    <div key={item.id} className="rounded-medium border border-default-200 p-3 space-y-2">
                      <div className="aspect-[4/3] overflow-hidden rounded-small border border-default-200 bg-default-100">
                        {item.imageUrl ? (
                          <img alt={item.name ?? "Diseño"} className="h-full w-full object-cover" src={item.imageUrl} />
                        ) : (
                          <div className="h-full w-full grid place-items-center text-xs text-default-500">Sin imagen</div>
                        )}
                      </div>
                      <div className="font-medium">{item.name ?? "-"}</div>
                      <div className="text-sm text-default-600">{renderStatusChip(item.status)}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-default-500">Cantidad</div>
                          <div>{item.quantity ?? 0}</div>
                        </div>
                        <div>
                          <div className="text-xs text-default-500">Proceso</div>
                          <div>{item.process ?? "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-default-500">Tela</div>
                          <div>{item.fabric ?? "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-default-500">Color</div>
                          <div>{item.color ?? "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-default-500">Unitario</div>
                          <div>{formatMoney(item.unitPrice)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-default-500">Total</div>
                          <div>{formatMoney(item.totalPrice)}</div>
                        </div>
                      </div>
                      {item.observations ? (
                        <div className="text-xs text-default-500">Observaciones: {item.observations}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <div className="font-semibold">Pagos realizados</div>
                <p className="text-xs text-default-500 mt-1">
                  Consulta el historial de pagos y abre vista previa del soporte.
                </p>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 gap-2 mb-3 sm:grid-cols-3">
                <div className="rounded-medium border border-default-200 p-2">
                  <div className="text-xs text-default-500">Pagos registrados</div>
                  <div className="font-semibold">{payments.length}</div>
                </div>
                <div className="rounded-medium border border-default-200 p-2">
                  <div className="text-xs text-default-500">Total abonado</div>
                  <div className="font-semibold">{formatMoney(totals?.paidTotal ?? 0)}</div>
                </div>
                <div className="rounded-medium border border-default-200 p-2">
                  <div className="text-xs text-default-500">Saldo pendiente</div>
                  <div className="font-semibold">{formatMoney(totals?.remaining ?? 0)}</div>
                </div>
              </div>

              <Table aria-label="Pagos del pedido" removeWrapper>
                <TableHeader>
                  <TableColumn>FECHA</TableColumn>
                  <TableColumn>METODO</TableColumn>
                  <TableColumn>ESTADO</TableColumn>
                  <TableColumn>MONTO</TableColumn>
                  <TableColumn>REFERENCIA</TableColumn>
                  <TableColumn>SOPORTE</TableColumn>
                </TableHeader>
                <TableBody emptyContent={loadingDetail ? "Cargando..." : "Sin pagos"} items={payments}>
                  {(payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.createdAt ? new Date(payment.createdAt).toLocaleString("es-CO") : "-"}</TableCell>
                      <TableCell>{payment.method ?? "-"}</TableCell>
                      <TableCell>{payment.status ?? "-"}</TableCell>
                      <TableCell>{formatMoney(payment.amount)}</TableCell>
                      <TableCell>{payment.referenceCode ?? "-"}</TableCell>
                      <TableCell>
                        {payment.proofImageUrl ? (
                          <button
                            className="h-10 w-10 overflow-hidden rounded-small border border-default-200"
                            type="button"
                            onClick={() => setPaymentPreviewUrl(payment.proofImageUrl)}
                          >
                            <img
                              alt="Soporte de pago"
                              className="h-full w-full object-cover"
                              src={payment.proofImageUrl}
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
            isOpen={Boolean(paymentPreviewUrl)}
            size="3xl"
            onOpenChange={(open) => {
              if (!open) setPaymentPreviewUrl(null);
            }}
          >
            <ModalContent>
              <ModalHeader>Soporte de pago</ModalHeader>
              <ModalBody>
                {paymentPreviewUrl ? (
                  <img
                    alt="Soporte de pago"
                    className="w-full max-h-[70vh] object-contain"
                    src={paymentPreviewUrl}
                  />
                ) : null}
              </ModalBody>
            </ModalContent>
          </Modal>
        </div>
      ) : null}
    </div>
  );
}
