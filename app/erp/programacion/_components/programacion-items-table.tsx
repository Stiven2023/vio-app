"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Skeleton } from "@heroui/skeleton";
import { AlertToast } from "@/components/alert-toast";
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
  orderItemId: string;
  orderId: string;
  orderCode: string;
  orderDate: string | null;
  clientName: string | null;
  clientCode: string | null;
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

function getDeadlineIndicator(deliveryDate: string | null) {
  if (!deliveryDate) return null;

  const target = new Date(deliveryDate);

  if (Number.isNaN(target.getTime())) return null;

  target.setHours(23, 59, 59, 999);

  const diffMs = target.getTime() - Date.now();
  const remainingHours = Math.ceil(diffMs / (1000 * 60 * 60));
  const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (remainingHours <= 0) {
    return {
      daysLabel: "Vencido",
      hoursLabel: "0 h",
      toneClass: "border-danger-200 bg-danger-50 text-danger-700",
    };
  }

  const toneClass =
    remainingDays <= 5
      ? "border-danger-200 bg-danger-50 text-danger-700"
      : remainingDays <= 10
        ? "border-warning-200 bg-warning-50 text-warning-700"
        : "border-success-200 bg-success-50 text-success-700";

  return {
    daysLabel: `${remainingDays} días`,
    hoursLabel: `${remainingHours} h`,
    toneClass,
  };
}

function renderCountdownCell(
  deliveryDate: string | null,
  fallback: string,
  variant: "days" | "hours",
) {
  const indicator = getDeadlineIndicator(deliveryDate);

  if (!indicator) {
    return <span>{fallback}</span>;
  }

  return (
    <span
      className={`inline-flex min-w-[88px] justify-center rounded-full border px-2 py-1 text-xs font-semibold ${indicator.toneClass}`}
    >
      {variant === "days" ? indicator.daysLabel : indicator.hoursLabel}
    </span>
  );
}

