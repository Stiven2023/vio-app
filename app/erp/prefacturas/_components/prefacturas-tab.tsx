"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
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
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Tooltip } from "@heroui/tooltip";
import NextLink from "next/link";
import {
  BsEye,
  BsCheck2Circle,
  BsFileEarmarkPdf,
  BsPiggyBank,
  BsPlusCircle,
  BsThreeDotsVertical,
  BsTrash,
  BsSend,
  BsArrowRepeat,
  BsLockFill,
} from "react-icons/bs";

import { FilterSearch } from "@/app/erp/catalog/_components/ui/filter-search";
import { FilterSelect } from "@/app/erp/catalog/_components/ui/filter-select";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";
import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import { FileUpload } from "@/components/file-upload";

import {
  APPROVE_ADVANCE_ALLOWED_STATUSES,
  DOCUMENT_TYPE_OPTIONS as documentTypeOptions,
  SIIGO_BLOCKED_STATUSES,
  STATUS_OPTIONS as statusOptions,
  TYPE_OPTIONS as typeOptions,
} from "../_lib/prefacturas-tab.constants";
import {
  canShowReadyDispatchAction,
  formatDate,
  formatMoney,
  formatMoneyByCurrency,
  normalizeAmountInput,
  normalizeCurrency,
  resolveAdvanceStatus,
  resolveTargetStatus,
} from "../_lib/prefacturas-tab.utils";
import type {
  ApproveAdvanceResult,
  BankOption,
  OrderDispatchPreview,
  PrefacturaAdvanceDetail,
  PrefacturaRow,
  ReadyDispatchPreview,
  RequestSchedulingResult,
  SiigoAuthStatus,
} from "../_lib/types";

