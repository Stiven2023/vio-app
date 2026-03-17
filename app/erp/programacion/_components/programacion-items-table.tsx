"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Skeleton } from "@heroui/skeleton";
import { BsThreeDotsVertical } from "react-icons/bs";
import { ORDER_ITEM_STATUS } from "@/src/utils/order-status";
import type { OrderItemStatus } from "@/src/utils/order-status";
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
  orderItemIds?: string[];
  orderId: string;
  orderCode: string;
  orderDate: string | null;
  clientName: string | null;
  clientCode: string | null;
  deliveryDate: string | null;
  sellerName: string | null;
  sellerCode: string | null;
  designNumber: number | null;
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
const ALL_COLUMN_KEYS = [
  "pedido",
  "fechaPedido",
  "cliente",
  "fechaEntrega",
  "vendedor",
  "cantidad",
  "tela",
  "genero",
  "proceso",
  "plazo",
  "plazoHoras",
] as const;
const DEFAULT_VISIBLE_COLUMNS = [
  "pedido",
  "fechaPedido",
  "cliente",
  "fechaEntrega",
  "vendedor",
  "cantidad",
  "tela",
  "genero",
  "plazo",
] as const;

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

function renderSellerCell(sellerCode: string | null) {
  const text = sellerCode?.trim() || "-";

  return (
    <div className="max-w-[170px] truncate whitespace-nowrap" title={text}>
      {text}
    </div>
  );
}

