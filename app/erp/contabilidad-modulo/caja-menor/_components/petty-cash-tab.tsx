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
import {
  getCurrencyOptions,
  getExpenseCategoryOptions,
  getTransactionTypeLabel,
  getTransactionTypeOptions,
  PETTY_CASH_COPY,
} from "../_lib/petty-cash.constants";
import {
  formatMoney,
  getMovementCountLabel,
  getPettyCashUiLocale,
  getSignedAmountPrefix,
  getTransactionTypeColor,
  toNumber,
} from "../_lib/petty-cash.utils";
import type {
  FundsData,
  PettyCashData,
  TransactionRow,
  TransactionType,
} from "../_lib/types";

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
  const locale = useMemo(() => getPettyCashUiLocale(), []);
  const copy = PETTY_CASH_COPY[locale];
  const transactionTypeOptions = useMemo(
    () => getTransactionTypeOptions(locale),
    [locale],
  );
  const expenseCategoryOptions = useMemo(
    () => getExpenseCategoryOptions(locale),
    [locale],
  );
  const currencyOptions = useMemo(() => getCurrencyOptions(locale), [locale]);
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
    if (!txFundId) return toast.error(copy.transactions.validation.fundRequired);
    if (!txDate) return toast.error(copy.transactions.validation.dateRequired);
    if (!txDescription.trim()) {
      return toast.error(copy.transactions.validation.descriptionRequired);
    }
    if (!txAmount) return toast.error(copy.transactions.validation.amountRequired);

    const numAmount = parseFloat(txAmount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return toast.error(copy.transactions.validation.positiveAmount);
    }

    if (txType === "EXPENSE" && numAmount > selectedFundBalance) {
      return toast.error(copy.transactions.validation.insufficientBalance);
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
      toast.success(copy.transactions.validation.saved);
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
    if (!fundName.trim()) return toast.error(copy.funds.validation.nameRequired);
    if (!fundInitialBalance) {
      return toast.error(copy.funds.validation.initialRequired);
    }

    const numInitial = parseFloat(fundInitialBalance);

    if (isNaN(numInitial) || numInitial < 0) {
      return toast.error(copy.funds.validation.initialInvalid);
    }

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
      toast.success(copy.funds.validation.saved);
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
      [copy.transactions.table.code]: row.transactionCode,
      [copy.transactions.table.date]: row.transactionDate,
      [copy.transactions.table.fund]: row.fundName ?? "",
      [copy.transactions.table.type]: getTransactionTypeLabel(
        locale,
        row.transactionType,
      ),
      [copy.transactions.table.category]: row.category ?? "",
      [copy.transactions.table.description]: row.description,
      [copy.funds.table.currency]: row.currency ?? "COP",
      [copy.transactions.table.amount]: toNumber(row.amount),
      [locale === "es" ? "Saldo antes" : "Balance before"]: toNumber(
        row.balanceBefore,
      ),
      [locale === "es" ? "Saldo despues" : "Balance after"]: toNumber(
        row.balanceAfter,
      ),
      [copy.transactions.table.reference]: row.referenceCode ?? "",
      [copy.transactions.modal.notes]: row.notes ?? "",
      [locale === "es" ? "Registrado por" : "Created by"]:
        row.createdByName ?? "",
      [locale === "es" ? "Creado en" : "Created at"]: row.createdAt ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, copy.exportSheetName);
    XLSX.writeFile(wb, copy.exportFileName);
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
        aria-label={copy.transactions.ariaLabel}
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(String(key))}
      >
        {/* ══════════════════════════
            TAB 1 – MOVIMIENTOS
        ══════════════════════════ */}
        <Tab key="movimientos" title={copy.tabs.transactions}>
          <div className="mt-4 space-y-4">
            {/* Actions row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-default-500">
                {copy.transactions.helper}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  startContent={<BsDownload />}
                  variant="flat"
                  onPress={exportToExcel}
                >
                  {copy.transactions.export}
                </Button>
                {canCreate ? (
                  <Button
                    color="primary"
                    size="sm"
                    startContent={<BsPlus className="text-lg" />}
                    onPress={() => setCreateTxOpen(true)}
                  >
                    {copy.transactions.new}
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Card>
                <CardBody className="gap-1">
                  <div className="text-xs uppercase tracking-wide text-default-500">
                    {copy.transactions.summary.expenses}
                  </div>
                  <div className="text-2xl font-semibold text-danger-600">
                    {pettyCashData?.summary
                      ? formatMoney(locale, pettyCashData.summary.totalExpenses)
                      : "—"}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="gap-1">
                  <div className="text-xs uppercase tracking-wide text-default-500">
                    {copy.transactions.summary.replenishments}
                  </div>
                  <div className="text-2xl font-semibold text-success-600">
                    {pettyCashData?.summary
                      ? formatMoney(
                          locale,
                          pettyCashData.summary.totalReplenishments,
                        )
                      : "—"}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="gap-1">
                  <div className="text-xs uppercase tracking-wide text-default-500">
                    {copy.transactions.summary.activeBalance}
                  </div>
                  <div className="text-2xl font-semibold">
                    {formatMoney(locale, totalActiveFundsBalance)}
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <Select
                className="sm:w-64"
                label={copy.transactions.filters.fund}
                placeholder={copy.transactions.filters.allFunds}
                selectedKeys={fundFilter ? [fundFilter] : []}
                size="sm"
                variant="bordered"
                onSelectionChange={(keys) =>
                  setFundFilter(String(Array.from(keys)[0] ?? ""))
                }
              >
                {(pettyCashData?.funds ?? []).map((f) => (
                  <SelectItem key={f.id}>
                    {f.name} — {f.currency} {formatMoney(locale, f.currentBalance)}
                  </SelectItem>
                ))}
              </Select>

              <Select
                className="sm:w-52"
                label={copy.transactions.filters.transactionType}
                selectedKeys={[typeFilter]}
                size="sm"
                variant="bordered"
                onSelectionChange={(keys) =>
                  setTypeFilter(String(Array.from(keys)[0] ?? "ALL"))
                }
              >
                {transactionTypeOptions.map((opt) => (
                  <SelectItem key={opt.value}>{opt.label}</SelectItem>
                ))}
              </Select>

              <Input
                className="sm:w-44"
                label={copy.transactions.filters.from}
                size="sm"
                type="date"
                value={dateFrom}
                variant="bordered"
                onValueChange={setDateFrom}
              />

              <Input
                className="sm:w-44"
                label={copy.transactions.filters.to}
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
                  {copy.transactions.filters.clear}
                </Button>
                <Button size="sm" variant="flat" onPress={refresh}>
                  {copy.transactions.filters.refresh}
                </Button>
              </div>
            </div>

            {/* Table */}
            <Table aria-label={copy.transactions.ariaLabel}>
              <TableHeader>
                <TableColumn>{copy.transactions.table.date}</TableColumn>
                <TableColumn>{copy.transactions.table.code}</TableColumn>
                <TableColumn>{copy.transactions.table.fund}</TableColumn>
                <TableColumn>{copy.transactions.table.type}</TableColumn>
                <TableColumn>{copy.transactions.table.category}</TableColumn>
                <TableColumn>{copy.transactions.table.description}</TableColumn>
                <TableColumn>{copy.transactions.table.amount}</TableColumn>
                <TableColumn>{copy.transactions.table.balance}</TableColumn>
                <TableColumn>{copy.transactions.table.reference}</TableColumn>
              </TableHeader>
              <TableBody
                emptyContent={
                  loading ? copy.transactions.table.loading : copy.transactions.table.empty
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
                        color={getTransactionTypeColor(row.transactionType)}
                        size="sm"
                        variant="flat"
                      >
                        {getTransactionTypeLabel(locale, row.transactionType)}
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
                            ? "font-medium text-danger-600"
                            : row.transactionType === "ADJUSTMENT"
                              ? "font-medium text-warning-600"
                              : "font-medium text-success-600"
                        }
                      >
                        {getSignedAmountPrefix(row.transactionType)}
                        {row.currency ?? "COP"} {formatMoney(locale, row.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-default-500">
                        {row.currency ?? "COP"} {formatMoney(locale, row.balanceAfter)}
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
                  {copy.transactions.pagination.total}{" "}
                  {getMovementCountLabel(locale, pettyCashData.total ?? 0)}
                </p>
                <div className="flex gap-2">
                  <Button
                    isDisabled={loading || page <= 1}
                    size="sm"
                    variant="flat"
                    onPress={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {copy.transactions.pagination.previous}
                  </Button>
                  <Button
                    isDisabled={loading || !pettyCashData.hasNextPage}
                    size="sm"
                    variant="flat"
                    onPress={() => setPage((p) => p + 1)}
                  >
                    {copy.transactions.pagination.next}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </Tab>

        {/* ══════════════════════════
            TAB 2 – FONDOS
        ══════════════════════════ */}
        <Tab key="fondos" title={copy.tabs.funds}>
          <div className="mt-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-default-500">
                {copy.funds.helper}
              </p>
              {canManage ? (
                <Button
                  color="primary"
                  size="sm"
                  startContent={<BsPlus className="text-lg" />}
                  onPress={() => setCreateFundOpen(true)}
                >
                  {copy.funds.new}
                </Button>
              ) : null}
            </div>

            <Table aria-label={copy.tabs.funds}>
              <TableHeader>
                <TableColumn>{copy.funds.table.name}</TableColumn>
                <TableColumn>{copy.funds.table.description}</TableColumn>
                <TableColumn>{copy.funds.table.responsible}</TableColumn>
                <TableColumn>{copy.funds.table.initialBalance}</TableColumn>
                <TableColumn>{copy.funds.table.currentBalance}</TableColumn>
                <TableColumn>{copy.funds.table.maxBalance}</TableColumn>
                <TableColumn>{copy.funds.table.currency}</TableColumn>
                <TableColumn>{copy.funds.table.status}</TableColumn>
              </TableHeader>
              <TableBody
                emptyContent={
                  fundsLoading ? copy.funds.table.loading : copy.funds.table.empty
                }
                items={fundsData?.items ?? []}
              >
                {(fund) => (
                  <TableRow key={fund.id}>
                    <TableCell className="font-medium">{fund.name}</TableCell>
                    <TableCell>{fund.description ?? "—"}</TableCell>
                    <TableCell>{fund.responsibleName ?? "—"}</TableCell>
                    <TableCell>
                      {fund.currency} {formatMoney(locale, fund.initialBalance)}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">
                        {fund.currency} {formatMoney(locale, fund.currentBalance)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {toNumber(fund.maxBalance) > 0
                        ? `${fund.currency} ${formatMoney(locale, fund.maxBalance)}`
                        : "—"}
                    </TableCell>
                    <TableCell>{fund.currency}</TableCell>
                    <TableCell>
                      <Chip
                        color={fund.status === "ACTIVE" ? "success" : "default"}
                        size="sm"
                        variant="flat"
                      >
                        {fund.status === "ACTIVE"
                          ? copy.funds.table.active
                          : copy.funds.table.inactive}
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
        disableAnimation
        isOpen={createTxOpen}
        size="2xl"
        onOpenChange={(open) => {
          setCreateTxOpen(open);
          if (!open) resetTxDraft();
        }}
      >
        <ModalContent>
          <ModalHeader>{copy.transactions.modal.title}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Select
                isRequired
                label={copy.transactions.modal.fund}
                selectedKeys={txFundId ? [txFundId] : []}
                variant="bordered"
                onSelectionChange={(keys) =>
                  setTxFundId(String(Array.from(keys)[0] ?? ""))
                }
              >
                {(pettyCashData?.funds ?? []).map((f) => (
                  <SelectItem key={f.id}>
                    {f.name} — {copy.transactions.modal.selectedFundPrefix} {f.currency}{" "}
                    {formatMoney(locale, f.currentBalance)}
                  </SelectItem>
                ))}
              </Select>

              <Input
                isRequired
                label={copy.transactions.modal.date}
                type="date"
                value={txDate}
                variant="bordered"
                onValueChange={setTxDate}
              />

              <Select
                isRequired
                label={copy.transactions.modal.type}
                selectedKeys={[txType]}
                variant="bordered"
                onSelectionChange={(keys) =>
                  setTxType(
                    String(Array.from(keys)[0] ?? "EXPENSE") as TransactionType,
                  )
                }
              >
                {transactionTypeOptions
                  .filter((option) => option.value !== "ALL")
                  .map((option) => (
                    <SelectItem key={option.value}>{option.label}</SelectItem>
                  ))}
              </Select>

              <Select
                label={copy.transactions.modal.category}
                placeholder={copy.transactions.modal.categoryPlaceholder}
                selectedKeys={txCategory ? [txCategory] : []}
                variant="bordered"
                onSelectionChange={(keys) =>
                  setTxCategory(String(Array.from(keys)[0] ?? ""))
                }
              >
                {expenseCategoryOptions.map((option) => (
                  <SelectItem key={option.value}>{option.label}</SelectItem>
                ))}
              </Select>

              <Input
                isRequired
                className="md:col-span-2"
                label={copy.transactions.modal.description}
                placeholder={copy.transactions.modal.descriptionPlaceholder}
                value={txDescription}
                variant="bordered"
                onValueChange={setTxDescription}
              />

              <Input
                isRequired
                label={copy.transactions.modal.amount}
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
                    ? copy.transactions.modal.currentBalanceHint
                    : copy.transactions.modal.currentBalanceEmpty
                }
                label={copy.transactions.modal.currentBalance}
                value={txFundId ? formatMoney(locale, selectedFundBalance) : "—"}
                variant="faded"
              />

              <Input
                label={copy.transactions.modal.referenceCode}
                placeholder={copy.transactions.modal.referencePlaceholder}
                value={txReference}
                variant="bordered"
                onValueChange={setTxReference}
              />

              <Textarea
                className="md:col-span-2"
                label={copy.transactions.modal.notes}
                minRows={2}
                placeholder={copy.transactions.modal.notesPlaceholder}
                value={txNotes}
                variant="bordered"
                onValueChange={setTxNotes}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setCreateTxOpen(false)}>
              {copy.transactions.modal.cancel}
            </Button>
            <Button
              color="primary"
              isDisabled={createTxLoading}
              onPress={saveTx}
            >
              {createTxLoading
                ? copy.transactions.modal.saving
                : copy.transactions.modal.confirm}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ══════════════════════════
          MODAL – Nuevo Fondo
      ══════════════════════════ */}
      <Modal
        disableAnimation
        isOpen={createFundOpen}
        size="xl"
        onOpenChange={(open) => {
          setCreateFundOpen(open);
          if (!open) resetFundDraft();
        }}
      >
        <ModalContent>
          <ModalHeader>{copy.funds.modal.title}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                isRequired
                className="md:col-span-2"
                label={copy.funds.modal.name}
                placeholder={copy.funds.modal.namePlaceholder}
                value={fundName}
                variant="bordered"
                onValueChange={setFundName}
              />

              <Textarea
                className="md:col-span-2"
                label={copy.funds.modal.description}
                minRows={2}
                placeholder={copy.funds.modal.descriptionPlaceholder}
                value={fundDescription}
                variant="bordered"
                onValueChange={setFundDescription}
              />

              <Input
                isRequired
                label={copy.funds.modal.initialBalance}
                min="0"
                placeholder="0.00"
                type="number"
                value={fundInitialBalance}
                variant="bordered"
                onValueChange={setFundInitialBalance}
              />

              <Input
                label={copy.funds.modal.maxBalance}
                min="0"
                placeholder="0.00"
                type="number"
                value={fundMaxBalance}
                variant="bordered"
                onValueChange={setFundMaxBalance}
              />

              <Select
                label={copy.funds.modal.currency}
                selectedKeys={[fundCurrency]}
                variant="bordered"
                onSelectionChange={(keys) =>
                  setFundCurrency(String(Array.from(keys)[0] ?? "COP"))
                }
              >
                {currencyOptions.map((option) => (
                  <SelectItem key={option.value}>{option.label}</SelectItem>
                ))}
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setCreateFundOpen(false)}>
              {copy.funds.modal.cancel}
            </Button>
            <Button
              color="primary"
              isDisabled={createFundLoading}
              onPress={saveFund}
            >
              {createFundLoading ? copy.funds.modal.saving : copy.funds.modal.confirm}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
