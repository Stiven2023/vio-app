"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/button";
import { Skeleton } from "@heroui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";

type ProcessType = "PRODUCCION" | "BODEGA" | "COMPRAS";

type ProgramacionItem = {
  id: string;
  orderId: string;
  orderCode: string;
  orderDate: string | null;
  clientName: string | null;
  deliveryDate: string | null;
  sellerName: string | null;
  design: string | null;
  talla: string | null;
  quantity: number | null;
  fabric: string | null;
  gender: string | null;
  leadDays: number | null;
  leadHours: number | null;
  process: string | null;
};

type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

const PAGE_SIZE = 10;

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

export function ProgramacionItemsTable({
  process,
  orderStatus = "PRODUCCION",
  basePath = "/programacion",
  labels,
  decompressByDesign = false,
  showProcessColumn = false,
}: {
  process: ProcessType;
  orderStatus?: "PRODUCCION" | "APROBACION_INICIAL";
  basePath?: string;
  decompressByDesign?: boolean;
  showProcessColumn?: boolean;
  labels?: {
    principal: string;
    bodega: string;
    compras: string;
  };
}) {
  const [data, setData] = useState<Paginated<ProgramacionItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);

      fetch(`/api/programacion/items?process=${process}&orderStatus=${orderStatus}&page=${page}&pageSize=${PAGE_SIZE}`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return (await response.json()) as Paginated<ProgramacionItem>;
      })
      .then((payload) => {
        if (!active) return;
        setData(payload);
      })
      .catch(() => {
        if (!active) return;
        setData({ items: [], page: 1, pageSize: PAGE_SIZE, total: 0, hasNextPage: false });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, process, orderStatus]);

  const title = useMemo(() => {
    if (process === "PRODUCCION") return labels?.principal ?? "Programación principal";
    if (process === "BODEGA") return labels?.bodega ?? "Programación bodega";
    return labels?.compras ?? "Programación compras";
  }, [labels?.bodega, labels?.compras, labels?.principal, process]);

  const hasRows = (data?.items?.length ?? 0) > 0;

  const renderHeaderColumns = () => {
    if (decompressByDesign && showProcessColumn) {
      return (
        <>
          <TableColumn>PEDIDO / DISEÑO</TableColumn>
          <TableColumn>FECHA PEDIDO</TableColumn>
          <TableColumn>CLIENTE</TableColumn>
          <TableColumn>FECHA DE ENTREGA</TableColumn>
          <TableColumn>VENDEDOR</TableColumn>
          <TableColumn>TALLA</TableColumn>
          <TableColumn>CANTIDAD</TableColumn>
          <TableColumn>TELA</TableColumn>
          <TableColumn>GENERO</TableColumn>
          <TableColumn>PROCESO</TableColumn>
          <TableColumn>PLAZO</TableColumn>
          <TableColumn>PLAZO EN HORAS</TableColumn>
        </>
      );
    }

    if (decompressByDesign && !showProcessColumn) {
      return (
        <>
          <TableColumn>PEDIDO / DISEÑO</TableColumn>
          <TableColumn>FECHA PEDIDO</TableColumn>
          <TableColumn>CLIENTE</TableColumn>
          <TableColumn>FECHA DE ENTREGA</TableColumn>
          <TableColumn>VENDEDOR</TableColumn>
          <TableColumn>TALLA</TableColumn>
          <TableColumn>CANTIDAD</TableColumn>
          <TableColumn>TELA</TableColumn>
          <TableColumn>GENERO</TableColumn>
          <TableColumn>PLAZO</TableColumn>
          <TableColumn>PLAZO EN HORAS</TableColumn>
        </>
      );
    }

    if (!decompressByDesign && showProcessColumn) {
      return (
        <>
          <TableColumn>PEDIDO</TableColumn>
          <TableColumn>FECHA PEDIDO</TableColumn>
          <TableColumn>CLIENTE</TableColumn>
          <TableColumn>FECHA DE ENTREGA</TableColumn>
          <TableColumn>VENDEDOR</TableColumn>
          <TableColumn>DISEÑO</TableColumn>
          <TableColumn>TALLA</TableColumn>
          <TableColumn>CANTIDAD</TableColumn>
          <TableColumn>TELA</TableColumn>
          <TableColumn>GENERO</TableColumn>
          <TableColumn>PROCESO</TableColumn>
          <TableColumn>PLAZO</TableColumn>
          <TableColumn>PLAZO EN HORAS</TableColumn>
        </>
      );
    }

    return (
      <>
        <TableColumn>PEDIDO</TableColumn>
        <TableColumn>FECHA PEDIDO</TableColumn>
        <TableColumn>CLIENTE</TableColumn>
        <TableColumn>FECHA DE ENTREGA</TableColumn>
        <TableColumn>VENDEDOR</TableColumn>
        <TableColumn>DISEÑO</TableColumn>
        <TableColumn>TALLA</TableColumn>
        <TableColumn>CANTIDAD</TableColumn>
        <TableColumn>TELA</TableColumn>
        <TableColumn>GENERO</TableColumn>
        <TableColumn>PLAZO</TableColumn>
        <TableColumn>PLAZO EN HORAS</TableColumn>
      </>
    );
  };

  const renderRowCells = (item: ProgramacionItem) => {
    if (decompressByDesign && showProcessColumn) {
      return (
        [
          <TableCell key="pedido-diseno">
            <div className="leading-tight">
              <div className="font-medium">{item.orderCode ?? "-"}</div>
              <div className="text-xs text-default-500">{item.design ?? "-"}</div>
            </div>
          </TableCell>,
          <TableCell key="fecha-pedido">{formatDate(item.orderDate)}</TableCell>,
          <TableCell key="cliente">{item.clientName ?? "-"}</TableCell>,
          <TableCell key="fecha-entrega">{formatDate(item.deliveryDate)}</TableCell>,
          <TableCell key="vendedor">{item.sellerName ?? "-"}</TableCell>,
          <TableCell key="talla">{item.talla ?? "-"}</TableCell>,
          <TableCell key="cantidad">{item.quantity ?? 0}</TableCell>,
          <TableCell key="tela">{item.fabric ?? "-"}</TableCell>,
          <TableCell key="genero">{item.gender ?? "-"}</TableCell>,
          <TableCell key="proceso">{item.process ?? "-"}</TableCell>,
          <TableCell key="plazo">
            {item.leadDays === null || item.leadDays === undefined
              ? "-"
              : `${item.leadDays} días`}
          </TableCell>,
          <TableCell key="plazo-horas">
            {item.leadHours === null || item.leadHours === undefined
              ? "-"
              : String(item.leadHours)}
          </TableCell>,
        ]
      );
    }

    if (decompressByDesign && !showProcessColumn) {
      return (
        [
          <TableCell key="pedido-diseno">
            <div className="leading-tight">
              <div className="font-medium">{item.orderCode ?? "-"}</div>
              <div className="text-xs text-default-500">{item.design ?? "-"}</div>
            </div>
          </TableCell>,
          <TableCell key="fecha-pedido">{formatDate(item.orderDate)}</TableCell>,
          <TableCell key="cliente">{item.clientName ?? "-"}</TableCell>,
          <TableCell key="fecha-entrega">{formatDate(item.deliveryDate)}</TableCell>,
          <TableCell key="vendedor">{item.sellerName ?? "-"}</TableCell>,
          <TableCell key="talla">{item.talla ?? "-"}</TableCell>,
          <TableCell key="cantidad">{item.quantity ?? 0}</TableCell>,
          <TableCell key="tela">{item.fabric ?? "-"}</TableCell>,
          <TableCell key="genero">{item.gender ?? "-"}</TableCell>,
          <TableCell key="plazo">
            {item.leadDays === null || item.leadDays === undefined
              ? "-"
              : `${item.leadDays} días`}
          </TableCell>,
          <TableCell key="plazo-horas">
            {item.leadHours === null || item.leadHours === undefined
              ? "-"
              : String(item.leadHours)}
          </TableCell>,
        ]
      );
    }

    if (!decompressByDesign && showProcessColumn) {
      return (
        [
          <TableCell key="pedido">{item.orderCode ?? "-"}</TableCell>,
          <TableCell key="fecha-pedido">{formatDate(item.orderDate)}</TableCell>,
          <TableCell key="cliente">{item.clientName ?? "-"}</TableCell>,
          <TableCell key="fecha-entrega">{formatDate(item.deliveryDate)}</TableCell>,
          <TableCell key="vendedor">{item.sellerName ?? "-"}</TableCell>,
          <TableCell key="diseno">{item.design ?? "-"}</TableCell>,
          <TableCell key="talla">{item.talla ?? "-"}</TableCell>,
          <TableCell key="cantidad">{item.quantity ?? 0}</TableCell>,
          <TableCell key="tela">{item.fabric ?? "-"}</TableCell>,
          <TableCell key="genero">{item.gender ?? "-"}</TableCell>,
          <TableCell key="proceso">{item.process ?? "-"}</TableCell>,
          <TableCell key="plazo">
            {item.leadDays === null || item.leadDays === undefined
              ? "-"
              : `${item.leadDays} días`}
          </TableCell>,
          <TableCell key="plazo-horas">
            {item.leadHours === null || item.leadHours === undefined
              ? "-"
              : String(item.leadHours)}
          </TableCell>,
        ]
      );
    }

    return (
      [
        <TableCell key="pedido">{item.orderCode ?? "-"}</TableCell>,
        <TableCell key="fecha-pedido">{formatDate(item.orderDate)}</TableCell>,
        <TableCell key="cliente">{item.clientName ?? "-"}</TableCell>,
        <TableCell key="fecha-entrega">{formatDate(item.deliveryDate)}</TableCell>,
        <TableCell key="vendedor">{item.sellerName ?? "-"}</TableCell>,
        <TableCell key="diseno">{item.design ?? "-"}</TableCell>,
        <TableCell key="talla">{item.talla ?? "-"}</TableCell>,
        <TableCell key="cantidad">{item.quantity ?? 0}</TableCell>,
        <TableCell key="tela">{item.fabric ?? "-"}</TableCell>,
        <TableCell key="genero">{item.gender ?? "-"}</TableCell>,
        <TableCell key="plazo">
          {item.leadDays === null || item.leadDays === undefined
            ? "-"
            : `${item.leadDays} días`}
        </TableCell>,
        <TableCell key="plazo-horas">
          {item.leadHours === null || item.leadHours === undefined
            ? "-"
            : String(item.leadHours)}
        </TableCell>,
      ]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
          <Button as={Link} href={basePath} variant={process === "PRODUCCION" ? "solid" : "flat"}>
          Principal
        </Button>
          <Button as={Link} href={`${basePath}/bodega`} variant={process === "BODEGA" ? "solid" : "flat"}>
          Bodega
        </Button>
          <Button as={Link} href={`${basePath}/compras`} variant={process === "COMPRAS" ? "solid" : "flat"}>
          Compras
        </Button>
      </div>

      <div className="text-sm text-default-600">{title}</div>

      {loading ? (
        <div className="rounded-medium border border-default-200 bg-content1 p-4">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={`programacion-skeleton-${index}`} className="h-8 w-full rounded-medium" />
            ))}
          </div>
        </div>
      ) : hasRows ? (
        <Table aria-label="Tabla programación" removeWrapper>
          <TableHeader>
            {renderHeaderColumns()}
          </TableHeader>
          <TableBody items={data?.items ?? []}>
            {(item) => (
              <TableRow key={item.id}>
                {renderRowCells(item)}
              </TableRow>
            )}
          </TableBody>
        </Table>
      ) : (
        <div className="rounded-medium border border-default-200 bg-content1 p-4 text-sm text-default-500">
          Sin items para esta programación
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          isDisabled={loading || page <= 1}
          size="sm"
          variant="flat"
          onPress={() => setPage((p) => Math.max(1, p - 1))}
        >
          Anterior
        </Button>
        <span className="text-xs text-default-500">
          Página {data?.page ?? page}
          {data ? ` / ${Math.max(1, Math.ceil(data.total / data.pageSize))}` : ""}
        </span>
        <Button
          isDisabled={loading || !data?.hasNextPage}
          size="sm"
          variant="flat"
          onPress={() => setPage((p) => p + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
