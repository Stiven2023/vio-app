"use client";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import { Input } from "@heroui/input";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/table";
import { BsThreeDotsVertical } from "react-icons/bs";

import { FilterSearch } from "@/app/catalog/_components/ui/filter-search";
import { FilterSelect } from "@/app/catalog/_components/ui/filter-select";
import { TableSkeleton } from "@/app/catalog/_components/ui/table-skeleton";
import { usePaginatedApi } from "@/app/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/orders/_lib/api";
import { normalizePaymentStatusLabel } from "@/src/utils/payment-status";

type ConsignacionRow = {
  id: string;
  orderCode: string | null;
  transferBank: string | null;
  referenceCode: string | null;
  status: string | null;
  transferCurrency: string | null;
  depositAmount: string | null;
  orderTotal: string | null;
  valorAFavor: string;
  createdAt: string | null;
};

function formatMoney(value: string | number | null | undefined, currency: string) {
  const n = Number(value ?? 0);
  const cur = String(currency ?? "COP").toUpperCase() === "USD" ? "USD" : "COP";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function ConsignacionesTab({
  canApprovePayments,
}: {
  canApprovePayments: boolean;
}) {
  const [q, setQ] = useState("");
  const [bank, setBank] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const bankOptions = [
    { value: "all", label: "Todos" },
    { value: "GC 24-25", label: "GC 24-25" },
    { value: "O 29-52", label: "O 29-52" },
    { value: "VIO-EXT.", label: "VIO-EXT." },
  ];

  const currencyOptions = [
    { value: "all", label: "Todas" },
    { value: "COP", label: "COP" },
    { value: "USD", label: "USD" },
  ];

  const endpoint = useMemo(() => {
    const sp = new URLSearchParams();
    const query = q.trim();
    if (query) sp.set("q", query);
    if (bank !== "all") sp.set("bank", bank);
    if (currency !== "all") sp.set("currency", currency);
    if (dateFrom) sp.set("dateFrom", dateFrom);
    if (dateTo) sp.set("dateTo", dateTo);
    const qs = sp.toString();
    return `/api/contabilidad/consignaciones${qs ? `?${qs}` : ""}`;
  }, [bank, currency, dateFrom, dateTo, q]);

  const { data, loading, page, setPage, refresh } = usePaginatedApi<ConsignacionRow>(endpoint, 15);

  const updateStatus = async (id: string, nextStatus: "PAGADO" | "ANULADO") => {
    try {
      await apiJson(`/api/contabilidad/consignaciones/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: nextStatus }),
      });

      toast.success(
        nextStatus === "PAGADO"
          ? "Pago aprobado como CONSIGNADO"
          : "Pago desechado como NO CONSIGNADO",
      );
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <FilterSearch
            className="sm:w-80"
            placeholder="Buscar por pedido, # consignación o banco..."
            value={q}
            onValueChange={setQ}
          />
          <FilterSelect
            className="sm:w-48"
            label="Banco"
            options={bankOptions}
            value={bank}
            onChange={setBank}
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
              setBank("all");
              setCurrency("all");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Limpiar filtros
          </Button>
          <Button variant="flat" onPress={refresh}>Refrescar</Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Consignaciones"
          headers={[
            "Fecha consignación",
            "Código pedido",
            "Banco",
            "# consignación",
            "Estado",
            "Moneda",
            "Total consignado",
            "Valor a pagar",
            "Valor a favor",
            "Acciones",
          ]}
        />
      ) : (
        <Table aria-label="Consignaciones">
          <TableHeader>
            <TableColumn>Fecha consignación</TableColumn>
            <TableColumn>Código pedido</TableColumn>
            <TableColumn>Banco</TableColumn>
            <TableColumn># consignación</TableColumn>
            <TableColumn>Estado</TableColumn>
            <TableColumn>Moneda</TableColumn>
            <TableColumn>Total consignado</TableColumn>
            <TableColumn>Valor a pagar en pedido</TableColumn>
            <TableColumn>Valor a favor</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent="Sin consignaciones" items={data?.items ?? []}>
            {(row) => {
              const currency = String(row.transferCurrency ?? "COP").toUpperCase();
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.createdAt ? new Date(row.createdAt).toLocaleString("es-CO") : "-"}
                  </TableCell>
                  <TableCell>{row.orderCode ?? "-"}</TableCell>
                  <TableCell>{row.transferBank ?? "-"}</TableCell>
                  <TableCell>{row.referenceCode ?? "-"}</TableCell>
                  <TableCell>{normalizePaymentStatusLabel(row.status)}</TableCell>
                  <TableCell>{currency}</TableCell>
                  <TableCell>{formatMoney(row.depositAmount, currency)}</TableCell>
                  <TableCell>{formatMoney(row.orderTotal, currency)}</TableCell>
                  <TableCell>{formatMoney(row.valorAFavor, currency)}</TableCell>
                  <TableCell>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button isIconOnly size="sm" variant="flat">
                          <BsThreeDotsVertical />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="Acciones consignación">
                        <DropdownItem
                          key="approve"
                          isDisabled={!canApprovePayments}
                          onPress={() => updateStatus(row.id, "PAGADO")}
                        >
                          Aprobar pago
                        </DropdownItem>
                        <DropdownItem
                          key="reject"
                          isDisabled={!canApprovePayments}
                          onPress={() => updateStatus(row.id, "ANULADO")}
                        >
                          Desechar pago
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
    </div>
  );
}
