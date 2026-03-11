"use client";

import { useEffect, useMemo, useState } from "react";
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

import { FilterSearch } from "@/app/erp/catalog/_components/ui/filter-search";
import { FilterSelect } from "@/app/erp/catalog/_components/ui/filter-select";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";
import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";
import { normalizePaymentStatusLabel } from "@/src/utils/payment-status";

type DepositRow = {
  id: string;
  bankId: string | null;
  bankCode: string | null;
  bankName: string | null;
  bankAccountRef: string | null;
  orderCode: string | null;
  referenceCode: string | null;
  status: string | null;
  transferCurrency: string | null;
  depositAmount: string | null;
  orderTotal: string | null;
  creditBalance: string;
  createdAt: string | null;
};

type BankOption = {
  id: string;
  code: string;
  name: string;
  isActive: boolean | null;
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

export function DepositsTab({
  canApprovePayments,
}: {
  canApprovePayments: boolean;
}) {
  const [q, setQ] = useState("");
  const [bank, setBank] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [bankOptions, setBankOptions] = useState<
    Array<{ value: string; label: string }>
  >([{ value: "all", label: "All" }]);

  const currencyOptions = [
    { value: "all", label: "All" },
    { value: "COP", label: "COP" },
    { value: "USD", label: "USD" },
  ];

  useEffect(() => {
    apiJson<{ items: BankOption[] }>("/api/banks?page=1&pageSize=200")
      .then((res) => {
        const options = (res.items ?? [])
          .filter((item) => item.isActive !== false)
          .map((item) => ({
            value: item.id,
            label: `${item.code} - ${item.name}`,
          }));

        setBankOptions([{ value: "all", label: "All" }, ...options]);
      })
      .catch(() => {
        setBankOptions([{ value: "all", label: "All" }]);
      });
  }, []);

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

  const { data, loading, page, setPage, refresh } = usePaginatedApi<DepositRow>(endpoint, 15);

  const updateStatus = async (id: string, nextStatus: "PAGADO" | "ANULADO") => {
    try {
      await apiJson(`/api/contabilidad/consignaciones/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: nextStatus }),
      });

      toast.success(
        nextStatus === "PAGADO"
          ? "Payment approved as DEPOSITED"
          : "Payment rejected as NOT DEPOSITED",
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
            placeholder="Search by order, deposit # or bank..."
            value={q}
            onValueChange={setQ}
          />
          <FilterSelect
            className="sm:w-48"
            label="Bank"
            options={bankOptions}
            value={bank}
            onChange={setBank}
          />
          <FilterSelect
            className="sm:w-36"
            label="Currency"
            options={currencyOptions}
            value={currency}
            onChange={setCurrency}
          />
          <Input
            className="sm:w-44"
            label="Date from"
            size="sm"
            type="date"
            value={dateFrom}
            onValueChange={setDateFrom}
          />
          <Input
            className="sm:w-44"
            label="Date to"
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
            Clear filters
          </Button>
          <Button variant="flat" onPress={refresh}>Refresh</Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Deposits"
          headers={[
            "Deposit date",
            "Order code",
            "Bank",
            "Deposit #",
            "Status",
            "Currency",
            "Deposited total",
            "Order amount",
            "Credit balance",
            "Actions",
          ]}
        />
      ) : (
        <Table aria-label="Deposits">
          <TableHeader>
            <TableColumn>Deposit date</TableColumn>
            <TableColumn>Order code</TableColumn>
            <TableColumn>Bank</TableColumn>
            <TableColumn>Deposit #</TableColumn>
            <TableColumn>Status</TableColumn>
            <TableColumn>Currency</TableColumn>
            <TableColumn>Deposited total</TableColumn>
            <TableColumn>Order amount</TableColumn>
            <TableColumn>Credit balance</TableColumn>
            <TableColumn>Actions</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No deposits" items={data?.items ?? []}>
            {(row) => {
              const currency = String(row.transferCurrency ?? "COP").toUpperCase();
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.createdAt ? new Date(row.createdAt).toLocaleString("es-CO") : "-"}
                  </TableCell>
                  <TableCell>{row.orderCode ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{[row.bankCode, row.bankName].filter(Boolean).join(" - ") || "-"}</span>
                      <span className="text-xs text-default-500">
                        {row.bankAccountRef ? `Account: ${row.bankAccountRef}` : "Account: -"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{row.referenceCode ?? "-"}</TableCell>
                  <TableCell>{normalizePaymentStatusLabel(row.status)}</TableCell>
                  <TableCell>{currency}</TableCell>
                  <TableCell>{formatMoney(row.depositAmount, currency)}</TableCell>
                  <TableCell>{formatMoney(row.orderTotal, currency)}</TableCell>
                  <TableCell>{formatMoney(row.creditBalance, currency)}</TableCell>
                  <TableCell>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button isIconOnly size="sm" variant="flat">
                          <BsThreeDotsVertical />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="Deposit actions">
                        <DropdownItem
                          key="approve"
                          isDisabled={!canApprovePayments}
                          onPress={() => updateStatus(row.id, "PAGADO")}
                        >
                          Approve payment
                        </DropdownItem>
                        <DropdownItem
                          key="reject"
                          isDisabled={!canApprovePayments}
                          onPress={() => updateStatus(row.id, "ANULADO")}
                        >
                          Reject payment
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
            Previous
          </Button>
          <Button
            isDisabled={!data.hasNextPage || loading}
            variant="flat"
            onPress={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
