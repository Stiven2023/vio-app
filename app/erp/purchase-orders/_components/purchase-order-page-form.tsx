"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";

import { apiJson, getErrorMessage } from "../_lib/api";
import { createPurchaseOrderSchema } from "../_lib/schemas";
import type { BankOption, InventoryItemOption, PurchaseOrderDetail, SupplierOption } from "../_lib/types";

type OptionsResponse = {
  suppliers: SupplierOption[];
  inventoryItems: InventoryItemOption[];
  banks?: BankOption[];
};

type DraftItem = { inventoryItemId: string; quantity: string; unitPrice: string };

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
  const [inventoryItems, setInventoryItems] = useState<InventoryItemOption[]>([]);
  const [banks, setBanks] = useState<BankOption[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [bankId, setBankId] = useState("");
  const [bankAccountRef, setBankAccountRef] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([
    { inventoryItemId: "", quantity: "", unitPrice: "" },
  ]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const [options, detail] = await Promise.all([
          apiJson<OptionsResponse>("/api/purchase-orders/options"),
          isEdit ? apiJson<PurchaseOrderDetail>(`/api/purchase-orders/${orderId}`) : Promise.resolve(null),
        ]);

        if (!active) return;

        setSuppliers(options.suppliers ?? []);
        setInventoryItems(options.inventoryItems ?? []);
        const bankRows = Array.isArray(options.banks) ? options.banks.filter((b) => b.isActive !== false) : [];
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
                  quantity: String(row.quantity ?? ""),
                  unitPrice: String(row.unitPrice ?? ""),
                }))
              : [{ inventoryItemId: "", quantity: "", unitPrice: "" }],
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
    () => [{ id: "__none", name: "Sin proveedor" }, ...suppliers],
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

  const itemRows = useMemo(
    () =>
      items.map((row) => {
        const source = row.inventoryItemId ? itemById.get(row.inventoryItemId) ?? null : null;
        const quantity = parseNumeric(row.quantity);
        const unitPrice = parseNumeric(row.unitPrice);
        const lineTotal = quantity * unitPrice;

        return {
          ...row,
          source,
          lineTotal,
        };
      }),
    [itemById, items],
  );

  const subtotal = useMemo(
    () => itemRows.reduce((acc, row) => acc + row.lineTotal, 0),
    [itemRows],
  );

  const selectedBank = useMemo(
    () => banks.find((bank) => bank.id === bankId) ?? null,
    [banks, bankId],
  );

  const updateItem = (index: number, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((item, current) => (current === index ? { ...item, ...patch } : item)));
  };

  const addEmptyRow = () => {
    setItems((prev) => [...prev, { inventoryItemId: "", quantity: "", unitPrice: "" }]);
  };

  const submit = async () => {
    if (submitting) return;

    const parsed = createPurchaseOrderSchema.safeParse({
      supplierId: supplierId ? supplierId : undefined,
      bankId,
      bankAccountRef,
      notes: notes.trim() ? notes.trim() : undefined,
      items,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }

    if (supplierId && !canAssociateSupplier) {
      setError("No tienes permiso para asociar proveedor");
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
        toast.success("Orden actualizada");
      } else {
        await apiJson("/api/purchase-orders", {
          method: "POST",
          body: JSON.stringify(parsed.data),
        });
        toast.success("Orden creada");
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
      <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">Viomar</p>
            <h1 className="mt-2 text-2xl font-semibold text-default-900">
              {isEdit ? "Editar orden de compra" : "Nueva orden de compra"}
            </h1>
            <p className="mt-1 text-sm text-default-600">
              Flujo con proveedor, banco maestro y líneas de costo para coordinación de compras.
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-default-700">
            Fecha: {new Intl.DateTimeFormat("es-CO").format(new Date())}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr,0.9fr]">
        <div className="space-y-4 rounded-2xl border border-default-200 bg-content1 p-4">
          <Select
            isDisabled={submitting || loading || !canAssociateSupplier}
            isLoading={loading}
            label="Proveedor"
            selectedKeys={supplierId ? new Set([supplierId]) : new Set([])}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              setSupplierId(first === "__none" ? "" : first ? String(first) : "");
            }}
            items={supplierOptions}
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
              label="Banco"
              selectedKeys={bankId ? new Set([bankId]) : new Set([])}
              onSelectionChange={(keys) => {
                const first = Array.from(keys)[0];
                const value = first ? String(first) : "";
                const bank = banks.find((row) => row.id === value);
                setBankId(value);
                if (bank?.accountRef) setBankAccountRef(bank.accountRef);
              }}
              items={banks}
            >
              {(bank) => (
                <SelectItem key={bank.id} textValue={bank.name}>
                  {bank.name}
                </SelectItem>
              )}
            </Select>

            <Input
              label="Referencia bancaria"
              value={bankAccountRef}
              onValueChange={setBankAccountRef}
              isDisabled={submitting || loading}
            />
          </div>

          <Input
            label="Observaciones"
            value={notes}
            onValueChange={setNotes}
            isDisabled={submitting || loading}
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-default-200 bg-default-50 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-default-700">Resumen</h3>
          <div className="space-y-2 rounded-xl bg-white p-3">
            <div className="flex items-center justify-between text-sm text-default-600">
              <span>Líneas</span>
              <span>{items.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-default-600">
              <span>Proveedor</span>
              <span className="max-w-[170px] truncate text-right">{selectedSupplier?.name ?? "Sin asignar"}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-default-600">
              <span>Banco</span>
              <span className="max-w-[170px] truncate text-right">{selectedBank?.name ?? "-"}</span>
            </div>
            <div className="h-px bg-default-100" />
            <div className="flex items-center justify-between text-base font-semibold text-default-800">
              <span>Total</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-default-200 bg-content1 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-default-700">Items</h3>
          <Button variant="flat" isDisabled={submitting || loading} onPress={addEmptyRow}>
            Agregar línea
          </Button>
        </div>

        <div className="space-y-3">
          {itemRows.map((row, index) => (
            <div key={index} className="rounded-xl border border-default-200 bg-white p-3">
              <div className="grid gap-3 xl:grid-cols-[2fr,0.7fr,0.9fr,0.8fr]">
                <Select
                  isDisabled={submitting || loading}
                  isLoading={loading}
                  label="Item de inventario"
                  selectedKeys={row.inventoryItemId ? new Set([row.inventoryItemId]) : new Set([])}
                  onSelectionChange={(keys) => {
                    const first = Array.from(keys)[0];
                    const value = first ? String(first) : "";
                    const selectedItem = value ? itemById.get(value) ?? null : null;

                    updateItem(index, {
                      inventoryItemId: value,
                      unitPrice:
                        selectedItem && !items[index]?.unitPrice
                          ? String(selectedItem.price ?? "")
                          : items[index]?.unitPrice ?? "",
                    });
                  }}
                  items={inventoryItems}
                >
                  {(item) => (
                    <SelectItem key={item.id} textValue={item.name}>
                      {item.name}
                    </SelectItem>
                  )}
                </Select>

                <Input
                  label="Cantidad"
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.quantity}
                  onValueChange={(value) => updateItem(index, { quantity: value })}
                  isDisabled={submitting || loading}
                />

                <Input
                  label="Precio unitario"
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.unitPrice}
                  onValueChange={(value) => updateItem(index, { unitPrice: value })}
                  isDisabled={submitting || loading}
                />

                <div className="flex flex-col justify-between rounded-xl border border-default-200 bg-default-50 px-3 py-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-default-500">Subtotal</div>
                    <div className="mt-1 text-lg font-semibold text-default-800">{formatMoney(row.lineTotal)}</div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button
                      color="danger"
                      variant="light"
                      isDisabled={submitting || items.length === 1 || loading}
                      onPress={() => {
                        setItems((prev) => prev.filter((_, current) => current !== index));
                      }}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error ? <div className="text-sm text-danger">{error}</div> : null}

      <div className="flex items-center justify-end gap-2">
        <Button variant="flat" isDisabled={submitting} onPress={() => router.push("/erp/purchase-orders")}>
          Cancelar
        </Button>
        <Button color="primary" isLoading={submitting} onPress={submit}>
          {isEdit ? "Guardar cambios" : "Crear orden"}
        </Button>
      </div>
    </div>
  );
}
