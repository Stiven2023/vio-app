"use client";

import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { TableCell, TableRow } from "@heroui/table";

import type { OrderType, Negotiation } from "../_lib/types";

type Addition = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

type QuoteItem = {
  id: string;
  productId: string;
  orderType: OrderType;
  negotiation: Negotiation;
  code: string;
  quantity: number;
  product: string;
  description: string;
  unitPrice: number;
  discount: number;
  additions: Addition[];
  referenceOrderCode?: string;
  referenceDesign?: string;
};

type ProductOption = {
  id: string;
  productCode: string | null;
  name: string;
  description: string | null;
  priceCopBase: string | null;
};

type QuotationsTableRowProps = {
  row: QuoteItem;
  products: ProductOption[];
  loadingProducts: boolean;
  expandedItemId: string | null;
  onExpandedChange: (id: string | null) => void;
  onUpdateItem: (id: string, patch: Partial<QuoteItem>) => void;
  onRemoveItem: (id: string) => void;
  onAddAddition: (id: string, addition: Addition) => void;
  asMoney: (value: number) => string;
};

export function QuotationsTableRow({
  row,
  products,
  loadingProducts,
  expandedItemId,
  onExpandedChange,
  onUpdateItem,
  onRemoveItem,
  onAddAddition,
  asMoney,
}: QuotationsTableRowProps) {
  const subtotalLine = row.quantity * row.unitPrice;
  const discountAmount = subtotalLine * (row.discount / 100);
  const lineTotal = subtotalLine - discountAmount;

  return (
    <TableRow>
        {/* Tipo Diseño */}
        <TableCell>
          <Select
            size="sm"
            variant="flat"
            selectedKeys={row.orderType ? [row.orderType] : []}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              onUpdateItem(row.id, { orderType: String(first ?? "NORMAL") as OrderType });
            }}
            classNames={{ trigger: "min-h-12 text-sm font-medium w-40" }}
          >
            <SelectItem key="NORMAL">Nuevo</SelectItem>
            <SelectItem key="COMPLETACION">Completación</SelectItem>
            <SelectItem key="REFERENTE">Referente</SelectItem>
            <SelectItem key="REPOSICION">Reposición</SelectItem>
            <SelectItem key="BODEGA">Bodega</SelectItem>
          </Select>
        </TableCell>
        {/* Negociación */}
        <TableCell>
          <Select
            size="sm"
            variant="flat"
            selectedKeys={row.negotiation ? [row.negotiation] : []}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              onUpdateItem(row.id, { negotiation: String(first ?? "") as Negotiation });
            }}
            classNames={{ trigger: "min-h-12 text-sm font-medium w-40" }}
          >
            <SelectItem key="">Ninguno</SelectItem>
            <SelectItem key="MUESTRA">Muestra</SelectItem>
            <SelectItem key="BODEGA">Origen: Bodega</SelectItem>
            <SelectItem key="COMPRAS">Origen: Compras</SelectItem>
            <SelectItem key="PRODUCCION">Origen: Producción</SelectItem>
          </Select>
        </TableCell>
        {/* Producto */}
        <TableCell>
          <Select
            size="sm"
            variant="flat"
            isLoading={loadingProducts}
            aria-label="Seleccionar producto"
            selectedKeys={row.productId ? [row.productId] : []}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              onUpdateItem(row.id, { productId: String(first ?? "") });
            }}
            classNames={{ trigger: "min-h-12 text-sm font-medium w-64" }}
          >
            {products.map((product) => (
              <SelectItem key={product.id}>
                {`${product.productCode ?? "-"} - ${product.name}`}
              </SelectItem>
            ))}
          </Select>
        </TableCell>
        {/* Descripción */}
        <TableCell>
          <Input
            size="sm"
            variant="flat"
            isReadOnly
            value={row.description}
            classNames={{ input: "text-xs" }}
          />
        </TableCell>
        {/* Cantidad */}
        <TableCell>
          <Input
            size="sm"
            type="number"
            variant="flat"
            value={String(row.quantity)}
            classNames={{ input: "w-16 text-center" }}
            onValueChange={(v) =>
              onUpdateItem(row.id, { quantity: Math.max(0, Number(v || 0)) })
            }
          />
        </TableCell>
        {/* Vr. Unitario */}
        <TableCell>
          <Input
            size="sm"
            type="number"
            variant="flat"
            isReadOnly
            value={String(row.unitPrice)}
            classNames={{ input: "text-xs" }}
          />
        </TableCell>
        {/* Descuento % */}
        <TableCell>
          <Input
            size="sm"
            type="number"
            variant="flat"
            placeholder="0"
            value={String(row.discount)}
            classNames={{ input: "w-16 text-center" }}
            onValueChange={(v) =>
              onUpdateItem(row.id, { discount: Math.max(0, Math.min(100, Number(v || 0))) })
            }
          />
        </TableCell>
        {/* Vr. Total */}
        <TableCell className="font-semibold">{asMoney(lineTotal)}</TableCell>
        {/* Acción */}
        <TableCell>
          <Dropdown>
            <DropdownTrigger>
              <Button isIconOnly size="sm" variant="light">
                ⋮
              </Button>
            </DropdownTrigger>
            <DropdownMenu>
              <DropdownItem
                key="expansiones"
                onPress={() =>
                  onExpandedChange(expandedItemId === row.id ? null : row.id)
                }
              >
                {expandedItemId === row.id ? "− Ocultar Adiciones" : "+ Agregar Adiciones"}
              </DropdownItem>
              <DropdownItem
                key="remove"
                className="text-danger"
                color="danger"
                onPress={() => onRemoveItem(row.id)}
              >
                Quitar Producto
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </TableCell>
      </TableRow>
    );
  }
