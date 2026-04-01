"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import {
  BsDownload,
  BsEye,
  BsFileEarmarkCheck,
  BsPencilSquare,
  BsThreeDotsVertical,
  BsTrash,
} from "react-icons/bs";

import { useClientOnly } from "../_hooks/useClientOnly";
import {
  getPrefactureOrderTypeOptions,
  QUOTATION_COPY,
} from "../_lib/constants";
import { getQuotationUiLocale } from "../_lib/utils";
import type { PrefactureOrderType } from "../_lib/types";

import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";
import { ConfirmActionModal } from "@/components/confirm-action-modal";

type QuotationRow = {
  id: string;
  quoteCode: string;
  currency: string | null;
  total: string | null;
  prefacturaApproved: boolean | null;
  isActive: boolean | null;
  createdAt: string | null;
  expiryDate: string | null;
  clientName: string | null;
  sellerName: string | null;
};

type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

function parseDateOnly(input: string | null | undefined) {
  if (!input) return null;
  const value = String(input).trim();

  if (!value) return null;

  const normalized = value.includes("T") ? value.slice(0, 10) : value;
  const date = new Date(`${normalized}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getExpiryBadge(expiryDate: string | null | undefined) {
  const expiry = parseDateOnly(expiryDate);

  if (!expiry) {
    return {
      label: "-",
      className: "text-default-600",
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  const formatted = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(expiry);

  if (diffDays < 0) {
    return {
      label: `${formatted} · Expired`,
      className: "text-danger font-semibold",
    };
  }

  if (diffDays <= 1) {
    return {
      label: `${formatted} · Critical`,
      className: "text-danger font-semibold",
    };
  }

  if (diffDays <= 5) {
    return {
      label: `${formatted} · Upcoming`,
      className: "text-warning font-semibold",
    };
  }

  return {
    label: formatted,
    className: "text-default-700",
  };
}

function formatMoneyByCurrency(
  value: string | number | null | undefined,
  currency: string | null | undefined,
) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) return "-";

  const code =
    String(currency ?? "COP").toUpperCase() === "USD" ? "USD" : "COP";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function QuotationsList() {
  const locale = getQuotationUiLocale();
  const copy = QUOTATION_COPY[locale];
  const prefactureOrderTypeOptions = getPrefactureOrderTypeOptions(locale);
  const router = useRouter();
  const isMounted = useClientOnly();
  const [rows, setRows] = useState<Paginated<QuotationRow> | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [currency, setCurrency] = useState("ALL");
  const [status, setStatus] = useState("active");
  const [pendingDelete, setPendingDelete] = useState<QuotationRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadRow, setDownloadRow] = useState<QuotationRow | null>(null);
  const [prefacturaId, setPrefacturaId] = useState<string | null>(null);
  const [prefacturaRow, setPrefacturaRow] = useState<QuotationRow | null>(null);
  const [prefacturaOrderName, setPrefacturaOrderName] = useState("");
  const [prefacturaOrderType, setPrefacturaOrderType] =
    useState<PrefactureOrderType>("VN");

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "10",
      status,
    });

    if (query.trim()) params.set("q", query.trim());
    if (currency !== "ALL") params.set("currency", currency);

    return `/api/quotations?${params.toString()}`;
  }, [currency, page, query, status]);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const data = await apiJson<Paginated<QuotationRow>>(endpoint);

      setRows(data);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setRows(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [endpoint]);

  const emptyContent = loading ? "" : copy.list.empty;

  const downloadPdf = async (
    row: QuotationRow,
    audience: "interno" | "externo" = "interno",
  ) => {
    if (downloadingId) return;

    try {
      setDownloadingId(row.id);
      const params = new URLSearchParams({ audience });
      const response = await fetch(
        `/api/exports/quotations/${row.id}/pdf?${params.toString()}`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `quotation-${row.quoteCode}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setDownloadRow(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDownloadingId(null);
    }
  };

  const openDownloadModal = (row: QuotationRow) => {
    if (downloadingId) return;
    setDownloadRow(row);
  };

  const downloadExcel = async (row: QuotationRow) => {
    if (downloadingId) return;

    try {
      setDownloadingId(row.id);
      const response = await fetch(`/api/exports/quotations/${row.id}/excel`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `quotation-${row.quoteCode}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDownloadingId(null);
    }
  };

  const openPrefacturaModal = (row: QuotationRow) => {
    const defaultName = `Order ${row.quoteCode}`;
    const defaultType: PrefactureOrderType =
      String(row.currency ?? "COP").toUpperCase() === "USD" ? "VI" : "VN";

    setPrefacturaRow(row);
    setPrefacturaOrderName(defaultName);
    setPrefacturaOrderType(defaultType);
  };

  const closePrefacturaModal = () => {
    if (prefacturaId) return;
    setPrefacturaRow(null);
    setPrefacturaOrderName("");
    setPrefacturaOrderType("VN");
  };

  const convertToPrefactura = async () => {
    if (!prefacturaRow || prefacturaId) return;

    const orderName =
      prefacturaOrderName.trim() || `Order ${prefacturaRow.quoteCode}`;

    try {
      setPrefacturaId(prefacturaRow.id);
      const result = await apiJson<{
        order: {
          id: string;
          orderCode: string;
          orderName: string | null;
        } | null;
        reused: boolean;
      }>(`/api/quotations/${prefacturaRow.id}/prefactura`, {
        method: "POST",
        body: JSON.stringify({ orderName, orderType: prefacturaOrderType }),
      });

      toast.success(
        result.reused
          ? copy.list.prefactureUpdated(result.order?.orderCode ?? "-")
          : copy.list.prefactureCreated(result.order?.orderCode ?? "-"),
      );

      fetchRows();

      if (result.order?.id) {
        router.push(`/erp/orders/${result.order.id}/detail`);
      }

      setPrefacturaRow(null);
      setPrefacturaOrderName("");
      setPrefacturaOrderType("VN");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPrefacturaId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Input
            className="sm:w-80"
            label={copy.list.search}
            placeholder={copy.list.searchPlaceholder}
            value={query}
            onValueChange={(v) => {
              setPage(1);
              setQuery(v);
            }}
          />
          {isMounted ? (
            <>
              <Select
                className="sm:w-44"
                label={copy.list.currency}
                selectedKeys={[currency]}
                onSelectionChange={(keys) => {
                  const first = String(Array.from(keys)[0] ?? "ALL");

                  setPage(1);
                  setCurrency(first);
                }}
              >
                <SelectItem key="ALL">{copy.list.all}</SelectItem>
                <SelectItem key="COP">COP</SelectItem>
                <SelectItem key="USD">USD</SelectItem>
              </Select>
              <Select
                className="sm:w-44"
                label={copy.list.status}
                selectedKeys={[status]}
                onSelectionChange={(keys) => {
                  const first = String(Array.from(keys)[0] ?? "active");

                  setPage(1);
                  setStatus(first);
                }}
              >
                <SelectItem key="active">{copy.list.active}</SelectItem>
                <SelectItem key="inactive">{copy.list.inactive}</SelectItem>
                <SelectItem key="all">{copy.list.all}</SelectItem>
              </Select>
            </>
          ) : (
            <>
              <div className="sm:w-44 h-14 rounded-xl border border-default-200 bg-content1" />
              <div className="sm:w-44 h-14 rounded-xl border border-default-200 bg-content1" />
            </>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="flat" onPress={fetchRows}>
            {copy.list.refresh}
          </Button>
          <Button
            color="primary"
            onPress={() => router.push("/quotations/new")}
          >
            {copy.list.createQuotation}
          </Button>
        </div>
      </div>

      <Table aria-label={copy.list.empty}>
        <TableHeader>
          <TableColumn>{copy.list.headers.code}</TableColumn>
          <TableColumn>{copy.list.headers.client}</TableColumn>
          <TableColumn>{copy.list.headers.seller}</TableColumn>
          <TableColumn>{copy.list.headers.expiration}</TableColumn>
          <TableColumn>{copy.list.headers.currency}</TableColumn>
          <TableColumn>{copy.list.headers.total}</TableColumn>
          <TableColumn>{copy.list.headers.status}</TableColumn>
          <TableColumn>{copy.list.headers.actions}</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent={emptyContent}
          isLoading={loading}
          items={rows?.items ?? []}
        >
          {(row) => (
            <TableRow key={row.id}>
              <TableCell>{row.quoteCode}</TableCell>
              <TableCell>{row.clientName ?? "-"}</TableCell>
              <TableCell>{row.sellerName ?? "-"}</TableCell>
              <TableCell>
                {(() => {
                  const expiryBadge = getExpiryBadge(row.expiryDate);

                  return (
                    <span className={expiryBadge.className}>
                      {expiryBadge.label}
                    </span>
                  );
                })()}
              </TableCell>
              <TableCell>{row.currency ?? "-"}</TableCell>
              <TableCell>
                {formatMoneyByCurrency(row.total, row.currency)}
              </TableCell>
              <TableCell>{row.isActive ? copy.list.active : copy.list.inactive}</TableCell>
              <TableCell>
                <Dropdown>
                  <DropdownTrigger>
                    <Button size="sm" variant="flat">
                      <BsThreeDotsVertical />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label={copy.list.actionsAriaLabel}>
                    <DropdownItem
                      key="view"
                      startContent={<BsEye />}
                      onPress={() => router.push(`/quotations/${row.id}`)}
                    >
                      {copy.list.actionViewEdit}
                    </DropdownItem>
                    <DropdownItem
                      key="edit"
                      startContent={<BsPencilSquare />}
                      onPress={() => router.push(`/quotations/${row.id}`)}
                    >
                      {copy.list.actionEdit}
                    </DropdownItem>
                    <DropdownItem
                      key="download"
                      startContent={<BsDownload />}
                      onPress={() => openDownloadModal(row)}
                    >
                      {downloadingId === row.id
                        ? copy.list.actionDownloadingPdf
                        : copy.list.actionDownloadPdf}
                    </DropdownItem>
                    <DropdownItem
                      key="download-excel"
                      startContent={<BsDownload />}
                      onPress={() => downloadExcel(row)}
                    >
                      {downloadingId === row.id
                        ? copy.list.actionDownloadingExcel
                        : copy.list.actionDownloadExcel}
                    </DropdownItem>
                    <DropdownItem
                      key="prefactura"
                      startContent={<BsFileEarmarkCheck />}
                      onPress={() => openPrefacturaModal(row)}
                    >
                      {prefacturaId === row.id
                        ? copy.list.actionConverting
                        : row.prefacturaApproved
                          ? copy.list.actionRevertPrefacture
                          : copy.list.actionApprovePrefacture}
                    </DropdownItem>
                    <DropdownItem
                      key="delete"
                      className="text-danger"
                      startContent={<BsTrash />}
                      onPress={() => setPendingDelete(row)}
                    >
                      {copy.list.actionDelete}
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between">
        <p className="text-sm text-default-500">
          {copy.list.total(rows?.total ?? 0)}
        </p>
        <div className="flex gap-2">
          <Button
            isDisabled={page <= 1 || loading}
            variant="flat"
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          >
            {copy.list.previous}
          </Button>
          <Button
            isDisabled={!rows?.hasNextPage || loading}
            variant="flat"
            onPress={() => setPage((p) => p + 1)}
          >
            {copy.list.next}
          </Button>
        </div>
      </div>

      <ConfirmActionModal
        cancelLabel={copy.list.cancel}
        confirmLabel={copy.list.actionDelete}
        description={
          pendingDelete
            ? copy.list.deleteDescription(pendingDelete.quoteCode)
            : undefined
        }
        isLoading={deleting}
        isOpen={Boolean(pendingDelete)}
        title={copy.list.deleteTitle}
        onConfirm={async () => {
          if (!pendingDelete || deleting) return;
          try {
            setDeleting(true);
            await apiJson(`/api/quotations/${pendingDelete.id}`, {
              method: "DELETE",
            });
            toast.success(copy.list.deleteSuccess);
            setPendingDelete(null);
            fetchRows();
          } catch (error) {
            toast.error(getErrorMessage(error));
          } finally {
            setDeleting(false);
          }
        }}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      />

      <Modal
        disableAnimation
        isDismissable={!downloadingId}
        isKeyboardDismissDisabled={Boolean(downloadingId)}
        isOpen={Boolean(downloadRow)}
        onOpenChange={(open) => {
          if (!open && !downloadingId) setDownloadRow(null);
        }}
      >
        <ModalContent>
          <ModalHeader>{copy.list.downloadTitle}</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              {copy.list.downloadDescription}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={Boolean(downloadingId)}
              variant="light"
              onPress={() => setDownloadRow(null)}
            >
              {copy.list.cancel}
            </Button>
            <Button
              isDisabled={Boolean(downloadingId) || !downloadRow}
              variant="flat"
              onPress={() => {
                if (!downloadRow) return;
                downloadPdf(downloadRow, "interno");
              }}
            >
              {copy.list.internalPdf}
            </Button>
            <Button
              color="primary"
              isDisabled={Boolean(downloadingId) || !downloadRow}
              onPress={() => {
                if (!downloadRow) return;
                downloadPdf(downloadRow, "externo");
              }}
            >
              {copy.list.externalPdf}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        disableAnimation
        isDismissable={!prefacturaId}
        isKeyboardDismissDisabled={Boolean(prefacturaId)}
        isOpen={Boolean(prefacturaRow)}
        onOpenChange={(open) => {
          if (!open) closePrefacturaModal();
        }}
      >
        <ModalContent>
          <ModalHeader>
            {prefacturaRow?.prefacturaApproved
              ? copy.list.prefactureModalRevert
              : copy.list.prefactureModalApprove}
          </ModalHeader>
          <ModalBody className="space-y-3">
            <Input
              label={copy.editor.orderName}
              placeholder="E.g: Order COT10001"
              value={prefacturaOrderName}
              onValueChange={setPrefacturaOrderName}
            />
            <Select
              label={copy.editor.orderType}
              selectedKeys={[prefacturaOrderType]}
              onSelectionChange={(keys) => {
                const first = String(Array.from(keys)[0] ?? "VN");

                setPrefacturaOrderType(
                  first === "VI" || first === "VT" || first === "VW"
                    ? first
                    : "VN",
                );
              }}
            >
              {prefactureOrderTypeOptions.map((option) => (
                <SelectItem key={option.value}>{option.label}</SelectItem>
              ))}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={Boolean(prefacturaId)}
              variant="flat"
              onPress={closePrefacturaModal}
            >
              {copy.list.cancel}
            </Button>
            <Button
              color="primary"
              isDisabled={Boolean(prefacturaId)}
              onPress={convertToPrefactura}
            >
              {prefacturaId ? copy.list.actionConverting : copy.list.confirm}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