export function ProgramacionItemsTable({
  process,
  orderStatus = "PRODUCCION",
  basePath = "/erp/programacion",
  actualizacionBasePath,
  labels,
  decompressByDesign = false,
  showProcessColumn = false,
  view = "GENERAL",
  actualizacionQueue = "PROGRAMACION",
  enableDecisions = false,
  groupByOrder = true,
}: {
  process: ProcessType;
    orderStatus?: "PRODUCCION" | "PROGRAMACION" | "APROBACION";
  basePath?: string;
  actualizacionBasePath?: string;
  decompressByDesign?: boolean;
  showProcessColumn?: boolean;
  view?: "GENERAL" | "ACTUALIZACION";
  actualizacionQueue?: "APROBACION" | "PROGRAMACION";
  enableDecisions?: boolean;
  groupByOrder?: boolean;
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
  const [deliverySort, setDeliverySort] = useState<"DEFAULT" | "MAS_PROXIMA" | "MAS_LEJANA">("DEFAULT");
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    () => new Set(DEFAULT_VISIBLE_COLUMNS),
  );
  const [currentView, setCurrentView] = useState<"GENERAL" | "ACTUALIZACION">(view ?? "GENERAL");
  const effectiveGroupByOrder = currentView === "ACTUALIZACION" ? false : groupByOrder;
  const isColumnVisible = (key: string) => selectedColumns.has(key);
  const visibleDataColumnsCount = selectedColumns.size;
  const shouldEnableHorizontalScroll = visibleDataColumnsCount + (enableDecisions ? 1 : 0) > 11;

  useEffect(() => {
    if (currentView !== "ACTUALIZACION") return;

    setSelectedColumns((prev) => {
      if (prev.has("diseno")) return prev;
      const next = new Set(prev);
      next.add("diseno");
      return next;
    });
  }, [currentView]);

  const buildQuery = () => {
    const params = new URLSearchParams({
      process,
      orderStatus,
      view: currentView,
      page: String(page),
      pageSize: String(PAGE_SIZE),
      groupBy: effectiveGroupByOrder ? "ORDER" : "ITEM",
    });

    if (currentView === "ACTUALIZACION") {
      params.set("actualizacionQueue", actualizacionQueue);
    }

    if (search.trim()) params.set("search", search.trim());
    if (gender) params.set("gender", gender);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (deliverySort !== "DEFAULT") params.set("deliverySort", deliverySort);

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
  }, [page, process, orderStatus, currentView, search, gender, startDate, endDate, deliverySort]);

  useEffect(() => {
    setPage(1);
  }, [process, orderStatus, currentView, search, gender, startDate, endDate, deliverySort]);

  const title = useMemo(() => {
    if (process === "PRODUCCION") return labels?.principal ?? "Programación principal";
    if (process === "BODEGA") return labels?.bodega ?? "Programación bodega";
    return labels?.compras ?? "Programación compras";
  }, [labels?.bodega, labels?.compras, labels?.principal, process]);

  const hasRows = (data?.items?.length ?? 0) > 0;

  const isActualizacion = currentView === "ACTUALIZACION";

  const decide = async (
    item: ProgramacionItem,
    nextStatus: OrderItemStatus,
  ) => {
    const itemIds = effectiveGroupByOrder
      ? Array.from(new Set((item.orderItemIds ?? []).filter(Boolean)))
      : [item.orderItemId].filter(Boolean);

    if (itemIds.length === 0) return;

    setPendingActionId(item.id);
    try {
      const responses = await Promise.all(
        itemIds.map(async (itemId) => {
          const res = await fetch(`/api/orders/items/${itemId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ status: nextStatus }),
          });

          if (!res.ok) {
            return { ok: false, message: await res.text() };
          }

          return { ok: true, message: "" };
        }),
      );

      const failed = responses.find((r) => !r.ok);
      if (failed) {
        setToast({ message: failed.message || "No se pudo actualizar el estado.", type: "error" });
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
    const showDesignInFirstColumn =
      (isActualizacion && !effectiveGroupByOrder) ||
      (decompressByDesign && !effectiveGroupByOrder);
    const showDesignColumn = !effectiveGroupByOrder && (!showDesignInFirstColumn && (isActualizacion || isColumnVisible("diseno")));
    const showTallaColumn = !effectiveGroupByOrder && !isActualizacion && isColumnVisible("talla");

    return (
      <>
        {isColumnVisible("pedido")
          ? <TableColumn>{showDesignInFirstColumn ? "PEDIDO / DISEÑO" : "PEDIDO"}</TableColumn>
          : null}
        {isColumnVisible("fechaPedido") ? <TableColumn>FECHA PEDIDO</TableColumn> : null}
        {isColumnVisible("cliente") ? <TableColumn>CLIENTE</TableColumn> : null}
        {isColumnVisible("fechaEntrega") ? <TableColumn>FECHA DE ENTREGA</TableColumn> : null}
        {isColumnVisible("vendedor") ? <TableColumn>VENDEDOR</TableColumn> : null}
        {showDesignColumn ? <TableColumn>DISEÑO</TableColumn> : null}
        {showTallaColumn ? <TableColumn>TALLA</TableColumn> : null}
        {isColumnVisible("cantidad") ? <TableColumn>CANTIDAD</TableColumn> : null}
        {isColumnVisible("tela") ? <TableColumn>TELA</TableColumn> : null}
        {isColumnVisible("genero") ? <TableColumn>GENERO</TableColumn> : null}
        {isColumnVisible("proceso") ? <TableColumn>PROCESO</TableColumn> : null}
        {isColumnVisible("plazo") ? <TableColumn>PLAZO</TableColumn> : null}
        {isColumnVisible("plazoHoras") ? <TableColumn>PLAZO EN HORAS</TableColumn> : null}
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
        <Dropdown>
          <DropdownTrigger>
            <Button
              isIconOnly
              isDisabled={pendingActionId === item.id}
              size="sm"
              variant="flat"
            >
              <BsThreeDotsVertical />
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Acciones programación">
            <DropdownItem
              key="aprobar"
              color="success"
              onPress={() =>
                decide(item, isActualizacion ? ORDER_ITEM_STATUS.APROBADO_CAMBIO : ORDER_ITEM_STATUS.PENDIENTE_PRODUCCION)
              }
            >
              Aprobar
            </DropdownItem>
            <DropdownItem
              key="denegar"
              color="danger"
              onPress={() =>
                decide(
                  item,
                  isActualizacion
                    ? ORDER_ITEM_STATUS.APROBACION_ACTUALIZACION
                    : ORDER_ITEM_STATUS.APROBACION_ACTUALIZACION,
                )
              }
            >
              Denegar
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </TableCell>
    ) : null;

    const showDesignInFirstColumn =
      (isActualizacion && !effectiveGroupByOrder) ||
      (decompressByDesign && !effectiveGroupByOrder);
    const showDesignColumn = !effectiveGroupByOrder && !showDesignInFirstColumn && (isActualizacion || isColumnVisible("diseno"));
    const showTallaColumn = !effectiveGroupByOrder && !isActualizacion && isColumnVisible("talla");
    const cells: Array<JSX.Element> = [];

    if (isColumnVisible("pedido")) {
      cells.push(
        <TableCell key="pedido">
          {showDesignInFirstColumn ? (
            <div className="leading-tight">
              <div className="font-medium">{item.orderCode ?? "-"}</div>
              {isActualizacion || isColumnVisible("diseno") ? (
                <div
                  className="max-w-[220px] truncate text-xs text-default-500"
                  title={item.design ?? `Diseño ${item.designNumber ?? "-"}`}
                >
                  {item.design ?? `Diseño ${item.designNumber ?? "-"}`}
                </div>
              ) : null}
            </div>
          ) : (
            item.orderCode ?? "-"
          )}
        </TableCell>,
      );
    }

    if (isColumnVisible("fechaPedido")) {
      cells.push(<TableCell key="fecha-pedido">{formatDate(item.orderDate)}</TableCell>);
    }
    if (isColumnVisible("cliente")) {
      cells.push(<TableCell key="cliente">{item.clientCode ?? item.clientName ?? "-"}</TableCell>);
    }
    if (isColumnVisible("fechaEntrega")) {
      cells.push(<TableCell key="fecha-entrega">{formatDate(item.deliveryDate)}</TableCell>);
    }
    if (isColumnVisible("vendedor")) {
      cells.push(<TableCell key="vendedor">{renderSellerCell(item.sellerCode)}</TableCell>);
    }
    if (showDesignColumn) {
      cells.push(
        <TableCell key="diseno">
          <div className="max-w-[220px] truncate" title={item.design ?? "-"}>
            {item.design ?? `Diseño ${item.designNumber ?? "-"}`}
          </div>
        </TableCell>,
      );
    }
    if (showTallaColumn) {
      cells.push(<TableCell key="talla">{item.talla ?? "-"}</TableCell>);
    }
    if (isColumnVisible("cantidad")) {
      cells.push(<TableCell key="cantidad">{item.quantity ?? 0}</TableCell>);
    }
    if (isColumnVisible("tela")) {
      cells.push(<TableCell key="tela">{item.fabric ?? "-"}</TableCell>);
    }
    if (isColumnVisible("genero")) {
      cells.push(<TableCell key="genero">{item.gender ?? "-"}</TableCell>);
    }
    if (isColumnVisible("proceso")) {
      cells.push(<TableCell key="proceso">{item.process ?? "-"}</TableCell>);
    }
    if (isColumnVisible("plazo")) {
      cells.push(
        <TableCell key="plazo">{renderCountdownCell(item.deliveryDate, leadDaysLabel, "days")}</TableCell>,
      );
    }
    if (isColumnVisible("plazoHoras")) {
      cells.push(
        <TableCell key="plazo-horas">{renderCountdownCell(item.deliveryDate, leadHoursLabel, "hours")}</TableCell>,
      );
    }
    if (actionsCell) {
      cells.push(actionsCell);
    }

    return cells;
  };

  return (
    <div className="space-y-4">
      {toast ? <AlertToast message={toast.message} type={toast.type} /> : null}
      <div className="flex flex-wrap items-center gap-2">
          <Button as={Link} href={basePath} variant={process === "PRODUCCION" ? "solid" : "flat"}>
          Producción
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <Input
          label="Buscar"
          placeholder={effectiveGroupByOrder ? "Pedido, cliente, vendedor" : "Pedido, cliente, diseño, vendedor, talla"}
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
        <Select
          label="Entrega"
          selectedKeys={[deliverySort]}
          onSelectionChange={(keys) => {
            const first = String(Array.from(keys)[0] ?? "DEFAULT").toUpperCase();
            if (first === "MAS_PROXIMA" || first === "MAS_LEJANA") {
              setDeliverySort(first);
              return;
            }
            setDeliverySort("DEFAULT");
          }}
        >
          <SelectItem key="DEFAULT">Normal</SelectItem>
          <SelectItem key="MAS_PROXIMA">Más próxima</SelectItem>
          <SelectItem key="MAS_LEJANA">Más lejana</SelectItem>
        </Select>
        <Select
          label="Columnas"
          selectionMode="multiple"
          selectedKeys={new Set(Array.from(selectedColumns).filter((k) => {
            if (k === "diseno" && effectiveGroupByOrder) return false;
            if (k === "talla" && (effectiveGroupByOrder || isActualizacion)) return false;
            return true;
          }))}
          onSelectionChange={(keys) => {
            if (keys === "all") {
              setSelectedColumns(new Set(ALL_COLUMN_KEYS));
              return;
            }

            const next = new Set(Array.from(keys).map(String));

            if (next.size === 0) {
              return;
            }

            setSelectedColumns(next);
          }}
        >
          <SelectItem key="pedido">Pedido</SelectItem>
          <SelectItem key="fechaPedido">Fecha pedido</SelectItem>
          <SelectItem key="cliente">Cliente</SelectItem>
          <SelectItem key="fechaEntrega">Fecha entrega</SelectItem>
          <SelectItem key="vendedor">Vendedor</SelectItem>
          {!effectiveGroupByOrder ? <SelectItem key="diseno">Diseño</SelectItem> : null}
          {!effectiveGroupByOrder && !isActualizacion ? <SelectItem key="talla">Talla</SelectItem> : null}
          <SelectItem key="cantidad">Cantidad</SelectItem>
          <SelectItem key="tela">Tela</SelectItem>
          <SelectItem key="genero">Género</SelectItem>
          <SelectItem key="proceso">Proceso</SelectItem>
          <SelectItem key="plazo">Plazo</SelectItem>
          <SelectItem key="plazoHoras">Plazo en horas</SelectItem>
        </Select>
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
        <div className={`w-full pb-2 ${shouldEnableHorizontalScroll ? "overflow-x-auto" : "overflow-x-hidden"}`}>
          <Table
            aria-label="Tabla programación"
            className={shouldEnableHorizontalScroll ? "min-w-[1200px]" : "w-full table-fixed"}
            classNames={{
              table: shouldEnableHorizontalScroll ? "min-w-[1200px]" : "w-full table-fixed",
              th: "px-2 py-2 text-[11px]",
              td: "px-2 py-2 text-xs",
            }}
            removeWrapper
          >
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
        </div>
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
