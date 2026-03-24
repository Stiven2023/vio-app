"use client";

import type { InventoryItemOption, SupplierOption } from "../_lib/types";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";

import { apiJson, getErrorMessage } from "../_lib/api";
import { createPurchaseOrderSchema } from "../_lib/schemas";

type OptionsResponse = {
  suppliers: SupplierOption[];
  inventoryItems: InventoryItemOption[];
  banks?: string[];
};

type DraftItem = {
  inventoryItemId: string;
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

export function PurchaseOrderModal({
  isOpen,
  onOpenChange,
  onSaved,
  canAssociateSupplier,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  canAssociateSupplier: boolean;
}) {
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemOption[]>(
    [],
  );
  const [banks, setBanks] = useState<string[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountRef, setBankAccountRef] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([
    { inventoryItemId: "", quantity: "", unitPrice: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setSubmitting(false);
    setSupplierId("");
    setBankName("");
    setBankAccountRef("");
    setNotes("");
    setItems([{ inventoryItemId: "", quantity: "", unitPrice: "" }]);

    let active = true;

    setLoadingOptions(true);
    apiJson<OptionsResponse>("/api/purchase-orders/options")
      .then((res) => {
        if (!active) return;
        setSuppliers(res.suppliers ?? []);
        setInventoryItems(res.inventoryItems ?? []);
        const bankList = Array.isArray(res.banks) ? res.banks : [];

        setBanks(bankList);
        setBankName(bankList[0] ?? "");
      })
      .catch(() => {
        if (!active) return;
        setSuppliers([]);
        setInventoryItems([]);
        setBanks([]);
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

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
        const source = row.inventoryItemId
          ? (itemById.get(row.inventoryItemId) ?? null)
          : null;
        const quantity = parseNumeric(row.quantity);
        const unitPrice = parseNumeric(row.unitPrice);
        const lineTotal = quantity * unitPrice;

        return {
          ...row,
          source,
          quantityValue: quantity,
          unitPriceValue: unitPrice,
          lineTotal,
        };
      }),
    [itemById, items],
  );

  const subtotal = useMemo(
    () => itemRows.reduce((acc, row) => acc + row.lineTotal, 0),
    [itemRows],
  );

  const updateItem = (index: number, patch: Partial<DraftItem>) => {
    setItems((prev) =>
      prev.map((item, current) =>
        current === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const addEmptyRow = () => {
    setItems((prev) => [
      ...prev,
      { inventoryItemId: "", quantity: "", unitPrice: "" },
    ]);
  };

  const submit = async () => {
    if (submitting) return;

    const parsed = createPurchaseOrderSchema.safeParse({
      supplierId: supplierId ? supplierId : undefined,
      bankName,
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
      await apiJson("/api/purchase-orders", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      toast.success("Orden creada");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal disableAnimation isOpen={isOpen} size="5xl" onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>Nueva orden de compra</ModalHeader>
        <ModalBody className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-warning-200 bg-content1">
            <div className="border-b border-warning-100 bg-gradient-to-r from-amber-100 via-orange-50 to-white px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-warning-700">
                Viomar
              </p>
              <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-default-900">
                    Orden de compra
                  </h2>
                  <p className="text-sm text-default-600">
                    Código automático al guardar. Todos los valores se registran
                    en COP.
                  </p>
                </div>
                <div className="rounded-2xl border border-warning-200 bg-white/80 px-4 py-2 text-sm text-default-700">
                  Fecha: {new Intl.DateTimeFormat("es-CO").format(new Date())}
                </div>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-4 xl:grid-cols-[1.6fr,0.9fr]">
                <div className="space-y-4 rounded-2xl border border-default-200 bg-default-50/70 p-4">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-default-700">
                      Proveedor
                    </h3>
                    <p className="mt-1 text-sm text-default-500">
                      Selecciona el proveedor y completa el detalle de
                      reposición.
                    </p>
                  </div>

                  {canAssociateSupplier ? (
                    <Select
                      isDisabled={submitting || loadingOptions}
                      isLoading={loadingOptions}
                      items={supplierOptions}
                      label="Proveedor"
                      selectedKeys={
                        supplierId ? new Set([supplierId]) : new Set([])
                      }
                      onSelectionChange={(keys) => {
                        const first = Array.from(keys)[0];

                        setSupplierId(
                          first === "__none" ? "" : first ? String(first) : "",
                        );
                      }}
                    >
                      {(supplier) => (
                        <SelectItem key={supplier.id} textValue={supplier.name}>
                          <div className="flex flex-col">
                            <span>{supplier.name}</span>
                            <span className="text-xs text-default-500">
                              {supplier.supplierCode ?? "Sin código"}
                            </span>
                          </div>
                        </SelectItem>
                      )}
                    </Select>
                  ) : null}

                  <Input
                    isDisabled={submitting}
                    label="Observaciones"
                    value={notes}
                    onValueChange={setNotes}
                  />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Select
                      isDisabled={submitting || loadingOptions}
                      items={banks.map((bank) => ({ key: bank, label: bank }))}
                      label="Banco"
                      selectedKeys={
                        bankName ? new Set([bankName]) : new Set([])
                      }
                      onSelectionChange={(keys) => {
                        const first = Array.from(keys)[0];

                        setBankName(first ? String(first) : "");
                      }}
                    >
                      {(bank) => (
                        <SelectItem key={bank.key} textValue={bank.label}>
                          {bank.label}
                        </SelectItem>
                      )}
                    </Select>

                    <Input
                      isDisabled={submitting}
                      label="Referencia bancaria"
                      value={bankAccountRef}
                      onValueChange={setBankAccountRef}
                    />
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-default-200 bg-white p-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-default-500">
                        Contacto
                      </div>
                      <div className="mt-1 text-sm font-medium text-default-800">
                        {selectedSupplier?.contactName ?? "Sin definir"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-default-500">
                        Correo
                      </div>
                      <div className="mt-1 text-sm font-medium text-default-800">
                        {selectedSupplier?.email ?? "Sin definir"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-default-500">
                        Identificación
                      </div>
                      <div className="mt-1 text-sm font-medium text-default-800">
                        {selectedSupplier?.identification ?? "Sin definir"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-default-500">
                        Teléfono
                      </div>
                      <div className="mt-1 text-sm font-medium text-default-800">
                        {selectedSupplier?.fullMobile ??
                          selectedSupplier?.mobile ??
                          "Sin definir"}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-xs uppercase tracking-wide text-default-500">
                        Dirección
                      </div>
                      <div className="mt-1 text-sm font-medium text-default-800">
                        {selectedSupplier
                          ? `${selectedSupplier.address ?? "Sin dirección"} · ${selectedSupplier.city ?? "-"} · ${selectedSupplier.department ?? "-"}`
                          : "Sin definir"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-warning-200 bg-warning-50/60 p-4">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-warning-800">
                      Resumen
                    </h3>
                    <p className="mt-1 text-sm text-warning-900/70">
                      Vista rápida para validar cantidades, costos y total antes
                      de emitir la orden.
                    </p>
                  </div>

                  <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between text-sm text-default-600">
                      <span>Líneas</span>
                      <span>{items.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-default-600">
                      <span>Proveedor</span>
                      <span className="max-w-[180px] truncate text-right">
                        {selectedSupplier?.name ?? "Sin asignar"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-default-600">
                      <span>Banco</span>
                      <span className="max-w-[180px] truncate text-right">
                        {bankName || "-"}
                      </span>
                    </div>
                    <div className="h-px bg-default-100" />
                    <div className="flex items-center justify-between text-sm font-medium text-default-700">
                      <span>Subtotal</span>
                      <span>{formatMoney(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-base font-semibold text-warning-800">
                      <span>Total</span>
                      <span>{formatMoney(subtotal)}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-dashed border-warning-300 bg-white/70 p-4">
                    <div className="text-xs uppercase tracking-wide text-default-500">
                      Firmas
                    </div>
                    <div className="mt-4 grid gap-4 text-xs text-default-500 sm:grid-cols-3">
                      {["Elaboró", "Aprobó", "Recibió proveedor"].map(
                        (label) => (
                          <div key={label} className="pt-6">
                            <div className="border-t border-default-300" />
                            <div className="mt-2 text-center font-medium">
                              {label}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-default-700">
                      Productos a reponer
                    </h3>
                    <p className="mt-1 text-sm text-default-500">
                      Define cantidad y valor unitario por cada item del
                      inventario.
                    </p>
                  </div>
                  <Button
                    isDisabled={submitting}
                    variant="flat"
                    onPress={addEmptyRow}
                  >
                    Agregar línea
                  </Button>
                </div>

                <div className="space-y-3">
                  {itemRows.map((row, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-default-200 bg-white p-4 shadow-sm"
                    >
                      <div className="grid gap-3 xl:grid-cols-[2fr,0.7fr,0.9fr,0.8fr]">
                        <Select
                          isDisabled={submitting || loadingOptions}
                          isLoading={loadingOptions}
                          items={inventoryItems}
                          label="Item de inventario"
                          selectedKeys={
                            row.inventoryItemId
                              ? new Set([row.inventoryItemId])
                              : new Set([])
                          }
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];
                            const value = first ? String(first) : "";
                            const selectedItem = value
                              ? (itemById.get(value) ?? null)
                              : null;

                            updateItem(index, {
                              inventoryItemId: value,
                              unitPrice:
                                selectedItem && !items[index]?.unitPrice
                                  ? String(selectedItem.price ?? "")
                                  : (items[index]?.unitPrice ?? ""),
                            });
                          }}
                        >
                          {(item) => (
                            <SelectItem key={item.id} textValue={item.name}>
                              <div className="flex flex-col">
                                <span>{item.name}</span>
                                <span className="text-xs text-default-500">
                                  {(item.itemCode ?? "Sin código") +
                                    " · " +
                                    (item.unit ?? "und")}
                                </span>
                              </div>
                            </SelectItem>
                          )}
                        </Select>

                        <Input
                          isDisabled={submitting}
                          label="Cantidad"
                          min="0"
                          step="0.01"
                          type="number"
                          value={row.quantity}
                          onValueChange={(value) =>
                            updateItem(index, { quantity: value })
                          }
                        />

                        <Input
                          isDisabled={submitting}
                          label="Precio unitario"
                          min="0"
                          step="0.01"
                          type="number"
                          value={row.unitPrice}
                          onValueChange={(value) =>
                            updateItem(index, { unitPrice: value })
                          }
                        />

                        <div className="flex flex-col justify-between rounded-2xl border border-default-200 bg-default-50 px-4 py-3">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-default-500">
                              Subtotal línea
                            </div>
                            <div className="mt-1 text-lg font-semibold text-default-800">
                              {formatMoney(row.lineTotal)}
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end">
                            <Button
                              color="danger"
                              isDisabled={submitting || items.length === 1}
                              variant="light"
                              onPress={() => {
                                setItems((prev) =>
                                  prev.filter(
                                    (_, current) => current !== index,
                                  ),
                                );
                              }}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 text-sm text-default-500 sm:grid-cols-3">
                        <div>
                          Código:{" "}
                          <span className="font-medium text-default-700">
                            {row.source?.itemCode ?? "-"}
                          </span>
                        </div>
                        <div>
                          Unidad:{" "}
                          <span className="font-medium text-default-700">
                            {row.source?.unit ?? "-"}
                          </span>
                        </div>
                        <div>
                          Precio sugerido:{" "}
                          <span className="font-medium text-default-700">
                            {formatMoney(
                              parseNumeric(String(row.source?.price ?? "0")),
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {error ? <div className="text-danger text-sm">{error}</div> : null}
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={submitting}
            variant="flat"
            onPress={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button color="primary" isDisabled={submitting} onPress={submit}>
            {submitting ? "Creando..." : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
