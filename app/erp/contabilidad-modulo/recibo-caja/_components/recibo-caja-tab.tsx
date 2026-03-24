"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input, Textarea } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";

import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";

type UiPaymentMethod = "CASH" | "TRANSFER" | "CREDIT";
type ReceiptStatus = "PENDING" | "CONFIRMED" | "VOIDED";

type ReceiptApplication = {
  id: string;
  cashReceiptId: string;
  prefacturaId: string;
  prefacturaCode: string;
  appliedAmount: string | null;
};

type ReceiptRow = {
  id: string;
  receiptCode: string;
  clientId: string;
  clientName: string;
  prefacturaId: string | null;
  orderId: string | null;
  receiptDate: string;
  amountReceived: string | null;
  paymentMethod: UiPaymentMethod;
  includesIva: boolean | null;
  originBank: string | null;
  referenceNumber: string | null;
  creditBalance: string | null;
  status: ReceiptStatus;
  notes: string | null;
  createdAt: string | null;
  applications: ReceiptApplication[];
};

type ReceiptData = {
  items: ReceiptRow[];
  clients: Array<{ id: string; name: string }>;
  summary: {
    totalToday: string;
    totalMonth: string;
    pendingCount: number;
  };
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

type PrefacturaOption = {
  id: string;
  prefacturaCode: string;
  orderId: string | null;
  total: string;
  applied: string;
  remaining: string;
};

type PrefacturaOptionsData = {
  items: PrefacturaOption[];
};

const METHOD_OPTIONS = [
  { value: "ALL", label: "ALL" },
  { value: "CASH", label: "CASH" },
  { value: "TRANSFER", label: "TRANSFER" },
  { value: "CREDIT", label: "CREDIT" },
] as const;

const STATUS_OPTIONS = [
  { value: "ALL", label: "ALL" },
  { value: "PENDING", label: "PENDING" },
  { value: "CONFIRMED", label: "CONFIRMED" },
  { value: "VOIDED", label: "VOIDED" },
] as const;

function toNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: string | number | null | undefined) {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function methodColor(
  value: UiPaymentMethod,
): "default" | "primary" | "success" | "warning" {
  if (value === "TRANSFER") return "primary";
  if (value === "CREDIT") return "warning";

  return "success";
}

function statusColor(value: ReceiptStatus): "warning" | "success" | "danger" {
  if (value === "CONFIRMED") return "success";
  if (value === "VOIDED") return "danger";

  return "warning";
}

export function ReciboCajaTab({
  canCreate,
  canVoid,
}: {
  canCreate: boolean;
  canVoid: boolean;
}) {
  const [clientFilter, setClientFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] =
    useState<(typeof METHOD_OPTIONS)[number]["value"]>("ALL");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_OPTIONS)[number]["value"]>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();

    if (clientFilter) params.set("clientId", clientFilter);
    if (paymentMethodFilter !== "ALL") {
      params.set("paymentMethod", paymentMethodFilter);
    }
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    return `/api/contabilidad/recibos-caja?${params.toString()}`;
  }, [clientFilter, dateFrom, dateTo, paymentMethodFilter, statusFilter]);

  const { data, loading, page, setPage, refresh } = usePaginatedApi<ReceiptRow>(
    endpoint,
    15,
  );

  const receiptData = data as ReceiptData | null;

  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [viewRow, setViewRow] = useState<ReceiptRow | null>(null);
  const [prefacturaOptions, setPrefacturaOptions] = useState<
    PrefacturaOption[]
  >([]);
  const [prefacturaOptionsLoading, setPrefacturaOptionsLoading] =
    useState(false);

  const [draftClientId, setDraftClientId] = useState("");
  const [draftPrefacturaIds, setDraftPrefacturaIds] = useState<string[]>([]);
  const [draftReceiptDate, setDraftReceiptDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [draftAmountReceived, setDraftAmountReceived] = useState("");
  const [draftPaymentMethod, setDraftPaymentMethod] =
    useState<UiPaymentMethod>("CASH");
  const [draftIncludesIva, setDraftIncludesIva] = useState(false);
  const [draftOriginBank, setDraftOriginBank] = useState("");
  const [draftReferenceNumber, setDraftReferenceNumber] = useState("");
  const [draftApplications, setDraftApplications] = useState<
    Record<string, string>
  >({});
  const [draftNotes, setDraftNotes] = useState("");

  useEffect(() => {
    setPage(1);
  }, [
    clientFilter,
    dateFrom,
    dateTo,
    paymentMethodFilter,
    setPage,
    statusFilter,
  ]);

  useEffect(() => {
    if (!draftClientId) {
      setPrefacturaOptions([]);
      setDraftPrefacturaIds([]);
      setDraftApplications({});

      return;
    }

    setPrefacturaOptionsLoading(true);
    apiJson<PrefacturaOptionsData>(
      `/api/contabilidad/recibos-caja/options?clientId=${encodeURIComponent(draftClientId)}`,
    )
      .then((response) => setPrefacturaOptions(response.items ?? []))
      .catch((error) => toast.error(getErrorMessage(error)))
      .finally(() => setPrefacturaOptionsLoading(false));
  }, [draftClientId]);

  const selectedPrefacturas = useMemo(
    () =>
      prefacturaOptions.filter((option) =>
        draftPrefacturaIds.includes(option.id),
      ),
    [draftPrefacturaIds, prefacturaOptions],
  );

  const appliedTotal = selectedPrefacturas.reduce((acc, option) => {
    return acc + toNumber(draftApplications[option.id]);
  }, 0);

  const remainingCreditBalance = Math.max(
    0,
    toNumber(draftAmountReceived) - appliedTotal,
  );

  const resetDraft = () => {
    setDraftClientId("");
    setDraftPrefacturaIds([]);
    setDraftReceiptDate(new Date().toISOString().slice(0, 10));
    setDraftAmountReceived("");
    setDraftPaymentMethod("CASH");
    setDraftIncludesIva(false);
    setDraftOriginBank("");
    setDraftReferenceNumber("");
    setDraftApplications({});
    setDraftNotes("");
    setPrefacturaOptions([]);
  };

  const updateReceiptStatus = async (
    id: string,
    status: "CONFIRMED" | "VOIDED",
  ) => {
    try {
      await apiJson(`/api/contabilidad/recibos-caja/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });

      toast.success(
        status === "CONFIRMED" ? "Receipt confirmed" : "Receipt voided",
      );
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const saveReceipt = async () => {
    if (!draftClientId) {
      toast.error("Client is required");

      return;
    }

    if (!draftReceiptDate) {
      toast.error("Receipt date is required");

      return;
    }

    if (toNumber(draftAmountReceived) <= 0) {
      toast.error("Amount received must be greater than zero");

      return;
    }

    if (
      draftPaymentMethod === "TRANSFER" &&
      appliedTotal - toNumber(draftAmountReceived) > 0.0001
    ) {
      toast.error("Applied total cannot exceed amount received");

      return;
    }

    if (appliedTotal - toNumber(draftAmountReceived) > 0.0001) {
      toast.error("Applied total cannot exceed amount received");

      return;
    }

    for (const option of selectedPrefacturas) {
      const amount = toNumber(draftApplications[option.id]);
      const remaining = toNumber(option.remaining);

      if (amount > remaining + 0.0001) {
        toast.error(
          `Applied amount exceeds remaining balance for ${option.prefacturaCode}`,
        );

        return;
      }
    }

    try {
      setCreateLoading(true);
      await apiJson("/api/contabilidad/recibos-caja", {
        method: "POST",
        body: JSON.stringify({
          clientId: draftClientId,
          prefacturaIds: draftPrefacturaIds,
          receiptDate: draftReceiptDate,
          amountReceived: toNumber(draftAmountReceived),
          paymentMethod: draftPaymentMethod,
          includesIva: draftIncludesIva,
          originBank: draftOriginBank,
          referenceNumber: draftReferenceNumber,
          applications: selectedPrefacturas.map((option) => ({
            prefacturaId: option.id,
            appliedAmount: toNumber(draftApplications[option.id]),
          })),
          notes: draftNotes,
        }),
      });

      toast.success("Receipt created");
      setCreateOpen(false);
      resetDraft();
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-default-500">
          Manage client cash receipts and their application to open
          pre-invoices.
        </div>
        {canCreate ? (
          <Button color="primary" onPress={() => setCreateOpen(true)}>
            New Receipt
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Select
          className="sm:w-72"
          label="Client"
          placeholder="All clients"
          selectedKeys={clientFilter ? [clientFilter] : []}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => {
            setClientFilter(String(Array.from(keys)[0] ?? ""));
          }}
        >
          {(receiptData?.clients ?? []).map((client) => (
            <SelectItem key={client.id}>{client.name}</SelectItem>
          ))}
        </Select>

        <Select
          className="sm:w-52"
          label="Payment method"
          selectedKeys={[paymentMethodFilter]}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => {
            setPaymentMethodFilter(
              String(
                Array.from(keys)[0] ?? "ALL",
              ).toUpperCase() as (typeof METHOD_OPTIONS)[number]["value"],
            );
          }}
        >
          {METHOD_OPTIONS.map((option) => (
            <SelectItem key={option.value}>{option.label}</SelectItem>
          ))}
        </Select>

        <Select
          className="sm:w-52"
          label="Status"
          selectedKeys={[statusFilter]}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => {
            setStatusFilter(
              String(
                Array.from(keys)[0] ?? "ALL",
              ).toUpperCase() as (typeof STATUS_OPTIONS)[number]["value"],
            );
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value}>{option.label}</SelectItem>
          ))}
        </Select>

        <Input
          className="sm:w-48"
          label="Date from"
          size="sm"
          type="date"
          value={dateFrom}
          variant="bordered"
          onValueChange={setDateFrom}
        />

        <Input
          className="sm:w-48"
          label="Date to"
          size="sm"
          type="date"
          value={dateTo}
          variant="bordered"
          onValueChange={setDateTo}
        />

        <Button
          size="sm"
          variant="flat"
          onPress={() => {
            setClientFilter("");
            setPaymentMethodFilter("ALL");
            setStatusFilter("ALL");
            setDateFrom("");
            setDateTo("");
          }}
        >
          Clear
        </Button>
        <Button size="sm" variant="flat" onPress={refresh}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardBody className="gap-1">
            <div className="text-xs uppercase tracking-wide text-default-500">
              Total received today
            </div>
            <div className="text-2xl font-semibold">
              {formatMoney(receiptData?.summary?.totalToday ?? 0)}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="gap-1">
            <div className="text-xs uppercase tracking-wide text-default-500">
              Total received this month
            </div>
            <div className="text-2xl font-semibold">
              {formatMoney(receiptData?.summary?.totalMonth ?? 0)}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="gap-1">
            <div className="text-xs uppercase tracking-wide text-default-500">
              Pending confirmation count
            </div>
            <div className="text-2xl font-semibold text-warning-600">
              {receiptData?.summary?.pendingCount ?? 0}
            </div>
          </CardBody>
        </Card>
      </div>

      <Table aria-label="Cash receipts table">
        <TableHeader>
          <TableColumn>Receipt code</TableColumn>
          <TableColumn>Client name</TableColumn>
          <TableColumn>Receipt date</TableColumn>
          <TableColumn>Amount received</TableColumn>
          <TableColumn>Payment method</TableColumn>
          <TableColumn>Includes IVA</TableColumn>
          <TableColumn>Origin bank</TableColumn>
          <TableColumn>Reference number</TableColumn>
          <TableColumn>Credit balance</TableColumn>
          <TableColumn>Status</TableColumn>
          <TableColumn>Actions</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent={loading ? "Loading..." : "No cash receipts found"}
          items={receiptData?.items ?? []}
        >
          {(row) => (
            <TableRow key={row.id}>
              <TableCell>{row.receiptCode}</TableCell>
              <TableCell>{row.clientName}</TableCell>
              <TableCell>{row.receiptDate}</TableCell>
              <TableCell>{formatMoney(row.amountReceived)}</TableCell>
              <TableCell>
                <Chip
                  color={methodColor(row.paymentMethod)}
                  size="sm"
                  variant="flat"
                >
                  {row.paymentMethod}
                </Chip>
              </TableCell>
              <TableCell>{row.includesIva ? "Yes" : "No"}</TableCell>
              <TableCell>
                {row.paymentMethod === "TRANSFER" ? row.originBank || "-" : "-"}
              </TableCell>
              <TableCell>
                {row.paymentMethod === "TRANSFER"
                  ? row.referenceNumber || "-"
                  : "-"}
              </TableCell>
              <TableCell>{formatMoney(row.creditBalance)}</TableCell>
              <TableCell>
                <Chip color={statusColor(row.status)} size="sm" variant="flat">
                  {row.status}
                </Chip>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setViewRow(row)}
                  >
                    View
                  </Button>
                  <Button
                    isDisabled={!canCreate || row.status !== "PENDING"}
                    size="sm"
                    variant="flat"
                    onPress={() => updateReceiptStatus(row.id, "CONFIRMED")}
                  >
                    Confirm
                  </Button>
                  <Button
                    color="danger"
                    isDisabled={!canVoid || row.status === "VOIDED"}
                    size="sm"
                    variant="flat"
                    onPress={() => updateReceiptStatus(row.id, "VOIDED")}
                  >
                    Void
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {receiptData ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-default-500">
            Total: {receiptData.total ?? 0}
          </p>
          <div className="flex gap-2">
            <Button
              isDisabled={loading || page <= 1}
              size="sm"
              variant="flat"
              onPress={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              isDisabled={loading || !receiptData.hasNextPage}
              size="sm"
              variant="flat"
              onPress={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Modal
        disableAnimation
        isOpen={createOpen}
        scrollBehavior="inside"
        size="5xl"
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetDraft();
        }}
      >
        <ModalContent>
          <ModalHeader>New Receipt</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Select
                isRequired
                label="Client"
                selectedKeys={draftClientId ? [draftClientId] : []}
                variant="bordered"
                onSelectionChange={(keys) => {
                  setDraftClientId(String(Array.from(keys)[0] ?? ""));
                }}
              >
                {(receiptData?.clients ?? []).map((client) => (
                  <SelectItem key={client.id}>{client.name}</SelectItem>
                ))}
              </Select>

              <Select
                isDisabled={!draftClientId}
                label="Pre-invoice selector"
                placeholder={
                  prefacturaOptionsLoading
                    ? "Loading open pre-invoices..."
                    : "Optional"
                }
                selectedKeys={draftPrefacturaIds}
                selectionMode="multiple"
                variant="bordered"
                onSelectionChange={(keys) => {
                  const values = Array.from(keys).map((value) => String(value));

                  setDraftPrefacturaIds(values);
                  setDraftApplications((current) => {
                    const next = { ...current };

                    for (const key of Object.keys(next)) {
                      if (!values.includes(key)) delete next[key];
                    }
                    for (const value of values) {
                      if (!(value in next)) next[value] = "0";
                    }

                    return next;
                  });
                }}
              >
                {prefacturaOptions.map((option) => (
                  <SelectItem key={option.id}>
                    {option.prefacturaCode} - Remaining{" "}
                    {formatMoney(option.remaining)}
                  </SelectItem>
                ))}
              </Select>

              <Input
                isRequired
                label="Receipt date"
                type="date"
                value={draftReceiptDate}
                variant="bordered"
                onValueChange={setDraftReceiptDate}
              />

              <Input
                isRequired
                label="Amount received"
                type="number"
                value={draftAmountReceived}
                variant="bordered"
                onValueChange={setDraftAmountReceived}
              />

              <Select
                isRequired
                label="Payment method"
                selectedKeys={[draftPaymentMethod]}
                variant="bordered"
                onSelectionChange={(keys) => {
                  const next = String(
                    Array.from(keys)[0] ?? "CASH",
                  ).toUpperCase() as UiPaymentMethod;

                  setDraftPaymentMethod(next);
                }}
              >
                {METHOD_OPTIONS.filter((option) => option.value !== "ALL").map(
                  (option) => (
                    <SelectItem key={option.value}>{option.label}</SelectItem>
                  ),
                )}
              </Select>

              {draftPaymentMethod === "TRANSFER" ? (
                <Select
                  label="Includes IVA"
                  selectedKeys={[draftIncludesIva ? "YES" : "NO"]}
                  variant="bordered"
                  onSelectionChange={(keys) => {
                    setDraftIncludesIva(
                      String(Array.from(keys)[0] ?? "NO") === "YES",
                    );
                  }}
                >
                  <SelectItem key="YES">Yes</SelectItem>
                  <SelectItem key="NO">No</SelectItem>
                </Select>
              ) : null}

              {draftPaymentMethod === "TRANSFER" ? (
                <Input
                  label="Origin bank"
                  value={draftOriginBank}
                  variant="bordered"
                  onValueChange={setDraftOriginBank}
                />
              ) : null}

              {draftPaymentMethod === "TRANSFER" ? (
                <Input
                  label="Reference number"
                  value={draftReferenceNumber}
                  variant="bordered"
                  onValueChange={setDraftReferenceNumber}
                />
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold">Applied to invoices</div>
              {selectedPrefacturas.length === 0 ? (
                <div className="rounded-medium border border-default-200 p-4 text-sm text-default-500">
                  Select one or more pre-invoices to apply this receipt.
                </div>
              ) : (
                <div className="space-y-3 rounded-medium border border-default-200 p-4">
                  {selectedPrefacturas.map((option) => (
                    <div
                      key={option.id}
                      className="grid grid-cols-1 gap-3 border-b border-default-100 pb-3 last:border-b-0 last:pb-0 md:grid-cols-4"
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {option.prefacturaCode}
                        </div>
                        <div className="text-xs text-default-500">
                          Remaining: {formatMoney(option.remaining)}
                        </div>
                      </div>
                      <Input
                        label="Apply amount"
                        type="number"
                        value={draftApplications[option.id] ?? "0"}
                        variant="bordered"
                        onValueChange={(value) => {
                          setDraftApplications((current) => ({
                            ...current,
                            [option.id]: value,
                          }));
                        }}
                      />
                      <Input
                        isDisabled
                        label="Total"
                        value={formatMoney(option.total)}
                        variant="faded"
                      />
                      <Input
                        isDisabled
                        label="Already applied"
                        value={formatMoney(option.applied)}
                        variant="faded"
                      />
                    </div>
                  ))}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Input
                      isDisabled
                      label="Applied total"
                      value={formatMoney(appliedTotal)}
                      variant="faded"
                    />
                    <Input
                      isDisabled
                      label="Remaining credit balance"
                      value={formatMoney(remainingCreditBalance)}
                      variant="faded"
                    />
                  </div>
                </div>
              )}
            </div>

            <Textarea
              label="Notes"
              minRows={3}
              value={draftNotes}
              variant="bordered"
              onValueChange={setDraftNotes}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={createLoading}
              onPress={saveReceipt}
            >
              {createLoading ? "Saving..." : "Save"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={Boolean(viewRow)}
        size="4xl"
        onOpenChange={(open) => {
          if (!open) setViewRow(null);
        }}
      >
        <ModalContent>
          <ModalHeader>Receipt detail</ModalHeader>
          <ModalBody>
            {viewRow ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input
                    isDisabled
                    label="Receipt code"
                    value={viewRow.receiptCode}
                  />
                  <Input isDisabled label="Client" value={viewRow.clientName} />
                  <Input
                    isDisabled
                    label="Receipt date"
                    value={viewRow.receiptDate}
                  />
                  <Input
                    isDisabled
                    label="Amount received"
                    value={formatMoney(viewRow.amountReceived)}
                  />
                  <Input
                    isDisabled
                    label="Payment method"
                    value={viewRow.paymentMethod}
                  />
                  <Input isDisabled label="Status" value={viewRow.status} />
                  <Input
                    isDisabled
                    label="Includes IVA"
                    value={viewRow.includesIva ? "Yes" : "No"}
                  />
                  <Input
                    isDisabled
                    label="Origin bank"
                    value={viewRow.originBank ?? "-"}
                  />
                  <Input
                    isDisabled
                    label="Reference number"
                    value={viewRow.referenceNumber ?? "-"}
                  />
                  <Input
                    isDisabled
                    label="Credit balance"
                    value={formatMoney(viewRow.creditBalance)}
                  />
                </div>

                <Table aria-label="Receipt applications detail table">
                  <TableHeader>
                    <TableColumn>Pre-invoice</TableColumn>
                    <TableColumn>Applied amount</TableColumn>
                  </TableHeader>
                  <TableBody
                    emptyContent="No applications"
                    items={viewRow.applications ?? []}
                  >
                    {(application) => (
                      <TableRow key={application.id}>
                        <TableCell>{application.prefacturaCode}</TableCell>
                        <TableCell>
                          {formatMoney(application.appliedAmount)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                <Textarea
                  isDisabled
                  label="Notes"
                  minRows={3}
                  value={viewRow.notes ?? ""}
                />
              </div>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setViewRow(null)}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
