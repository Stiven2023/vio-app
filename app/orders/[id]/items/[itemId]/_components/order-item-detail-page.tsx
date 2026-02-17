"use client";

import { useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Textarea } from "@heroui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";

import { apiJson } from "@/app/orders/_lib/api";

type OrderItemPayload = {
  item: any;
  packaging: Array<any>;
  socks: Array<any>;
  materials: Array<any>;
};

type IssueRow = {
  id: string;
  message: string;
  role: string | null;
  statusSnapshot: string | null;
  createdAt: string | null;
};

type GroupedRow = { size: string; quantity: number };

function buildGroupedSummary(packaging: Array<any>): GroupedRow[] {
  if (!Array.isArray(packaging) || packaging.length === 0) return [];

  const grouped = packaging.find((p) => p.mode === "AGRUPADO");
  if (grouped) {
    const size = String(grouped.size ?? "").trim();
    if (!size) return [];
    const qty = Number(grouped.quantity ?? 1);

    return [{ size, quantity: Number.isFinite(qty) && qty > 0 ? qty : 1 }];
  }

  const map = new Map<string, number>();
  for (const row of packaging) {
    const size = String(row.size ?? "").trim();
    if (!size) continue;
    const qty = Number(row.quantity ?? 1);
    const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
    map.set(size, (map.get(size) ?? 0) + safeQty);
  }

  return Array.from(map.entries()).map(([size, quantity]) => ({ size, quantity }));
}

