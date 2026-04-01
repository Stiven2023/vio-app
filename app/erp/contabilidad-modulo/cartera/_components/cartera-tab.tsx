"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Pagination } from "@heroui/pagination";
import { Select, SelectItem } from "@heroui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { Tab, Tabs } from "@heroui/tabs";
import { BsDownload } from "react-icons/bs";

import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";
import {
  ACCOUNTS_RECEIVABLE_COPY,
  getAgingOptions,
  getCreditBackingOptions,
} from "../_lib/cartera.constants";
import {
  exportCashToExcel,
  exportCreditToExcel,
  formatDate,
  formatMoney,
  getAccountsReceivableUiLocale,
  getAgingBucketColor,
  getAgingBucketLabel,
  getCreditBackingDisplay,
  getDaysOverdueLabel,
  getTotalPages,
} from "../_lib/cartera.utils";
import type {
  AccountsReceivableData,
  AccountsReceivableRow,
  AgingBucket,
  CreditBackingType,
  PaymentType,
} from "../_lib/types";

export function CarteraTab({ canExport }: { canExport: boolean }) {
  const locale = useMemo(() => getAccountsReceivableUiLocale(), []);
  const copy = ACCOUNTS_RECEIVABLE_COPY[locale];
  const agingOptions = useMemo(() => getAgingOptions(locale), [locale]);
  const creditBackingOptions = useMemo(
    () => getCreditBackingOptions(locale),
    [locale],
  );
  const [activeTab, setActiveTab] = useState<PaymentType>("CASH");

  const [clientId, setClientId] = useState("");
  const [agingBucket, setAgingBucket] = useState<AgingBucket | "ALL">("ALL");
  const [creditBackingType, setCreditBackingType] = useState<
    CreditBackingType | "ALL"
  >("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();

    params.set("paymentType", activeTab);
    if (clientId) params.set("clientId", clientId);
    if (agingBucket !== "ALL") params.set("agingBucket", agingBucket);
    if (creditBackingType !== "ALL")
      params.set("creditBackingType", creditBackingType);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    return `/api/contabilidad/cartera?${params.toString()}`;
  }, [activeTab, agingBucket, clientId, creditBackingType, dateFrom, dateTo]);

  const { data, loading, page, setPage } = usePaginatedApi<AccountsReceivableRow>(
    endpoint,
    15,
  );

  const carteraData = data as AccountsReceivableData | null;
  const items = carteraData?.items ?? [];
  const clients = carteraData?.clients ?? [];
  const summary = carteraData?.summary ?? null;
  const totalPages = getTotalPages(carteraData);

  useEffect(() => {
    setPage(1);
    setAgingBucket("ALL");
    setCreditBackingType("ALL");
  }, [activeTab, setPage]);

  useEffect(() => {
    setPage(1);
  }, [clientId, agingBucket, creditBackingType, dateFrom, dateTo, setPage]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();

      params.set("paymentType", activeTab);
      params.set("page", "1");
      params.set("pageSize", "5000");
      if (clientId) params.set("clientId", clientId);
      if (agingBucket !== "ALL") params.set("agingBucket", agingBucket);
      if (creditBackingType !== "ALL")
        params.set("creditBackingType", creditBackingType);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const result = await apiJson<AccountsReceivableData>(
        `/api/contabilidad/cartera?${params.toString()}`,
      );
      const allRows = result.items ?? [];

      if (activeTab === "CREDIT") {
        exportCreditToExcel(locale, allRows);
      } else {
        exportCashToExcel(locale, allRows);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs
        aria-label={copy.pageTitle}
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as PaymentType)}
      >
        <Tab key="CASH" title={copy.tabs.CASH} />
        <Tab key="CREDIT" title={copy.tabs.CREDIT} />
      </Tabs>

      <div className="flex flex-wrap items-end gap-3">
        <Select
          className="w-48"
          label={copy.filters.client}
          placeholder={copy.filters.all}
          selectedKeys={clientId ? new Set([clientId]) : new Set([])}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => {
            const first = String(Array.from(keys)[0] ?? "");

            setClientId(first);
          }}
        >
          {clients.map((c) => (
            <SelectItem key={c.id}>{c.name}</SelectItem>
          ))}
        </Select>

        {activeTab === "CREDIT" && (
          <>
            <Select
              className="w-44"
              label={copy.filters.aging}
              selectedKeys={new Set([agingBucket])}
              size="sm"
              variant="bordered"
              onSelectionChange={(keys) => {
                const first = String(Array.from(keys)[0] ?? "ALL") as
                  | AgingBucket
                  | "ALL";

                setAgingBucket(first);
              }}
            >
              {agingOptions.map((o) => (
                <SelectItem key={o.value}>{o.label}</SelectItem>
              ))}
            </Select>

            <Select
              className="w-48"
              label={copy.filters.backing}
              selectedKeys={new Set([creditBackingType])}
              size="sm"
              variant="bordered"
              onSelectionChange={(keys) => {
                const first = String(Array.from(keys)[0] ?? "ALL") as
                  | CreditBackingType
                  | "ALL";

                setCreditBackingType(first);
              }}
            >
              {creditBackingOptions.map((o) => (
                <SelectItem key={o.value}>{o.label}</SelectItem>
              ))}
            </Select>
          </>
        )}

        <Input
          className="w-40"
          label={copy.filters.from}
          size="sm"
          type="date"
          value={dateFrom}
          variant="bordered"
          onValueChange={setDateFrom}
        />
        <Input
          className="w-40"
          label={copy.filters.to}
          size="sm"
          type="date"
          value={dateTo}
          variant="bordered"
          onValueChange={setDateTo}
        />

        {canExport && (
          <Button
            className="ml-auto"
            isDisabled={exporting}
            size="sm"
            startContent={!exporting && <BsDownload />}
            variant="flat"
            onPress={handleExport}
          >
            {exporting ? copy.filters.exporting : copy.filters.export}
          </Button>
        )}
      </div>

      {activeTab === "CREDIT" && summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: copy.summary.current, value: summary.current, color: "success" },
            { label: copy.summary.d1_30, value: summary.d1_30, color: "primary" },
            { label: copy.summary.d31_60, value: summary.d31_60, color: "warning" },
            { label: copy.summary.d61_90, value: summary.d61_90, color: "secondary" },
            { label: copy.summary.d90Plus, value: summary.d90plus, color: "danger" },
            {
              label: copy.summary.total,
              value: summary.grandTotal,
              color: "default",
            },
          ].map((card) => (
            <Card key={card.label} shadow="sm">
              <CardBody className="py-3 px-4">
                <p className="text-xs text-default-500">{card.label}</p>
                <p className="text-sm font-semibold">
                  ${formatMoney(locale, card.value)}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "CREDIT" ? (
        <Table
          isStriped
          removeWrapper
          aria-label={copy.creditTable.ariaLabel}
        >
          <TableHeader>
            <TableColumn>{copy.creditTable.client}</TableColumn>
            <TableColumn>{copy.creditTable.preinvoice}</TableColumn>
            <TableColumn>{copy.creditTable.invoiceDate}</TableColumn>
            <TableColumn>{copy.creditTable.dueDate}</TableColumn>
            <TableColumn className="text-right">{copy.creditTable.total}</TableColumn>
            <TableColumn className="text-right">{copy.creditTable.paid}</TableColumn>
            <TableColumn className="text-right">{copy.creditTable.balance}</TableColumn>
            <TableColumn>{copy.creditTable.daysOverdue}</TableColumn>
            <TableColumn>{copy.creditTable.aging}</TableColumn>
            <TableColumn>{copy.creditTable.backing}</TableColumn>
          </TableHeader>
          <TableBody
            emptyContent={
              loading ? copy.creditTable.loading : copy.creditTable.empty
            }
            items={items}
          >
            {(row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.clientName ?? "-"}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs">{row.prefacturaCode}</span>
                </TableCell>
                <TableCell>{formatDate(locale, row.approvedAt)}</TableCell>
                <TableCell>
                  {row.dueDate ? formatDate(locale, row.dueDate) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  ${formatMoney(locale, row.totalAmount)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  ${formatMoney(locale, row.amountPaid)}
                </TableCell>
                <TableCell
                  className={`text-right font-mono text-xs font-semibold${row.agingBucket === "90_PLUS" ? " text-danger" : ""}`}
                >
                  ${formatMoney(locale, row.balanceDue)}
                </TableCell>
                <TableCell>{getDaysOverdueLabel(locale, row.daysOverdue)}</TableCell>
                <TableCell>
                  <Chip
                    color={getAgingBucketColor(row.agingBucket)}
                    size="sm"
                    variant="flat"
                  >
                    {getAgingBucketLabel(locale, row.agingBucket)}
                  </Chip>
                </TableCell>
                <TableCell>
                  {row.creditBackingType ? (
                    <Chip size="sm" variant="bordered">
                      {getCreditBackingDisplay(locale, row.creditBackingType)}
                    </Chip>
                  ) : (
                    "-"
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      ) : (
        <Table isStriped removeWrapper aria-label={copy.cashTable.ariaLabel}>
          <TableHeader>
            <TableColumn>{copy.cashTable.client}</TableColumn>
            <TableColumn>{copy.cashTable.preinvoice}</TableColumn>
            <TableColumn>{copy.cashTable.invoiceDate}</TableColumn>
            <TableColumn className="text-right">{copy.cashTable.total}</TableColumn>
            <TableColumn className="text-right">{copy.cashTable.paid}</TableColumn>
            <TableColumn className="text-right">{copy.cashTable.balance}</TableColumn>
          </TableHeader>
          <TableBody
            emptyContent={loading ? copy.cashTable.loading : copy.cashTable.empty}
            items={items}
          >
            {(row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.clientName ?? "-"}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs">{row.prefacturaCode}</span>
                </TableCell>
                <TableCell>{formatDate(locale, row.approvedAt)}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  ${formatMoney(locale, row.totalAmount)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  ${formatMoney(locale, row.amountPaid)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold">
                  ${formatMoney(locale, row.balanceDue)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {(carteraData?.total ?? 0) > (carteraData?.pageSize ?? 15) && (
        <div className="flex justify-center pt-2">
          <Pagination page={page} total={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
