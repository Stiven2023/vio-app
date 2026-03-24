"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
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
import { BsEye, BsPlusCircle, BsTrash } from "react-icons/bs";

import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";

type BankOption = {
  id: string;
  name: string;
};

type ReconciliationItem = {
  id: string;
  reconciliationId: string;
  itemDate: string;
  description: string;
  booksAmount: string | null;
  bankAmount: string | null;
  difference: string | null;
  itemType: ItemType;
};

type ReconciliationRow = {
  id: string;
  period: string;
  bankId: string;
  bankName: string;
  balancePerBank: string | null;
  balancePerBooks: string | null;
  difference: string | null;
  status: "OPEN" | "CLOSED";
  isClosed: boolean;
  createdAt: string | null;
  closedAt: string | null;
  items: ReconciliationItem[];
};

type ReconciliationData = {
  items: ReconciliationRow[];
  banks: BankOption[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

type ItemType =
  | "DEPOSIT_IN_TRANSIT"
  | "OUTSTANDING_CHECK"
  | "BANK_DEBIT_NOTE"
  | "BANK_CREDIT_NOTE"
  | "ACCOUNTING_ERROR"
  | "BANK_ERROR";

type DraftItem = {
  itemDate: string;
  description: string;
  booksAmount: string;
  bankAmount: string;
  itemType: ItemType;
};

const ITEM_TYPE_OPTIONS: Array<{ value: ItemType; label: string }> = [
  { value: "DEPOSIT_IN_TRANSIT", label: "Deposit in transit" },
  { value: "OUTSTANDING_CHECK", label: "Outstanding check" },
  { value: "BANK_DEBIT_NOTE", label: "Bank debit note" },
  { value: "BANK_CREDIT_NOTE", label: "Bank credit note" },
  { value: "ACCOUNTING_ERROR", label: "Accounting error" },
  { value: "BANK_ERROR", label: "Bank error" },
];

const STATUS_OPTIONS = [
  { value: "ALL", label: "ALL" },
  { value: "OPEN", label: "OPEN" },
  { value: "CLOSED", label: "CLOSED" },
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

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("es-CO");
}

function buildEmptyItem(): DraftItem {
  return {
    itemDate: "",
    description: "",
    booksAmount: "0",
    bankAmount: "0",
    itemType: "DEPOSIT_IN_TRANSIT",
  };
}

export function BankReconciliationTab({
  canCreate,
  canClose,
}: {
  canCreate: boolean;
  canClose: boolean;
}) {
  const [bankFilter, setBankFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_OPTIONS)[number]["value"]>("ALL");

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();

    if (bankFilter) params.set("bankId", bankFilter);
    if (periodFilter) params.set("period", periodFilter);
    params.set("status", statusFilter);

    return `/api/contabilidad/conciliaciones-bancarias?${params.toString()}`;
  }, [bankFilter, periodFilter, statusFilter]);

  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<ReconciliationRow>(endpoint, 15);

  const reconciliationData = data as ReconciliationData | null;

  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const [viewRow, setViewRow] = useState<ReconciliationRow | null>(null);

  const [bankId, setBankId] = useState("");
  const [period, setPeriod] = useState("");
  const [balancePerBank, setBalancePerBank] = useState("0");
  const [balancePerBooks, setBalancePerBooks] = useState("0");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([buildEmptyItem()]);

  const difference = useMemo(
    () => toNumber(balancePerBank) - toNumber(balancePerBooks),
    [balancePerBank, balancePerBooks],
  );

  useEffect(() => {
    setPage(1);
  }, [bankFilter, periodFilter, setPage, statusFilter]);

  const resetDraft = () => {
    setBankId("");
    setPeriod("");
    setBalancePerBank("0");
    setBalancePerBooks("0");
    setDraftItems([buildEmptyItem()]);
  };

  const addDraftItem = () => {
    setDraftItems((current) => [...current, buildEmptyItem()]);
  };

  const removeDraftItem = (index: number) => {
    setDraftItems((current) =>
      current.length <= 1
        ? current
        : current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const updateDraftItem = <K extends keyof DraftItem>(
    index: number,
    key: K,
    value: DraftItem[K],
  ) => {
    setDraftItems((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  };

  const saveReconciliation = async () => {
    if (!bankId) {
      toast.error("Selecciona un banco");

      return;
    }

    if (!period) {
      toast.error("Selecciona un periodo");

      return;
    }

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      toast.error("El periodo debe tener formato YYYY-MM");

      return;
    }

    for (const [index, item] of draftItems.entries()) {
      if (!item.itemDate) {
        toast.error(`El item ${index + 1} requiere fecha`);

        return;
      }
      if (!item.description.trim()) {
        toast.error(`El item ${index + 1} requiere descripcion`);

        return;
      }
    }

    try {
      setCreateLoading(true);
      await apiJson("/api/contabilidad/conciliaciones-bancarias", {
        method: "POST",
        body: JSON.stringify({
          bankId,
          period,
          balancePerBank,
          balancePerBooks,
          items: draftItems,
        }),
      });

      toast.success("Conciliacion creada");
      setCreateOpen(false);
      resetDraft();
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreateLoading(false);
    }
  };

  const closeReconciliation = async (id: string) => {
    try {
      await apiJson(`/api/contabilidad/conciliaciones-bancarias/${id}/close`, {
        method: "PUT",
      });
      toast.success("Conciliacion cerrada");
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-default-500">
          Controla diferencias por banco y periodo.
        </div>
        {canCreate ? (
          <Button color="primary" onPress={() => setCreateOpen(true)}>
            New Reconciliation
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Select
          className="sm:w-64"
          label="Bank"
          placeholder="All banks"
          selectedKeys={bankFilter ? [bankFilter] : []}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => {
            const value = String(Array.from(keys)[0] ?? "");

            setBankFilter(value);
          }}
        >
          {(reconciliationData?.banks ?? []).map((bank) => (
            <SelectItem key={bank.id}>{bank.name}</SelectItem>
          ))}
        </Select>

        <Input
          className="sm:w-56"
          label="Period"
          size="sm"
          type="month"
          value={periodFilter}
          variant="bordered"
          onValueChange={setPeriodFilter}
        />

        <Select
          className="sm:w-44"
          label="Status"
          selectedKeys={[statusFilter]}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => {
            const value = String(Array.from(keys)[0] ?? "ALL").toUpperCase() as
              | "ALL"
              | "OPEN"
              | "CLOSED";

            setStatusFilter(value);
          }}
        >
          {STATUS_OPTIONS.map((status) => (
            <SelectItem key={status.value}>{status.label}</SelectItem>
          ))}
        </Select>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="flat"
            onPress={() => {
              setBankFilter("");
              setPeriodFilter("");
              setStatusFilter("ALL");
            }}
          >
            Clear
          </Button>
          <Button size="sm" variant="flat" onPress={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      <Table aria-label="Bank reconciliations table">
        <TableHeader>
          <TableColumn>Period</TableColumn>
          <TableColumn>Bank name</TableColumn>
          <TableColumn>Balance per bank</TableColumn>
          <TableColumn>Balance per books</TableColumn>
          <TableColumn>Difference</TableColumn>
          <TableColumn>Status</TableColumn>
          <TableColumn>Actions</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent={loading ? "Loading..." : "No reconciliations found"}
          items={reconciliationData?.items ?? []}
        >
          {(row) => {
            const rowDifference = toNumber(row.difference);

            return (
              <TableRow key={row.id}>
                <TableCell>{row.period}</TableCell>
                <TableCell>{row.bankName}</TableCell>
                <TableCell>{formatMoney(row.balancePerBank)}</TableCell>
                <TableCell>{formatMoney(row.balancePerBooks)}</TableCell>
                <TableCell>
                  <span
                    className={
                      rowDifference !== 0 ? "font-semibold text-danger" : ""
                    }
                  >
                    {formatMoney(row.difference)}
                  </span>
                </TableCell>
                <TableCell>
                  <Chip
                    color={row.isClosed ? "default" : "success"}
                    size="sm"
                    variant="flat"
                  >
                    {row.isClosed ? "CLOSED" : "OPEN"}
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
                    {canClose && !row.isClosed ? (
                      <Button
                        color="warning"
                        size="sm"
                        variant="flat"
                        onPress={() => closeReconciliation(row.id)}
                      >
                        Close
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          }}
        </TableBody>
      </Table>

      {reconciliationData ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-default-500">
            Total: {reconciliationData.total ?? 0}
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
              isDisabled={loading || !reconciliationData.hasNextPage}
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
        onOpenChange={setCreateOpen}
      >
        <ModalContent>
          <ModalHeader>New Reconciliation</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Select
                isRequired
                label="Bank"
                selectedKeys={bankId ? [bankId] : []}
                variant="bordered"
                onSelectionChange={(keys) => {
                  const value = String(Array.from(keys)[0] ?? "");

                  setBankId(value);
                }}
              >
                {(reconciliationData?.banks ?? []).map((bank) => (
                  <SelectItem key={bank.id}>{bank.name}</SelectItem>
                ))}
              </Select>

              <Input
                isRequired
                label="Period"
                type="month"
                value={period}
                variant="bordered"
                onValueChange={setPeriod}
              />

              <Input
                isRequired
                label="Balance per bank"
                type="number"
                value={balancePerBank}
                variant="bordered"
                onValueChange={setBalancePerBank}
              />

              <Input
                isRequired
                label="Balance per books"
                type="number"
                value={balancePerBooks}
                variant="bordered"
                onValueChange={setBalancePerBooks}
              />

              <Input
                isDisabled
                label="Difference"
                value={formatMoney(difference)}
                variant="faded"
              />
            </div>

            <div className="mt-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Reconciliation items</h4>
              <Button
                size="sm"
                startContent={<BsPlusCircle />}
                variant="flat"
                onPress={addDraftItem}
              >
                Add item
              </Button>
            </div>

            <Table aria-label="Reconciliation items draft table">
              <TableHeader>
                <TableColumn>Item date</TableColumn>
                <TableColumn>Description</TableColumn>
                <TableColumn>Books amount</TableColumn>
                <TableColumn>Bank amount</TableColumn>
                <TableColumn>Difference</TableColumn>
                <TableColumn>Item type</TableColumn>
                <TableColumn>Actions</TableColumn>
              </TableHeader>
              <TableBody items={draftItems}>
                {(item) => {
                  const index = draftItems.indexOf(item);
                  const itemDiff =
                    toNumber(item.bankAmount) - toNumber(item.booksAmount);

                  return (
                    <TableRow key={`draft-item-${index}`}>
                      <TableCell>
                        <Input
                          size="sm"
                          type="date"
                          value={item.itemDate}
                          onValueChange={(value) =>
                            updateDraftItem(index, "itemDate", value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          size="sm"
                          value={item.description}
                          onValueChange={(value) =>
                            updateDraftItem(index, "description", value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          size="sm"
                          type="number"
                          value={item.booksAmount}
                          onValueChange={(value) =>
                            updateDraftItem(index, "booksAmount", value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          size="sm"
                          type="number"
                          value={item.bankAmount}
                          onValueChange={(value) =>
                            updateDraftItem(index, "bankAmount", value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          isDisabled
                          size="sm"
                          value={formatMoney(itemDiff)}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          selectedKeys={[item.itemType]}
                          size="sm"
                          onSelectionChange={(keys) => {
                            const value = String(
                              Array.from(keys)[0] ?? "DEPOSIT_IN_TRANSIT",
                            ) as ItemType;

                            updateDraftItem(index, "itemType", value);
                          }}
                        >
                          {ITEM_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          isIconOnly
                          color="danger"
                          size="sm"
                          variant="light"
                          onPress={() => removeDraftItem(index)}
                        >
                          <BsTrash />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                }}
              </TableBody>
            </Table>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={createLoading}
              onPress={saveReconciliation}
            >
              {createLoading ? "Saving..." : "Save"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        disableAnimation
        isOpen={Boolean(viewRow)}
        size="5xl"
        onOpenChange={(open) => !open && setViewRow(null)}
      >
        <ModalContent>
          <ModalHeader>Reconciliation detail</ModalHeader>
          <ModalBody>
            {viewRow ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Input isDisabled label="Period" value={viewRow.period} />
                  <Input isDisabled label="Bank" value={viewRow.bankName} />
                  <Input
                    isDisabled
                    label="Status"
                    value={viewRow.isClosed ? "CLOSED" : "OPEN"}
                  />
                  <Input
                    isDisabled
                    label="Balance per bank"
                    value={formatMoney(viewRow.balancePerBank)}
                  />
                  <Input
                    isDisabled
                    label="Balance per books"
                    value={formatMoney(viewRow.balancePerBooks)}
                  />
                  <Input
                    isDisabled
                    label="Difference"
                    value={formatMoney(viewRow.difference)}
                  />
                </div>

                <Table aria-label="Reconciliation items detail table">
                  <TableHeader>
                    <TableColumn>Item date</TableColumn>
                    <TableColumn>Description</TableColumn>
                    <TableColumn>Books amount</TableColumn>
                    <TableColumn>Bank amount</TableColumn>
                    <TableColumn>Difference</TableColumn>
                    <TableColumn>Item type</TableColumn>
                  </TableHeader>
                  <TableBody
                    emptyContent="No items"
                    items={viewRow.items ?? []}
                  >
                    {(item) => (
                      <TableRow key={item.id}>
                        <TableCell>{formatDate(item.itemDate)}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{formatMoney(item.booksAmount)}</TableCell>
                        <TableCell>{formatMoney(item.bankAmount)}</TableCell>
                        <TableCell>{formatMoney(item.difference)}</TableCell>
                        <TableCell>{item.itemType}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
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