export function OrderItemDetailPage({
  orderId,
  itemId,
}: {
  orderId: string;
  itemId: string;
}) {
  const [payload, setPayload] = useState<OrderItemPayload | null>(null);
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issueMessage, setIssueMessage] = useState("");
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    let active = true;

    setLoading(true);
    Promise.all([
      apiJson<OrderItemPayload>(`/api/orders/items/${itemId}`),
      apiJson<any>(`/api/orders/${orderId}`),
    ])
      .then(([itemPayload, orderPayload]) => {
        if (!active) return;
        setPayload(itemPayload);
        setOrder(orderPayload);
      })
      .catch(() => {
        if (!active) return;
        setPayload(null);
        setOrder(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [itemId, orderId]);

  const loadIssues = async () => {
    setIssuesLoading(true);
    try {
      const res = await apiJson<{ items: IssueRow[] }>(
        `/api/orders/items/${itemId}/issues`,
      );
      setIssues(Array.isArray(res.items) ? res.items : []);
    } catch {
      setIssues([]);
    } finally {
      setIssuesLoading(false);
    }
  };

  useEffect(() => {
    if (!itemId) return;
    loadIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const reportIssue = async () => {
    const msg = issueMessage.trim();
    if (!msg) return;
    if (reporting) return;

    try {
      setReporting(true);
      await apiJson(`/api/orders/items/${itemId}/issues`, {
        method: "POST",
        body: JSON.stringify({ message: msg }),
      });
      setIssueMessage("");
      await loadIssues();
    } finally {
      setReporting(false);
    }
  };

  const groupedSummary = useMemo(
    () => buildGroupedSummary(payload?.packaging ?? []),
    [payload?.packaging],
  );

  const individualRows = useMemo(() => {
    const rows = (payload?.packaging ?? []).filter(
      (p) => p.mode === "INDIVIDUAL",
    );

    if (rows.length > 0)
      return rows.map((row, idx) => ({ ...row, __key: `ind-${idx}` }));

    return groupedSummary.flatMap((row, idx) =>
      Array.from({ length: Math.max(1, Number(row.quantity) || 1) }).map(
        (_, subIdx) => ({
          __key: `grp-${idx}-${subIdx}`,
          personName: "",
          personNumber: "",
          size: row.size,
          quantity: 1,
        }),
      ),
    );
  }, [groupedSummary, payload?.packaging]);

  const item = payload?.item ?? null;

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 rounded-medium bg-default-200" />
        <div className="h-4 w-80 rounded-medium bg-default-100" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-20 rounded-medium bg-default-100" />
          ))}
        </div>
        <div className="h-56 rounded-medium bg-default-100" />
        <div className="h-56 rounded-medium bg-default-100" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Detalle del Diseño</h1>
          <p className="text-default-600 mt-1">Informacion completa del Diseño.</p>
        </div>
        <div className="flex gap-2">
          <Button as={NextLink} href={`/orders/${orderId}/items`} variant="flat">
            Volver a Diseños
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
              <div className="font-medium">{order?.orderCode ?? orderId}</div>
              <div className="text-sm text-default-600">
                {order?.clientName ?? "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-default-500">Diseño</div>
              <div className="font-medium">{item?.name ?? "-"}</div>
              <div className="text-sm text-default-600">
                Estado: {item?.status ?? "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-default-500">Cantidad</div>
              <div className="font-medium">{item?.quantity ?? "-"}</div>
              <div className="text-sm text-default-600">
                Total: {item?.totalPrice ?? "-"}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-semibold">Detalles del Diseño</div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <div className="text-xs text-default-500">Producto</div>
              <div className="font-medium">
                {item?.productName ?? item?.productId ?? "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-default-500">Precio</div>
              <div className="font-medium">{item?.unitPrice ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-default-500">Total</div>
              <div className="font-medium">{item?.totalPrice ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-default-500">Tela</div>
              <div className="font-medium">{item?.fabric ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-default-500">Proceso</div>
              <div className="font-medium">{item?.process ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-default-500">Genero</div>
              <div className="font-medium">{item?.gender ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-default-500">Cuello</div>
              <div className="font-medium">{item?.neckType ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-default-500">Manga</div>
              <div className="font-medium">{item?.sleeve ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-default-500">Color</div>
              <div className="font-medium">{item?.color ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-default-500">Requiere medias</div>
              <div className="font-medium">
                {item?.requiresSocks ? "Si" : "No"}
              </div>
            </div>
            <div>
              <div className="text-xs text-default-500">Revision</div>
              <div className="font-medium">
                {item?.requiresRevision ? "Si" : "No"}
              </div>
            </div>
            <div>
              <div className="text-xs text-default-500">Produccion</div>
              <div className="font-medium">{item?.manufacturingId ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-default-500">Screen print</div>
              <div className="font-medium">
                {item?.screenPrint ? "Si" : "No"}
              </div>
            </div>
            <div>
              <div className="text-xs text-default-500">Bordado</div>
              <div className="font-medium">
                {item?.embroidery ? "Si" : "No"}
              </div>
            </div>
            <div>
              <div className="text-xs text-default-500">Ojal</div>
              <div className="font-medium">
                {item?.buttonhole ? "Si" : "No"}
              </div>
            </div>
            <div>
              <div className="text-xs text-default-500">Broche</div>
              <div className="font-medium">{item?.snap ? "Si" : "No"}</div>
            </div>
            <div>
              <div className="text-xs text-default-500">Etiqueta</div>
              <div className="font-medium">{item?.tag ? "Si" : "No"}</div>
            </div>
            <div>
              <div className="text-xs text-default-500">Bandera</div>
              <div className="font-medium">{item?.flag ? "Si" : "No"}</div>
            </div>
          </div>

          {item?.observations ? (
            <div className="mt-3">
              <div className="text-xs text-default-500">Observaciones</div>
              <div className="text-sm text-default-600 whitespace-pre-wrap">
                {item.observations}
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {item?.imageUrl ? (
        <Card>
          <CardHeader>
            <div className="font-semibold">Imagen del Diseño</div>
          </CardHeader>
          <CardBody>
            <img
              alt="Imagen del Diseño"
              className="max-h-96 w-auto rounded-medium border border-default-200 object-contain"
              src={item.imageUrl}
            />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="font-semibold">Empaque - Resumen agrupado</div>
        </CardHeader>
        <CardBody>
          {groupedSummary.length === 0 ? (
            <div className="text-sm text-default-500">Sin datos agrupados.</div>
          ) : (
            <Table removeWrapper aria-label="Empaque agrupado">
              <TableHeader>
                <TableColumn>Talla</TableColumn>
                <TableColumn>Cantidad</TableColumn>
              </TableHeader>
              <TableBody items={groupedSummary}>
                {(row) => (
                  <TableRow key={row.size}>
                    <TableCell>{row.size}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-semibold">Empaque - Individual</div>
        </CardHeader>
        <CardBody>
          <Table removeWrapper aria-label="Empaque individual">
            <TableHeader>
              <TableColumn>Nombre</TableColumn>
              <TableColumn>Numero</TableColumn>
              <TableColumn>Talla</TableColumn>
              <TableColumn>Cantidad</TableColumn>
            </TableHeader>
            <TableBody
              emptyContent="Sin registros"
              items={individualRows}
            >
              {(row: any) => (
                <TableRow key={row.__key}>
                  <TableCell>{row.personName ?? "-"}</TableCell>
                  <TableCell>{row.personNumber ?? "-"}</TableCell>
                  <TableCell>{row.size ?? "-"}</TableCell>
                  <TableCell>{row.quantity ?? 1}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {payload?.socks?.length ? (
        <Card>
          <CardHeader>
            <div className="font-semibold">Medias</div>
          </CardHeader>
          <CardBody>
            <Table removeWrapper aria-label="Medias">
              <TableHeader>
                <TableColumn>Talla</TableColumn>
                <TableColumn>Cantidad</TableColumn>
                <TableColumn>Descripcion</TableColumn>
                <TableColumn>Imagen</TableColumn>
              </TableHeader>
              <TableBody emptyContent="Sin medias" items={payload?.socks ?? []}>
                {(row) => (
                  <TableRow key={`${row.size}-${row.description}`}>
                    <TableCell>{row.size ?? "-"}</TableCell>
                    <TableCell>{row.quantity ?? 1}</TableCell>
                    <TableCell>{row.description ?? "-"}</TableCell>
                    <TableCell>
                      {row.imageUrl ? (
                        <img
                          alt="Media"
                          className="h-10 w-10 rounded-small border border-default-200 object-cover"
                          src={row.imageUrl}
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
      ) : null}

      <Card>
        <CardHeader>
          <div className="font-semibold">Materiales</div>
        </CardHeader>
        <CardBody>
          <Table removeWrapper aria-label="Materiales">
            <TableHeader>
              <TableColumn>Item</TableColumn>
              <TableColumn>Cantidad</TableColumn>
              <TableColumn>Entregado</TableColumn>
              <TableColumn>Nota</TableColumn>
            </TableHeader>
            <TableBody emptyContent="Sin materiales" items={payload?.materials ?? []}>
              {(row) => (
                <TableRow key={`${row.inventoryItemId}-${row.note}`}>
                  <TableCell>{(row as any).itemName ?? row.inventoryItemId ?? "-"}</TableCell>
                  <TableCell>{row.quantity ?? "-"}</TableCell>
                  <TableCell>{(row as any).deliveredQty ?? "0"}</TableCell>
                  <TableCell>{row.note ?? "-"}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-semibold">Problemas</div>
        </CardHeader>
        <CardBody className="space-y-3">
          <Textarea
            label="Reportar problema"
            minRows={2}
            placeholder="Describe el error o bloqueo del proceso…"
            value={issueMessage}
            onValueChange={setIssueMessage}
          />
          <div className="flex justify-end">
            <Button
              color="primary"
              isDisabled={!issueMessage.trim()}
              isLoading={reporting}
              onPress={reportIssue}
            >
              Reportar
            </Button>
          </div>

          <Table removeWrapper aria-label="Problemas">
            <TableHeader>
              <TableColumn>Fecha</TableColumn>
              <TableColumn>Estado</TableColumn>
              <TableColumn>Rol</TableColumn>
              <TableColumn>Mensaje</TableColumn>
            </TableHeader>
            <TableBody
              emptyContent={issuesLoading ? "" : "Sin problemas"}
              items={issues}
            >
              {(row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleString()
                      : "-"}
                  </TableCell>
                  <TableCell>{row.statusSnapshot ?? "-"}</TableCell>
                  <TableCell>{row.role ?? "-"}</TableCell>
                  <TableCell>{row.message ?? "-"}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
