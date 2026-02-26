"use client";

import { useMemo, useState } from "react";
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
  Negotiation,
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
      negotiation:
        item.negotiation === "MUESTRA_G" || item.negotiation === "MUESTRA_C"
          ? "MUESTRA"
          : item.negotiation || "NINGUNO",
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
        <span className="text-sm font-semibold">Detalle de Productos</span>
        <Button variant="flat" onPress={onAddItem}>
          Agregar producto
        </Button>
      </CardHeader>
      <CardBody className="space-y-4">
        <Card radius="sm" shadow="none" className="border border-default-200">
          <CardHeader className="py-3">
            <span className="text-sm font-semibold">Tabla resumida de productos</span>
          </CardHeader>
          <CardBody className="pt-0">
            {summaryRows.length === 0 ? (
              <p className="text-xs text-default-500">Aún no hay productos agregados temporalmente.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-xs">
                  <thead>
                    <tr className="border-b border-default-200 text-default-600">
                      <th className="py-2 px-2 text-left font-semibold">#</th>
                      <th className="py-2 px-2 text-left font-semibold">Producto</th>
                      <th className="py-2 px-2 text-left font-semibold">Negociación</th>
                      <th className="py-2 px-2 text-right font-semibold">Cant.</th>
                      <th className="py-2 px-2 text-right font-semibold">Total diseño</th>
                      <th className="py-2 px-2 text-right font-semibold">Adiciones</th>
                      <th className="py-2 px-2 text-right font-semibold">Total item</th>
                      <th className="py-2 px-2 text-right font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map((row) => (
                      <tr key={row.key} className="border-b border-default-100 last:border-b-0">
                        <td className="py-2 px-2">{row.index}</td>
                        <td className="py-2 px-2">{`${row.code} - ${row.product}`}</td>
                        <td className="py-2 px-2">{row.negotiation}</td>
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
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="light"
                              color="danger"
                              onPress={() => onRemoveItem(row.key)}
                            >
                              Quitar
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
              ? `Editar producto #${items.findIndex((i) => i.id === editingRow.id) + 1}`
              : "Editar producto"}
          </ModalHeader>
          <ModalBody className="space-y-4 pb-5">
            {editingRow ? (
              <>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <Select
                    size="sm"
                    variant="bordered"
                    label="Tipo diseño"
                    aria-label="Tipo de diseño"
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
                    <SelectItem key="BODEGA">Bodega</SelectItem>
                  </Select>

                  <Select
                    size="sm"
                    variant="bordered"
                    label="Negociación"
                    aria-label="Tipo de negociación"
                    selectedKeys={editingRow.negotiation ? [editingRow.negotiation] : []}
                    onSelectionChange={(keys) => {
                      const first = Array.from(keys)[0];
                      onUpdateItem(editingRow.id, { negotiation: String(first ?? "") as Negotiation });
                    }}
                    classNames={{ trigger: "min-h-12 text-sm font-medium" }}
                  >
                    <SelectItem key="">Ninguno</SelectItem>
                    <SelectItem key="MUESTRA">Muestra</SelectItem>
                    <SelectItem key="BODEGA">Origen: Bodega</SelectItem>
                    <SelectItem key="COMPRAS">Origen: Compras</SelectItem>
                    <SelectItem key="PRODUCCION">Origen: Producción</SelectItem>
                  </Select>

                  <Select
                    size="sm"
                    variant="bordered"
                    label="Producto"
                    isLoading={loadingProducts}
                    aria-label="Seleccionar producto"
                    selectedKeys={editingRow.productId ? [editingRow.productId] : []}
                    onSelectionChange={(keys) => {
                      const first = Array.from(keys)[0];
                      onUpdateItem(editingRow.id, { productId: String(first ?? "") });
                    }}
                    classNames={{ trigger: "min-h-12 text-sm font-medium" }}
                  >
                    {products.map((product) => (
                      <SelectItem key={product.id}>
                        {`${product.productCode ?? "-"} - ${product.name}`}
                      </SelectItem>
                    ))}
                  </Select>
                </div>

                <Input
                  size="sm"
                  variant="bordered"
                  label="Descripción"
                  isReadOnly
                  value={editingRow.description}
                  classNames={{ input: "text-sm leading-5" }}
                  aria-label="Descripción"
                />

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Input
                    size="sm"
                    type="number"
                    variant="bordered"
                    label="Cantidad"
                    value={String(editingRow.quantity)}
                    aria-label="Cantidad"
                    onValueChange={(v) =>
                      onUpdateItem(editingRow.id, { quantity: Math.max(0, Number(v || 0)) })
                    }
                  />
                  <Input
                    size="sm"
                    type="number"
                    variant="bordered"
                    label="Vr. Unitario"
                    isReadOnly={!isAuthorizedManual}
                    value={String(editingRow.unitPrice)}
                    aria-label="Valor unitario"
                    onValueChange={(v) => {
                      if (!isAuthorizedManual) return;
                      onUpdateItem(editingRow.id, { unitPrice: Math.max(0, Number(v || 0)) });
                    }}
                  />
                  <Input
                    size="sm"
                    type="number"
                    variant="bordered"
                    label="Descuento %"
                    placeholder="0"
                    value={String(editingRow.discount)}
                    aria-label="Descuento porcentaje"
                    onValueChange={(v) =>
                      onUpdateItem(editingRow.id, { discount: Math.max(0, Math.min(100, Number(v || 0))) })
                    }
                  />
                  <Input
                    size="sm"
                    variant="bordered"
                    label="Vr. Total"
                    isReadOnly
                    value={asMoney(
                      editingRow.quantity * editingRow.unitPrice -
                        editingRow.quantity * editingRow.unitPrice * (editingRow.discount / 100),
                    )}
                    aria-label="Valor total"
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
                    Cerrar
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
