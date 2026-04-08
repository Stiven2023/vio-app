"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Chip } from "@heroui/chip";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { BsFileEarmarkPdf, BsSend, BsThreeDotsVertical } from "react-icons/bs";

import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";
import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";

type SupplierInvoiceRow = {
  id: string;
  invoiceCode: string;
  supplierName: string | null;
  supplierInvoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  subtotal: string | null;
  total: string | null;
  status: string;
  documentType: string | null;
  siigoStatus: string | null;
  createdAt: string | null;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "RECIBIDA", label: "Received" },
  { value: "VERIFICADA", label: "Verified" },
  { value: "APROBADA", label: "Approved" },
  { value: "CONTABILIZADA", label: "Posted" },
  { value: "PAGADA", label: "Paid" },
  { value: "RECHAZADA", label: "Rejected" },
];

const DOC_TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "F", label: "F — Invoice (Siigo)" },
  { value: "R", label: "R — Remision" },
];

const SIIGO_BLOCKED = new Set(["SENT", "INVOICED", "ACCEPTED"]);

function formatMoney(v: string | null) {
  if (!v) return "—";
  const num = Number(v);

  return Number.isFinite(num)
    ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(num)
    : "—";
}

function formatDate(v: string | null) {
  if (!v) return "—";
  return String(v).slice(0, 10);
}

function statusColor(s: string): "warning" | "primary" | "success" | "danger" | "default" {
  switch (s) {
    case "RECIBIDA": return "warning";
    case "VERIFICADA": return "primary";
    case "APROBADA": return "success";
    case "CONTABILIZADA": return "success";
    case "PAGADA": return "success";
    case "RECHAZADA": return "danger";
    default: return "default";
  }
}