export function ProgramacionItemsTable({
  process,
  orderStatus = "PRODUCCION",
  basePath = "/programacion",
  actualizacionBasePath,
  labels,
  decompressByDesign = false,
  showProcessColumn = false,
  view = "GENERAL",
  enableDecisions = false,
}: {
  process: ProcessType;
  orderStatus?: "PRODUCCION" | "APROBACION_INICIAL";
  basePath?: string;
  actualizacionBasePath?: string;
  decompressByDesign?: boolean;
  showProcessColumn?: boolean;
  view?: "GENERAL" | "ACTUALIZACION";
  enableDecisions?: boolean;
  labels?: {
    principal: string;
    bodega: string;
    compras: string;
  };
}) {
  const [data, setData] = useState<Paginated<ProgramacionItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentView, setCurrentView] = useState<"GENERAL" | "ACTUALIZACION">(view ?? "GENERAL");

  const buildQuery = () => {
    const params = new URLSearchParams({
      process,
      orderStatus,
      view: currentView,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });

    if (search.trim()) params.set("search", search.trim());
    if (gender) params.set("gender", gender);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    return params.toString();
  };

  useEffect(() => {
    let active = true;
    setLoading(true);

      fetch(`/api/programacion/items?${buildQuery()}`, {
      credentials: "include",
      cache: "no-store",
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
  }, [page, process, orderStatus, currentView, search, gender, startDate, endDate]);

  useEffect(() => {
    setPage(1);
  }, [process, orderStatus, currentView, search, gender, startDate, endDate]);

  const title = useMemo(() => {
    if (process === "PRODUCCION") return labels?.principal ?? "Programación principal";
    if (process === "BODEGA") return labels?.bodega ?? "Programación bodega";
    return labels?.compras ?? "Programación compras";
  }, [labels?.bodega, labels?.compras, labels?.principal, process]);

  const hasRows = (data?.items?.length ?? 0) > 0;

  const isActualizacion = currentView === "ACTUALIZACION";

  const decide = async (item: ProgramacionItem, nextStatus: "PENDIENTE_PRODUCCION" | "EN_REVISION_CAMBIO") => {
    if (!item.orderItemId) return;
    setPendingActionId(item.orderItemId);
    try {
      const res = await fetch(`/api/orders/items/${item.orderItemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        const text = await res.text();
        setToast({ message: text || "No se pudo actualizar el estado.", type: "error" });
        return;
      }

      setToast({ message: "Estado actualizado correctamente.", type: "success" });
      setLoading(true);
      const refreshed = await fetch(
        `/api/programacion/items?${buildQuery()}`,
        { credentials: "include", cache: "no-store" },
      );

      if (refreshed.ok) {
        const payload = (await refreshed.json()) as Paginated<ProgramacionItem>;
        setData(payload);
      }
    } catch {
      setToast({ message: "No se pudo actualizar el estado.", type: "error" });
    } finally {
      setPendingActionId(null);
      setLoading(false);
    }
  };

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
          {enableDecisions ? <TableColumn>ACCIONES</TableColumn> : null}
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
          {enableDecisions ? <TableColumn>ACCIONES</TableColumn> : null}
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
          {enableDecisions ? <TableColumn>ACCIONES</TableColumn> : null}
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
        {enableDecisions ? <TableColumn>ACCIONES</TableColumn> : null}
      </>
    );
  };

  const renderRowCells = (item: ProgramacionItem) => {
    const leadDaysLabel =
      item.leadDays === null || item.leadDays === undefined
        ? "-"
        : `${item.leadDays} días`;
    const leadHoursLabel =
      item.leadHours === null || item.leadHours === undefined
        ? "-"
        : String(item.leadHours);
    const actionsCell = enableDecisions ? (
      <TableCell key="acciones">
        <div className="flex flex-wrap gap-2">
          <Button
            color="success"
            isDisabled={pendingActionId === item.orderItemId}
            size="sm"
            variant="flat"
            onPress={() => decide(item, "PENDIENTE_PRODUCCION")}
          >
            Aprobar
          </Button>
          <Button
            color="danger"
            isDisabled={pendingActionId === item.orderItemId}
            size="sm"
            variant="flat"
            onPress={() => decide(item, "EN_REVISION_CAMBIO")}
          >
            Denegar
          </Button>
        </div>
      </TableCell>
    ) : null;

    if (decompressByDesign && showProcessColumn) {
      return (
        [
          <TableCell key="pedido-diseno">
            <div className="leading-tight">
              <div className="font-medium">{item.orderCode ?? "-"}</div>
              <div className="max-w-[220px] truncate text-xs text-default-500" title={item.design ?? "-"}>
                {item.design ?? "-"}
              </div>
            </div>
          </TableCell>,
          <TableCell key="fecha-pedido">{formatDate(item.orderDate)}</TableCell>,
          <TableCell key="cliente">{item.clientCode ?? item.clientName ?? "-"}</TableCell>,
          <TableCell key="fecha-entrega">{formatDate(item.deliveryDate)}</TableCell>,
          <TableCell key="vendedor">{item.sellerName ?? "-"}</TableCell>,
          <TableCell key="talla">{item.talla ?? "-"}</TableCell>,
          <TableCell key="cantidad">{item.quantity ?? 0}</TableCell>,
          <TableCell key="tela">{item.fabric ?? "-"}</TableCell>,
          <TableCell key="genero">{item.gender ?? "-"}</TableCell>,
          <TableCell key="proceso">{item.process ?? "-"}</TableCell>,
          <TableCell key="plazo">{renderCountdownCell(item.deliveryDate, leadDaysLabel, "days")}</TableCell>,
          <TableCell key="plazo-horas">{renderCountdownCell(item.deliveryDate, leadHoursLabel, "hours")}</TableCell>,
          ...(actionsCell ? [actionsCell] : []),
        ]
      );
    }

    if (decompressByDesign && !showProcessColumn) {
      return (
        [
          <TableCell key="pedido-diseno">
            <div className="leading-tight">
              <div className="font-medium">{item.orderCode ?? "-"}</div>
              <div className="max-w-[220px] truncate text-xs text-default-500" title={item.design ?? "-"}>
                {item.design ?? "-"}
              </div>
            </div>
          </TableCell>,
          <TableCell key="fecha-pedido">{formatDate(item.orderDate)}</TableCell>,
          <TableCell key="cliente">{item.clientCode ?? item.clientName ?? "-"}</TableCell>,
          <TableCell key="fecha-entrega">{formatDate(item.deliveryDate)}</TableCell>,
          <TableCell key="vendedor">{item.sellerName ?? "-"}</TableCell>,
          <TableCell key="talla">{item.talla ?? "-"}</TableCell>,
          <TableCell key="cantidad">{item.quantity ?? 0}</TableCell>,
          <TableCell key="tela">{item.fabric ?? "-"}</TableCell>,
          <TableCell key="genero">{item.gender ?? "-"}</TableCell>,
          <TableCell key="plazo">{renderCountdownCell(item.deliveryDate, leadDaysLabel, "days")}</TableCell>,
          <TableCell key="plazo-horas">{renderCountdownCell(item.deliveryDate, leadHoursLabel, "hours")}</TableCell>,
          ...(actionsCell ? [actionsCell] : []),
        ]
      );
    }

    if (!decompressByDesign && showProcessColumn) {
      return (
        [
          <TableCell key="pedido">{item.orderCode ?? "-"}</TableCell>,
          <TableCell key="fecha-pedido">{formatDate(item.orderDate)}</TableCell>,
          <TableCell key="cliente">{item.clientCode ?? item.clientName ?? "-"}</TableCell>,
          <TableCell key="fecha-entrega">{formatDate(item.deliveryDate)}</TableCell>,
          <TableCell key="vendedor">{item.sellerName ?? "-"}</TableCell>,
          <TableCell key="diseno">
            <div className="max-w-[220px] truncate" title={item.design ?? "-"}>
              {item.design ?? "-"}
            </div>
          </TableCell>,
          <TableCell key="talla">{item.talla ?? "-"}</TableCell>,
          <TableCell key="cantidad">{item.quantity ?? 0}</TableCell>,
          <TableCell key="tela">{item.fabric ?? "-"}</TableCell>,
          <TableCell key="genero">{item.gender ?? "-"}</TableCell>,
          <TableCell key="proceso">{item.process ?? "-"}</TableCell>,
          <TableCell key="plazo">{renderCountdownCell(item.deliveryDate, leadDaysLabel, "days")}</TableCell>,
          <TableCell key="plazo-horas">{renderCountdownCell(item.deliveryDate, leadHoursLabel, "hours")}</TableCell>,
          ...(actionsCell ? [actionsCell] : []),
        ]
      );
    }

    return (
      [
        <TableCell key="pedido">{item.orderCode ?? "-"}</TableCell>,
        <TableCell key="fecha-pedido">{formatDate(item.orderDate)}</TableCell>,
        <TableCell key="cliente">{item.clientCode ?? item.clientName ?? "-"}</TableCell>,
        <TableCell key="fecha-entrega">{formatDate(item.deliveryDate)}</TableCell>,
        <TableCell key="vendedor">{item.sellerName ?? "-"}</TableCell>,
        <TableCell key="diseno">
          <div className="max-w-[220px] truncate" title={item.design ?? "-"}>
            {item.design ?? "-"}
          </div>
        </TableCell>,
        <TableCell key="talla">{item.talla ?? "-"}</TableCell>,
        <TableCell key="cantidad">{item.quantity ?? 0}</TableCell>,
        <TableCell key="tela">{item.fabric ?? "-"}</TableCell>,
        <TableCell key="genero">{item.gender ?? "-"}</TableCell>,
        <TableCell key="plazo">{renderCountdownCell(item.deliveryDate, leadDaysLabel, "days")}</TableCell>,
        <TableCell key="plazo-horas">{renderCountdownCell(item.deliveryDate, leadHoursLabel, "hours")}</TableCell>,
        ...(actionsCell ? [actionsCell] : []),
      ]
    );
  };

  return (
    <div className="space-y-4">
      {toast ? <AlertToast message={toast.message} type={toast.type} /> : null}
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
        <Button
          variant={isActualizacion ? "solid" : "flat"}
          onPress={() => setCurrentView((v) => (v === "ACTUALIZACION" ? "GENERAL" : "ACTUALIZACION"))}
        >
          Actualización
        </Button>
      </div>

      <div className="text-sm text-default-600">{title}</div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Input
          label="Buscar"
          placeholder="Pedido, cliente, diseño, vendedor, talla"
          value={search}
          onValueChange={setSearch}
        />
        <Select
          label="Género"
          selectedKeys={gender ? [gender] : []}
          onSelectionChange={(keys) => {
            const first = Array.from(keys)[0];
            setGender(first ? String(first) : "");
          }}
        >
          <SelectItem key="HOMBRE">Hombre</SelectItem>
          <SelectItem key="MUJER">Mujer</SelectItem>
          <SelectItem key="UNISEX">Unisex</SelectItem>
        </Select>
        <Input label="Desde" type="date" value={startDate} onValueChange={setStartDate} />
        <Input label="Hasta" type="date" value={endDate} onValueChange={setEndDate} />
      </div>

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
