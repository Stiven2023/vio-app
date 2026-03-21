"use client";

import type { OrderType, QuoteProcess } from "../_lib/types";

import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Button } from "@heroui/button";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { TableCell, TableRow } from "@heroui/table";

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
  process: QuoteProcess;
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
          classNames={{ trigger: "min-h-12 text-sm font-medium w-40" }}
          selectedKeys={row.orderType ? [row.orderType] : []}
          size="sm"
          variant="flat"
          onSelectionChange={(keys) => {
            const first = Array.from(keys)[0];

            onUpdateItem(row.id, {
              orderType: String(first ?? "NORMAL") as OrderType,
            });
          }}
        >
          <SelectItem key="NORMAL">New</SelectItem>
          <SelectItem key="COMPLETACION">Completion</SelectItem>
          <SelectItem key="REFERENTE">Referent</SelectItem>
          <SelectItem key="REPOSICION">Reposition</SelectItem>
          <SelectItem key="MUESTRA">Sample</SelectItem>
          <SelectItem key="OBSEQUIO">Gift</SelectItem>
        </Select>
      </TableCell>
      {/* Proceso */}
      <TableCell>
        <Select
          classNames={{ trigger: "min-h-12 text-sm font-medium w-40" }}
          selectedKeys={row.process ? [row.process] : []}
          size="sm"
          variant="flat"
          onSelectionChange={(keys) => {
            const first = Array.from(keys)[0];

            onUpdateItem(row.id, {
              process: String(first ?? "PRODUCCION") as QuoteProcess,
            });
          }}
        >
          <SelectItem key="PRODUCCION">Production</SelectItem>
          <SelectItem key="BODEGA">Warehouse</SelectItem>
          <SelectItem key="COMPRAS">Purchases</SelectItem>
        </Select>
      </TableCell>
      {/* Producto */}
      <TableCell>
        <Select
          aria-label="Select product"
          classNames={{ trigger: "min-h-12 text-sm font-medium w-64" }}
          isLoading={loadingProducts}
          selectedKeys={row.productId ? [row.productId] : []}
          size="sm"
          variant="flat"
          onSelectionChange={(keys) => {
            const first = Array.from(keys)[0];

            onUpdateItem(row.id, { productId: String(first ?? "") });
          }}
        >
          {products.map((product) => (
            <SelectItem key={product.id}>
              {`${product.productCode ?? "-"} - ${product.name}`}
            </SelectItem>
          ))}
        </Select>
      </TableCell>
      {/* Description */}
      <TableCell>
        <Input
          isReadOnly
          classNames={{ input: "text-xs" }}
          size="sm"
          value={row.description}
          variant="flat"
        />
      </TableCell>
      {/* Quantity */}
      <TableCell>
        <Input
          classNames={{ input: "w-16 text-center" }}
          size="sm"
          type="number"
          value={String(row.quantity)}
          variant="flat"
          onValueChange={(v) =>
            onUpdateItem(row.id, { quantity: Math.max(0, Number(v || 0)) })
          }
        />
      </TableCell>
      {/* Vr. Unitario */}
      <TableCell>
        <Input
          isReadOnly
          classNames={{ input: "text-xs" }}
          size="sm"
          type="number"
          value={String(row.unitPrice)}
          variant="flat"
        />
      </TableCell>
      {/* Descuento % */}
      <TableCell>
        <Input
          classNames={{ input: "w-16 text-center" }}
          placeholder="0"
          size="sm"
          type="number"
          value={String(row.discount)}
          variant="flat"
          onValueChange={(v) =>
            onUpdateItem(row.id, {
              discount: Math.max(0, Math.min(100, Number(v || 0))),
            })
          }
        />
      </TableCell>
      {/* Total Value */}
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
              {expandedItemId === row.id
                ? "− Hide Additions"
                : "+ Add Additions"}
            </DropdownItem>
            <DropdownItem
              key="remove"
              className="text-danger"
              color="danger"
              onPress={() => onRemoveItem(row.id)}
            >
              Remove Product
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </TableCell>
    </TableRow>
  );
}
