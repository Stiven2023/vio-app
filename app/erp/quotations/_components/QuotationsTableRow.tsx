"use client";

import type {
  Addition,
  ProductOption,
  QuoteItem,
  UiLocale,
} from "../_lib/types";

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
import {
  getOrderTypeOptions,
  getProcessOptions,
  QUOTATION_COPY,
} from "../_lib/constants";
import { getQuotationUiLocale } from "../_lib/utils";

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
  locale?: UiLocale;
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
  locale,
}: QuotationsTableRowProps) {
  const uiLocale = locale ?? getQuotationUiLocale();
  const copy = QUOTATION_COPY[uiLocale];
  const orderTypeOptions = getOrderTypeOptions(uiLocale);
  const processOptions = getProcessOptions(uiLocale);
  const subtotalLine = row.quantity * row.unitPrice;
  const discountAmount = subtotalLine * (row.discount / 100);
  const lineTotal = subtotalLine - discountAmount;

  return (
    <TableRow>
      <TableCell>
        <Select
          classNames={{ trigger: "min-h-12 text-sm font-medium w-40" }}
          selectedKeys={row.orderType ? [row.orderType] : []}
          size="sm"
          variant="flat"
          onSelectionChange={(keys) => {
            const first = Array.from(keys)[0];

            onUpdateItem(row.id, {
              orderType: String(first ?? "NORMAL") as QuoteItem["orderType"],
            });
          }}
        >
          {orderTypeOptions.map((option) => (
            <SelectItem key={option.value}>{option.label}</SelectItem>
          ))}
        </Select>
      </TableCell>
      <TableCell>
        <Select
          classNames={{ trigger: "min-h-12 text-sm font-medium w-40" }}
          selectedKeys={row.process ? [row.process] : []}
          size="sm"
          variant="flat"
          onSelectionChange={(keys) => {
            const first = Array.from(keys)[0];

            onUpdateItem(row.id, {
              process: String(first ?? "PRODUCCION") as QuoteItem["process"],
            });
          }}
        >
          {processOptions.map((option) => (
            <SelectItem key={option.value}>{option.label}</SelectItem>
          ))}
        </Select>
      </TableCell>
      <TableCell>
        <Select
          aria-label={copy.products.productSearch}
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
                ? `- ${copy.products.headers.additions}`
                : `+ ${copy.additions.addAddition}`}
            </DropdownItem>
            <DropdownItem
              key="remove"
              className="text-danger"
              color="danger"
              onPress={() => onRemoveItem(row.id)}
            >
              {copy.products.remove}
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </TableCell>
    </TableRow>
  );
}
