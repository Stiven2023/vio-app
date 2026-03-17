"use client";

import type { Paginated } from "@/app/erp/orders/_lib/types";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import NextLink from "next/link";
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
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { BsThreeDotsVertical } from "react-icons/bs";

import { FilterSearch } from "@/app/erp/catalog/_components/ui/filter-search";
import { FilterSelect } from "@/app/erp/catalog/_components/ui/filter-select";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";
import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";
import { normalizePaymentStatusLabel } from "@/src/utils/payment-status";

type CajaRow = {
  id: string;
  orderId: string | null;
  orderCode: string | null;
  clientName: string | null;
  referenceCode: string | null;
  status: string | null;
  transferCurrency: string | null;
  depositAmount: string | null;
  amount: string | null;
  orderTotal: string | null;
  proofImageUrl: string | null;
  createdAt: string | null;
};

type CajaData = Paginated<CajaRow> & {
  summary?: {
    totalGeneral: string;
    totalEfectivo: string;
    totalTransferencias: string;
  };
};

const statusOptions = [
  { value: "all", label: "Todos" },
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "CONFIRMADO_CAJA", label: "Recibido en caja" },
  { value: "ANULADO", label: "Anulado" },
];

const currencyOptions = [
  { value: "all", label: "Todas" },
  { value: "COP", label: "COP" },
  { value: "USD", label: "USD" },
];