export function PrefacturasTab({
  canChangeStatus,
  canCreate,
  canEdit,
  canDelete,
  initialStatus = "all",
  lockStatusFilter = false,
  initialDocumentType = "all",
  lockDocumentTypeFilter = false,
  initialOrderStatus = "all",
}: {
  canChangeStatus: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  initialStatus?: string;
  lockStatusFilter?: boolean;
  initialDocumentType?: string;
  lockDocumentTypeFilter?: boolean;
  initialOrderStatus?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [type, setType] = useState("all");
  const [documentType, setDocumentType] = useState(initialDocumentType);

  const endpoint = useMemo(() => {
    const sp = new URLSearchParams();

    const query = q.trim();

    if (query) sp.set("q", query);
    if (status !== "all") sp.set("status", status);
    if (type !== "all") sp.set("type", type);
    if (documentType !== "all") sp.set("documentType", documentType);
    if (initialOrderStatus !== "all") sp.set("orderStatus", initialOrderStatus);

    const qs = sp.toString();

    return `/api/prefacturas${qs ? `?${qs}` : ""}`;
  }, [documentType, q, status, type, initialOrderStatus]);

  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<PrefacturaRow>(endpoint, 10);

  const [pendingDelete, setPendingDelete] = useState<PrefacturaRow | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [banks, setBanks] = useState<BankOption[]>([]);

  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [advanceSubmitting, setAdvanceSubmitting] = useState(false);
  const [advanceTarget, setAdvanceTarget] = useState<PrefacturaRow | null>(
    null,
  );
  const [advanceDetail, setAdvanceDetail] =
    useState<PrefacturaAdvanceDetail | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceMethod, setAdvanceMethod] = useState<
    "EFECTIVO" | "TRANSFERENCIA"
  >("EFECTIVO");
  const [advanceBankId, setAdvanceBankId] = useState("");
  const [advanceReferenceNumber, setAdvanceReferenceNumber] = useState("");
  const [advanceCurrency, setAdvanceCurrency] = useState<"COP" | "USD">("COP");
  const [advanceDate, setAdvanceDate] = useState("");
  const [advanceProofImageUrl, setAdvanceProofImageUrl] = useState("");

  const [readyModalOpen, setReadyModalOpen] = useState(false);
  const [readyLoading, setReadyLoading] = useState(false);
  const [readySubmitting, setReadySubmitting] = useState(false);
  const [readyPreview, setReadyPreview] = useState<ReadyDispatchPreview | null>(
    null,
  );

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveSubmitting, setApproveSubmitting] = useState(false);
  const [approveTarget, setApproveTarget] = useState<PrefacturaRow | null>(null);
  const [approveNote, setApproveNote] = useState("");
  const [approveReference, setApproveReference] = useState("");

  // ── SIIGO integration state ────────────────────────────────────────────────
  const [siigoSending, setSiigoSending] = useState<string | null>(null);
  const [siigoPolling, setSiigoPolling] = useState<string | null>(null);
  const [invoiceDownloadLoading, setInvoiceDownloadLoading] = useState<
    string | null
  >(null);
  const [siigoLiveSubmissionEnabled, setSiigoLiveSubmissionEnabled] =
    useState<boolean>(false);
  const [siigoErrorModal, setSiigoErrorModal] = useState<{
    prefacturaCode: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    apiJson<SiigoAuthStatus>("/api/siigo/auth")
      .then((res) => {
        if (!active) return;
        setSiigoLiveSubmissionEnabled(Boolean(res.liveSubmissionEnabled));
      })
      .catch(() => {
        if (!active) return;
        setSiigoLiveSubmissionEnabled(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    apiJson<{ items: BankOption[] }>("/api/banks?page=1&pageSize=200")
      .then((res) =>
        setBanks((res.items ?? []).filter((bank) => bank.isActive !== false)),
      )
      .catch(() => setBanks([]));
  }, []);

  const emptyContent = useMemo(() => {
    if (data) return "";
    if (
      q.trim() ||
      status !== "all" ||
      type !== "all" ||
      documentType !== "all"
    )
      return "No results";

    return "No prefactures";
  }, [documentType, loading, q, status, type]);

  const removePrefactura = async () => {
    if (!pendingDelete || deleting) return;

    try {
      setDeleting(true);
      await apiJson(`/api/prefacturas/${pendingDelete.id}`, {
        method: "DELETE",
      });

      toast.success("Prefacture deleted");
      setPendingDelete(null);
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const openAdvanceModal = async (row: PrefacturaRow) => {
    setAdvanceTarget(row);
    setAdvanceModalOpen(true);
    setAdvanceLoading(true);

    try {
      const detail = await apiJson<PrefacturaAdvanceDetail>(
        `/api/prefacturas/${row.id}`,
      );

      const paymentCurrency = normalizeCurrency(
        detail.advanceCurrency ?? detail.currency,
      );

      setAdvanceDetail(detail);
      setAdvanceAmount(String(detail.advanceReceived ?? ""));
      setAdvanceMethod(
        detail.advanceMethod === "TRANSFERENCIA" ? "TRANSFERENCIA" : "EFECTIVO",
      );
      setAdvanceBankId(detail.advanceBankId ?? "");
      setAdvanceReferenceNumber(detail.advanceReferenceNumber ?? "");
      setAdvanceCurrency(paymentCurrency);
      setAdvanceDate(
        detail.advanceDate ? String(detail.advanceDate).slice(0, 10) : "",
      );
      setAdvanceProofImageUrl(detail.advancePaymentImageUrl ?? "");
    } catch (error) {
      toast.error(getErrorMessage(error));
      setAdvanceModalOpen(false);
      setAdvanceTarget(null);
    } finally {
      setAdvanceLoading(false);
    }
  };

  const saveAdvancePayment = async () => {
    if (!advanceTarget || advanceSubmitting) return;

    const amount = Number(advanceAmount || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid paid amount");

      return;
    }

    if (advanceMethod === "TRANSFERENCIA" && !advanceBankId.trim()) {
      toast.error("Select the bank for the transfer");

      return;
    }

    if (advanceMethod === "TRANSFERENCIA" && !advanceReferenceNumber.trim()) {
      toast.error("Enter the transfer reference number");

      return;
    }

    if (advanceMethod === "TRANSFERENCIA" && !advanceProofImageUrl.trim()) {
      toast.error("Attach the proof to register the transfer");

      return;
    }

    const total = Number(advanceDetail?.total ?? advanceTarget.total ?? 0);
    const status = resolveAdvanceStatus(amount, total);

    try {
      setAdvanceSubmitting(true);

      await apiJson(`/api/prefacturas/${advanceTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          advanceReceived: amount,
          advanceMethod,
          advanceBankId:
            advanceMethod === "TRANSFERENCIA" ? advanceBankId : null,
          advanceReferenceNumber:
            advanceMethod === "TRANSFERENCIA"
              ? advanceReferenceNumber.trim() || null
              : null,
          advanceCurrency,
          advanceDate: advanceDate || null,
          advancePaymentImageUrl: advanceProofImageUrl || null,
          advanceStatus: status,
        }),
      });

      if (advanceMethod === "EFECTIVO") {
        toast.success("Cash registered — payment confirmed at cashier");
      } else {
        toast.success(
          "Transfer registered as NOT DEPOSITED — pending accounting verification",
        );
      }
      setAdvanceModalOpen(false);
      setAdvanceTarget(null);
      setAdvanceDetail(null);
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAdvanceSubmitting(false);
    }
  };

  const openReadyDispatchModal = async (row: PrefacturaRow) => {
    if (!row.orderId) {
      toast.error("This prefacture has no associated order");

      return;
    }

    setReadyModalOpen(true);
    setReadyLoading(true);
    setReadyPreview(null);

    try {
      const [orderInfo, paymentSummary] = await Promise.all([
        apiJson<OrderDispatchPreview>(`/api/orders/${row.orderId}`),
        apiJson<{ orderTotal?: string | null; paidTotal?: string | null }>(
          `/api/orders/${row.orderId}/payments?page=1&pageSize=1`,
        ),
      ]);

      const orderTotal = Math.max(
        0,
        Number(orderInfo.total ?? 0) + Number(orderInfo.shippingFee ?? 0),
      );
      const paidTotal = Math.max(0, Number(paymentSummary.paidTotal ?? 0));
      const paidPercent =
        orderTotal > 0 ? Math.max(0, (paidTotal / orderTotal) * 100) : 0;
      const target = resolveTargetStatus(
        String(orderInfo.status ?? ""),
        paidPercent,
      );

      setReadyPreview({
        prefacturaCode: row.prefacturaCode,
        orderId: row.orderId,
        orderCode: row.orderCode ?? orderInfo.orderCode,
        currentStatus: String(orderInfo.status ?? "PENDIENTE"),
        targetStatus: target.targetStatus,
        reason: target.reason,
        paidPercent,
        paidTotal,
        orderTotal,
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
      setReadyModalOpen(false);
    } finally {
      setReadyLoading(false);
    }
  };

  const openApproveAdvanceModal = (row: PrefacturaRow) => {
    setApproveTarget(row);
    setApproveModalOpen(true);
    setApproveNote("");
    setApproveReference("");
  };

  const confirmApproveAdvance = async () => {
    if (!approveTarget || approveSubmitting) return;

    try {
      setApproveSubmitting(true);

      const result = await apiJson<ApproveAdvanceResult>(
        `/api/prefacturas/${approveTarget.id}/approve-advance`,
        {
          method: "POST",
          body: JSON.stringify({
            note: approveNote.trim() || null,
            reference: approveReference.trim() || null,
          }),
        },
      );

      toast.success(result.message || "Advance approved successfully.");
      setApproveModalOpen(false);
      setApproveTarget(null);
      setApproveNote("");
      setApproveReference("");
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setApproveSubmitting(false);
    }
  };

  const confirmReadyDispatch = async () => {
    if (!readyPreview || readySubmitting) return;

    try {
      setReadySubmitting(true);
      const result = await apiJson<RequestSchedulingResult>(
        `/api/orders/${readyPreview.orderId}/request-scheduling`,
        {
          method: "POST",
        },
      );

      if (!result.toStatus) {
        toast.error(result.reason || "No applicable destination status.");

        return;
      }

      toast.success(
        result.toStatus === "PROGRAMACION"
          ? "Order sent to Scheduling"
          : "Order sent to Approval",
      );

      if (!result.changed && result.reason) {
        toast(result.reason);
      }

      setReadyModalOpen(false);
      setReadyPreview(null);
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setReadySubmitting(false);
    }
  };

  const canApproveAdvanceAction = (row: PrefacturaRow) => {
    const s = String(row.status ?? "").trim().toUpperCase();

    return (
      Boolean(row.orderId) &&
      (APPROVE_ADVANCE_ALLOWED_STATUSES as readonly string[]).includes(s)
    );
  };

  const isSiigoBlocked = (row: PrefacturaRow) => {
    const s = String(row.siigoStatus ?? "").trim().toUpperCase();

    return (SIIGO_BLOCKED_STATUSES as readonly string[]).includes(s);
  };

  const hasOfficialSiigoInvoice = (row: PrefacturaRow) => {
    if (row.documentType !== "F") return false;
    if (!String(row.siigoInvoiceId ?? "").trim()) return false;
    const status = String(row.siigoStatus ?? "").trim().toUpperCase();

    return ["SENT", "DRAFT", "INVOICED", "ACCEPTED"].includes(status);
  };

  const [siigoPollLoading, setSiigoPollLoading] = useState(false);

  const sendToSiigo = async (row: PrefacturaRow) => {
    if (siigoSending) return;

    try {
      setSiigoSending(row.id);
      await apiJson(`/api/prefacturas/${row.id}/siigo/send`, {
        method: "POST",
      });
      toast.success(`Prefacture ${row.prefacturaCode} sent to SIIGO`);
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSiigoSending(null);
    }
  };

  const pollSingleSiigo = async (row: PrefacturaRow) => {
    if (siigoPolling) return;

    try {
      setSiigoPolling(row.id);
      const result = await apiJson<{
        ok: boolean;
        siigoStatus: string;
      }>(`/api/prefacturas/${row.id}/siigo/poll`, {
        method: "POST",
      });

      toast.success(
        `SIIGO status for ${row.prefacturaCode}: ${result.siigoStatus}`,
      );
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSiigoPolling(null);
    }
  };

  const downloadInvoiceDocument = async (row: PrefacturaRow) => {
    if (invoiceDownloadLoading) return;

    const previewUrl = row.orderId
      ? `/api/exports/orders/${row.orderId}/prefactura-pdf`
      : null;

    if (!hasOfficialSiigoInvoice(row)) {
      if (previewUrl) {
        window.open(previewUrl, "_blank", "noopener,noreferrer");
      } else {
        toast.error("No preview available for this prefacture.");
      }

      return;
    }

    try {
      setInvoiceDownloadLoading(row.id);

      const resolved = await apiJson<{
        ok: boolean;
        officialPdfUrl?: string;
        reason?: string;
        message?: string;
      }>(`/api/prefacturas/${row.id}/siigo/official-invoice-pdf?resolve=1`);

      const officialPdfUrl = String(resolved.officialPdfUrl ?? "").trim();

      if (officialPdfUrl) {
        window.open(officialPdfUrl, "_blank", "noopener,noreferrer");
        toast.success("Official SIIGO invoice opened.");

        return;
      }

      if (previewUrl) {
        window.open(previewUrl, "_blank", "noopener,noreferrer");
        toast("Official PDF not available yet. Downloaded local preview.");

        return;
      }

      toast.error("Official PDF is not available yet.");
    } catch (error) {
      const message = getErrorMessage(error);

      if (previewUrl) {
        window.open(previewUrl, "_blank", "noopener,noreferrer");
        toast(`Could not download official PDF (${message}). Local preview opened.`);

        return;
      }

      toast.error(message);
    } finally {
      setInvoiceDownloadLoading(null);
    }
  };

  const resetSiigoStatus = async (row: PrefacturaRow) => {
    const reason = window
      .prompt(
        `Reason for SIIGO reset of ${row.prefacturaCode}:`,
        "Administrative correction",
      )
      ?.trim();

    if (!reason) return;

    try {
      await apiJson(`/api/prefacturas/${row.id}/siigo/reset`, {
        method: "POST",
        body: JSON.stringify({ reason }),
        headers: { "Content-Type": "application/json" },
      });

      toast.success(`SIIGO reset applied to ${row.prefacturaCode}`);
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const pollSiigoStatus = async () => {
    if (siigoPollLoading) return;

    try {
      setSiigoPollLoading(true);
      const result = await apiJson<{
        ok: boolean;
        polled: number;
        invoiced: number;
        errors: number;
      }>("/api/prefacturas/siigo/poll", { method: "POST" });

      toast.success(
        `SIIGO poll: ${result.polled} queried, ${result.invoiced} invoiced, ${result.errors} with errors`,
      );
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSiigoPollLoading(false);
    }
  };

  const getSiigoStatusChip = (row: PrefacturaRow) => {
    const s = String(row.siigoStatus ?? "").trim().toUpperCase();
    const errorMessage = String(row.siigoErrorMessage ?? "").trim();

    if (!s || s === "NOT_APPLICABLE" || row.documentType !== "F") {
      return (
        <span className="rounded bg-default-100 px-1.5 py-0.5 text-xs text-default-500">
          N/A
        </span>
      );
    }

    if (s === "READY") {
      return (
        <span className="rounded bg-primary-100 px-1.5 py-0.5 text-xs text-primary-700">
          READY
        </span>
      );
    }

    if (s === "SENT") {
      return (
        <span className="rounded bg-warning-100 px-1.5 py-0.5 text-xs text-warning-700">
          SENT
        </span>
      );
    }

    if (s === "DRAFT") {
      return (
        <span className="rounded bg-warning-100 px-1.5 py-0.5 text-xs text-warning-700">
          DRAFT
        </span>
      );
    }

    if (s === "INVOICED") {
      return (
        <span className="rounded bg-success-100 px-1.5 py-0.5 text-xs text-success-700">
          INVOICED
        </span>
      );
    }

    if (s === "ACCEPTED") {
      return (
        <span className="rounded bg-success-100 px-1.5 py-0.5 text-xs text-success-700">
          ACCEPTED
        </span>
      );
    }

    if (s === "REJECTED") {
      return (
        <span className="rounded bg-danger-100 px-1.5 py-0.5 text-xs text-danger-700">
          REJECTED
        </span>
      );
    }

    if (s === "ERROR") {
      const chip = (
        <span className="rounded bg-danger-100 px-1.5 py-0.5 text-xs text-danger-700">
          ERROR
        </span>
      );

      if (!errorMessage) return chip;

      return <Tooltip content={errorMessage}>{chip}</Tooltip>;
    }

    return (
      <span className="rounded bg-default-100 px-1.5 py-0.5 text-xs text-default-500">
        {s || "–"}
      </span>
    );
  };

  const getInvoiceAvailabilityChip = (row: PrefacturaRow) => {
    const canPreview = Boolean(row.orderId);

    if (hasOfficialSiigoInvoice(row)) {
      return (
        <span className="rounded bg-success-100 px-1.5 py-0.5 text-[11px] text-success-700">
          Official PDF
        </span>
      );
    }

    if (canPreview) {
      return (
        <span className="rounded bg-default-100 px-1.5 py-0.5 text-[11px] text-default-600">
          Preview only
        </span>
      );
    }

    return null;
  };

  return (
    <div className="space-y-4">
      {!siigoLiveSubmissionEnabled ? (
        <div className="rounded-md border border-warning-300 bg-warning-50 px-3 py-2 text-sm text-warning-800">
          SIIGO test mode active. Live submission is disabled and no documents
          will be sent to DIAN.
        </div>
      ) : null}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <FilterSearch
            className="w-full sm:w-72"
            placeholder="Prefacture code, quotation or order…"
            value={q}
            onValueChange={setQ}
          />
          <FilterSelect
            className="w-full sm:w-48"
            isDisabled={lockStatusFilter}
            label="Status"
            options={statusOptions}
            value={status}
            onChange={setStatus}
          />
          <FilterSelect
            className="w-full sm:w-48"
            label="Type"
            options={typeOptions}
            value={type}
            onChange={setType}
          />
          <FilterSelect
            className="w-full sm:w-40"
            label="Document"
            isDisabled={lockDocumentTypeFilter}
            options={documentTypeOptions}
            value={documentType}
            onChange={setDocumentType}
          />
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
          {canCreate ? (
            <Button
              color="primary"
              className="w-full sm:w-auto"
              onPress={() => router.push("/erp/pre-invoices/new")}
            >
              <BsPlusCircle /> New prefacture
            </Button>
          ) : null}
          <Button
            className="w-full sm:w-auto"
            isLoading={siigoPollLoading}
            startContent={<BsArrowRepeat />}
            variant="flat"
            onPress={pollSiigoStatus}
          >
            Update SIIGO
          </Button>
          <Dropdown>
            <DropdownTrigger>
              <Button className="w-full sm:w-auto" variant="flat">
                <BsThreeDotsVertical /> More
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Prefacture toolbar actions">
              <DropdownItem
                key="refresh-list"
                startContent={<BsArrowRepeat />}
                onPress={refresh}
              >
                Refresh list
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Prefactures"
          headers={[
            "Code",
            "Quotation",
            "Order",
            "Type",
            "Client",
            "Status",
            "SIIGO",
            "Total",
            "Created",
            "Actions",
          ]}
        />
      ) : (
        <Table aria-label="Prefactures">
          <TableHeader>
            <TableColumn>Code</TableColumn>
            <TableColumn>Quotation</TableColumn>
            <TableColumn>Order</TableColumn>
            <TableColumn>Type</TableColumn>
            <TableColumn>Client</TableColumn>
            <TableColumn>Status</TableColumn>
            <TableColumn>SIIGO</TableColumn>
            <TableColumn>Total</TableColumn>
            <TableColumn>Created</TableColumn>
            <TableColumn>Actions</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={data?.items ?? []}>
            {(row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.prefacturaCode}
                </TableCell>
                <TableCell>{row.quoteCode ?? "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{row.orderCode ?? "-"}</span>
                    <span className="text-xs text-default-500">
                      {row.orderName ?? "-"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{row.orderType ?? "-"}</TableCell>
                <TableCell>{row.clientName ?? "-"}</TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {getSiigoStatusChip(row)}
                    {getInvoiceAvailabilityChip(row)}
                  </div>
                </TableCell>
                <TableCell>{formatMoney(row.total)}</TableCell>
                <TableCell>{formatDate(row.createdAt)}</TableCell>
                <TableCell>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button size="sm" variant="flat">
                        <BsThreeDotsVertical />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Prefacture actions">
                      {row.orderId ? (
                        <DropdownItem
                          key="view"
                          as={NextLink}
                          href={`/erp/orders/${row.orderId}/detail`}
                          startContent={<BsEye />}
                        >
                          View order
                        </DropdownItem>
                      ) : null}
                      {row.orderId && !hasOfficialSiigoInvoice(row) ? (
                        <DropdownItem
                          key="download-invoice-document"
                          startContent={<BsFileEarmarkPdf />}
                          onPress={() => downloadInvoiceDocument(row)}
                        >
                          Download invoice preview (PDF)
                        </DropdownItem>
                      ) : null}
                      {hasOfficialSiigoInvoice(row) ? (
                        <DropdownItem
                          key="download-official-or-preview"
                          isDisabled={invoiceDownloadLoading === row.id}
                          startContent={<BsFileEarmarkPdf />}
                          onPress={() => downloadInvoiceDocument(row)}
                        >
                          {invoiceDownloadLoading === row.id
                            ? "Preparing invoice..."
                            : "Download official SIIGO invoice (PDF)"}
                        </DropdownItem>
                      ) : null}
                      {canEdit && !isSiigoBlocked(row) ? (
                        <DropdownItem
                          key="advance"
                          isDisabled={isSiigoBlocked(row)}
                          startContent={<BsPiggyBank />}
                          onPress={() => openAdvanceModal(row)}
                        >
                          Pay advance
                        </DropdownItem>
                      ) : null}
                      {canEdit && isSiigoBlocked(row) ? (
                        <DropdownItem
                          key="siigo-blocked"
                          isDisabled
                          startContent={<BsLockFill className="text-warning" />}
                        >
                          Locked by SIIGO ({row.siigoStatus})
                        </DropdownItem>
                      ) : null}
                      {row.documentType === "F" &&
                      (String(row.siigoStatus ?? "")
                        .trim()
                        .toUpperCase() === "SENT" ||
                        String(row.siigoStatus ?? "")
                          .trim()
                          .toUpperCase() === "DRAFT") ? (
                        <DropdownItem
                          key="siigo-poll-one"
                          startContent={<BsArrowRepeat />}
                          onPress={() => pollSingleSiigo(row)}
                        >
                          Update SIIGO status
                        </DropdownItem>
                      ) : null}
                      {canChangeStatus && canApproveAdvanceAction(row) ? (
                        <DropdownItem
                          key="approve-advance"
                          startContent={<BsCheck2Circle />}
                          onPress={() => openApproveAdvanceModal(row)}
                        >
                          Approve advance (Accounting)
                        </DropdownItem>
                      ) : null}
                      {canChangeStatus &&
                      row.orderId &&
                      canShowReadyDispatchAction(row.status) ? (
                        <DropdownItem
                          key="ready-dispatch"
                          startContent={<BsCheck2Circle />}
                          onPress={() => openReadyDispatchModal(row)}
                        >
                          Order / designs ready
                        </DropdownItem>
                      ) : null}
                      {canEdit &&
                      row.documentType === "F" &&
                      !isSiigoBlocked(row) ? (
                        <DropdownItem
                          key="siigo-send"
                          startContent={<BsSend />}
                          onPress={() => sendToSiigo(row)}
                        >
                          Send to SIIGO
                        </DropdownItem>
                      ) : null}
                      {canChangeStatus &&
                      row.documentType === "F" &&
                      String(row.siigoStatus ?? "")
                        .trim()
                        .toUpperCase() !== "NOT_APPLICABLE" ? (
                        <DropdownItem
                          key="siigo-reset"
                          startContent={<BsArrowRepeat />}
                          onPress={() => resetSiigoStatus(row)}
                        >
                          Reset SIIGO
                        </DropdownItem>
                      ) : null}
                      {canDelete ? (
                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          color="danger"
                          isDisabled={isSiigoBlocked(row)}
                          startContent={<BsTrash />}
                          onPress={() => setPendingDelete(row)}
                        >
                          Delete
                        </DropdownItem>
                      ) : null}
                    </DropdownMenu>
                  </Dropdown>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-default-500">Total: {data?.total ?? 0}</p>
        <div className="flex gap-2">
          <Button
            isDisabled={page <= 1 || loading}
            variant="flat"
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            isDisabled={!data?.hasNextPage || loading}
            variant="flat"
            onPress={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <ConfirmActionModal
        cancelLabel="Cancel"
        confirmLabel="Delete"
        description={
          pendingDelete
            ? `Delete prefacture ${pendingDelete.prefacturaCode}?`
            : undefined
        }
        isLoading={deleting}
        isOpen={Boolean(pendingDelete)}
        title="Confirm deletion"
        onConfirm={removePrefactura}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      />

      <Modal
        disableAnimation
        isOpen={advanceModalOpen}
        size="xl"
        onOpenChange={(open) => {
          setAdvanceModalOpen(open);
          if (!open) {
            setAdvanceTarget(null);
            setAdvanceDetail(null);
          }
        }}
      >
        <ModalContent>
          <ModalHeader>Register advance</ModalHeader>
          <ModalBody>
            {advanceLoading ? (
              <p className="text-sm text-default-500">Loading prefacture...</p>
            ) : (
              <div className="space-y-3">
                <div className="rounded-medium border border-default-200 bg-default-50 p-3 text-sm">
                  <div>
                    <span className="text-default-500">Prefacture:</span>{" "}
                    <strong>
                      {advanceDetail?.prefacturaCode ??
                        advanceTarget?.prefacturaCode ??
                        "-"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-default-500">50% goal:</span>{" "}
                    <strong>
                      {formatMoneyByCurrency(
                        Number(
                          advanceDetail?.total ?? advanceTarget?.total ?? 0,
                        ) * 0.5,
                        normalizeCurrency(advanceDetail?.currency),
                      )}
                    </strong>
                  </div>
                </div>

                <Input
                  label="Paid amount"
                  placeholder="0"
                  value={advanceAmount}
                  variant="bordered"
                  onValueChange={(value) =>
                    setAdvanceAmount(normalizeAmountInput(value))
                  }
                />

                <Select
                  label="Payment method"
                  selectedKeys={[advanceMethod]}
                  variant="bordered"
                  onSelectionChange={(keys) => {
                    const first = String(Array.from(keys)[0] ?? "EFECTIVO");

                    setAdvanceMethod(
                      first === "TRANSFERENCIA" ? "TRANSFERENCIA" : "EFECTIVO",
                    );
                  }}
                >
                  <SelectItem key="EFECTIVO">Cash</SelectItem>
                  <SelectItem key="TRANSFERENCIA">Transfer</SelectItem>
                </Select>

                <Select
                  label="Currency"
                  selectedKeys={[advanceCurrency]}
                  variant="bordered"
                  onSelectionChange={(keys) => {
                    const first = String(Array.from(keys)[0] ?? "COP");

                    setAdvanceCurrency(first === "USD" ? "USD" : "COP");
                  }}
                >
                  <SelectItem key="COP">COP</SelectItem>
                  <SelectItem key="USD">USD</SelectItem>
                </Select>

                {advanceMethod === "TRANSFERENCIA" ? (
                  <>
                    <Select
                      label="Bank"
                      selectedKeys={advanceBankId ? [advanceBankId] : []}
                      variant="bordered"
                      onSelectionChange={(keys) => {
                        setAdvanceBankId(String(Array.from(keys)[0] ?? ""));
                      }}
                    >
                      {banks.map((bank) => (
                        <SelectItem key={bank.id}>
                          {[bank.code, bank.name].filter(Boolean).join(" - ")}
                        </SelectItem>
                      ))}
                    </Select>

                    <Input
                      label="Reference number"
                      placeholder="E.g: 8457712201"
                      value={advanceReferenceNumber}
                      variant="bordered"
                      onValueChange={setAdvanceReferenceNumber}
                    />
                  </>
                ) : null}

                <Input
                  label="Payment date"
                  type="date"
                  value={advanceDate}
                  variant="bordered"
                  onValueChange={setAdvanceDate}
                />

                <FileUpload
                  acceptedFileTypes="image/*"
                  errorMessage={
                    advanceMethod === "TRANSFERENCIA" &&
                    !advanceProofImageUrl.trim()
                      ? "The proof is required for transfers"
                      : undefined
                  }
                  isRequired={advanceMethod === "TRANSFERENCIA"}
                  label="Advance proof"
                  uploadFolder="prefacturas/anticipos"
                  value={advanceProofImageUrl}
                  onChange={setAdvanceProofImageUrl}
                  onClear={() => setAdvanceProofImageUrl("")}
                />
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setAdvanceModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={advanceLoading || advanceSubmitting}
              onPress={saveAdvancePayment}
            >
              {advanceSubmitting ? "Saving..." : "Save advance"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        disableAnimation
        isOpen={approveModalOpen}
        onOpenChange={(open) => {
          setApproveModalOpen(open);
          if (!open) {
            setApproveTarget(null);
            setApproveNote("");
            setApproveReference("");
          }
        }}
      >
        <ModalContent>
          <ModalHeader>Approve advance (Accounting)</ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <p className="text-sm text-default-600">
                This action confirms the advance in accounting and may auto-move
                the order to Scheduling if it already meets Option B rules.
              </p>
              <div className="rounded-medium border border-default-200 bg-default-50 p-3 text-sm">
                <div>
                  <span className="text-default-500">Prefacture:</span>{" "}
                  <strong>{approveTarget?.prefacturaCode ?? "-"}</strong>
                </div>
                <div>
                  <span className="text-default-500">Order:</span>{" "}
                  <strong>{approveTarget?.orderCode ?? "-"}</strong>
                </div>
                <div>
                  <span className="text-default-500">Current status:</span>{" "}
                  <strong>{approveTarget?.status ?? "-"}</strong>
                </div>
              </div>

              <Input
                label="Reference (optional)"
                placeholder="Accounting approval reference"
                value={approveReference}
                variant="bordered"
                onValueChange={setApproveReference}
              />

              <Input
                label="Note (optional)"
                placeholder="Approval note"
                value={approveNote}
                variant="bordered"
                onValueChange={setApproveNote}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setApproveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={!approveTarget || approveSubmitting}
              onPress={confirmApproveAdvance}
            >
              {approveSubmitting ? "Approving..." : "Approve advance"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        disableAnimation
        isOpen={readyModalOpen}
        onOpenChange={(open) => {
          setReadyModalOpen(open);
          if (!open) setReadyPreview(null);
        }}
      >
        <ModalContent>
          <ModalHeader>Confirm order shipment</ModalHeader>
          <ModalBody>
            {readyLoading ? (
              <p className="text-sm text-default-500">Loading preview...</p>
            ) : !readyPreview ? (
              <p className="text-sm text-default-500">
                Could not load preview.
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-default-500">Prefacture:</span>{" "}
                  <strong>{readyPreview.prefacturaCode}</strong>
                </div>
                <div>
                  <span className="text-default-500">Order:</span>{" "}
                  <strong>{readyPreview.orderCode || "-"}</strong>
                </div>
                <div>
                  <span className="text-default-500">Current status:</span>{" "}
                  <strong>{readyPreview.currentStatus}</strong>
                </div>
                <div>
                  <span className="text-default-500">Order total:</span>{" "}
                  <strong>{formatMoney(readyPreview.orderTotal)}</strong>
                </div>
                <div>
                  <span className="text-default-500">Confirmed paid:</span>{" "}
                  <strong>{formatMoney(readyPreview.paidTotal)}</strong>
                </div>
                <div>
                  <span className="text-default-500">Paid percentage:</span>{" "}
                  <strong>{readyPreview.paidPercent.toFixed(0)}%</strong>
                </div>
                <div>
                  <span className="text-default-500">Destination:</span>{" "}
                  <strong>
                    {readyPreview.targetStatus ?? "Not applicable"}
                  </strong>
                </div>
                <div className="rounded-medium border border-default-200 bg-default-50 p-2 text-default-700">
                  {readyPreview.reason}
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setReadyModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={
                readyLoading || readySubmitting || !readyPreview
              }
              onPress={confirmReadyDispatch}
            >
              {readySubmitting ? "Confirming..." : "Confirm shipment"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* SIIGO Error Detail Modal */}
      <Modal
        isOpen={Boolean(siigoErrorModal)}
        onClose={() => setSiigoErrorModal(null)}
      >
        <ModalContent>
          <ModalHeader>
            SIIGO Error — {siigoErrorModal?.prefacturaCode}
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-danger whitespace-pre-wrap break-words">
              {siigoErrorModal?.message ?? "No error details."}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              variant="flat"
              onPress={() => setSiigoErrorModal(null)}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
