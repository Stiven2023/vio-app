"use client";

import * as XLSX from "xlsx";
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
import { Tab, Tabs } from "@heroui/tabs";
import { BsDownload, BsPlus } from "react-icons/bs";

import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";

/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */

type TransactionType = "EXPENSE" | "REPLENISHMENT" | "OPENING" | "ADJUSTMENT";

type FundOption = {
  id: string;
  name: string;
  currentBalance: string;
  currency: string;
  status: string;
};

type TransactionRow = {
  id: string;
  transactionCode: string;
  fundId: string;
  fundName: string | null;
  transactionDate: string;
  transactionType: TransactionType;
  category: string | null;
  description: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  referenceCode: string | null;
  attachmentUrl: string | null;
  notes: string | null;
  currency: string | null;
  createdAt: string | null;
  createdByName: string | null;
};

type PettyCashData = {
  items: TransactionRow[];
  funds: FundOption[];
  summary: {
    totalExpenses: string;
    totalReplenishments: string;
    totalAdjustments: string;
  };
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

type FundRow = {
  id: string;
  name: string;
  description: string | null;
  initialBalance: string;
  currentBalance: string;
  maxBalance: string | null;
  currency: string;
  status: string;
  createdAt: string | null;
  responsibleName: string | null;
};

type FundsData = {
  items: FundRow[];
};

/* ─────────────────────────────────────────
   Constants
───────────────────────────────────────── */

const TRANSACTION_TYPE_OPTIONS = [
  { value: "ALL", label: "Todos los tipos" },
  { value: "EXPENSE", label: "Egreso" },
  { value: "REPLENISHMENT", label: "Reposición" },
  { value: "OPENING", label: "Apertura" },
  { value: "ADJUSTMENT", label: "Ajuste" },
] as const;

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  EXPENSE: "Egreso",
  REPLENISHMENT: "Reposición",
  OPENING: "Apertura",
  ADJUSTMENT: "Ajuste",
};

const EXPENSE_CATEGORIES = [
  "Papelería",
  "Transporte",
  "Aseo",
  "Cafetería",
  "Materiales varios",
  "Mensajería",
  "Servicios públicos",
  "Otros",
] as const;

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */

