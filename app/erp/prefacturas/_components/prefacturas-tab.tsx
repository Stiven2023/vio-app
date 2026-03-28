"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
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
import NextLink from "next/link";
import {
  BsEye,
  BsCheck2Circle,
  BsPiggyBank,
  BsPlusCircle,
  BsThreeDotsVertical,
  BsTrash,
} from "react-icons/bs";

import { FilterSearch } from "@/app/erp/catalog/_components/ui/filter-search";
import { FilterSelect } from "@/app/erp/catalog/_components/ui/filter-select";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";
import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import { FileUpload } from "@/components/file-upload";

type OrderType = "VN" | "VI" | "VT" | "VW";

type PrefacturaRow = {
  id: string;
  prefacturaCode: string;
  quotationId: string | null;
  quoteCode: string | null;
  orderId: string | null;
  orderCode: string | null;
  orderName: string | null;
  orderType: OrderType | null;
  status: string;
  totalProducts: string | null;
  subtotal: string | null;
  total: string | null;
  clientName: string | null;
  documentType: "F" | "R" | null;
  approvedAt: string | null;
  createdAt: string | null;
};

type BankOption = {
  id: string;
  code: string;
  name: string;
  accountRef: string;
  isActive: boolean | null;
};

type PrefacturaAdvanceDetail = {
  id: string;
  prefacturaCode?: string | null;
  total?: string | null;
  currency?: string | null;
  advanceRequired?: string | null;
  advanceReceived?: string | null;
  advanceMethod?: "EFECTIVO" | "TRANSFERENCIA" | null;
  advanceBankId?: string | null;
  advanceReferenceNumber?: string | null;
  advanceCurrency?: string | null;
  advanceDate?: string | null;
  advancePaymentImageUrl?: string | null;
};

type OrderDispatchPreview = {
  id: string;
  orderCode: string;
  status: string;
  total: string | null;
  shippingFee?: string | null;
};

type ReadyDispatchPreview = {
  prefacturaCode: string;
  orderId: string;
  orderCode: string;
  currentStatus: string;
  targetStatus: "APROBACION" | "PROGRAMACION" | null;
  reason: string;
  paidPercent: number;
  paidTotal: number;
  orderTotal: number;
};

type ApproveAdvanceResult = {
  ok: boolean;
  prefacturaId: string;
  orderId: string | null;
  accountingApproved: boolean;
  fromOrderStatus: string;
  toOrderStatus: string | null;
  paidPercent: number;
  autoScheduled: boolean;
  message: string;
};

type RequestSchedulingResult = {
  changed: boolean;
  fromStatus: string;
  toStatus: "APROBACION" | "PROGRAMACION" | null;
  reason: string;
};

const documentTypeOptions = [
  { value: "all", label: "All" },
  { value: "F", label: "F" },
  { value: "R", label: "R" },
];

const statusOptions = [
  { value: "all", label: "All" },
  { value: "PENDIENTE_CONTABILIDAD", label: "Pending accounting" },
  { value: "APROBADO_CONTABILIDAD", label: "Accounting approved" },
  { value: "APROBACION", label: "Approval" },
  { value: "PROGRAMACION", label: "Scheduling" },
  { value: "PENDIENTE", label: "Pending" },
  { value: "APROBADA", label: "Approved" },
  { value: "CANCELADA", label: "Cancelled" },
  { value: "ANULADA", label: "Voided" },
];

const typeOptions = [
  { value: "all", label: "All" },
  { value: "VN", label: "National" },
  { value: "VI", label: "International" },
  { value: "VT", label: "VT" },
  { value: "VW", label: "VW" },
];

function formatMoney(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) return "-";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function canShowReadyDispatchAction(currentStatusRaw: string | null | undefined) {
  const currentStatus = String(currentStatusRaw ?? "")
    .trim()
    .toUpperCase();

  return ![
    "PROGRAMACION",
    "PRODUCCION",
    "ATRASADO",
    "FINALIZADO",
    "ENTREGADO",
    "CANCELADO",
  ].includes(currentStatus);
}

function normalizeCurrency(value: string | null | undefined): "COP" | "USD" {
  return String(value ?? "COP")
    .trim()
    .toUpperCase() === "USD"
    ? "USD"
    : "COP";
}