export function SupplierInvoicesTab({
  canEdit,
}: {
  canEdit: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [siigoSending, setSiigoSending] = useState<string | null>(null);
  const [remisionGenerating, setRemisionGenerating] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    const sp = new URLSearchParams();

    if (statusFilter !== "all") sp.set("status", statusFilter);
    const qs = sp.toString();

    return `/api/supplier-invoices${qs ? `?${qs}` : ""}`;
  }, [statusFilter]);

  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<SupplierInvoiceRow>(endpoint, 20);

  const rows = useMemo(() => {
    if (!data?.items) return [];
    if (docTypeFilter === "all") return data.items;
    return data.items.filter((r) => r.documentType === docTypeFilter);
  }, [data, docTypeFilter]);

  const isSiigoBlocked = (row: SupplierInvoiceRow) => {
    if (!row.siigoStatus) return false;
    return SIIGO_BLOCKED.has(String(row.siigoStatus).toUpperCase());
  };

  const sendToSiigo = async (row: SupplierInvoiceRow) => {
    if (siigoSending) return;
    try {
      setSiigoSending(row.id);
      await apiJson(`/api/supplier-invoices/${row.id}/siigo/send`, { method: "POST" });
      toast.success(`${row.invoiceCode} sent to SIIGO`);
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSiigoSending(null);
    }
  };

  const generateRemision = async (row: SupplierInvoiceRow) => {
    if (remisionGenerating) return;
    try {
      setRemisionGenerating(row.id);
      await apiJson(`/api/supplier-invoices/${row.id}/remision/generate`, { method: "POST" });
      toast.success(`Remision generated for ${row.invoiceCode}`);
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRemisionGenerating(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          aria-label="Filter by status"
          className="w-44"
          selectedKeys={[statusFilter]}
          size="sm"
          onSelectionChange={(keys) => {
            const val = Array.from(keys)[0];

            if (val) setStatusFilter(String(val));
          }}
        >
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value}>{o.label}</SelectItem>
          ))}
        </Select>
        <Select
          aria-label="Filter by document type"
          className="w-52"
          selectedKeys={[docTypeFilter]}
          size="sm"
          onSelectionChange={(keys) => {
            const val = Array.from(keys)[0];

            if (val) setDocTypeFilter(String(val));
          }}
        >
          {DOC_TYPE_OPTIONS.map((o) => (
            <SelectItem key={o.value}>{o.label}</SelectItem>
          ))}
        </Select>
      </div>

      {/* Table */}
      <Table
        aria-label="Supplier invoices"
        isStriped
        removeWrapper
        classNames={{ thead: "[&_tr]:!rounded-none" }}
      >
        <TableHeader>
          <TableColumn>Code</TableColumn>
          <TableColumn>Supplier</TableColumn>
          <TableColumn>Invoice #</TableColumn>
          <TableColumn>Date</TableColumn>
          <TableColumn>Total</TableColumn>
          <TableColumn>Type</TableColumn>
          <TableColumn>Status</TableColumn>
          <TableColumn>Siigo</TableColumn>
          {canEdit ? <TableColumn>Actions</TableColumn> : <TableColumn> </TableColumn>}
        </TableHeader>
        <TableBody
          emptyContent={loading ? "Loading..." : "No supplier invoices found"}
          isLoading={loading}
          items={rows}
        >
          {(row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-xs">{row.invoiceCode}</TableCell>
              <TableCell>{row.supplierName ?? "—"}</TableCell>
              <TableCell>{row.supplierInvoiceNumber ?? "—"}</TableCell>
              <TableCell>{formatDate(row.invoiceDate)}</TableCell>
              <TableCell>{formatMoney(row.total)}</TableCell>
              <TableCell>
                {row.documentType ? (
                  <Chip
                    color={row.documentType === "F" ? "primary" : "secondary"}
                    size="sm"
                    variant="flat"
                  >
                    {row.documentType}
                  </Chip>
                ) : (
                  <span className="text-default-400 text-xs">—</span>
                )}
              </TableCell>
              <TableCell>
                <Chip color={statusColor(row.status)} size="sm" variant="flat">
                  {row.status}
                </Chip>
              </TableCell>
              <TableCell>
                {row.siigoStatus ? (
                  <Chip
                    color={
                      row.siigoStatus === "NOT_APPLICABLE"
                        ? "default"
                        : isSiigoBlocked(row)
                        ? "success"
                        : "warning"
                    }
                    size="sm"
                    variant="flat"
                  >
                    {row.siigoStatus}
                  </Chip>
                ) : (
                  <span className="text-default-400 text-xs">—</span>
                )}
              </TableCell>
              <TableCell>
                {canEdit ? (
                  <Dropdown>
                    <DropdownTrigger>
                      <Button isIconOnly size="sm" variant="light">
                        <BsThreeDotsVertical />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Actions">
                      {canEdit && row.documentType === "F" && !isSiigoBlocked(row) ? (
                        <DropdownItem
                          key="siigo-send"
                          isDisabled={siigoSending === row.id}
                          startContent={<BsSend />}
                          onPress={() => sendToSiigo(row)}
                        >
                          {siigoSending === row.id ? "Sending..." : "Send to SIIGO"}
                        </DropdownItem>
                      ) : null}
                      {canEdit && row.documentType !== "F" ? (
                        <DropdownItem
                          key="remision-generate"
                          isDisabled={remisionGenerating === row.id || isSiigoBlocked(row)}
                          startContent={<BsFileEarmarkPdf />}
                          onPress={() => generateRemision(row)}
                        >
                          {remisionGenerating === row.id ? "Generating..." : "Generate remision"}
                        </DropdownItem>
                      ) : null}
                    </DropdownMenu>
                  </Dropdown>
                ) : null}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between">
        <p className="text-sm text-default-500">Total: {data?.total ?? rows.length}</p>
        <div className="flex gap-2">
          <Button
            isDisabled={page <= 1 || loading}
            size="sm"
            variant="flat"
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <Button
            isDisabled={!data || rows.length < 20 || loading}
            size="sm"
            variant="flat"
            onPress={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
