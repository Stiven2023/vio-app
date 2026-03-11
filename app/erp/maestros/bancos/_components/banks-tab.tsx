"use client";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { Switch } from "@heroui/switch";
import {
  BsClockHistory,
  BsPencilSquare,
  BsThreeDotsVertical,
  BsTrash,
} from "react-icons/bs";

import { Pager } from "@/app/erp/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";
import { usePaginatedApi } from "@/app/erp/catalog/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";
import { ConfirmActionModal } from "@/components/confirm-action-modal";

type Bank = {
  id: string;
  code: string;
  name: string;
  accountRef: string;
  isActive: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type Draft = {
  id?: string;
  code: string;
  name: string;
  accountRef: string;
  isActive: boolean;
};

type BankHistoryResponse = {
  bank: Bank;
  purchaseOrders: Array<{
    id: string;
    purchaseOrderCode: string | null;
    supplierName: string | null;
    total: string | null;
    status: string | null;
    createdAt: string | null;
  }>;
  payments: Array<{
    id: string;
    orderId: string | null;
    orderCode: string | null;
    amount: string | null;
    depositAmount: string | null;
    method: string | null;
    transferBank: string | null;
    transferCurrency: string | null;
    referenceCode: string | null;
    status: string | null;
    createdAt: string | null;
  }>;
};

const EMPTY_DRAFT: Draft = {
  code: "",
  name: "",
  accountRef: "",
  isActive: true,
};

export function BanksTab({ canManage }: { canManage: boolean }) {
  const { data, loading, page, setPage, refresh } = usePaginatedApi<Bank>(
    "/api/banks",
    10,
  );

  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Bank | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<BankHistoryResponse | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = data?.items ?? [];

    if (!q) return items;

    return items.filter((bank) => {
      return (
        String(bank.code ?? "")
          .toLowerCase()
          .includes(q) ||
        String(bank.name ?? "")
          .toLowerCase()
          .includes(q) ||
        String(bank.accountRef ?? "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [data?.items, search]);

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setModalOpen(true);
  };

  const openEdit = (bank: Bank) => {
    setDraft({
      id: bank.id,
      code: bank.code ?? "",
      name: bank.name ?? "",
      accountRef: bank.accountRef ?? "",
      isActive: bank.isActive !== false,
    });
    setModalOpen(true);
  };

  const openHistory = async (bank: Bank) => {
    try {
      setHistoryLoading(true);
      setHistoryOpen(true);
      const response = await apiJson<BankHistoryResponse>(
        `/api/banks/${bank.id}/history`,
      );

      setHistory(response);
    } catch (error) {
      setHistory(null);
      setHistoryOpen(false);
      toast.error(getErrorMessage(error));
    } finally {
      setHistoryLoading(false);
    }
  };

  const save = async () => {
    if (saving) return;

    const payload = {
      id: draft.id,
      code: draft.code.trim(),
      name: draft.name.trim(),
      accountRef: draft.accountRef.trim(),
      isActive: draft.isActive,
    };

    if (!payload.code || !payload.name || !payload.accountRef) {
      toast.error("Code, name, and account reference are required");

      return;
    }

    try {
      setSaving(true);
      if (draft.id) {
        await apiJson("/api/banks", {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("Bank updated");
      } else {
        await apiJson("/api/banks", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Bank created");
      }

      setModalOpen(false);
      setDraft(EMPTY_DRAFT);
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete || deletingId) return;

    setDeletingId(pendingDelete.id);
    try {
      const result = await apiJson<{
        deleted?: boolean;
        deactivated?: boolean;
        message?: string;
      }>("/api/banks", {
        method: "DELETE",
        body: JSON.stringify({ id: pendingDelete.id }),
      });

      if (result.deactivated) {
        toast.success(result.message ?? "Bank deactivated");
      } else {
        toast.success("Bank deleted");
      }

      setConfirmOpen(false);
      setPendingDelete(null);
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  const emptyContent = loading ? "" : search.trim() ? "No results" : "No banks";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Input
          isClearable
          className="sm:w-80"
          placeholder="Search by code, name, or reference..."
          value={search}
          onClear={() => setSearch("")}
          onValueChange={setSearch}
        />
        {canManage ? (
          <Button color="primary" onPress={openCreate}>
            New bank
          </Button>
        ) : null}
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Banks"
          headers={["Code", "Name", "Account", "Status", "Actions"]}
          rows={6}
        />
      ) : (
        <Table aria-label="Bank list">
          <TableHeader>
            <TableColumn>Code</TableColumn>
            <TableColumn>Name</TableColumn>
            <TableColumn>Account</TableColumn>
            <TableColumn>Status</TableColumn>
            <TableColumn>Actions</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={filtered}>
            {(bank) => (
              <TableRow key={bank.id}>
                <TableCell>{bank.code}</TableCell>
                <TableCell>{bank.name}</TableCell>
                <TableCell>{bank.accountRef}</TableCell>
                <TableCell>
                  <Chip
                    color={bank.isActive === false ? "danger" : "success"}
                    variant="flat"
                  >
                    {bank.isActive === false ? "Inactive" : "Active"}
                  </Chip>
                </TableCell>
                <TableCell>
                  {canManage ? (
                    <Dropdown>
                      <DropdownTrigger>
                        <Button isIconOnly size="sm" variant="flat">
                          <BsThreeDotsVertical />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="Bank actions">
                        <DropdownItem
                          key="history"
                          startContent={<BsClockHistory />}
                          onPress={() => void openHistory(bank)}
                        >
                          View history
                        </DropdownItem>
                        <DropdownItem
                          key="edit"
                          startContent={<BsPencilSquare />}
                          onPress={() => openEdit(bank)}
                        >
                          Edit
                        </DropdownItem>
                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          color="danger"
                          startContent={<BsTrash />}
                          onPress={() => {
                            setPendingDelete(bank);
                            setConfirmOpen(true);
                          }}
                        >
                          Delete
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  ) : (
                    <span className="text-xs text-default-500">
                      No permissions
                    </span>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {data ? <Pager data={data} page={page} onChange={setPage} /> : null}

      <Modal isOpen={modalOpen} onOpenChange={setModalOpen}>
        <ModalContent>
          <ModalHeader>{draft.id ? "Edit bank" : "New bank"}</ModalHeader>
          <ModalBody className="space-y-3">
            <Input
              label="Code"
              placeholder="BANC-001"
              value={draft.code}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, code: value }))
              }
            />
            <Input
              label="Name"
              placeholder="Bank of Colombia"
              value={draft.name}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, name: value }))
              }
            />
            <Input
              label="Account reference"
              placeholder="Checking account 1234"
              value={draft.accountRef}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, accountRef: value }))
              }
            />
            <Switch
              isSelected={draft.isActive}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, isActive: value }))
              }
            >
              Active bank
            </Switch>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" isLoading={saving} onPress={save}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmActionModal
        cancelLabel="Cancel"
        confirmLabel="Delete"
        description={
          pendingDelete
            ? `Do you want to delete bank ${pendingDelete.name}? If it has related orders, it will be deactivated.`
            : undefined
        }
        isLoading={deletingId === pendingDelete?.id}
        isOpen={confirmOpen}
        title="Delete bank"
        onConfirm={remove}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
          setConfirmOpen(open);
        }}
      />

      <Modal isOpen={historyOpen} size="5xl" onOpenChange={setHistoryOpen}>
        <ModalContent>
          <ModalHeader>
            {history?.bank
              ? `Bank history: ${history.bank.code} - ${history.bank.name}`
              : "Bank history"}
          </ModalHeader>
          <ModalBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-default-200 p-3">
                <p className="text-xs text-default-500">Related payments</p>
                <p className="mt-1 text-lg font-semibold">
                  {history?.payments.length ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-default-200 p-3">
                <p className="text-xs text-default-500">Related orders</p>
                <p className="mt-1 text-lg font-semibold">
                  {history?.purchaseOrders.length ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-default-200 p-3">
                <p className="text-xs text-default-500">Account</p>
                <p className="mt-1 text-sm font-medium">
                  {history?.bank.accountRef ?? "-"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Payment history</p>
              <Table aria-label="Payment history related to bank">
                <TableHeader>
                  <TableColumn>Order</TableColumn>
                  <TableColumn>Method</TableColumn>
                  <TableColumn>Amount</TableColumn>
                  <TableColumn>Currency</TableColumn>
                  <TableColumn>Reference</TableColumn>
                  <TableColumn>Status</TableColumn>
                  <TableColumn>Date</TableColumn>
                </TableHeader>
                <TableBody
                  emptyContent={
                    historyLoading ? "Loading..." : "No related payments"
                  }
                  items={history?.payments ?? []}
                >
                  {(row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.orderCode ?? "-"}</TableCell>
                      <TableCell>{row.method ?? "-"}</TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("es-CO", {
                          style: "currency",
                          currency: "COP",
                          maximumFractionDigits: 0,
                        }).format(Number(row.amount ?? row.depositAmount ?? 0))}
                      </TableCell>
                      <TableCell>{row.transferCurrency ?? "-"}</TableCell>
                      <TableCell>{row.referenceCode ?? "-"}</TableCell>
                      <TableCell>{row.status ?? "-"}</TableCell>
                      <TableCell>
                        {row.createdAt
                          ? new Date(row.createdAt).toLocaleString()
                          : "-"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Related purchase orders</p>
              <Table aria-label="Related orders history by bank">
                <TableHeader>
                  <TableColumn>Code</TableColumn>
                  <TableColumn>Supplier</TableColumn>
                  <TableColumn>Total</TableColumn>
                  <TableColumn>Status</TableColumn>
                  <TableColumn>Date</TableColumn>
                </TableHeader>
                <TableBody
                  emptyContent={
                    historyLoading ? "Loading..." : "No related orders"
                  }
                  items={history?.purchaseOrders ?? []}
                >
                  {(row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.purchaseOrderCode ?? "-"}</TableCell>
                      <TableCell>{row.supplierName ?? "-"}</TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("es-CO", {
                          style: "currency",
                          currency: "COP",
                          maximumFractionDigits: 0,
                        }).format(Number(row.total ?? 0))}
                      </TableCell>
                      <TableCell>{row.status ?? "-"}</TableCell>
                      <TableCell>
                        {row.createdAt
                          ? new Date(row.createdAt).toLocaleString()
                          : "-"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setHistoryOpen(false)}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