function toNumber(value: unknown): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: string | number | null | undefined): string {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function txTypeColor(
  type: TransactionType,
): "danger" | "success" | "primary" | "warning" {
  if (type === "EXPENSE") return "danger";
  if (type === "REPLENISHMENT") return "success";
  if (type === "OPENING") return "primary";

  return "warning";
}

/* ─────────────────────────────────────────
   Main Component
───────────────────────────────────────── */

export function PettyCashTab({
  canCreate,
  canManage,
}: {
  canCreate: boolean;
  canManage: boolean;
}) {
  const [activeTab, setActiveTab] = useState<string>("movimientos");

  /* ── Transactions tab state ── */
  const [fundFilter, setFundFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const txEndpoint = useMemo(() => {
    const params = new URLSearchParams();

    if (fundFilter) params.set("fundId", fundFilter);
    if (typeFilter && typeFilter !== "ALL") params.set("type", typeFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    return `/api/contabilidad/caja-menor?${params.toString()}`;
  }, [fundFilter, typeFilter, dateFrom, dateTo]);

  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<TransactionRow>(txEndpoint, 15);

  const pettyCashData = data as PettyCashData | null;

  useEffect(() => {
    setPage(1);
  }, [fundFilter, typeFilter, dateFrom, dateTo, setPage]);

  /* ── Create transaction modal ── */
  const [createTxOpen, setCreateTxOpen] = useState(false);
  const [createTxLoading, setCreateTxLoading] = useState(false);
  const [txFundId, setTxFundId] = useState("");
  const [txDate, setTxDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [txType, setTxType] = useState<TransactionType>("EXPENSE");
  const [txCategory, setTxCategory] = useState("");
  const [txDescription, setTxDescription] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txReference, setTxReference] = useState("");
  const [txNotes, setTxNotes] = useState("");

  const selectedFundBalance = useMemo(() => {
    const fund = (pettyCashData?.funds ?? []).find((f) => f.id === txFundId);

    return fund ? toNumber(fund.currentBalance) : 0;
  }, [pettyCashData?.funds, txFundId]);

  const resetTxDraft = () => {
    setTxFundId("");
    setTxDate(new Date().toISOString().slice(0, 10));
    setTxType("EXPENSE");
    setTxCategory("");
    setTxDescription("");
    setTxAmount("");
    setTxReference("");
    setTxNotes("");
  };

  const saveTx = async () => {
    if (!txFundId) return toast.error("Selecciona un fondo");
    if (!txDate) return toast.error("La fecha es obligatoria");
    if (!txDescription.trim())
      return toast.error("La descripción es obligatoria");
    if (!txAmount) return toast.error("El monto es obligatorio");

    const numAmount = parseFloat(txAmount);

    if (isNaN(numAmount) || numAmount <= 0)
      return toast.error("El monto debe ser positivo");

    if (txType === "EXPENSE" && numAmount > selectedFundBalance) {
      return toast.error("Saldo insuficiente en el fondo");
    }

    try {
      setCreateTxLoading(true);
      await apiJson("/api/contabilidad/caja-menor", {
        method: "POST",
        body: JSON.stringify({
          fundId: txFundId,
          transactionDate: txDate,
          transactionType: txType,
          category: txCategory || null,
          description: txDescription,
          amount: numAmount,
          referenceCode: txReference || null,
          notes: txNotes || null,
        }),
      });
      toast.success("Movimiento registrado");
      setCreateTxOpen(false);
      resetTxDraft();
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreateTxLoading(false);
    }
  };

  /* ── Funds tab state ── */
  const [fundsData, setFundsData] = useState<FundsData | null>(null);
  const [fundsLoading, setFundsLoading] = useState(false);
  const [createFundOpen, setCreateFundOpen] = useState(false);
  const [createFundLoading, setCreateFundLoading] = useState(false);
  const [fundName, setFundName] = useState("");
  const [fundDescription, setFundDescription] = useState("");
  const [fundInitialBalance, setFundInitialBalance] = useState("");
  const [fundMaxBalance, setFundMaxBalance] = useState("");
  const [fundCurrency, setFundCurrency] = useState("COP");

  const loadFunds = async () => {
    setFundsLoading(true);
    try {
      const res = await apiJson<FundsData>(
        "/api/contabilidad/caja-menor/funds",
      );

      setFundsData(res);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setFundsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "fondos") {
      void loadFunds();
    }
  }, [activeTab]);

  const resetFundDraft = () => {
    setFundName("");
    setFundDescription("");
    setFundInitialBalance("");
    setFundMaxBalance("");
    setFundCurrency("COP");
  };

  const saveFund = async () => {
    if (!fundName.trim())
      return toast.error("El nombre del fondo es obligatorio");
    if (!fundInitialBalance)
      return toast.error("El saldo inicial es obligatorio");

    const numInitial = parseFloat(fundInitialBalance);

    if (isNaN(numInitial) || numInitial < 0)
      return toast.error("Saldo inicial inválido");

    try {
      setCreateFundLoading(true);
      await apiJson("/api/contabilidad/caja-menor/funds", {
        method: "POST",
        body: JSON.stringify({
          name: fundName,
          description: fundDescription || null,
          initialBalance: numInitial,
          maxBalance: fundMaxBalance ? parseFloat(fundMaxBalance) : null,
          currency: fundCurrency,
        }),
      });
      toast.success("Fondo creado correctamente");
      setCreateFundOpen(false);
      resetFundDraft();
      void loadFunds();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreateFundLoading(false);
    }
  };

  /* ── Export ── */
  const exportToExcel = () => {
    const rows = (pettyCashData?.items ?? []).map((row) => ({
      Código: row.transactionCode,
      Fecha: row.transactionDate,
      Fondo: row.fundName ?? "",
      Tipo: TRANSACTION_TYPE_LABELS[row.transactionType] ?? row.transactionType,
      Categoría: row.category ?? "",
      Descripción: row.description,
      Moneda: row.currency ?? "COP",
      Monto: toNumber(row.amount),
      "Saldo Antes": toNumber(row.balanceBefore),
      "Saldo Después": toNumber(row.balanceAfter),
      Referencia: row.referenceCode ?? "",
      Notas: row.notes ?? "",
      "Registrado Por": row.createdByName ?? "",
      "Creado En": row.createdAt ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Caja Menor");
    XLSX.writeFile(wb, "caja_menor.xlsx");
  };

  /* ── Summary totals ── */
  const totalActiveFundsBalance = useMemo(
    () =>
      (pettyCashData?.funds ?? []).reduce(
        (acc, f) => acc + toNumber(f.currentBalance),
        0,
      ),
    [pettyCashData?.funds],
  );

  /* ─────────────────────────────────────────
     Render
  ───────────────────────────────────────── */

  return (
    <div className="space-y-4">
      <Tabs
        aria-label="Caja Menor"
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(String(key))}
      >
        {/* ══════════════════════════
            TAB 1 – MOVIMIENTOS
        ══════════════════════════ */}
        <Tab key="movimientos" title="Movimientos">
          <div className="mt-4 space-y-4">
            {/* Actions row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-default-500">
                Registro de egresos, reposiciones y aperturas de caja menor.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  startContent={<BsDownload />}
                  variant="flat"
                  onPress={exportToExcel}
                >
                  Exportar Excel
                </Button>
                {canCreate ? (
                  <Button
                    color="primary"
                    size="sm"
                    startContent={<BsPlus className="text-lg" />}
                    onPress={() => setCreateTxOpen(true)}
                  >
                    Nuevo Movimiento
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Card>
                <CardBody className="gap-1">
                  <div className="text-xs uppercase tracking-wide text-default-500">
                    Total Egresos
                  </div>
                  <div className="text-2xl font-semibold text-danger-600">
                    {pettyCashData?.summary
                      ? formatMoney(pettyCashData.summary.totalExpenses)
                      : "—"}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="gap-1">
                  <div className="text-xs uppercase tracking-wide text-default-500">
                    Total Reposiciones
                  </div>
                  <div className="text-2xl font-semibold text-success-600">
                    {pettyCashData?.summary
                      ? formatMoney(pettyCashData.summary.totalReplenishments)
                      : "—"}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="gap-1">
                  <div className="text-xs uppercase tracking-wide text-default-500">
                    Balance Actual (Fondos Activos)
                  </div>
                  <div className="text-2xl font-semibold">
                    {formatMoney(totalActiveFundsBalance)}
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <Select
                className="sm:w-64"
                label="Fondo"
                placeholder="Todos los fondos"
                selectedKeys={fundFilter ? [fundFilter] : []}
                size="sm"
                variant="bordered"
                onSelectionChange={(keys) =>
                  setFundFilter(String(Array.from(keys)[0] ?? ""))
                }
              >
                {(pettyCashData?.funds ?? []).map((f) => (
                  <SelectItem key={f.id}>
                    {f.name} — {f.currency} {formatMoney(f.currentBalance)}
                  </SelectItem>
                ))}
              </Select>

              <Select
                className="sm:w-52"
                label="Tipo de movimiento"
                selectedKeys={[typeFilter]}
                size="sm"
                variant="bordered"
                onSelectionChange={(keys) =>
                  setTypeFilter(String(Array.from(keys)[0] ?? "ALL"))
                }
              >
                {TRANSACTION_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value}>{opt.label}</SelectItem>
                ))}
              </Select>

              <Input
                className="sm:w-44"
                label="Desde"
                size="sm"
                type="date"
                value={dateFrom}
                variant="bordered"
                onValueChange={setDateFrom}
              />

              <Input
                className="sm:w-44"
                label="Hasta"
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
                    setFundFilter("");
                    setTypeFilter("ALL");
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Limpiar
                </Button>
                <Button size="sm" variant="flat" onPress={refresh}>
                  Actualizar
                </Button>
              </div>
            </div>

            {/* Table */}
            <Table aria-label="Movimientos de caja menor">
              <TableHeader>
                <TableColumn>Fecha</TableColumn>
                <TableColumn>Código</TableColumn>
                <TableColumn>Fondo</TableColumn>
                <TableColumn>Tipo</TableColumn>
                <TableColumn>Categoría</TableColumn>
                <TableColumn>Descripción</TableColumn>
                <TableColumn>Monto</TableColumn>
                <TableColumn>Balance</TableColumn>
                <TableColumn>Referencia</TableColumn>
              </TableHeader>
              <TableBody
                emptyContent={
                  loading ? "Cargando..." : "Sin movimientos registrados"
                }
                items={pettyCashData?.items ?? []}
              >
                {(row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.transactionDate}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {row.transactionCode}
                      </span>
                    </TableCell>
                    <TableCell>{row.fundName ?? "—"}</TableCell>
                    <TableCell>
                      <Chip
                        color={txTypeColor(row.transactionType)}
                        size="sm"
                        variant="flat"
                      >
                        {TRANSACTION_TYPE_LABELS[row.transactionType] ??
                          row.transactionType}
                      </Chip>
                    </TableCell>
                    <TableCell>{row.category ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {row.description}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          row.transactionType === "EXPENSE"
                            ? "text-danger-600 font-medium"
                            : "text-success-600 font-medium"
                        }
                      >
                        {row.transactionType === "EXPENSE" ? "−" : "+"}
                        {row.currency ?? "COP"} {formatMoney(row.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-default-500">
                        {row.currency ?? "COP"} {formatMoney(row.balanceAfter)}
                      </span>
                    </TableCell>
                    <TableCell>{row.referenceCode ?? "—"}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {pettyCashData ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-default-500">
                  Total: {pettyCashData.total ?? 0} movimiento
                  {pettyCashData.total !== 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  <Button
                    isDisabled={loading || page <= 1}
                    size="sm"
                    variant="flat"
                    onPress={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    isDisabled={loading || !pettyCashData.hasNextPage}
                    size="sm"
                    variant="flat"
                    onPress={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </Tab>

        {/* ══════════════════════════
            TAB 2 – FONDOS
        ══════════════════════════ */}
        <Tab key="fondos" title="Fondos">
          <div className="mt-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-default-500">
                Administración de fondos de caja menor activos e inactivos.
              </p>
              {canManage ? (
                <Button
                  color="primary"
                  size="sm"
                  startContent={<BsPlus className="text-lg" />}
                  onPress={() => setCreateFundOpen(true)}
                >
                  Nuevo Fondo
                </Button>
              ) : null}
            </div>

            <Table aria-label="Fondos de caja menor">
              <TableHeader>
                <TableColumn>Nombre</TableColumn>
                <TableColumn>Descripción</TableColumn>
                <TableColumn>Responsable</TableColumn>
                <TableColumn>Saldo Inicial</TableColumn>
                <TableColumn>Saldo Actual</TableColumn>
                <TableColumn>Saldo Máx.</TableColumn>
                <TableColumn>Moneda</TableColumn>
                <TableColumn>Estado</TableColumn>
              </TableHeader>
              <TableBody
                emptyContent={
                  fundsLoading ? "Cargando..." : "Sin fondos registrados"
                }
                items={fundsData?.items ?? []}
              >
                {(fund) => (
                  <TableRow key={fund.id}>
                    <TableCell className="font-medium">{fund.name}</TableCell>
                    <TableCell>{fund.description ?? "—"}</TableCell>
                    <TableCell>{fund.responsibleName ?? "—"}</TableCell>
                    <TableCell>
                      {fund.currency} {formatMoney(fund.initialBalance)}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">
                        {fund.currency} {formatMoney(fund.currentBalance)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {toNumber(fund.maxBalance) > 0
                        ? `${fund.currency} ${formatMoney(fund.maxBalance)}`
                        : "—"}
                    </TableCell>
                    <TableCell>{fund.currency}</TableCell>
                    <TableCell>
                      <Chip
                        color={fund.status === "ACTIVE" ? "success" : "default"}
                        size="sm"
                        variant="flat"
                      >
                        {fund.status === "ACTIVE" ? "Activo" : "Inactivo"}
                      </Chip>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Tab>
      </Tabs>

      {/* ══════════════════════════
          MODAL – Nuevo Movimiento
      ══════════════════════════ */}
      <Modal
        isOpen={createTxOpen}
        size="2xl"
        onOpenChange={(open) => {
          setCreateTxOpen(open);
          if (!open) resetTxDraft();
        }}
      >
        <ModalContent>
          <ModalHeader>Registrar Movimiento de Caja Menor</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Select
                isRequired
                label="Fondo"
                selectedKeys={txFundId ? [txFundId] : []}
                variant="bordered"
                onSelectionChange={(keys) =>
                  setTxFundId(String(Array.from(keys)[0] ?? ""))
                }
              >
                {(pettyCashData?.funds ?? []).map((f) => (
                  <SelectItem key={f.id}>
                    {f.name} — Saldo: {f.currency}{" "}
                    {formatMoney(f.currentBalance)}
                  </SelectItem>
                ))}
              </Select>

              <Input
                isRequired
                label="Fecha"
                type="date"
                value={txDate}
                variant="bordered"
                onValueChange={setTxDate}
              />

              <Select
                isRequired
                label="Tipo de movimiento"
                selectedKeys={[txType]}
                variant="bordered"
                onSelectionChange={(keys) =>
                  setTxType(
                    String(Array.from(keys)[0] ?? "EXPENSE") as TransactionType,
                  )
                }
              >
                <SelectItem key="EXPENSE">Egreso</SelectItem>
                <SelectItem key="REPLENISHMENT">Reposición</SelectItem>
                <SelectItem key="OPENING">Apertura</SelectItem>
                <SelectItem key="ADJUSTMENT">Ajuste</SelectItem>
              </Select>

              <Select
                label="Categoría"
                placeholder="Seleccionar categoría"
                selectedKeys={txCategory ? [txCategory] : []}
                variant="bordered"
                onSelectionChange={(keys) =>
                  setTxCategory(String(Array.from(keys)[0] ?? ""))
                }
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat}>{cat}</SelectItem>
                ))}
              </Select>

              <Input
                isRequired
                className="md:col-span-2"
                label="Descripción"
                placeholder="Detalle del movimiento"
                value={txDescription}
                variant="bordered"
                onValueChange={setTxDescription}
              />

              <Input
                isRequired
                label="Monto"
                min="0"
                placeholder="0.00"
                type="number"
                value={txAmount}
                variant="bordered"
                onValueChange={setTxAmount}
              />

              <Input
                isDisabled
                description={
                  txFundId
                    ? `Saldo disponible en el fondo seleccionado`
                    : "Selecciona un fondo para ver el saldo"
                }
                label="Saldo actual del fondo"
                value={txFundId ? formatMoney(selectedFundBalance) : "—"}
                variant="faded"
              />

              <Input
                label="Código de referencia"
                placeholder="Comprobante, factura, etc."
                value={txReference}
                variant="bordered"
                onValueChange={setTxReference}
              />

              <Textarea
                className="md:col-span-2"
                label="Observaciones"
                minRows={2}
                placeholder="Notas adicionales (opcional)"
                value={txNotes}
                variant="bordered"
                onValueChange={setTxNotes}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setCreateTxOpen(false)}>
              Cancelar
            </Button>
            <Button
              color="primary"
              isLoading={createTxLoading}
              onPress={saveTx}
            >
              Registrar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ══════════════════════════
          MODAL – Nuevo Fondo
      ══════════════════════════ */}
      <Modal
        isOpen={createFundOpen}
        size="xl"
        onOpenChange={(open) => {
          setCreateFundOpen(open);
          if (!open) resetFundDraft();
        }}
      >
        <ModalContent>
          <ModalHeader>Crear Fondo de Caja Menor</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                isRequired
                className="md:col-span-2"
                label="Nombre del fondo"
                placeholder="Ej. Caja Menor Administrativa"
                value={fundName}
                variant="bordered"
                onValueChange={setFundName}
              />

              <Textarea
                className="md:col-span-2"
                label="Descripción"
                minRows={2}
                placeholder="Propósito o descripción del fondo (opcional)"
                value={fundDescription}
                variant="bordered"
                onValueChange={setFundDescription}
              />

              <Input
                isRequired
                label="Saldo inicial"
                min="0"
                placeholder="0.00"
                type="number"
                value={fundInitialBalance}
                variant="bordered"
                onValueChange={setFundInitialBalance}
              />

              <Input
                label="Saldo máximo"
                min="0"
                placeholder="0.00"
                type="number"
                value={fundMaxBalance}
                variant="bordered"
                onValueChange={setFundMaxBalance}
              />

              <Select
                label="Moneda"
                selectedKeys={[fundCurrency]}
                variant="bordered"
                onSelectionChange={(keys) =>
                  setFundCurrency(String(Array.from(keys)[0] ?? "COP"))
                }
              >
                <SelectItem key="COP">COP – Peso Colombiano</SelectItem>
                <SelectItem key="USD">USD – Dólar Americano</SelectItem>
                <SelectItem key="EUR">EUR – Euro</SelectItem>
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setCreateFundOpen(false)}>
              Cancelar
            </Button>
            <Button
              color="primary"
              isLoading={createFundLoading}
              onPress={saveFund}
            >
              Crear Fondo
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
