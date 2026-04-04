"use client";

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

import { useMemo, useState } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/modal";

import {
  getOrderTypeOptions,
  getProcessOptions,
  QUOTATION_COPY,
} from "../_lib/constants";
import { QuotationsAdditionsPanel } from "./QuotationsAdditionsPanel";
import { useQuotationUiLocale } from "../_hooks/useQuotationUiLocale";

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
  const locale = useQuotationUiLocale();
  const copy = QUOTATION_COPY[locale];
  const orderTypeOptions = getOrderTypeOptions(locale);
  const processOptions = getProcessOptions(locale);
  const isAuthorizedManual =
    currency === "COP" && clientPriceType === "AUTORIZADO";
  const additionsById = new Map(
    additions.map((addition) => [addition.id, addition]),
  );
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
      product: item.product || copy.products.unselectedProduct,
      process: item.process,
      quantity: item.quantity,
      lineTotal,
      additionsCount,
      additionsTotal,
      totalWithAdditions: lineTotal + additionsTotal,
    };
  });

  return (
    <Card className="border border-default-200" radius="md" shadow="none">
      <CardHeader className="flex items-center justify-between">
        <span className="text-sm font-semibold">{copy.products.title}</span>
        <Button variant="flat" onPress={onAddItem}>
          {copy.products.addProduct}
        </Button>
      </CardHeader>
      <CardBody className="space-y-4">
        <Card className="border border-default-200" radius="sm" shadow="none">
          <CardHeader className="py-3">
            <span className="text-sm font-semibold">
              {copy.products.summaryTitle}
            </span>
          </CardHeader>
          <CardBody className="pt-0">
            {summaryRows.length === 0 ? (
              <p className="text-xs text-default-500">{copy.products.empty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-xs">
                  <thead>
                    <tr className="border-b border-default-200 text-default-600">
                      <th className="py-2 px-2 text-left font-semibold">
                        {copy.products.headers.index}
                      </th>
                      <th className="py-2 px-2 text-left font-semibold">
                        {copy.products.headers.product}
                      </th>
                      <th className="py-2 px-2 text-left font-semibold">
                        {copy.products.headers.process}
                      </th>
                      <th className="py-2 px-2 text-right font-semibold">
                        {copy.products.headers.quantity}
                      </th>
                      <th className="py-2 px-2 text-right font-semibold">
                        {copy.products.headers.designTotal}
                      </th>
                      <th className="py-2 px-2 text-right font-semibold">
                        {copy.products.headers.additions}
                      </th>
                      <th className="py-2 px-2 text-right font-semibold">
                        {copy.products.headers.itemTotal}
                      </th>
                      <th className="py-2 px-2 text-right font-semibold">
                        {copy.products.headers.actions}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map((row) => (
                      <tr
                        key={row.key}
                        className="border-b border-default-100 last:border-b-0"
                      >
                        <td className="py-2 px-2">{row.index}</td>
                        <td className="py-2 px-2">{`${row.code} - ${row.product}`}</td>
                        <td className="py-2 px-2">{row.process}</td>
                        <td className="py-2 px-2 text-right">{row.quantity}</td>
                        <td className="py-2 px-2 text-right">
                          {asMoney(row.lineTotal)}
                        </td>
                        <td className="py-2 px-2 text-right">{`${row.additionsCount} · ${asMoney(row.additionsTotal)}`}</td>
                        <td className="py-2 px-2 text-right font-semibold">
                          {asMoney(row.totalWithAdditions)}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="flat"
                              onPress={() => setEditingItemId(row.key)}
                            >
                              {copy.products.edit}
                            </Button>
                            <Button
                              color="danger"
                              size="sm"
                              variant="light"
                              onPress={() => onRemoveItem(row.key)}
                            >
                              {copy.products.remove}
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
              ? copy.products.editProductNumber(
                  items.findIndex((i) => i.id === editingRow.id) + 1,
                )
              : copy.products.editProduct}
          </ModalHeader>
          <ModalBody className="space-y-4 pb-5">
            {editingRow ? (
              <>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <Select
                    aria-label="Design type"
                    classNames={{ trigger: "min-h-12 text-sm font-medium" }}
                    label={copy.products.designType}
                    selectedKeys={
                      editingRow.orderType ? [editingRow.orderType] : []
                    }
                    size="sm"
                    variant="bordered"
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
                  >
                        {orderTypeOptions.map((option) => (
                          <SelectItem key={option.value}>{option.label}</SelectItem>
                        ))}
                  </Select>

                  <Select
                    aria-label="Design process"
                    classNames={{ trigger: "min-h-12 text-sm font-medium" }}
                        label={copy.products.process}
                    selectedKeys={
                      editingRow.process ? [editingRow.process] : []
                    }
                    size="sm"
                    variant="bordered"
                    onSelectionChange={(keys) => {
                      const first = Array.from(keys)[0];

                      onUpdateItem(editingRow.id, {
                        process: String(first ?? "PRODUCCION") as QuoteProcess,
                      });
                    }}
                  >
                    {processOptions.map((option) => (
                      <SelectItem key={option.value}>{option.label}</SelectItem>
                    ))}
                  </Select>

                  <Autocomplete
                    aria-label="Search product by code"
                    classNames={{
                      base: "min-h-12",
                      selectorButton: "min-h-12",
                    }}
                    defaultItems={products}
                    isLoading={loadingProducts}
                    label={copy.products.productSearch}
                    selectedKey={editingRow.productId || null}
                    size="sm"
                    variant="bordered"
                    onSelectionChange={(key) => {
                      onUpdateItem(editingRow.id, {
                        productId: String(key ?? ""),
                      });
                    }}
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
                  isReadOnly
                  aria-label="Description"
                  classNames={{ input: "text-sm leading-5" }}
                  label={copy.products.description}
                  size="sm"
                  value={editingRow.description}
                  variant="bordered"
                />

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Input
                    aria-label="Quantity"
                    label={copy.products.quantity}
                    size="sm"
                    type="number"
                    value={String(editingRow.quantity)}
                    variant="bordered"
                    onValueChange={(v) =>
                      onUpdateItem(editingRow.id, {
                        quantity: Math.max(0, Number(v || 0)),
                      })
                    }
                  />
                  <Input
                    aria-label="Unit price"
                    isReadOnly={!isAuthorizedManual}
                    label={copy.products.unitPrice}
                    size="sm"
                    type="number"
                    value={String(editingRow.unitPrice)}
                    variant="bordered"
                    onValueChange={(v) => {
                      if (!isAuthorizedManual) return;
                      onUpdateItem(editingRow.id, {
                        unitPrice: Math.max(0, Number(v || 0)),
                      });
                    }}
                  />
                  <Input
                    aria-label="Discount percentage"
                    label={copy.products.discount}
                    placeholder={copy.products.discountPlaceholder}
                    size="sm"
                    type="number"
                    value={String(editingRow.discount)}
                    variant="bordered"
                    onValueChange={(v) =>
                      onUpdateItem(editingRow.id, {
                        discount: Math.max(0, Math.min(100, Number(v || 0))),
                      })
                    }
                  />
                  <Input
                    isReadOnly
                    aria-label="Total value"
                    label={copy.products.totalValue}
                    size="sm"
                    value={asMoney(
                      editingRow.quantity * editingRow.unitPrice -
                        editingRow.quantity *
                          editingRow.unitPrice *
                          (editingRow.discount / 100),
                    )}
                    variant="bordered"
                  />
                </div>

                <QuotationsAdditionsPanel
                  additions={additions}
                  asMoney={asMoney}
                  clientPriceType={clientPriceType}
                  currency={currency}
                  loadingAdditions={loadingAdditions}
                  row={editingRow}
                  onAddAddition={(itemId, addition) => {
                    onAddAddition(itemId, addition);
                  }}
                  onUpdateItem={onUpdateItem}
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
