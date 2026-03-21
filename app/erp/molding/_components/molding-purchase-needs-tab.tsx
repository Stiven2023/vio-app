"use client";

import type { PurchaseNeedRow } from "../_lib/types";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { FiRefreshCw } from "react-icons/fi";

import { apiJson, getErrorMessage } from "../_lib/api";

export function MoldingPurchaseNeedsTab() {
  const [items, setItems] = useState<PurchaseNeedRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiJson<{ items: PurchaseNeedRow[] }>(
        "/api/molding/purchase-needs",
      );

      setItems(res.items);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-default-600">
          Insumos grouped by inventory item where purchase is needed
          (qtyToPurchase &gt; 0).
        </p>
        <Button
          isIconOnly
          isLoading={loading}
          size="sm"
          variant="light"
          onPress={load}
        >
          <FiRefreshCw />
        </Button>
      </div>

      <Table removeWrapper aria-label="Purchase needs">
        <TableHeader>
          <TableColumn>Inventory item</TableColumn>
          <TableColumn>Variant SKU</TableColumn>
          <TableColumn>Unit</TableColumn>
          <TableColumn>Total qty to purchase</TableColumn>
          <TableColumn>Pending items</TableColumn>
        </TableHeader>
        <TableBody emptyContent="No pending purchases for molding insumos">
          {items.map((row) => (
            <TableRow key={`${row.inventoryItemId}-${row.variantId ?? "null"}`}>
              <TableCell>
                {row.inventoryItemName ?? row.inventoryItemId}
              </TableCell>
              <TableCell>{row.variantSku ?? "—"}</TableCell>
              <TableCell>{row.inventoryItemUnit ?? "—"}</TableCell>
              <TableCell>
                <Chip color="warning" size="sm" variant="flat">
                  {Number(row.totalQtyToPurchase).toFixed(2)}
                </Chip>
              </TableCell>
              <TableCell>{row.pendingInsumoCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