function formatMoneyByCurrency(
  value: string | number | null | undefined,
  currency: "COP" | "USD",
) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) return "-";

  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(amount);
}

function normalizeAmountInput(value: string) {
  const raw = value.replace(/[^\d.,]/g, "");

  if (!raw) return "";

  const normalized = raw.replace(/,/g, ".");
  const parts = normalized.split(".");

  if (parts.length === 1) {
    return parts[0].replace(/^0+(?=\d)/, "");
  }

  const integer = (parts[0] || "0").replace(/^0+(?=\d)/, "");
  const decimal = parts.slice(1).join("").replace(/\D/g, "").slice(0, 2);

  return decimal ? `${integer}.${decimal}` : integer;
}

function resolveAdvanceStatus(amount: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) return "PENDIENTE";

  const percentage = Math.max(0, (amount / total) * 100);

  if (percentage >= 50) return "RECIBIDO";
  if (percentage > 29) return "PARCIAL";

  return "PENDIENTE";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("es-CO");
}

export function PrefacturasTab({
  canChangeStatus,
  canCreate,
  canEdit,
  canDelete,
  initialStatus = "all",
  lockStatusFilter = false,
  initialOrderStatus = "all",
}: {
  canChangeStatus: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  initialStatus?: string;
  lockStatusFilter?: boolean;
  initialOrderStatus?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [type, setType] = useState("all");
  const [documentType, setDocumentType] = useState("all");

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

  const resolveTargetStatus = (
    currentStatusRaw: string,
    paidPercent: number,
  ): { targetStatus: "APROBACION" | "PROGRAMACION" | null; reason: string } => {
    const currentStatus = String(currentStatusRaw ?? "")
      .trim()
      .toUpperCase();
    const isPaidAtLeast50 = paidPercent >= 50;

    if (
      [
        "PROGRAMACION",
        "PRODUCCION",
        "ATRASADO",
        "FINALIZADO",
        "ENTREGADO",
        "CANCELADO",
      ].includes(currentStatus)
    ) {
      return {
        targetStatus: null,
        reason: `The order is already in ${currentStatus} and does not require this manual shipment.`,
      };
    }

    if (isPaidAtLeast50) {
      if (currentStatus === "APROBACION") {
        return {
          targetStatus: "PROGRAMACION",
          reason:
            "The confirmed advance is 50% or more, it will be sent to Scheduling.",
        };
      }

      return {
        targetStatus: "APROBACION",
        reason:
          "Although the advance is 50% or more, the workflow requires passing through Approval before Scheduling.",
      };
    }

    if (currentStatus === "APROBACION") {
      return {
        targetStatus: null,
        reason:
          "The order is already in Approval. When it meets the rules, you can send it to Scheduling.",
      };
    }

    return {
      targetStatus: "APROBACION",
      reason:
        "With confirmed advance less than 50%, the order should be sent to Approval.",
    };
  };

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
    const status = String(row.status ?? "")
      .trim()
      .toUpperCase();

    return (
      Boolean(row.orderId) &&
      ["PENDIENTE_CONTABILIDAD", "PENDIENTE", "APROBACION"].includes(status)
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <FilterSearch
            className="sm:w-72"
            placeholder="Prefacture code, quotation or order…"
            value={q}
            onValueChange={setQ}
          />
          <FilterSelect
            className="sm:w-48"
            isDisabled={lockStatusFilter}
            label="Status"
            options={statusOptions}
            value={status}
            onChange={setStatus}
          />
          <FilterSelect
            className="sm:w-48"
            label="Type"
            options={typeOptions}
            value={type}
            onChange={setType}
          />
          <FilterSelect
            className="sm:w-40"
            label="Document"
            options={documentTypeOptions}
            value={documentType}
            onChange={setDocumentType}
          />
        </div>

        <div className="flex gap-2">
          {canCreate ? (
            <Button
              color="primary"
              onPress={() => router.push("/erp/pre-invoices/new")}
            >
              <BsPlusCircle /> New prefacture
            </Button>
          ) : null}
          <Button variant="flat" onPress={refresh}>
            Refresh
          </Button>
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
                      {canEdit ? (
                        <DropdownItem
                          key="advance"
                          startContent={<BsPiggyBank />}
                          onPress={() => openAdvanceModal(row)}
                        >
                          Pay advance
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
                      {canDelete ? (
                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          color="danger"
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
    </div>
  );
}
