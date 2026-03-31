"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Checkbox } from "@heroui/checkbox";
import { Chip } from "@heroui/chip";
import { Input, Textarea } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
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
import { BsPencil, BsPlus, BsTrash } from "react-icons/bs";

import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";

type LeaveTypeKey = "PAID" | "UNPAID";
type PayrollDeductionKey = "ALL" | "YES" | "NO";

type EmployeeOption = {
  id: string;
  name: string;
  employeeCode: string | null;
};

type LeaveRow = {
  id: string;
  employeeId: string;
  employeeName: string | null;
  employeeCode: string | null;
  leaveType: LeaveTypeKey;
  startDate: string;
  endDate: string;
  durationDays: number;
  hoursAbsent: string | null;
  payrollDeduction: boolean | null;
  notes: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  createdAt: string;
};

type MonthlySummaryRow = {
  employeeId: string;
  employeeName: string | null;
  totalLeaves: number;
  totalDays: number;
  unpaidDays: number;
  payrollDeductions: number;
};

type LeavesData = {
  items: LeaveRow[];
  employeeOptions: EmployeeOption[];
  monthlySummary: MonthlySummaryRow[];
  summaryPeriod: string;
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

type DraftLeave = {
  employeeId: string;
  leaveType: LeaveTypeKey;
  startDate: string;
  endDate: string;
  hoursAbsent: string;
  payrollDeduction: boolean;
  notes: string;
};

const LEAVE_TYPE_OPTIONS: Array<{ value: LeaveTypeKey; label: string }> = [
  { value: "PAID", label: "Paid" },
  { value: "UNPAID", label: "Unpaid" },
];

const PAYROLL_FILTER_OPTIONS: Array<{
  value: PayrollDeductionKey;
  label: string;
}> = [
  { value: "ALL", label: "All" },
  { value: "YES", label: "Yes" },
  { value: "NO", label: "No" },
];

function toNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function toMonthInput(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${date.getFullYear()}-${month}`;
}

function leaveTypeLabel(value: LeaveTypeKey) {
  return value === "UNPAID" ? "Unpaid" : "Paid";
}

function leaveTypeChipColor(
  value: LeaveTypeKey,
): "success" | "warning" | "default" {
  if (value === "PAID") return "success";
  if (value === "UNPAID") return "warning";

  return "default";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("es-CO");
}

function emptyDraft(): DraftLeave {
  return {
    employeeId: "",
    leaveType: "PAID",
    startDate: "",
    endDate: "",
    hoursAbsent: "",
    payrollDeduction: false,
    notes: "",
  };
}

function LeaveModal({
  open,
  loading,
  draft,
  setDraft,
  employeeOptions,
  title,
  onClose,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  draft: DraftLeave;
  setDraft: React.Dispatch<React.SetStateAction<DraftLeave>>;
  employeeOptions: EmployeeOption[];
  title: string;
  onClose: () => void;
  onSubmit: () => void;
}) {
  useEffect(() => {
    if (draft.leaveType === "UNPAID") {
      setDraft((current) => ({ ...current, payrollDeduction: true }));
    }
  }, [draft.leaveType, setDraft]);

  return (
    <Modal disableAnimation isOpen={open} size="3xl" onClose={onClose}>
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select
              isRequired
              label="Employee"
              selectedKeys={draft.employeeId ? [draft.employeeId] : []}
              variant="bordered"
              onSelectionChange={(keys) => {
                const employeeId = String(Array.from(keys)[0] ?? "");

                setDraft((current) => ({ ...current, employeeId }));
              }}
            >
              {employeeOptions.map((employee) => (
                <SelectItem key={employee.id}>
                  {employee.name}
                  {employee.employeeCode ? ` (${employee.employeeCode})` : ""}
                </SelectItem>
              ))}
            </Select>

            <Select
              isRequired
              label="Leave type"
              selectedKeys={[draft.leaveType]}
              variant="bordered"
              onSelectionChange={(keys) => {
                const leaveType = String(Array.from(keys)[0] ?? "PAID")
                  .toUpperCase()
                  .trim() as LeaveTypeKey;

                setDraft((current) => ({
                  ...current,
                  leaveType,
                  payrollDeduction:
                    leaveType === "UNPAID" ? true : current.payrollDeduction,
                }));
              }}
            >
              {LEAVE_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value}>{option.label}</SelectItem>
              ))}
            </Select>

            <Input
              isRequired
              label="Start date"
              type="date"
              value={draft.startDate}
              variant="bordered"
              onValueChange={(startDate) => {
                setDraft((current) => ({ ...current, startDate }));
              }}
            />

            <Input
              isRequired
              label="End date"
              type="date"
              value={draft.endDate}
              variant="bordered"
              onValueChange={(endDate) => {
                setDraft((current) => ({ ...current, endDate }));
              }}
            />

            <Input
              label="Hours absent"
              min="0"
              step="0.25"
              type="number"
              value={draft.hoursAbsent}
              variant="bordered"
              onValueChange={(hoursAbsent) => {
                setDraft((current) => ({ ...current, hoursAbsent }));
              }}
            />

            <div className="flex items-center rounded-medium border border-default-200 px-3 py-2">
              <Checkbox
                isSelected={draft.payrollDeduction}
                onValueChange={(payrollDeduction) => {
                  setDraft((current) => ({ ...current, payrollDeduction }));
                }}
              >
                Apply payroll deduction
              </Checkbox>
            </div>

            <Textarea
              className="md:col-span-2"
              label="Notes"
              minRows={3}
              value={draft.notes}
              variant="bordered"
              onValueChange={(notes) => {
                setDraft((current) => ({ ...current, notes }));
              }}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={loading} variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary" isDisabled={loading} onPress={onSubmit}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function EmployeeLeavesTab({ canManage }: { canManage: boolean }) {
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<"ALL" | LeaveTypeKey>(
    "ALL",
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [payrollFilter, setPayrollFilter] =
    useState<PayrollDeductionKey>("ALL");
  const [summaryPeriod, setSummaryPeriod] = useState(toMonthInput());

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();

    if (employeeFilter) params.set("employeeId", employeeFilter);
    if (leaveTypeFilter !== "ALL") params.set("leaveType", leaveTypeFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (payrollFilter !== "ALL") params.set("payrollDeduction", payrollFilter);
    if (summaryPeriod) params.set("summaryPeriod", summaryPeriod);

    return `/api/hcm/permisos-ausencias?${params.toString()}`;
  }, [
    dateFrom,
    dateTo,
    employeeFilter,
    leaveTypeFilter,
    payrollFilter,
    summaryPeriod,
  ]);

  const { data, loading, page, setPage, refresh } = usePaginatedApi<LeaveRow>(
    endpoint,
    15,
  );

  const leavesData = data as LeavesData | null;

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftLeave>(emptyDraft);

  useEffect(() => {
    setPage(1);
  }, [
    dateFrom,
    dateTo,
    employeeFilter,
    leaveTypeFilter,
    payrollFilter,
    setPage,
  ]);

  const totalPages = useMemo(() => {
    const total = leavesData?.total ?? 0;

    return Math.max(1, Math.ceil(total / (leavesData?.pageSize ?? 15)));
  }, [leavesData?.pageSize, leavesData?.total]);

  function resetDraft() {
    setDraft(emptyDraft());
    setEditingId(null);
  }

  function openCreateModal() {
    resetDraft();
    setCreateOpen(true);
  }

  function openEditModal(row: LeaveRow) {
    setEditingId(row.id);
    setDraft({
      employeeId: row.employeeId,
      leaveType: row.leaveType,
      startDate: row.startDate,
      endDate: row.endDate,
      hoursAbsent: row.hoursAbsent ?? "",
      payrollDeduction: Boolean(row.payrollDeduction),
      notes: row.notes ?? "",
    });
    setEditOpen(true);
  }

  function validateDraft(currentDraft: DraftLeave) {
    if (!currentDraft.employeeId) return "Employee is required";
    if (!currentDraft.startDate || !currentDraft.endDate) {
      return "Start and end date are required";
    }
    if (currentDraft.startDate > currentDraft.endDate) {
      return "End date cannot be earlier than start date";
    }
    if (
      currentDraft.hoursAbsent.trim() !== "" &&
      (!Number.isFinite(Number(currentDraft.hoursAbsent)) ||
        Number(currentDraft.hoursAbsent) < 0)
    ) {
      return "Hours absent must be a positive number";
    }

    return null;
  }

  async function saveCreate() {
    const validationError = validateDraft(draft);

    if (validationError) {
      toast.error(validationError);

      return;
    }

    setSubmitLoading(true);
    try {
      await apiJson("/api/hcm/permisos-ausencias", {
        method: "POST",
        body: JSON.stringify({
          employeeId: draft.employeeId,
          leaveType: draft.leaveType,
          startDate: draft.startDate,
          endDate: draft.endDate,
          hoursAbsent:
            draft.hoursAbsent.trim() === ""
              ? null
              : toNumber(draft.hoursAbsent),
          payrollDeduction: draft.payrollDeduction,
          notes: draft.notes,
        }),
      });

      toast.success("Leave registered successfully");
      setCreateOpen(false);
      resetDraft();
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitLoading(false);
    }
  }

  async function saveEdit() {
    if (!editingId) return;

    const validationError = validateDraft(draft);

    if (validationError) {
      toast.error(validationError);

      return;
    }

    setSubmitLoading(true);
    try {
      await apiJson(`/api/hcm/permisos-ausencias/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          employeeId: draft.employeeId,
          leaveType: draft.leaveType,
          startDate: draft.startDate,
          endDate: draft.endDate,
          hoursAbsent:
            draft.hoursAbsent.trim() === ""
              ? null
              : toNumber(draft.hoursAbsent),
          payrollDeduction: draft.payrollDeduction,
          notes: draft.notes,
        }),
      });

      toast.success("Leave updated");
      setEditOpen(false);
      resetDraft();
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitLoading(false);
    }
  }

  async function removeLeave(id: string) {
    const confirmDelete = window.confirm(
      "Do you want to delete this leave record?",
    );

    if (!confirmDelete) return;

    try {
      await apiJson(`/api/hcm/permisos-ausencias/${id}`, {
        method: "DELETE",
      });
      toast.success("Leave deleted");
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-default-500">
          Employee leave control with payroll deduction tracking and monthly
          summary.
        </div>
        {canManage ? (
          <Button
            color="primary"
            startContent={<BsPlus />}
            onPress={openCreateModal}
          >
            Register leave
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Select
          className="sm:w-72"
          label="Employee"
          placeholder="All employees"
          selectedKeys={employeeFilter ? [employeeFilter] : []}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => {
            const value = String(Array.from(keys)[0] ?? "");

            setEmployeeFilter(value);
          }}
        >
          {(leavesData?.employeeOptions ?? []).map((employee) => (
            <SelectItem key={employee.id}>
              {employee.name}
              {employee.employeeCode ? ` (${employee.employeeCode})` : ""}
            </SelectItem>
          ))}
        </Select>

        <Select
          className="sm:w-48"
          label="Leave type"
          selectedKeys={[leaveTypeFilter]}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => {
            const value = String(Array.from(keys)[0] ?? "ALL")
              .trim()
              .toUpperCase() as "ALL" | LeaveTypeKey;

            setLeaveTypeFilter(value);
          }}
        >
          <SelectItem key="ALL">All</SelectItem>
          <SelectItem key="PAID">Paid</SelectItem>
          <SelectItem key="UNPAID">Unpaid</SelectItem>
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

        <Select
          className="sm:w-44"
          label="Payroll deduction"
          selectedKeys={[payrollFilter]}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => {
            const value = String(Array.from(keys)[0] ?? "ALL")
              .trim()
              .toUpperCase() as PayrollDeductionKey;

            setPayrollFilter(value);
          }}
        >
          {PAYROLL_FILTER_OPTIONS.map((option) => (
            <SelectItem key={option.value}>{option.label}</SelectItem>
          ))}
        </Select>

        <Input
          className="sm:w-44"
          label="Summary month"
          size="sm"
          type="month"
          value={summaryPeriod}
          variant="bordered"
          onValueChange={setSummaryPeriod}
        />

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="flat"
            onPress={() => {
              setEmployeeFilter("");
              setLeaveTypeFilter("ALL");
              setDateFrom("");
              setDateTo("");
              setPayrollFilter("ALL");
              setSummaryPeriod(toMonthInput());
              setPage(1);
            }}
          >
            Clear
          </Button>
          <Button size="sm" variant="flat" onPress={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      <Table aria-label="Employee leaves table">
        <TableHeader>
          <TableColumn>Employee</TableColumn>
          <TableColumn>Leave type</TableColumn>
          <TableColumn>Start date</TableColumn>
          <TableColumn>End date</TableColumn>
          <TableColumn>Duration (days)</TableColumn>
          <TableColumn>Hours absent</TableColumn>
          <TableColumn>Payroll deduction</TableColumn>
          <TableColumn>Notes</TableColumn>
          <TableColumn>Approved by</TableColumn>
          <TableColumn>Actions</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent={loading ? "Loading..." : "No leave records found"}
          items={leavesData?.items ?? []}
        >
          {(row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span>{row.employeeName ?? "-"}</span>
                  <span className="text-xs text-default-500">
                    {row.employeeCode ?? ""}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Chip
                  color={leaveTypeChipColor(row.leaveType)}
                  size="sm"
                  variant="flat"
                >
                  {leaveTypeLabel(row.leaveType)}
                </Chip>
              </TableCell>
              <TableCell>{formatDate(row.startDate)}</TableCell>
              <TableCell>{formatDate(row.endDate)}</TableCell>
              <TableCell>{row.durationDays}</TableCell>
              <TableCell>
                {row.hoursAbsent ? toNumber(row.hoursAbsent) : "-"}
              </TableCell>
              <TableCell>
                <Chip
                  color={row.payrollDeduction ? "danger" : "default"}
                  size="sm"
                  variant="flat"
                >
                  {row.payrollDeduction ? "Yes" : "No"}
                </Chip>
              </TableCell>
              <TableCell className="max-w-[280px] truncate">
                {row.notes || "-"}
              </TableCell>
              <TableCell>{row.approvedByName || "-"}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Button
                    isDisabled={!canManage}
                    size="sm"
                    startContent={<BsPencil />}
                    variant="flat"
                    onPress={() => openEditModal(row)}
                  >
                    Edit
                  </Button>
                  <Button
                    color="danger"
                    isDisabled={!canManage}
                    size="sm"
                    startContent={<BsTrash />}
                    variant="flat"
                    onPress={() => removeLeave(row.id)}
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {leavesData ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-default-500">
            Total records: {leavesData.total}
          </p>
          <Pagination page={page} total={totalPages} onChange={setPage} />
        </div>
      ) : null}

      <Card>
        <CardBody className="gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">
              Monthly Summary by Employee
            </h3>
            <Chip size="sm" variant="flat">
              {leavesData?.summaryPeriod ?? summaryPeriod}
            </Chip>
          </div>

          <Table removeWrapper aria-label="Monthly summary table">
            <TableHeader>
              <TableColumn>Employee</TableColumn>
              <TableColumn>Leaves</TableColumn>
              <TableColumn>Total days</TableColumn>
              <TableColumn>Unpaid days</TableColumn>
              <TableColumn>Payroll deductions</TableColumn>
            </TableHeader>
            <TableBody
              emptyContent={
                loading
                  ? "Loading summary..."
                  : "No summary data for selected month"
              }
              items={leavesData?.monthlySummary ?? []}
            >
              {(row) => (
                <TableRow key={row.employeeId}>
                  <TableCell>{row.employeeName ?? "-"}</TableCell>
                  <TableCell>{row.totalLeaves}</TableCell>
                  <TableCell>{row.totalDays}</TableCell>
                  <TableCell>{row.unpaidDays}</TableCell>
                  <TableCell>{row.payrollDeductions}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <LeaveModal
        draft={draft}
        employeeOptions={leavesData?.employeeOptions ?? []}
        loading={submitLoading}
        open={createOpen}
        setDraft={setDraft}
        title="Register leave"
        onClose={() => {
          setCreateOpen(false);
          resetDraft();
        }}
        onSubmit={saveCreate}
      />

      <LeaveModal
        draft={draft}
        employeeOptions={leavesData?.employeeOptions ?? []}
        loading={submitLoading}
        open={editOpen}
        setDraft={setDraft}
        title="Edit leave"
        onClose={() => {
          setEditOpen(false);
          resetDraft();
        }}
        onSubmit={saveEdit}
      />
    </div>
  );
}
