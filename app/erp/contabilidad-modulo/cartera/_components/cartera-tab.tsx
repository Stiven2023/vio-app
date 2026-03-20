"use client";

import * as XLSX from "xlsx";
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

type PaymentType = "CASH" | "CREDIT";
type AgingBucket = "CURRENT" | "1_30" | "31_60" | "61_90" | "90_PLUS";
type CreditBackingType =
  | "PROMISSORY_NOTE"
  | "PURCHASE_ORDER"
  | "VERBAL_AGREEMENT";

type ClientOption = {
  id: string;
  name: string;
};

type CarteraRow = {
  id: string;
  prefacturaCode: string;
  approvedAt: string | null;
  dueDate: string | null;
  paymentType: string;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  clientId: string | null;
  clientName: string | null;
  creditBackingType: CreditBackingType | null;
  daysOverdue: number | null;
  agingBucket: AgingBucket | null;
};

type CarteraData = {
  items: CarteraRow[];
  clients: ClientOption[];
  summary: {
    current: string;
    d1_30: string;
    d31_60: string;
    d61_90: string;
    d90plus: string;
    grandTotal: string;
  } | null;
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

const AGING_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "CURRENT", label: "Current" },
  { value: "1_30", label: "1-30 days" },
  { value: "31_60", label: "31-60 days" },
  { value: "61_90", label: "61-90 days" },
  { value: "90_PLUS", label: "90+ days" },
] as const;

const CREDIT_BACKING_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "PROMISSORY_NOTE", label: "Promissory note" },
  { value: "PURCHASE_ORDER", label: "Purchase order" },
  { value: "VERBAL_AGREEMENT", label: "Verbal agreement" },
] as const;

function toNumber(value: unknown) {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString("en-US");
}

function agingBucketLabel(bucket: AgingBucket | null | undefined) {
  switch (bucket) {
    case "CURRENT":
      return "Current";
    case "1_30":
      return "1-30 days";
    case "31_60":
      return "31-60 days";
    case "61_90":
      return "61-90 days";
    case "90_PLUS":
      return "90+ days";
    default:
      return "-";
  }
}

function agingBucketColor(
  bucket: AgingBucket | null | undefined,
): "success" | "primary" | "warning" | "secondary" | "danger" | "default" {
  switch (bucket) {
    case "CURRENT":
      return "success";
    case "1_30":
      return "primary";
    case "31_60":
      return "warning";
    case "61_90":
      return "secondary";
    case "90_PLUS":
      return "danger";
    default:
      return "default";
  }
}

function creditBackingLabel(type: CreditBackingType | null | undefined) {
  switch (type) {
    case "PROMISSORY_NOTE":
      return "Promissory note";
    case "PURCHASE_ORDER":
      return "Purchase order";
    case "VERBAL_AGREEMENT":
      return "Verbal agreement";
    default:
      return "-";
  }
}

