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
import { BsEye } from "react-icons/bs";

import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";

type FactoringStatus = "ACTIVE" | "COLLECTED" | "VOIDED";

type ClientOption = {
  id: string;
  name: string;
};

type PrefacturaOption = {
  id: string;
  prefacturaCode: string;
  clientId: string;
  clientName: string;
  invoiceValue: string | null;
};

type FactoringRow = {
  id: string;
  factoringCode: string;
  clientId: string;
  clientName: string;
  prefacturaId: string;
  prefacturaCode: string;
  factoringEntity: string;
  assignmentDate: string;
  invoiceValue: string | null;
  discountRate: string | null;
  netAmountReceived: string | null;
  status: FactoringStatus;
  notes: string | null;
  createdAt: string | null;
};

type FactoringData = {
  items: FactoringRow[];
  clients: ClientOption[];
  prefacturaOptions: PrefacturaOption[];
  summary: {
    totalFactored: string;
    totalNetReceived: string;
    totalDiscountCost: string;
  };
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

const STATUS_OPTIONS = [
  { value: "ALL", label: "ALL" },
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "COLLECTED", label: "COLLECTED" },
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

function formatPercent(value: string | number | null | undefined) {
  return `${toNumber(value).toFixed(2)}%`;
}

function statusColor(
  status: FactoringStatus,
): "success" | "primary" | "danger" {
  if (status === "ACTIVE") return "success";
  if (status === "COLLECTED") return "primary";

  return "danger";
}

export function FactoringTab({ canCreate }: { canCreate: boolean }) {
  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_OPTIONS)[number]["value"]>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();

    if (clientFilter) params.set("clientId", clientFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    return `/api/contabilidad/factoring?${params.toString()}`;
  }, [clientFilter, dateFrom, dateTo, statusFilter]);

  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<FactoringRow>(endpoint, 15);

  const factoringData = data as FactoringData | null;

  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [viewRow, setViewRow] = useState<FactoringRow | null>(null);

  const [prefacturaId, setPrefacturaId] = useState("");
  const [factoringEntity, setFactoringEntity] = useState("");
  const [assignmentDate, setAssignmentDate] = useState("");
  const [discountRate, setDiscountRate] = useState("0");
  const [notes, setNotes] = useState("");

  const selectedPrefactura = useMemo(
    () =>
      (factoringData?.prefacturaOptions ?? []).find(
        (option) => option.id === prefacturaId,
      ) ?? null,
    [factoringData?.prefacturaOptions, prefacturaId],
  );

  const invoiceValue = toNumber(selectedPrefactura?.invoiceValue ?? 0);
  const netAmountReceived =
    invoiceValue - (invoiceValue * toNumber(discountRate)) / 100;

  useEffect(() => {
    setPage(1);
  }, [clientFilter, dateFrom, dateTo, setPage, statusFilter]);

  const resetDraft = () => {
    setPrefacturaId("");
    setFactoringEntity("");
    setAssignmentDate("");
    setDiscountRate("0");
    setNotes("");
  };

  const saveFactoring = async () => {
    if (!prefacturaId) {
      toast.error("Selecciona una prefactura");

      return;
    }

    if (!factoringEntity.trim()) {
      toast.error("La entidad de factoring es obligatoria");

      return;
    }

    if (!assignmentDate) {
      toast.error("La fecha de asignacion es obligatoria");

      return;
    }

    const rate = toNumber(discountRate);

    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      toast.error("La tasa de descuento debe estar entre 0 y 100");

      return;
    }

    try {
      setCreateLoading(true);
      await apiJson("/api/contabilidad/factoring", {
        method: "POST",
        body: JSON.stringify({
          prefacturaId,
          factoringEntity,
          assignmentDate,
          discountRate: rate,
          notes,
        }),
      });

      toast.success("Asignacion a factoring creada");
      setCreateOpen(false);
      resetDraft();
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreateLoading(false);
    }
  };

  const updateStatus = async (id: string, status: "COLLECTED" | "VOIDED") => {
    try {
      await apiJson(`/api/contabilidad/factoring/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });

      toast.success(
        status === "COLLECTED"
          ? "Registro marcado como cobrado"
          : "Registro anulado",
      );
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-default-500">
          Control de cartera asignada a entidades de factoring.
        </div>
        {canCreate ? (
          <Button color="primary" onPress={() => setCreateOpen(true)}>
            Assign to Factoring
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardBody className="gap-1">
            <div className="text-xs uppercase tracking-wide text-default-500">
              Total factored (ACTIVE)
            </div>
            <div className="text-2xl font-semibold">
              {formatMoney(factoringData?.summary?.totalFactored ?? 0)}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="gap-1">
            <div className="text-xs uppercase tracking-wide text-default-500">
              Total net received
            </div>
            <div className="text-2xl font-semibold">
              {formatMoney(factoringData?.summary?.totalNetReceived ?? 0)}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="gap-1">
            <div className="text-xs uppercase tracking-wide text-default-500">
              Total discount cost
            </div>
            <div className="text-2xl font-semibold text-warning-600">
              {formatMoney(factoringData?.summary?.totalDiscountCost ?? 0)}
            </div>
          </CardBody>
        </Card>
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
            const value = String(Array.from(keys)[0] ?? "");

            setClientFilter(value);
          }}
        >
          {(factoringData?.clients ?? []).map((client) => (
            <SelectItem key={client.id}>{client.name}</SelectItem>
          ))}
        </Select>

        <Select
          className="sm:w-52"
          label="Status"
          selectedKeys={[statusFilter]}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => {
            const value = String(Array.from(keys)[0] ?? "ALL").toUpperCase() as
              | "ALL"
              | "ACTIVE"
              | "COLLECTED"
              | "VOIDED";

            setStatusFilter(value);
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

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="flat"
            onPress={() => {
              setClientFilter("");
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
      </div>

      <Table aria-label="Factoring records table">
        <TableHeader>
          <TableColumn>Factoring code</TableColumn>
          <TableColumn>Client name</TableColumn>
          <TableColumn>Pre-invoice reference</TableColumn>
          <TableColumn>Factoring entity</TableColumn>
          <TableColumn>Assignment date</TableColumn>
          <TableColumn>Invoice value</TableColumn>
          <TableColumn>Discount rate %</TableColumn>
          <TableColumn>Net amount received</TableColumn>
          <TableColumn>Status</TableColumn>
          <TableColumn>Actions</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent={loading ? "Loading..." : "No factoring records found"}
          items={factoringData?.items ?? []}
        >
          {(row) => (
            <TableRow key={row.id}>
              <TableCell>{row.factoringCode}</TableCell>
              <TableCell>{row.clientName}</TableCell>
              <TableCell>{row.prefacturaCode}</TableCell>
              <TableCell>{row.factoringEntity}</TableCell>
              <TableCell>{row.assignmentDate}</TableCell>
              <TableCell>{formatMoney(row.invoiceValue)}</TableCell>
              <TableCell>{formatPercent(row.discountRate)}</TableCell>
              <TableCell>{formatMoney(row.netAmountReceived)}</TableCell>
              <TableCell>
                <Chip color={statusColor(row.status)} size="sm" variant="flat">
                  {row.status}
                </Chip>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    startContent={<BsEye />}
                    variant="flat"
                    onPress={() => setViewRow(row)}
                  >
                    View
                  </Button>
                  <Button
                    isDisabled={!canCreate || row.status !== "ACTIVE"}
                    size="sm"
                    variant="flat"
                    onPress={() => updateStatus(row.id, "COLLECTED")}
                  >
                    Mark as collected
                  </Button>
                  <Button
                    color="danger"
                    isDisabled={!canCreate || row.status !== "ACTIVE"}
                    size="sm"
                    variant="flat"
                    onPress={() => updateStatus(row.id, "VOIDED")}
                  >
                    Void
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {factoringData ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-default-500">
            Total: {factoringData.total ?? 0}
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
              isDisabled={loading || !factoringData.hasNextPage}
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
        isOpen={createOpen}
        size="4xl"
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetDraft();
        }}
      >
        <ModalContent>
          <ModalHeader>Assign to Factoring</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Select
                isRequired
                label="Pre-invoice"
                selectedKeys={prefacturaId ? [prefacturaId] : []}
                variant="bordered"
                onSelectionChange={(keys) => {
                  const value = String(Array.from(keys)[0] ?? "");

                  setPrefacturaId(value);
                }}
              >
                {(factoringData?.prefacturaOptions ?? []).map((prefactura) => (
                  <SelectItem key={prefactura.id}>
                    {prefactura.prefacturaCode} - {prefactura.clientName}
                  </SelectItem>
                ))}
              </Select>

              <Input
                isDisabled
                label="Client"
                value={selectedPrefactura?.clientName ?? ""}
                variant="bordered"
              />

              <Input
                isRequired
                label="Factoring entity"
                value={factoringEntity}
                variant="bordered"
                onValueChange={setFactoringEntity}
              />

              <Input
                isRequired
                label="Assignment date"
                type="date"
                value={assignmentDate}
                variant="bordered"
                onValueChange={setAssignmentDate}
              />

              <Input
                isRequired
                label="Discount rate %"
                type="number"
                value={discountRate}
                variant="bordered"
                onValueChange={setDiscountRate}
              />

              <Input
                isDisabled
                label="Invoice value"
                value={formatMoney(invoiceValue)}
                variant="faded"
              />

              <Input
                isDisabled
                label="Net amount received"
                value={formatMoney(netAmountReceived)}
                variant="faded"
              />

              <Textarea
                className="md:col-span-2"
                label="Notes"
                minRows={3}
                value={notes}
                variant="bordered"
                onValueChange={setNotes}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={createLoading}
              onPress={saveFactoring}
            >
              Confirm
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={Boolean(viewRow)}
        size="3xl"
        onOpenChange={(open) => {
          if (!open) setViewRow(null);
        }}
      >
        <ModalContent>
          <ModalHeader>Factoring detail</ModalHeader>
          <ModalBody>
            {viewRow ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input
                  isDisabled
                  label="Factoring code"
                  value={viewRow.factoringCode}
                />
                <Input isDisabled label="Client" value={viewRow.clientName} />
                <Input
                  isDisabled
                  label="Pre-invoice"
                  value={viewRow.prefacturaCode}
                />
                <Input
                  isDisabled
                  label="Entity"
                  value={viewRow.factoringEntity}
                />
                <Input
                  isDisabled
                  label="Assignment date"
                  value={viewRow.assignmentDate}
                />
                <Input
                  isDisabled
                  label="Invoice value"
                  value={formatMoney(viewRow.invoiceValue)}
                />
                <Input
                  isDisabled
                  label="Discount rate"
                  value={formatPercent(viewRow.discountRate)}
                />
                <Input
                  isDisabled
                  label="Net amount received"
                  value={formatMoney(viewRow.netAmountReceived)}
                />
                <Input isDisabled label="Status" value={viewRow.status} />
                <Textarea
                  isDisabled
                  className="md:col-span-2"
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
