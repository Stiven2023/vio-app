"use client";

import * as XLSX from "xlsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
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
import { BsDownload, BsPencil, BsPlus } from "react-icons/bs";

import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";

type ContractTypeKey =
  | "FIXED_TERM"
  | "INDEFINITE_TERM"
  | "WORK_CONTRACT"
  | "SERVICE_CONTRACT";

type ProvisionRow = {
  id: string;
  period: string;
  employeeId: string;
  employeeName: string | null;
  employeeCode: string | null;
  contractType: ContractTypeKey | null;
  baseSalary: string;
  transportAllowance: string;
  severancePay: string;
  severanceInterests: string;
  serviceBonus: string;
  vacationProvision: string;
  healthContribution: string;
  pensionContribution: string;
  arlContribution: string;
  compensationBoxContribution: string;
  createdAt: string;
};

type EmployeeOption = {
  id: string;
  name: string;
  employeeCode: string | null;
};

type ProvisionData = {
  items: ProvisionRow[];
  employeeOptions: EmployeeOption[];
  summary: {
    totalSeverancePay: string;
    totalServiceBonus: string;
    totalVacationProvision: string;
    totalSocialSecurity: string;
  } | null;
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

type ModalEmployee = {
  id: string;
  name: string;
  employeeCode: string | null;
  contractType: ContractTypeKey | null;
  hasProvisionForPeriod: boolean;
  included: boolean;
  baseSalary: string;
  transportAllowance: string;
  arlRatePct: string;
};

const CONTRACT_LABELS: Record<ContractTypeKey, string> = {
  FIXED_TERM: "Fixed-term",
  INDEFINITE_TERM: "Indefinite term",
  WORK_CONTRACT: "Work and labor",
  SERVICE_CONTRACT: "Service contract",
};

const CONTRACT_FILTER_OPTIONS: { value: ContractTypeKey; label: string }[] = [
  { value: "FIXED_TERM", label: "Fixed-term" },
  { value: "INDEFINITE_TERM", label: "Indefinite term" },
  { value: "WORK_CONTRACT", label: "Work and labor" },
  { value: "SERVICE_CONTRACT", label: "Service contract" },
];

function toNumber(value: unknown) {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: string | number | null | undefined) {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function contractLabel(type: ContractTypeKey | null | undefined) {
  return type ? (CONTRACT_LABELS[type] ?? type) : "-";
}

function todayPeriod() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");

  return `${d.getFullYear()}-${mm}`;
}

function validPeriodFormat(p: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
}

function computeProvision(row: {
  baseSalary: string;
  transportAllowance: string;
  arlRatePct: string;
}) {
  const salary = toNumber(row.baseSalary);
  const transport = toNumber(row.transportAllowance);
  const arlRate = toNumber(row.arlRatePct);
  const severancePay = (salary + transport) / 12;
  const severanceInterests = severancePay * 0.12;
  const serviceBonus = (salary + transport) / 12;
  const vacationProvision = salary / 24;
  const healthContribution = salary * 0.125;
  const pensionContribution = salary * 0.16;
  const arlContribution = salary * (arlRate / 100);
  const compensationBoxContribution = salary * 0.04;

  return {
    severancePay,
    severanceInterests,
    serviceBonus,
    vacationProvision,
    healthContribution,
    pensionContribution,
    arlContribution,
    compensationBoxContribution,
  };
}

function exportToExcel(rows: ProvisionRow[]) {
  const headers = [
    "Employee",
    "Code",
    "Contract type",
    "Period",
    "Base salary",
    "Transport allowance",
    "Severance pay",
    "Severance interest",
    "Service bonus",
    "Vacation provision",
    "Health (company)",
    "Pension (company)",
    "ARL",
    "Compensation box",
    "Generated date",
  ];

  const lines = rows.map((r) => [
    r.employeeName ?? "",
    r.employeeCode ?? "",
    contractLabel(r.contractType),
    r.period,
    toNumber(r.baseSalary).toFixed(2),
    toNumber(r.transportAllowance).toFixed(2),
    toNumber(r.severancePay).toFixed(2),
    toNumber(r.severanceInterests).toFixed(2),
    toNumber(r.serviceBonus).toFixed(2),
    toNumber(r.vacationProvision).toFixed(2),
    toNumber(r.healthContribution).toFixed(2),
    toNumber(r.pensionContribution).toFixed(2),
    toNumber(r.arlContribution).toFixed(2),
    toNumber(r.compensationBoxContribution).toFixed(2),
    r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-CO") : "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...lines]);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "Payroll Provisions");
  XLSX.writeFile(
    wb,
    `payroll-provisions-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

type GenerateModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

function GenerateModal({ open, onClose, onSuccess }: GenerateModalProps) {
  const [period, setPeriod] = useState(todayPeriod);
  const [periodError, setPeriodError] = useState("");
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [rows, setRows] = useState<ModalEmployee[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fetched, setFetched] = useState(false);

  const loadEmployees = useCallback(async () => {
    if (!validPeriodFormat(period)) {
      setPeriodError("Use YYYY-MM format (e.g. 2025-06)");

      return;
    }

    setPeriodError("");
    setLoadingEmployees(true);
    try {
      const data = await apiJson<{
        employees: Array<{
          id: string;
          name: string;
          employeeCode: string | null;
          contractType: ContractTypeKey | null;
          hasProvisionForPeriod: boolean;
          lastBaseSalary: string | null;
          lastTransportAllowance: string | null;
          lastArlRatePct: number;
        }>;
      }>(
        `/api/hr/provisiones-nomina/employees?period=${encodeURIComponent(period)}`,
      );

      setRows(
        data.employees.map((e) => ({
          id: e.id,
          name: e.name,
          employeeCode: e.employeeCode,
          contractType: e.contractType,
          hasProvisionForPeriod: e.hasProvisionForPeriod,
          included: !e.hasProvisionForPeriod,
          baseSalary: e.lastBaseSalary ?? "",
          transportAllowance: e.lastTransportAllowance ?? "0",
          arlRatePct: String(e.lastArlRatePct ?? 0.522),
        })),
      );
      setFetched(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingEmployees(false);
    }
  }, [period]);

  useEffect(() => {
    if (!open) {
      setPeriod(todayPeriod());
      setPeriodError("");
      setRows([]);
      setFetched(false);
    }
  }, [open]);

  function updateRow(
    id: string,
    field: "baseSalary" | "transportAllowance" | "arlRatePct" | "included",
    value: string | boolean,
  ) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }

  const includableRows = rows.filter((r) => !r.hasProvisionForPeriod);
  const includedRows = rows.filter((r) => r.included);
  const allIncluded =
    includableRows.length > 0 && includableRows.every((r) => r.included);

  function toggleAll() {
    const newVal = !allIncluded;

    setRows((prev) =>
      prev.map((r) =>
        r.hasProvisionForPeriod ? r : { ...r, included: newVal },
      ),
    );
  }

  async function handleSubmit() {
    if (includedRows.length === 0) {
      toast.error("Select at least one employee");

      return;
    }

    const invalid = includedRows.find((r) => toNumber(r.baseSalary) <= 0);

    if (invalid) {
      toast.error(`Employee "${invalid.name}" has invalid salary`);

      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/hr/provisiones-nomina", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period,
          provisions: includedRows.map((r) => ({
            employeeId: r.id,
            baseSalary: toNumber(r.baseSalary),
            transportAllowance: toNumber(r.transportAllowance),
            arlRatePct: toNumber(r.arlRatePct),
          })),
        }),
      });

      if (res.status === 409) {
        const json = (await res.json()) as {
          message: string;
          duplicates: string[];
        };
        const names = json.duplicates.join(", ");

        toast.error(`Provisions already exist for: ${names}`);

        return;
      }

      if (!res.ok) {
        const text = await res.text();

        throw new Error(text || "Error generating provisions");
      }

      const result = (await res.json()) as {
        created: number;
        skippedDuplicates: number;
      };

      toast.success(
        `${result.created} provisions generated${result.skippedDuplicates > 0 ? `, ${result.skippedDuplicates} skipped` : ""}`,
      );
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      disableAnimation
      isOpen={open}
      scrollBehavior="inside"
      size="5xl"
      onClose={onClose}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader>
              <h2 className="text-lg font-semibold">Generate Provisions</h2>
            </ModalHeader>
            <ModalBody>
              <div className="flex items-end gap-3">
                <Input
                  className="max-w-[180px]"
                  errorMessage={periodError}
                  isInvalid={!!periodError}
                  label="Period (YYYY-MM)"
                  placeholder="2025-06"
                  value={period}
                  onValueChange={(v) => {
                    setPeriod(v);
                    setFetched(false);
                    setRows([]);
                  }}
                />
                <Button
                  color="primary"
                  isDisabled={!validPeriodFormat(period) || loadingEmployees}
                  variant="flat"
                  onPress={loadEmployees}
                >
                  {loadingEmployees ? "Loading..." : "Load employees"}
                </Button>
              </div>

              {fetched && rows.length === 0 && (
                <p className="mt-4 text-sm text-default-500">
                  No active employees.
                </p>
              )}

              {rows.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <p className="mb-2 text-sm text-default-500">
                    Enter base salary and transport allowance for each employee.
                    Those showing{" "}
                    <Chip color="warning" size="sm" variant="flat">
                      already generated
                    </Chip>{" "}
                    will not be processed.
                  </p>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-divider text-left text-xs text-default-500">
                        <th className="py-2 pr-3">
                          <input
                            checked={allIncluded}
                            title="Select all"
                            type="checkbox"
                            onChange={toggleAll}
                          />
                        </th>
                        <th className="py-2 pr-4">Employee</th>
                        <th className="py-2 pr-4">Contract</th>
                        <th className="py-2 pr-3">Base salary</th>
                        <th className="py-2 pr-3">Transport allow.</th>
                        <th className="py-2 pr-3">ARL rate (%)</th>
                        <th className="py-2 pr-3">Severance pay</th>
                        <th className="py-2 pr-3">Bonus</th>
                        <th className="py-2 pr-3">Vacation prov.</th>
                        <th className="py-2">Social sec.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const computed = computeProvision(row);
                        const socialSecurity =
                          computed.healthContribution +
                          computed.pensionContribution +
                          computed.arlContribution +
                          computed.compensationBoxContribution;

                        return (
                          <tr
                            key={row.id}
                            className="border-b border-divider/50"
                          >
                            <td className="py-2 pr-3">
                              {row.hasProvisionForPeriod ? (
                                <Chip color="warning" size="sm" variant="flat">
                                  already generated
                                </Chip>
                              ) : (
                                <input
                                  checked={row.included}
                                  type="checkbox"
                                  onChange={(e) =>
                                    updateRow(
                                      row.id,
                                      "included",
                                      e.target.checked,
                                    )
                                  }
                                />
                              )}
                            </td>
                            <td className="py-2 pr-4 font-medium">
                              {row.name}
                            </td>
                            <td className="py-2 pr-4 text-xs text-default-500">
                              {contractLabel(row.contractType)}
                            </td>
                            <td className="py-2 pr-3">
                              <Input
                                className="w-28"
                                isDisabled={
                                  row.hasProvisionForPeriod || !row.included
                                }
                                placeholder="0"
                                size="sm"
                                startContent={
                                  <span className="text-xs text-default-400">
                                    $
                                  </span>
                                }
                                type="number"
                                value={row.baseSalary}
                                onValueChange={(v) =>
                                  updateRow(row.id, "baseSalary", v)
                                }
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <Input
                                className="w-24"
                                isDisabled={
                                  row.hasProvisionForPeriod || !row.included
                                }
                                placeholder="0"
                                size="sm"
                                startContent={
                                  <span className="text-xs text-default-400">
                                    $
                                  </span>
                                }
                                type="number"
                                value={row.transportAllowance}
                                onValueChange={(v) =>
                                  updateRow(row.id, "transportAllowance", v)
                                }
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <Input
                                className="w-20"
                                isDisabled={
                                  row.hasProvisionForPeriod || !row.included
                                }
                                placeholder="0.522"
                                size="sm"
                                step="0.001"
                                type="number"
                                value={row.arlRatePct}
                                onValueChange={(v) =>
                                  updateRow(row.id, "arlRatePct", v)
                                }
                              />
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">
                              {formatMoney(computed.severancePay)}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">
                              {formatMoney(computed.serviceBonus)}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">
                              {formatMoney(computed.vacationProvision)}
                            </td>
                            <td className="py-2 text-right font-mono">
                              {formatMoney(socialSecurity)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button
                color="primary"
                isDisabled={!fetched || includedRows.length === 0 || submitting}
                onPress={handleSubmit}
              >
                {submitting
                  ? "Generating..."
                  : `Generate${includedRows.length > 0 ? ` (${includedRows.length})` : ""}`}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

type EditModalProps = {
  provision: ProvisionRow | null;
  onClose: () => void;
  onSuccess: () => void;
};

function EditModal({ provision, onClose, onSuccess }: EditModalProps) {
  const [baseSalary, setBaseSalary] = useState("");
  const [transportAllowance, setTransportAllowance] = useState("");
  const [arlRatePct, setArlRatePct] = useState("0.522");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (provision) {
      setBaseSalary(provision.baseSalary ?? "");
      setTransportAllowance(provision.transportAllowance ?? "0");
      const salary = toNumber(provision.baseSalary);
      const arlContrib = toNumber(provision.arlContribution);
      const implied = salary > 0 ? (arlContrib / salary) * 100 : 0.522;

      setArlRatePct(implied.toFixed(4));
    }
  }, [provision]);

  const preview = useMemo(
    () => computeProvision({ baseSalary, transportAllowance, arlRatePct }),
    [baseSalary, transportAllowance, arlRatePct],
  );

  async function handleSave() {
    if (!provision) return;
    if (toNumber(baseSalary) <= 0) {
      toast.error("Base salary must be greater than 0");

      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/hr/provisiones-nomina/${provision.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseSalary: toNumber(baseSalary),
          transportAllowance: toNumber(transportAllowance),
          arlRatePct: toNumber(arlRatePct),
        }),
      });

      if (!res.ok) {
        const text = await res.text();

        throw new Error(text || "Error updating");
      }

      toast.success("Provision updated");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal disableAnimation isOpen={!!provision} size="lg" onClose={onClose}>
      <ModalContent>
        {() => (
          <>
            <ModalHeader>
              <h2 className="text-lg font-semibold">
                Edit Provision - {provision?.employeeName}
              </h2>
            </ModalHeader>
            <ModalBody>
              <p className="text-sm text-default-500">
                Period: <strong>{provision?.period}</strong>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Input
                  label="Base salary"
                  startContent={
                    <span className="text-xs text-default-400">$</span>
                  }
                  type="number"
                  value={baseSalary}
                  onValueChange={setBaseSalary}
                />
                <Input
                  label="Transport allow."
                  startContent={
                    <span className="text-xs text-default-400">$</span>
                  }
                  type="number"
                  value={transportAllowance}
                  onValueChange={setTransportAllowance}
                />
                <Input
                  description="E.g. 0.522 for risk I"
                  label="ARL rate (%)"
                  step="0.001"
                  type="number"
                  value={arlRatePct}
                  onValueChange={setArlRatePct}
                />
              </div>
              <div className="mt-4 rounded-xl bg-default-50 p-3">
                <p className="mb-2 text-xs font-semibold text-default-500">
                  PREVIEW
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-default-500">Severance pay:</span>
                  <span className="text-right font-mono">
                    ${formatMoney(preview.severancePay)}
                  </span>
                  <span className="text-default-500">Severance interest:</span>
                  <span className="text-right font-mono">
                    ${formatMoney(preview.severanceInterests)}
                  </span>
                  <span className="text-default-500">Service bonus:</span>
                  <span className="text-right font-mono">
                    ${formatMoney(preview.serviceBonus)}
                  </span>
                  <span className="text-default-500">Vacation prov.:</span>
                  <span className="text-right font-mono">
                    ${formatMoney(preview.vacationProvision)}
                  </span>
                  <span className="text-default-500">Health (company):</span>
                  <span className="text-right font-mono">
                    ${formatMoney(preview.healthContribution)}
                  </span>
                  <span className="text-default-500">Pension (company):</span>
                  <span className="text-right font-mono">
                    ${formatMoney(preview.pensionContribution)}
                  </span>
                  <span className="text-default-500">ARL:</span>
                  <span className="text-right font-mono">
                    ${formatMoney(preview.arlContribution)}
                  </span>
                  <span className="text-default-500">Compensation box:</span>
                  <span className="text-right font-mono">
                    ${formatMoney(preview.compensationBoxContribution)}
                  </span>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button
                color="primary"
                isDisabled={submitting}
                onPress={handleSave}
              >
                {submitting ? "Saving..." : "Save"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

export function PayrollProvisionsTab({ canCreate }: { canCreate: boolean }) {
  const [period, setPeriod] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [contractType, setContractType] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editProvision, setEditProvision] = useState<ProvisionRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();

    if (period) params.set("period", period);
    if (employeeId) params.set("employeeId", employeeId);
    if (contractType) params.set("contractType", contractType);

    return `/api/hr/provisiones-nomina?${params.toString()}`;
  }, [period, employeeId, contractType]);

  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<ProvisionRow>(endpoint, 20);

  const provisionData = data as ProvisionData | null;
  const items = provisionData?.items ?? [];
  const employeeOptions = provisionData?.employeeOptions ?? [];
  const summary = provisionData?.summary ?? null;
  const total = provisionData?.total ?? 0;
  const totalPages = Math.max(
    1,
    Math.ceil(total / (provisionData?.pageSize ?? 20)),
  );

  async function handleExport() {
    if (items.length === 0) {
      toast("No data to export");

      return;
    }

    setExporting(true);
    try {
      exportToExcel(items);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-default-500">
          {total > 0
            ? `${total} record${total !== 1 ? "s" : ""}`
            : "No records"}
        </p>
        <div className="flex gap-2">
          <Button
            isDisabled={items.length === 0 || exporting}
            startContent={<BsDownload />}
            variant="flat"
            onPress={handleExport}
          >
            {exporting ? "Exporting..." : "Export"}
          </Button>
          {canCreate && (
            <Button
              color="primary"
              startContent={<BsPlus />}
              onPress={() => setGenerateOpen(true)}
            >
              Generate provisions
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Severance pay", value: summary?.totalSeverancePay },
          { label: "Service bonus", value: summary?.totalServiceBonus },
          { label: "Vacation prov.", value: summary?.totalVacationProvision },
          { label: "Social security", value: summary?.totalSocialSecurity },
        ].map(({ label, value }) => (
          <Card key={label} shadow="sm">
            <CardBody className="py-4">
              <p className="text-xs text-default-500">{label}</p>
              <p className="mt-1 text-xl font-bold">
                ${formatMoney(value ?? 0)}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-[160px]"
          label="Period"
          placeholder="YYYY-MM"
          value={period}
          onValueChange={(v) => {
            setPeriod(v);
            setPage(1);
          }}
        />
        <Select
          className="max-w-[240px]"
          label="Employee"
          placeholder="All"
          selectedKeys={employeeId ? new Set([employeeId]) : new Set([])}
          onSelectionChange={(keys) => {
            setEmployeeId(String(Array.from(keys)[0] ?? ""));
            setPage(1);
          }}
        >
          {employeeOptions.map((employee) => (
            <SelectItem key={employee.id}>{employee.name}</SelectItem>
          ))}
        </Select>
        <Select
          className="max-w-[260px]"
          label="Contract type"
          placeholder="All"
          selectedKeys={contractType ? new Set([contractType]) : new Set([])}
          onSelectionChange={(keys) => {
            setContractType(String(Array.from(keys)[0] ?? ""));
            setPage(1);
          }}
        >
          {CONTRACT_FILTER_OPTIONS.map((option) => (
            <SelectItem key={option.value}>{option.label}</SelectItem>
          ))}
        </Select>
      </div>

      <div className="overflow-x-auto">
        <Table isStriped removeWrapper aria-label="Payroll provisions">
          <TableHeader>
            <TableColumn>EMPLOYEE</TableColumn>
            <TableColumn>PERIOD</TableColumn>
            <TableColumn>CONTRACT</TableColumn>
            <TableColumn className="text-right">BASE SALARY</TableColumn>
            <TableColumn className="text-right">TRANSPORT ALLOW.</TableColumn>
            <TableColumn className="text-right">SEVERANCE</TableColumn>
            <TableColumn className="text-right">SEVER. INT.</TableColumn>
            <TableColumn className="text-right">BONUS</TableColumn>
            <TableColumn className="text-right">VACATION</TableColumn>
            <TableColumn className="text-right">HEALTH</TableColumn>
            <TableColumn className="text-right">PENSION</TableColumn>
            <TableColumn className="text-right">ARL</TableColumn>
            <TableColumn className="text-right">COMP. BOX</TableColumn>
            <TableColumn className="w-16 text-center">
              {canCreate ? "EDIT" : " "}
            </TableColumn>
          </TableHeader>
          <TableBody
            emptyContent={
              loading ? "Loading..." : "No provisions for the selected filters."
            }
            isLoading={loading}
          >
            {items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.employeeName ?? "-"}
                  {row.employeeCode && (
                    <span className="ml-1 text-xs text-default-400">
                      ({row.employeeCode})
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat">
                    {row.period}
                  </Chip>
                </TableCell>
                <TableCell className="text-xs">
                  {contractLabel(row.contractType)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${formatMoney(row.baseSalary)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${formatMoney(row.transportAllowance)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${formatMoney(row.severancePay)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${formatMoney(row.severanceInterests)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${formatMoney(row.serviceBonus)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${formatMoney(row.vacationProvision)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${formatMoney(row.healthContribution)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${formatMoney(row.pensionContribution)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${formatMoney(row.arlContribution)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${formatMoney(row.compensationBoxContribution)}
                </TableCell>
                <TableCell className="text-center">
                  {canCreate ? (
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      onPress={() => setEditProvision(row)}
                    >
                      <BsPencil />
                    </Button>
                  ) : (
                    " "
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center pt-2">
          <Pagination
            page={page}
            total={totalPages}
            onChange={(next) => setPage(next)}
          />
        </div>
      )}

      <GenerateModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSuccess={refresh}
      />
      <EditModal
        provision={editProvision}
        onClose={() => setEditProvision(null)}
        onSuccess={refresh}
      />
    </div>
  );
}

