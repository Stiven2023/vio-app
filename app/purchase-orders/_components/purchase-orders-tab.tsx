"use client";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { BsThreeDotsVertical } from "react-icons/bs";

import { apiJson, getErrorMessage } from "../_lib/api";
import { PurchaseOrderModal } from "./purchase-order-modal";

import { usePaginatedApi } from "@/app/catalog/_hooks/use-paginated-api";
import { Pager } from "@/app/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/catalog/_components/ui/table-skeleton";

import type { PurchaseOrderListRow } from "../_lib/types";

export function PurchaseOrdersTab({
  canFinalize,
  canAssociateSupplier,
}: {
  canFinalize: boolean;
  canAssociateSupplier: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const endpoint = useMemo(() => "/api/purchase-orders", []);

  const { data, loading, page, setPage, refresh } = usePaginatedApi<PurchaseOrderListRow>(
    endpoint,
    10,
  );

  const emptyContent = useMemo(() => {
    if (loading) return "";
    return "Sin órdenes";
  }, [loading]);

  const finalize = async (id: string) => {
    if (!canFinalize) {
      toast.error("No tienes permiso para registrar entrada");
      return;
    }

    try {
      await apiJson(`/api/purchase-orders/${id}`, {
        method: "PUT",
        body: JSON.stringify({ action: "FINALIZAR" }),
      });
      toast.success("Orden finalizada");
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div />
        <div className="flex gap-2">
          <Button color="primary" onPress={() => setModalOpen(true)}>
            Nueva orden
          </Button>
          <Button variant="flat" onPress={refresh}>
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Órdenes de compra"
          headers={["Proveedor", "Estado", "Creada", "Acciones"]}
        />
      ) : (
        <Table aria-label="Órdenes de compra">
          <TableHeader>
            <TableColumn>Proveedor</TableColumn>
            <TableColumn>Estado</TableColumn>
            <TableColumn>Creada</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={data?.items ?? []}>
            {(row) => (
              <TableRow key={row.id}>
                <TableCell>{row.supplierName ?? "-"}</TableCell>
                <TableCell>{row.status ?? "-"}</TableCell>
                <TableCell>
                  {row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}
                </TableCell>
                <TableCell>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button size="sm" variant="flat">
                        <BsThreeDotsVertical />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Acciones">
                      {row.status === "PENDIENTE" ? (
                        <DropdownItem
                          key="finalize"
                          onPress={() => finalize(row.id)}
                        >
                          Finalizar (registrar entrada)
                        </DropdownItem>
                      ) : null}
                    </DropdownMenu>
                  </Dropdown>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {data ? <Pager data={data} page={page} onChange={setPage} /> : null}

      <PurchaseOrderModal
        canAssociateSupplier={canAssociateSupplier}
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={refresh}
      />
    </div>
  );
}
