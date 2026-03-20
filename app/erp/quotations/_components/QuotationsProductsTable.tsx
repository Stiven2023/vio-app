"use client";

import { useMemo, useState } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/modal";

import { QuotationsAdditionsPanel } from "./QuotationsAdditionsPanel";
import type {
  Addition,
  AdditionOption,
  ClientPriceType,
  Currency,
  OrderType,
  ProductOption,
  QuoteItem,
  QuoteProcess,
} from "../_lib/types";

type QuotationsProductsTableProps = {
  items: QuoteItem[];
  products: ProductOption[];
  additions: AdditionOption[];
  currency: Currency;
  clientPriceType: ClientPriceType;
  loadingProducts: boolean;
  loadingAdditions: boolean;
  onAddItem: () => void;
  onUpdateItem: (id: string, patch: Partial<QuoteItem>) => void;
  onRemoveItem: (id: string) => void;
  onAddAddition: (id: string, addition: Addition) => void;
  asMoney: (value: number) => string;
};

export function QuotationsProductsTable({
  items,
  products,
  additions,
  currency,
  clientPriceType,
  loadingProducts,
  loadingAdditions,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onAddAddition,
  asMoney,
}: QuotationsProductsTableProps) {
  const isAuthorizedManual = currency === "COP" && clientPriceType === "AUTORIZADO";
  const additionsById = new Map(additions.map((addition) => [addition.id, addition]));
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const editingRow = useMemo(
    () => items.find((item) => item.id === editingItemId) ?? null,
    [items, editingItemId],
  );

  const summaryRows = items.map((item, index) => {
    const subtotalLine = item.quantity * item.unitPrice;
    const discountAmount = subtotalLine * (item.discount / 100);
    const lineTotal = subtotalLine - discountAmount;
    const additionsCount = item.additions.length;
    const additionsTotal = item.additions.reduce(
      (acc, add) => acc + add.quantity * add.unitPrice,
      0,
    );

    return {
      key: item.id,
      index: index + 1,
      code: item.code || "-",
      product: item.product || "Producto sin seleccionar",
      process: item.process,
      quantity: item.quantity,
      lineTotal,
      additionsCount,
      additionsTotal,
      totalWithAdditions: lineTotal + additionsTotal,
    };
  });

  return (
    <Card radius="md" shadow="none" className="border border-default-200">
      <CardHeader className="flex items-center justify-between">
        <span className="text-sm font-semibold">Product Details</span>
        <Button variant="flat" onPress={onAddItem}>
          Add product
        </Button>
      </CardHeader>
      <CardBody className="space-y-4">
        <Card radius="sm" shadow="none" className="border border-default-200">
          <CardHeader className="py-3">
            <span className="text-sm font-semibold">Products summary table</span>
          </CardHeader>
          <CardBody className="pt-0">
            {summaryRows.length === 0 ? (
              <p className="text-xs text-default-500">No products added yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-xs">
                  <thead>
                    <tr className="border-b border-default-200 text-default-600">
                      <th className="py-2 px-2 text-left font-semibold">#</th>
                      <th className="py-2 px-2 text-left font-semibold">Product</th>
                      <th className="py-2 px-2 text-left font-semibold">Process</th>
                      <th className="py-2 px-2 text-right font-semibold">Qty.</th>
                      <th className="py-2 px-2 text-right font-semibold">Design Total</th>
                      <th className="py-2 px-2 text-right font-semibold">Additions</th>
                      <th className="py-2 px-2 text-right font-semibold">Item Total</th>
                      <th className="py-2 px-2 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map((row) => (
                      <tr key={row.key} className="border-b border-default-100 last:border-b-0">
                        <td className="py-2 px-2">{row.index}</td>
                        <td className="py-2 px-2">{`${row.code} - ${row.product}`}</td>
                        <td className="py-2 px-2">{row.process}</td>
                        <td className="py-2 px-2 text-right">{row.quantity}</td>
                        <td className="py-2 px-2 text-right">{asMoney(row.lineTotal)}</td>
                        <td className="py-2 px-2 text-right">{`${row.additionsCount} · ${asMoney(row.additionsTotal)}`}</td>
                        <td className="py-2 px-2 text-right font-semibold">{asMoney(row.totalWithAdditions)}</td>
                        <td className="py-2 px-2">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="flat"
                              onPress={() => setEditingItemId(row.key)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="light"
                              color="danger"
                              onPress={() => onRemoveItem(row.key)}
                            >
                              Remove
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </CardBody>

      <Modal
        isOpen={Boolean(editingRow)}
        size="5xl"
        onOpenChange={(open) => {
          if (!open) setEditingItemId(null);
        }}
      >
        <ModalContent>
          <ModalHeader>
            {editingRow
              ? `Edit product #${items.findIndex((i) => i.id === editingRow.id) + 1}`
              : "Edit product"}
          </ModalHeader>
          <ModalBody className="space-y-4 pb-5">
            {editingRow ? (
              <>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <Select
                    size="sm"
                    variant="bordered"
                    label="Design Type"
                    aria-label="Design type"
                    selectedKeys={editingRow.orderType ? [editingRow.orderType] : []}
                    onSelectionChange={(keys) => {
                      const first = Array.from(keys)[0];
                      const nextType = String(first ?? "NORMAL") as OrderType;
                      const isConditional =
                        nextType === "COMPLETACION" ||
                        nextType === "REFERENTE" ||
                        nextType === "REPOSICION";

                      onUpdateItem(editingRow.id, {
                        orderType: nextType,
                        ...(isConditional
                          ? {}
                          : {
                              referenceOrderCode: "",
                              referenceDesign: "",
                            }),
                      });
                    }}
                    classNames={{ trigger: "min-h-12 text-sm font-medium" }}
                  >
                    <SelectItem key="NORMAL">Nuevo</SelectItem>
                    <SelectItem key="COMPLETACION">Completación</SelectItem>
                    <SelectItem key="REFERENTE">Referente</SelectItem>
                    <SelectItem key="REPOSICION">Reposición</SelectItem>
                    <SelectItem key="MUESTRA">Muestra</SelectItem>
                    <SelectItem key="OBSEQUIO">Obsequio</SelectItem>
                  </Select>

                  <Select
                    size="sm"
                    variant="bordered"
                    label="Process"
                    aria-label="Design process"
                    selectedKeys={editingRow.process ? [editingRow.process] : []}
                    onSelectionChange={(keys) => {
                      const first = Array.from(keys)[0];
                      onUpdateItem(editingRow.id, {
                        process: String(first ?? "PRODUCCION") as QuoteProcess,
                      });
                    }}
                    classNames={{ trigger: "min-h-12 text-sm font-medium" }}
                  >
                    <SelectItem key="PRODUCCION">Producción</SelectItem>
                    <SelectItem key="BODEGA">Bodega</SelectItem>
                    <SelectItem key="COMPRAS">Compras</SelectItem>
                  </Select>

                  <Autocomplete
                    size="sm"
                    variant="bordered"
                    label="Product (search by code)"
                    isLoading={loadingProducts}
                    aria-label="Search product by code"
                    selectedKey={editingRow.productId || null}
                    defaultItems={products}
                    onSelectionChange={(key) => {
                      onUpdateItem(editingRow.id, { productId: String(key ?? "") });
                    }}
                    classNames={{ base: "min-h-12", selectorButton: "min-h-12" }}
                  >
                    {products.map((product) => (
                      <AutocompleteItem
                        key={product.id}
                        textValue={`${product.productCode ?? ""} ${product.name}`}
                      >
                        {`${product.productCode ?? "-"} - ${product.name}`}
                      </AutocompleteItem>
                    ))}
                  </Autocomplete>
                </div>

                <Input
                  size="sm"
                  variant="bordered"
                  label="Description"
                  isReadOnly
                  value={editingRow.description}
                  classNames={{ input: "text-sm leading-5" }}
                  aria-label="Description"
                />

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Input
                    size="sm"
                    type="number"
                    variant="bordered"
                    label="Quantity"
                    value={String(editingRow.quantity)}
                    aria-label="Quantity"
                    onValueChange={(v) =>
                      onUpdateItem(editingRow.id, { quantity: Math.max(0, Number(v || 0)) })
                    }
                  />
                  <Input
                    size="sm"
                    type="number"
                    variant="bordered"
                    label="Unit Price"
                    isReadOnly={!isAuthorizedManual}
                    value={String(editingRow.unitPrice)}
                    aria-label="Unit price"
                    onValueChange={(v) => {
                      if (!isAuthorizedManual) return;
                      onUpdateItem(editingRow.id, { unitPrice: Math.max(0, Number(v || 0)) });
                    }}
                  />
                  <Input
                    size="sm"
                    type="number"
                    variant="bordered"
                    label="Discount %"
                    placeholder="0"
                    value={String(editingRow.discount)}
                    aria-label="Discount percentage"
                    onValueChange={(v) =>
                      onUpdateItem(editingRow.id, { discount: Math.max(0, Math.min(100, Number(v || 0))) })
                    }
                  />
                  <Input
                    size="sm"
                    variant="bordered"
                    label="Total Value"
                    isReadOnly
                    value={asMoney(
                      editingRow.quantity * editingRow.unitPrice -
                        editingRow.quantity * editingRow.unitPrice * (editingRow.discount / 100),
                    )}
                    aria-label="Total value"
                  />
                </div>

                <QuotationsAdditionsPanel
                  row={editingRow}
                  additions={additions}
                  currency={currency}
                  clientPriceType={clientPriceType}
                  loadingAdditions={loadingAdditions}
                  onUpdateItem={onUpdateItem}
                  onAddAddition={(itemId, addition) => {
                    onAddAddition(itemId, addition);
                  }}
                  asMoney={asMoney}
                />

                <div className="flex justify-end">
                  <Button variant="flat" onPress={() => setEditingItemId(null)}>
                    Close
                  </Button>
                </div>
              </>
            ) : null}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Card>
  );
}
