"use client";

import type {
  BankOption,
  InventoryItemOption,
  PurchaseOrderDetail,
  SupplierOption,
  VariantOption,
} from "../_lib/types";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";

import { apiJson, getErrorMessage } from "../_lib/api";
import { createPurchaseOrderSchema } from "../_lib/schemas";

type OptionsResponse = {
  suppliers: SupplierOption[];
  inventoryItems: InventoryItemOption[];
  banks?: BankOption[];
};

type DraftItem = {
  inventoryItemId: string;
  variantId: string;
  quantity: string;
  unitPrice: string;
};

type ModalState = {
  open: boolean;
  editingIndex: number | null;
  inventoryItemId: string;
  variantId: string;
  quantity: string;
  unitPrice: string;
};

function parseNumeric(value: string) {
  const parsed = Number(String(value ?? "").replace(/,/g, "."));

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function variantLabel(v: VariantOption): string {
  if (v.color && v.size) return `${v.color} / ${v.size}`;
  if (v.color) return v.color;
  if (v.size) return v.size;

  return v.sku;
}

const EMPTY_MODAL: ModalState = {
  open: false,
  editingIndex: null,
  inventoryItemId: "",
  variantId: "",
  quantity: "",
  unitPrice: "",
};

export function PurchaseOrderPageForm({
  orderId,
  canAssociateSupplier,
}: {
  orderId?: string;
  canAssociateSupplier: boolean;
}) {
  const router = useRouter();
  const isEdit = Boolean(orderId);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemOption[]>(
    [],
  );
  const [banks, setBanks] = useState<BankOption[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [bankId, setBankId] = useState("");
  const [bankAccountRef, setBankAccountRef] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);

  const [modal, setModal] = useState<ModalState>(EMPTY_MODAL);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const [options, detail] = await Promise.all([
          apiJson<OptionsResponse>("/api/purchase-orders/options"),
          isEdit
            ? apiJson<PurchaseOrderDetail>(`/api/purchase-orders/${orderId}`)
            : Promise.resolve(null),
        ]);

        if (!active) return;

        setSuppliers(options.suppliers ?? []);
        setInventoryItems(options.inventoryItems ?? []);
        const bankRows = Array.isArray(options.banks)
          ? options.banks.filter((b) => b.isActive !== false)
          : [];

        setBanks(bankRows);

        if (detail) {
          setSupplierId(detail.supplierId ?? "");
          setBankId(detail.bankId ?? bankRows[0]?.id ?? "");
          setBankAccountRef(detail.bankAccountRef ?? "");
          setNotes(detail.notes ?? "");
          setItems(
            detail.items.length > 0
              ? detail.items.map((row) => ({
                  inventoryItemId: row.inventoryItemId,
                  variantId: row.variantId ?? "",
                  quantity: String(row.quantity ?? ""),
                  unitPrice: String(row.unitPrice ?? ""),
                }))
              : [],
          );
        } else {
          setBankId(bankRows[0]?.id ?? "");
          setBankAccountRef(bankRows[0]?.accountRef ?? "");
        }
      } catch (e) {
        if (!active) return;
        toast.error(getErrorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [isEdit, orderId]);

  const supplierOptions = useMemo(
    () => [{ id: "__none", name: "No supplier" }, ...suppliers],
    [suppliers],
  );

  const itemById = useMemo(
    () => new Map(inventoryItems.map((item) => [item.id, item])),
    [inventoryItems],
  );

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === supplierId) ?? null,
    [supplierId, suppliers],
  );

  const selectedBank = useMemo(
    () => banks.find((bank) => bank.id === bankId) ?? null,
    [banks, bankId],
  );

  const subtotal = useMemo(
    () =>
      items.reduce((acc, row) => {
        return acc + parseNumeric(row.quantity) * parseNumeric(row.unitPrice);
      }, 0),
    [items],
  );

  // Modal computed values
  const modalItem = modal.inventoryItemId
    ? (itemById.get(modal.inventoryItemId) ?? null)
    : null;
  const modalVariants = modalItem?.variants ?? [];
  const modalSubtotal =
    parseNumeric(modal.quantity) * parseNumeric(modal.unitPrice);

  const openAddModal = () => {
    setModal({ ...EMPTY_MODAL, open: true });
  };

  const openEditModal = (index: number) => {
    const row = items[index];

    if (!row) return;
    setModal({
      open: true,
      editingIndex: index,
      inventoryItemId: row.inventoryItemId,
      variantId: row.variantId,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
    });
  };

  const closeModal = () => {
    setModal((prev) => ({ ...prev, open: false }));
  };

  const confirmModal = () => {
    const { inventoryItemId, variantId, quantity, unitPrice, editingIndex } =
      modal;

    if (!inventoryItemId || !quantity || !unitPrice) return;
    const newItem: DraftItem = {
      inventoryItemId,
      variantId,
      quantity,
      unitPrice,
    };

    if (editingIndex !== null) {
      setItems((prev) =>
        prev.map((item, idx) => (idx === editingIndex ? newItem : item)),
      );
    } else {
      setItems((prev) => [...prev, newItem]);
    }
    closeModal();
  };

  const handleItemSelectInModal = (value: string) => {
    const selected = value ? (itemById.get(value) ?? null) : null;

    setModal((prev) => ({
      ...prev,
      inventoryItemId: value,
      variantId: "",
      unitPrice: selected?.price ? String(selected.price) : prev.unitPrice,
    }));
  };

  const submit = async () => {
    if (submitting) return;

    const parsed = createPurchaseOrderSchema.safeParse({
      supplierId: supplierId ? supplierId : undefined,
      bankId,
      bankAccountRef,
      notes: notes.trim() ? notes.trim() : undefined,
      items: items.map((it) => ({
        inventoryItemId: it.inventoryItemId,
        variantId: it.variantId || undefined,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid data");

      return;
    }

    if (supplierId && !canAssociateSupplier) {
      setError("You do not have permission to associate a supplier");

      return;
    }

    setError(null);

    try {
      setSubmitting(true);
      if (isEdit && orderId) {
        await apiJson(`/api/purchase-orders/${orderId}/edit`, {
          method: "PUT",
          body: JSON.stringify(parsed.data),
        });
        toast.success("Order updated");
      } else {
        await apiJson("/api/purchase-orders", {
          method: "POST",
          body: JSON.stringify(parsed.data),
        });
        toast.success("Order created");
      }

      router.push("/erp/purchase-orders");
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 via-content1 to-teal-50/30 p-5 shadow-sm dark:border-teal-800/40 dark:from-teal-950/30 dark:via-content1 dark:to-teal-900/10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-700 dark:text-teal-400">
              Viomar
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-default-900">
              {isEdit ? "Edit purchase order" : "New purchase order"}
            </h1>
            <p className="mt-1 text-sm text-default-600">
              Supplier flow, master bank and cost lines for purchase
              coordination.
            </p>
          </div>
          <div className="rounded-xl border border-teal-200 bg-content2 px-3 py-2 text-xs text-default-700 dark:border-teal-800/40">
            Date: {new Intl.DateTimeFormat("es-CO").format(new Date())}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-4 xl:grid-cols-[1.6fr,0.9fr]">
        <div className="space-y-4 rounded-2xl border border-default-200 bg-content1 p-4">
          <Select
            isDisabled={submitting || loading || !canAssociateSupplier}
            isLoading={loading}
            items={supplierOptions}
            label="Supplier"
            selectedKeys={supplierId ? new Set([supplierId]) : new Set([])}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];

              setSupplierId(
                first === "__none" ? "" : first ? String(first) : "",
              );
            }}
          >
            {(supplier) => (
              <SelectItem key={supplier.id} textValue={supplier.name}>
                {supplier.name}
              </SelectItem>
            )}
          </Select>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              isDisabled={submitting || loading}
              isLoading={loading}
              items={banks}
              label="Bank"
              selectedKeys={bankId ? new Set([bankId]) : new Set([])}
              onSelectionChange={(keys) => {
                const first = Array.from(keys)[0];
                const value = first ? String(first) : "";
                const bank = banks.find((row) => row.id === value);

                setBankId(value);
                if (bank?.accountRef) setBankAccountRef(bank.accountRef);
              }}
            >
              {(bank) => (
                <SelectItem
                  key={bank.id}
                  textValue={`${bank.code} – ${bank.name}`}
                >
                  <span className="font-mono text-xs text-default-500">
                    {bank.code}
                  </span>
                  <span className="ml-2">{bank.name}</span>
                </SelectItem>
              )}
            </Select>

            <Input
              isDisabled={submitting || loading}
              label="Bank reference"
              value={bankAccountRef}
              onValueChange={setBankAccountRef}
            />
          </div>

          <Input
            isDisabled={submitting || loading}
            label="Notes"
            value={notes}
            onValueChange={setNotes}
          />
        </div>

        {/* Summary panel */}
        <div className="space-y-3 rounded-2xl border border-default-200 bg-default-50 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-default-700">
            Summary
          </h3>
          <div className="space-y-2 rounded-xl bg-content2 p-3">
            <div className="flex items-center justify-between text-sm text-default-600">
              <span>Lines</span>
              <span>{items.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-default-600">
              <span>Supplier</span>
              <span className="max-w-[170px] truncate text-right">
                {selectedSupplier?.name ?? "Unassigned"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-default-600">
              <span>Bank</span>
              <span className="max-w-[170px] truncate text-right">
                {selectedBank
                  ? `${selectedBank.code} – ${selectedBank.name}`
                  : "-"}
              </span>
            </div>
            <div className="h-px bg-default-200" />
            <div className="flex items-center justify-between text-base font-semibold text-default-800">
              <span>Total</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="space-y-3 rounded-2xl border border-default-200 bg-content1 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-default-700">
            Items
          </h3>
          <Button
            color="primary"
            isDisabled={submitting || loading}
            variant="flat"
            onPress={openAddModal}
          >
            Add item
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-default-200 py-8 text-center text-sm text-default-400">
            No items added yet. Click <strong>Add item</strong> to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-default-200 text-left text-xs font-semibold uppercase tracking-wide text-default-500">
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">Item</th>
                  <th className="py-2 px-2">Variant</th>
                  <th className="py-2 px-2 text-right">Qty</th>
                  <th className="py-2 px-2 text-right">Unit price</th>
                  <th className="py-2 px-2 text-right">Subtotal</th>
                  <th className="py-2 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, index) => {
                  const source = row.inventoryItemId
                    ? (itemById.get(row.inventoryItemId) ?? null)
                    : null;
                  const variant = row.variantId
                    ? (source?.variants.find((v) => v.id === row.variantId) ??
                      null)
                    : null;
                  const lineTotal =
                    parseNumeric(row.quantity) * parseNumeric(row.unitPrice);

                  return (
                    <tr
                      key={index}
                      className="border-b border-default-100 last:border-b-0 hover:bg-default-50/50"
                    >
                      <td className="py-2 px-2 text-default-400">
                        {index + 1}
                      </td>
                      <td className="py-2 px-2">
                        <p className="font-medium text-default-800">
                          {source?.name ?? row.inventoryItemId}
                        </p>
                        {source?.itemCode ? (
                          <p className="text-xs text-default-400">
                            {source.itemCode}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-2 px-2 text-default-500">
                        {variant ? (
                          variantLabel(variant)
                        ) : (
                          <span className="text-default-300">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right">{row.quantity}</td>
                      <td className="py-2 px-2 text-right">
                        {formatMoney(parseNumeric(row.unitPrice))}
                      </td>
                      <td className="py-2 px-2 text-right font-semibold text-default-800">
                        {formatMoney(lineTotal)}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            isDisabled={submitting}
                            size="sm"
                            variant="flat"
                            onPress={() => openEditModal(index)}
                          >
                            Edit
                          </Button>
                          <Button
                            color="danger"
                            isDisabled={submitting}
                            size="sm"
                            variant="light"
                            onPress={() =>
                              setItems((prev) =>
                                prev.filter((_, i) => i !== index),
                              )
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error ? <div className="text-sm text-danger">{error}</div> : null}

      <div className="flex items-center justify-end gap-2">
        <Button
          isDisabled={submitting}
          variant="flat"
          onPress={() => router.push("/erp/purchase-orders")}
        >
          Cancel
        </Button>
        <Button color="primary" isLoading={submitting} onPress={submit}>
          {isEdit ? "Save changes" : "Create order"}
        </Button>
      </div>

      {/* Add / Edit item modal */}
      <Modal
        isOpen={modal.open}
        size="lg"
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
        <ModalContent>
          <ModalHeader>
            {modal.editingIndex !== null
              ? `Edit item #${modal.editingIndex + 1}`
              : "Add item"}
          </ModalHeader>
          <ModalBody className="space-y-4 pb-5">
            <Select
              isLoading={loading}
              items={inventoryItems}
              label="Inventory item"
              selectedKeys={
                modal.inventoryItemId
                  ? new Set([modal.inventoryItemId])
                  : new Set([])
              }
              onSelectionChange={(keys) => {
                const first = Array.from(keys)[0];

                handleItemSelectInModal(first ? String(first) : "");
              }}
            >
              {(item) => (
                <SelectItem
                  key={item.id}
                  textValue={`${item.itemCode ?? ""} ${item.name}`}
                >
                  <span className="font-mono text-xs text-default-500">
                    {item.itemCode ?? "—"}
                  </span>
                  <span className="ml-2">{item.name}</span>
                </SelectItem>
              )}
            </Select>

            {modalVariants.length > 0 && (
              <Select
                items={modalVariants}
                label="Variant"
                placeholder="Select variant…"
                selectedKeys={
                  modal.variantId ? new Set([modal.variantId]) : new Set([])
                }
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0];

                  setModal((prev) => ({
                    ...prev,
                    variantId: first ? String(first) : "",
                  }));
                }}
              >
                {(v) => (
                  <SelectItem key={v.id} textValue={variantLabel(v)}>
                    <span>{variantLabel(v)}</span>
                    <span className="ml-2 text-xs text-default-400">
                      {v.sku}
                    </span>
                  </SelectItem>
                )}
              </Select>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Quantity"
                min="0"
                step="0.01"
                type="number"
                value={modal.quantity}
                onValueChange={(v) =>
                  setModal((prev) => ({ ...prev, quantity: v }))
                }
              />
              <Input
                label="Unit price"
                min="0"
                step="0.01"
                type="number"
                value={modal.unitPrice}
                onValueChange={(v) =>
                  setModal((prev) => ({ ...prev, unitPrice: v }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-default-200 bg-default-50 px-4 py-3">
              <span className="text-sm text-default-500">Subtotal</span>
              <span className="text-lg font-semibold text-default-800">
                {formatMoney(modalSubtotal)}
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="flat" onPress={closeModal}>
                Cancel
              </Button>
              <Button
                color="primary"
                isDisabled={
                  !modal.inventoryItemId || !modal.quantity || !modal.unitPrice
                }
                onPress={confirmModal}
              >
                {modal.editingIndex !== null ? "Save" : "Add"}
              </Button>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
