"use client";

import * as XLSX from "xlsx";
import { useMemo, useState } from "react";
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
import { BsDownload, BsPlus } from "react-icons/bs";

import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";

type ContractTypeKey =
  | "FIXED_TERM"
  | "INDEFINITE_TERM"
  | "WORK_CONTRACT"
  | "SERVICE_CONTRACT";

type PilaRow = {
  id: string;
  employeeId: string;
  employeeName: string | null;
  contractType: ContractTypeKey | null;
  baseSalary: string;
  healthEmployer: string;
  healthEmployee: string;
  pensionEmployer: string;
  pensionEmployee: string;
  arlRatePct: string;
  arlContribution: string;
  compensationBoxRatePct: string;
  compensationBoxContribution: string;
  totalPerEmployee: string;
};

type PilaData = {
  period: string;
  items: PilaRow[];
  employeeOptions: Array<{
    id: string;
    name: string;
  }>;
  summary: {
    totalHealth: string;
    totalPension: string;
    totalArl: string;
    totalCompensationBox: string;
    grandTotal: string;
  };
  generation: {
    isGenerated: boolean;
    generatedAt: string | null;
  };
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

type PilaPreview = {
  period: string;
  isGenerated: boolean;
  generatedAt?: string | null;
  previewRows: PilaRow[];
  summary: {
    totalHealth: string;
    totalPension: string;
    totalArl: string;
    totalCompensationBox: string;
    grandTotal: string;
  };
};

const CONTRACT_LABELS: Record<ContractTypeKey, string> = {
  FIXED_TERM: "Término fijo",
  INDEFINITE_TERM: "Término indefinido",
  WORK_CONTRACT: "Obra y labor",
  SERVICE_CONTRACT: "Prestación de servicios",
};

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

function contractLabel(type: ContractTypeKey | null | undefined) {
  return type ? (CONTRACT_LABELS[type] ?? type) : "-";
}

function currentMonth() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${now.getFullYear()}-${month}`;
}

function exportPilaExcel(period: string, rows: PilaRow[]) {
  const headers = [
    "Empleado",
    "Tipo de contrato",
    "Salario base",
    "Salud empleador (8.5%)",
    "Salud empleado (4%)",
    "Pensión empleador (12%)",
    "Pensión empleado (4%)",
    "ARL %",
    "Aporte ARL",
    "Caja comp. %",
    "Caja comp. aporte",
    "Total empleado",
  ];

  const data = rows.map((row) => [
    row.employeeName ?? "",
    contractLabel(row.contractType),
    toNumber(row.baseSalary).toFixed(2),
    toNumber(row.healthEmployer).toFixed(2),
    toNumber(row.healthEmployee).toFixed(2),
    toNumber(row.pensionEmployer).toFixed(2),
    toNumber(row.pensionEmployee).toFixed(2),
    toNumber(row.arlRatePct).toFixed(4),
    toNumber(row.arlContribution).toFixed(2),
    toNumber(row.compensationBoxRatePct).toFixed(2),
    toNumber(row.compensationBoxContribution).toFixed(2),
    toNumber(row.totalPerEmployee).toFixed(2),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "PILA");
  XLSX.writeFile(wb, `pila-${period}.xlsx`);
}

export function PilaTab({ canGenerate }: { canGenerate: boolean }) {
  const [period, setPeriod] = useState(currentMonth());
  const [employeeId, setEmployeeId] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [preview, setPreview] = useState<PilaPreview | null>(null);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();

    if (period) params.set("period", period);
    if (employeeId) params.set("employeeId", employeeId);

    return `/api/hcm/pila?${params.toString()}`;
  }, [employeeId, period]);

  const { data, loading, page, setPage, refresh } = usePaginatedApi<PilaRow>(
    endpoint,
    15,
  );

  const pilaData = data as PilaData | null;

  const totalPages = useMemo(() => {
    const total = pilaData?.total ?? 0;

    return Math.max(1, Math.ceil(total / (pilaData?.pageSize ?? 15)));
  }, [pilaData?.pageSize, pilaData?.total]);

  async function openPreview() {
    if (!period) {
      toast.error("Selecciona un período");

      return;
    }

    try {
      setPreviewLoading(true);
      const response = await apiJson<PilaPreview>("/api/hcm/pila", {
        method: "POST",
        body: JSON.stringify({ period, confirm: false }),
      });

      setPreview(response);
      setPreviewOpen(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function confirmGenerate() {
    if (!preview) return;

    try {
      setConfirmLoading(true);
      const response = await apiJson<PilaPreview>("/api/hcm/pila", {
        method: "POST",
        body: JSON.stringify({ period: preview.period, confirm: true }),
      });

      setPreview(response);
      toast.success("PILA generada y período bloqueado");
      exportPilaExcel(response.period, response.previewRows);
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-default-500">
          Liquidación de aportes PILA con base en provisiones de nómina.
        </div>
        {canGenerate ? (
          <Button
            color="primary"
            isDisabled={Boolean(pilaData?.generation.isGenerated) || previewLoading}
            startContent={<BsPlus />}
            onPress={openPreview}
          >
            {previewLoading ? "Loading..." : "Generate PILA"}
          </Button>
        ) : null}
      </div>

      {pilaData?.generation.isGenerated ? (
        <div className="rounded-medium border border-success-200 bg-success-50 p-3 text-sm text-success-800">
          Período bloqueado por generación PILA. Generado el{" "}
          {pilaData.generation.generatedAt
            ? new Date(pilaData.generation.generatedAt).toLocaleString("es-CO")
            : "-"}
          .
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Input
          className="sm:w-48"
          label="Período"
          size="sm"
          type="month"
          value={period}
          variant="bordered"
          onValueChange={(value) => {
            setPeriod(value);
            setPage(1);
          }}
        />

        <Select
          className="sm:w-72"
          label="Empleado"
          placeholder="Todos"
          selectedKeys={employeeId ? [employeeId] : []}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => {
            const value = String(Array.from(keys)[0] ?? "");

            setEmployeeId(value);
            setPage(1);
          }}
        >
          {(pilaData?.employeeOptions ?? []).map((employee) => (
            <SelectItem key={employee.id}>{employee.name}</SelectItem>
          ))}
        </Select>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="flat"
            onPress={() => {
              setEmployeeId("");
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <Card>
          <CardBody>
            <p className="text-xs text-default-500">
              Total health contributions
            </p>
            <p className="text-xl font-semibold">
              ${formatMoney(pilaData?.summary.totalHealth ?? 0)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-default-500">
              Total pension contributions
            </p>
            <p className="text-xl font-semibold">
              ${formatMoney(pilaData?.summary.totalPension ?? 0)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-default-500">Total ARL contributions</p>
            <p className="text-xl font-semibold">
              ${formatMoney(pilaData?.summary.totalArl ?? 0)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-default-500">
              Total compensation box contributions
            </p>
            <p className="text-xl font-semibold">
              ${formatMoney(pilaData?.summary.totalCompensationBox ?? 0)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-default-500">Grand total PILA</p>
            <p className="text-xl font-semibold">
              ${formatMoney(pilaData?.summary.grandTotal ?? 0)}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="space-y-2">
          <h3 className="text-sm font-semibold">
            Colombian contribution rates (reference)
          </h3>
          <p className="text-sm text-default-600">
            Health: 12.5% total (8.5% employer + 4% employee)
          </p>
          <p className="text-sm text-default-600">
            Pension: 16% total (12% employer + 4% employee)
          </p>
          <p className="text-sm text-default-600">
            ARL: variable by risk level (0.522% to 6.96%)
          </p>
          <p className="text-sm text-default-600">
            Compensation box: 4% employer only
          </p>
        </CardBody>
      </Card>

      <Table aria-label="PILA table">
        <TableHeader>
          <TableColumn>Employee name</TableColumn>
          <TableColumn>Contract type</TableColumn>
          <TableColumn>Base salary</TableColumn>
          <TableColumn>Health (employer %) | Health (employee %)</TableColumn>
          <TableColumn>Pension (employer %) | Pension (employee %)</TableColumn>
          <TableColumn>ARL %</TableColumn>
          <TableColumn>Compensation box %</TableColumn>
          <TableColumn>Total per employee</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent={
            loading ? "Loading..." : "No PILA data for selected period"
          }
          items={pilaData?.items ?? []}
        >
          {(row) => (
            <TableRow key={row.id}>
              <TableCell>{row.employeeName ?? "-"}</TableCell>
              <TableCell>{contractLabel(row.contractType)}</TableCell>
              <TableCell>${formatMoney(row.baseSalary)}</TableCell>
              <TableCell>
                8.5% (${formatMoney(row.healthEmployer)}) | 4% ($
                {formatMoney(row.healthEmployee)})
              </TableCell>
              <TableCell>
                12% (${formatMoney(row.pensionEmployer)}) | 4% ($
                {formatMoney(row.pensionEmployee)})
              </TableCell>
              <TableCell>{toNumber(row.arlRatePct).toFixed(4)}%</TableCell>
              <TableCell>
                {toNumber(row.compensationBoxRatePct).toFixed(2)}%
              </TableCell>
              <TableCell className="font-semibold">
                ${formatMoney(row.totalPerEmployee)}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {pilaData ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-default-500">
            Total records: {pilaData.total}
          </p>
          <Pagination page={page} total={totalPages} onChange={setPage} />
        </div>
      ) : null}

      <Modal
        disableAnimation
        isOpen={previewOpen}
        size="5xl"
        onClose={() => setPreviewOpen(false)}
      >
        <ModalContent>
          <ModalHeader>PILA preview - {preview?.period}</ModalHeader>
          <ModalBody>
            {preview ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Chip variant="flat">Rows: {preview.previewRows.length}</Chip>
                  <Button
                    size="sm"
                    startContent={<BsDownload />}
                    variant="flat"
                    onPress={() =>
                      exportPilaExcel(preview.period, preview.previewRows)
                    }
                  >
                    Export Excel
                  </Button>
                </div>

                <Table removeWrapper aria-label="PILA preview table">
                  <TableHeader>
                    <TableColumn>Employee</TableColumn>
                    <TableColumn>Base salary</TableColumn>
                    <TableColumn>Health total</TableColumn>
                    <TableColumn>Pension total</TableColumn>
                    <TableColumn>ARL</TableColumn>
                    <TableColumn>Comp. box</TableColumn>
                    <TableColumn>Total</TableColumn>
                  </TableHeader>
                  <TableBody items={preview.previewRows}>
                    {(row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.employeeName ?? "-"}</TableCell>
                        <TableCell>${formatMoney(row.baseSalary)}</TableCell>
                        <TableCell>
                          $
                          {formatMoney(
                            toNumber(row.healthEmployer) +
                              toNumber(row.healthEmployee),
                          )}
                        </TableCell>
                        <TableCell>
                          $
                          {formatMoney(
                            toNumber(row.pensionEmployer) +
                              toNumber(row.pensionEmployee),
                          )}
                        </TableCell>
                        <TableCell>
                          ${formatMoney(row.arlContribution)}
                        </TableCell>
                        <TableCell>
                          ${formatMoney(row.compensationBoxContribution)}
                        </TableCell>
                        <TableCell className="font-semibold">
                          ${formatMoney(row.totalPerEmployee)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setPreviewOpen(false)}>
              Close
            </Button>
            <Button
              color="primary"
              isDisabled={!preview || preview.isGenerated || confirmLoading}
              onPress={confirmGenerate}
            >
              {confirmLoading ? "Locking..." : "Confirm and lock period"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
