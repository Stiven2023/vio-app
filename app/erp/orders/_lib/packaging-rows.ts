import type { OrderItemPackagingInput } from "@/app/erp/orders/_lib/order-item-types";

import { createRuntimeId } from "@/src/utils/runtime-id";

const PACKAGING_ROW_ID_PREFIX = "packaging-row";

function isGroupedPackagingRow(row: OrderItemPackagingInput) {
  return String(row.mode ?? "").trim().toUpperCase() === "AGRUPADO";
}

function hasPackagingRowId(row: OrderItemPackagingInput) {
  return String(row.id ?? "").trim().length > 0;
}

function createPackagingRowId() {
  return createRuntimeId(PACKAGING_ROW_ID_PREFIX);
}

export function createEmptyIndividualPackagingRow(): OrderItemPackagingInput {
  return {
    id: createPackagingRowId(),
    mode: "INDIVIDUAL",
    size: "",
    quantity: 1,
    personName: "",
    personNumber: "",
  };
}

export function normalizePackagingRows(
  rows: OrderItemPackagingInput[],
): OrderItemPackagingInput[] {
  return (rows ?? []).map((row) => {
    if (isGroupedPackagingRow(row) || hasPackagingRowId(row)) {
      return row;
    }

    return {
      ...row,
      id: createPackagingRowId(),
    };
  });
}

export function toIndividualPackagingRows(
  rows: OrderItemPackagingInput[],
): OrderItemPackagingInput[] {
  return normalizePackagingRows(rows)
    .filter((row) => !isGroupedPackagingRow(row))
    .flatMap((row) => {
      const quantity = Math.max(1, Math.floor(Number(row.quantity ?? 1)));
      const baseRow: OrderItemPackagingInput = {
        ...row,
        id: hasPackagingRowId(row) ? row.id : createPackagingRowId(),
        mode: "INDIVIDUAL",
        quantity: 1,
      };

      if (quantity === 1) {
        return [baseRow];
      }

      return Array.from({ length: quantity }).map((_, index) => ({
        ...baseRow,
        id: index === 0 ? baseRow.id : createPackagingRowId(),
      }));
    });
}

export function stripPackagingRowIds(
  rows: OrderItemPackagingInput[],
): OrderItemPackagingInput[] {
  return (rows ?? []).map(({ id: _id, ...row }) => row);
}