function exportCreditToExcel(rows: CarteraRow[]) {
  const headers = [
    "Client",
    "Pre-invoice",
    "Invoice date",
    "Due date",
    "Total",
    "Paid",
    "Outstanding balance",
    "Days overdue",
    "Aging",
    "Credit backing",
  ];

  const lines = rows.map((row) => [
    row.clientName ?? "",
    row.prefacturaCode,
    formatDate(row.approvedAt),
    formatDate(row.dueDate),
    toNumber(row.totalAmount).toFixed(2),
    toNumber(row.amountPaid).toFixed(2),
    toNumber(row.balanceDue).toFixed(2),
    row.daysOverdue ?? 0,
    agingBucketLabel(row.agingBucket),
    creditBackingLabel(row.creditBackingType),
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...lines]);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Credit A/R");
  XLSX.writeFile(
    workbook,
    `credit-ar-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

function exportCashToExcel(rows: CarteraRow[]) {
  const headers = [
    "Client",
    "Pre-invoice",
    "Invoice date",
    "Total",
    "Paid",
    "Outstanding balance",
  ];

  const lines = rows.map((row) => [
    row.clientName ?? "",
    row.prefacturaCode,
    formatDate(row.approvedAt),
    toNumber(row.totalAmount).toFixed(2),
    toNumber(row.amountPaid).toFixed(2),
    toNumber(row.balanceDue).toFixed(2),
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...lines]);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Cash A/R");
  XLSX.writeFile(
    workbook,
    `cash-ar-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

export function CarteraTab({ canExport }: { canExport: boolean }) {
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

  const { data, loading, page, setPage } = usePaginatedApi<CarteraRow>(
    endpoint,
    15,
  );

  const carteraData = data as CarteraData | null;
  const items = carteraData?.items ?? [];
  const clients = carteraData?.clients ?? [];
  const summary = carteraData?.summary ?? null;
  const totalPages = Math.ceil(
    (carteraData?.total ?? 0) / (carteraData?.pageSize ?? 15),
  );

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

      const result = await apiJson<CarteraData>(
        `/api/contabilidad/cartera?${params.toString()}`,
      );
      const allRows = result.items ?? [];

      if (activeTab === "CREDIT") {
        exportCreditToExcel(allRows);
      } else {
        exportCashToExcel(allRows);
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
        aria-label="Accounts receivable type"
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as PaymentType)}
      >
        <Tab key="CASH" title="Cash" />
        <Tab key="CREDIT" title="Credit" />
      </Tabs>

      <div className="flex flex-wrap items-end gap-3">
        <Select
          className="w-48"
          label="Client"
          placeholder="All"
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
              label="Aging"
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
              {AGING_OPTIONS.map((o) => (
                <SelectItem key={o.value}>{o.label}</SelectItem>
              ))}
            </Select>

            <Select
              className="w-48"
              label="Credit backing"
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
              {CREDIT_BACKING_OPTIONS.map((o) => (
                <SelectItem key={o.value}>{o.label}</SelectItem>
              ))}
            </Select>
          </>
        )}

        <Input
          className="w-40"
          label="From"
          size="sm"
          type="date"
          value={dateFrom}
          variant="bordered"
          onValueChange={setDateFrom}
        />
        <Input
          className="w-40"
          label="To"
          size="sm"
          type="date"
          value={dateTo}
          variant="bordered"
          onValueChange={setDateTo}
        />

        {canExport && (
          <Button
            className="ml-auto"
            isLoading={exporting}
            size="sm"
            startContent={!exporting && <BsDownload />}
            variant="flat"
            onPress={handleExport}
          >
            Export Excel
          </Button>
        )}
      </div>

      {activeTab === "CREDIT" && summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Current", value: summary.current, color: "success" },
            { label: "1-30 days", value: summary.d1_30, color: "primary" },
            { label: "31-60 days", value: summary.d31_60, color: "warning" },
            { label: "61-90 days", value: summary.d61_90, color: "secondary" },
            { label: "90+ days", value: summary.d90plus, color: "danger" },
            {
              label: "Grand total",
              value: summary.grandTotal,
              color: "default",
            },
          ].map((card) => (
            <Card key={card.label} shadow="sm">
              <CardBody className="py-3 px-4">
                <p className="text-xs text-default-500">{card.label}</p>
                <p className="text-sm font-semibold">
                  ${formatMoney(card.value)}
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
          aria-label="Credit accounts receivable aging report"
        >
          <TableHeader>
            <TableColumn>Client</TableColumn>
            <TableColumn>Pre-invoice</TableColumn>
            <TableColumn>Invoice date</TableColumn>
            <TableColumn>Due date</TableColumn>
            <TableColumn className="text-right">Total</TableColumn>
            <TableColumn className="text-right">Paid</TableColumn>
            <TableColumn className="text-right">Balance</TableColumn>
            <TableColumn>Days overdue</TableColumn>
            <TableColumn>Aging</TableColumn>
            <TableColumn>Backing</TableColumn>
          </TableHeader>
          <TableBody
            emptyContent={loading ? "Loading..." : "No credit pre-invoices"}
            items={items}
          >
            {(row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.clientName ?? "-"}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs">
                    {row.prefacturaCode}
                  </span>
                </TableCell>
                <TableCell>{formatDate(row.approvedAt)}</TableCell>
                <TableCell>
                  {row.dueDate ? formatDate(row.dueDate) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  ${formatMoney(row.totalAmount)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  ${formatMoney(row.amountPaid)}
                </TableCell>
                <TableCell
                  className={`text-right font-mono text-xs font-semibold${row.agingBucket === "90_PLUS" ? " text-danger" : ""}`}
                >
                  ${formatMoney(row.balanceDue)}
                </TableCell>
                <TableCell>
                  {row.daysOverdue == null
                    ? "-"
                    : row.daysOverdue < 0
                      ? `${Math.abs(row.daysOverdue)} days remaining`
                      : `${row.daysOverdue} days`}
                </TableCell>
                <TableCell>
                  <Chip
                    color={agingBucketColor(row.agingBucket)}
                    size="sm"
                    variant="flat"
                  >
                    {agingBucketLabel(row.agingBucket)}
                  </Chip>
                </TableCell>
                <TableCell>
                  {row.creditBackingType ? (
                    <Chip size="sm" variant="bordered">
                      {creditBackingLabel(row.creditBackingType)}
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
        <Table isStriped removeWrapper aria-label="Cash accounts receivable">
          <TableHeader>
            <TableColumn>Client</TableColumn>
            <TableColumn>Pre-invoice</TableColumn>
            <TableColumn>Invoice date</TableColumn>
            <TableColumn className="text-right">Total</TableColumn>
            <TableColumn className="text-right">Paid</TableColumn>
            <TableColumn className="text-right">
              Outstanding balance
            </TableColumn>
          </TableHeader>
          <TableBody
            emptyContent={loading ? "Loading..." : "No cash pre-invoices"}
            items={items}
          >
            {(row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.clientName ?? "-"}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs">
                    {row.prefacturaCode}
                  </span>
                </TableCell>
                <TableCell>{formatDate(row.approvedAt)}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  ${formatMoney(row.totalAmount)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  ${formatMoney(row.amountPaid)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold">
                  ${formatMoney(row.balanceDue)}
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