function formatMoney(
  value: string | number | null | undefined,
  currency: string,
) {
  const n = Number(value ?? 0);
  const cur = String(currency ?? "COP").toUpperCase() === "USD" ? "USD" : "COP";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function ReciboCajaTab({
  canApprovePayments,
}: {
  canApprovePayments: boolean;
}) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const cardCurrency = currency === "USD" ? "USD" : "COP";

  // Build endpoint always including method=EFECTIVO
  const endpoint = useMemo(() => {
    const sp = new URLSearchParams();

    sp.set("method", "EFECTIVO");
    const query = q.trim();

    if (query) sp.set("q", query);
    if (statusFilter !== "all") sp.set("status", statusFilter);
    if (currency !== "all") sp.set("currency", currency);
    if (dateFrom) sp.set("dateFrom", dateFrom);
    if (dateTo) sp.set("dateTo", dateTo);

    return `/api/contabilidad/consignaciones?${sp.toString()}`;
  }, [q, statusFilter, currency, dateFrom, dateTo]);

  const { data, loading, page, setPage, refresh } = usePaginatedApi<CajaRow>(
    endpoint,
    15,
  );
  const cajaData = data as CajaData | null;

  const updateStatus = async (
    id: string,
    nextStatus: "CONFIRMADO_CAJA" | "ANULADO",
  ) => {
    try {
      await apiJson(`/api/contabilidad/consignaciones/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: nextStatus }),
      });

      toast.success(
        nextStatus === "CONFIRMADO_CAJA"
          ? "Pago recibido en caja"
          : "Pago rechazado",
      );
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card>
          <CardBody className="gap-1">
            <div className="text-xs uppercase tracking-wide text-default-500">
              Total en caja
            </div>
            <div className="text-2xl font-semibold">
              {formatMoney(cajaData?.summary?.totalEfectivo ?? 0, cardCurrency)}
            </div>
            <p className="text-xs text-default-500">
              Entradas de caja confirmadas (solo efectivo).
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="gap-1">
            <div className="text-xs uppercase tracking-wide text-default-500">
              Total general efectivo
            </div>
            <div className="text-2xl font-semibold">
              {formatMoney(cajaData?.summary?.totalGeneral ?? 0, cardCurrency)}
            </div>
            <p className="text-xs text-default-500">
              Todos los pagos en efectivo según filtros.
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <FilterSearch
            className="sm:w-80"
            placeholder="Buscar por pedido o cliente..."
            value={q}
            onValueChange={setQ}
          />
          <FilterSelect
            className="sm:w-44"
            label="Estado"
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <FilterSelect
            className="sm:w-36"
            label="Moneda"
            options={currencyOptions}
            value={currency}
            onChange={setCurrency}
          />
          <Input
            className="sm:w-44"
            label="Fecha desde"
            size="sm"
            type="date"
            value={dateFrom}
            onValueChange={setDateFrom}
          />
          <Input
            className="sm:w-44"
            label="Fecha hasta"
            size="sm"
            type="date"
            value={dateTo}
            onValueChange={setDateTo}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="flat"
            onPress={() => {
              setQ("");
              setStatusFilter("all");
              setCurrency("all");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Limpiar filtros
          </Button>
          <Button variant="flat" onPress={refresh}>
            Actualizar
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton
          ariaLabel="Recibo de caja"
          headers={[
            "Fecha",
            "Pedido",
            "Cliente",
            "Referencia",
            "Estado",
            "Moneda",
            "Pagado",
            "Valor pedido",
            "Soporte",
            "Acciones",
          ]}
        />
      ) : (
        <Table aria-label="Recibo de caja">
          <TableHeader>
            <TableColumn>Fecha</TableColumn>
            <TableColumn>Pedido</TableColumn>
            <TableColumn>Cliente</TableColumn>
            <TableColumn>Referencia</TableColumn>
            <TableColumn>Estado</TableColumn>
            <TableColumn>Moneda</TableColumn>
            <TableColumn>Pagado</TableColumn>
            <TableColumn>Valor pedido</TableColumn>
            <TableColumn>Soporte</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody
            emptyContent="No hay pagos en efectivo"
            items={cajaData?.items ?? []}
          >
            {(row) => {
              const rowCurrency = String(
                row.transferCurrency ?? "COP",
              ).toUpperCase();

              return (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleString("es-CO")
                      : "-"}
                  </TableCell>
                  <TableCell>{row.orderCode ?? "-"}</TableCell>
                  <TableCell>{row.clientName ?? "-"}</TableCell>
                  <TableCell>{row.referenceCode ?? "-"}</TableCell>
                  <TableCell>
                    <span
                      className={
                        row.status === "CONFIRMADO_CAJA"
                          ? "font-medium text-success-600"
                          : row.status === "ANULADO"
                            ? "text-danger-600"
                            : ""
                      }
                    >
                      {normalizePaymentStatusLabel(row.status)}
                    </span>
                  </TableCell>
                  <TableCell>{rowCurrency}</TableCell>
                  <TableCell>
                    {formatMoney(row.depositAmount, rowCurrency)}
                  </TableCell>
                  <TableCell>
                    {formatMoney(row.orderTotal, rowCurrency)}
                  </TableCell>
                  <TableCell>
                    {row.proofImageUrl ? (
                      <Button
                        as={NextLink}
                        href={row.proofImageUrl}
                        rel="noreferrer"
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
                  <TableCell>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button isIconOnly size="sm" variant="flat">
                          <BsThreeDotsVertical />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="Acciones recibo de caja">
                        <DropdownItem
                          key="confirm"
                          isDisabled={
                            !canApprovePayments ||
                            row.status === "CONFIRMADO_CAJA"
                          }
                          onPress={() =>
                            updateStatus(row.id, "CONFIRMADO_CAJA")
                          }
                        >
                          Confirmar recibo en caja
                        </DropdownItem>
                        <DropdownItem
                          key="reject"
                          className="text-danger"
                          color="danger"
                          isDisabled={
                            !canApprovePayments || row.status === "ANULADO"
                          }
                          onPress={() => updateStatus(row.id, "ANULADO")}
                        >
                          Rechazar pago
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </TableCell>
                </TableRow>
              );
            }}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {cajaData ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-default-500">
            Total: {cajaData.total ?? 0}
          </p>
          <div className="flex gap-2">
            <Button
              isDisabled={page <= 1 || loading}
              variant="flat"
              onPress={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              isDisabled={!cajaData.hasNextPage || loading}
              variant="flat"
              onPress={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
