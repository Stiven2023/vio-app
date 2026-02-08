"use client";

import { useEffect, useMemo, useState } from "react";
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
import { BsPencilSquare, BsThreeDotsVertical, BsTrash } from "react-icons/bs";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { usePaginatedApi } from "../../_hooks/use-paginated-api";
import { Pager } from "../ui/pager";
import { TableSkeleton } from "../ui/table-skeleton";
import { FilterSearch } from "../ui/filter-search";

import { InventoryEntryModal } from "./inventory-entry-modal";

import { ConfirmActionModal } from "@/components/confirm-action-modal";

import type { InventoryEntry, InventoryItem } from "../../_lib/types";

type SupplierRow = { id: string; name: string };

export function InventoryEntriesTab({
  canCreate,
  canEdit,
  canDelete,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  useEffect(() => {
    let active = true;

    setLoadingItems(true);
    apiJson<{ items: InventoryItem[] }>(`/api/inventory-items?page=1&pageSize=600`)
      .then((res) => {
        if (!active) return;
        setItems(res.items ?? []);
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
      })
      .finally(() => {
        if (active) setLoadingItems(false);
      });

    setLoadingSuppliers(true);
    apiJson<{ items: SupplierRow[] }>(`/api/suppliers?page=1&pageSize=600`)
      .then((res) => {
        if (!active) return;
        setSuppliers(res.items ?? []);
      })
      .catch(() => {
        if (!active) return;
        setSuppliers([]);
      })
      .finally(() => {
        if (active) setLoadingSuppliers(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const endpoint = useMemo(() => {
    const q = search.trim();

    return q ? `/api/inventory-entries?q=${encodeURIComponent(q)}` : "/api/inventory-entries";
  }, [search]);

  const { data, loading, page, setPage, refresh } = usePaginatedApi<InventoryEntry>(
    endpoint,
    10,
  );

  useEffect(() => {
    setPage(1);
  }, [search, setPage]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryEntry | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<InventoryEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (search.trim() !== "") return "Sin resultados";

    return "Sin entradas";
  }, [loading, search]);

  const remove = async () => {
    const entry = pendingDelete;

    if (!entry) return;
    if (deletingId) return;

    setDeletingId(entry.id);
    try {
      await apiJson(`/api/inventory-entries`, {
        method: "DELETE",
        body: JSON.stringify({ id: entry.id }),
      });
      toast.success("Entrada eliminada");
      setConfirmOpen(false);
      setPendingDelete(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <FilterSearch
          className="sm:w-72"
          placeholder="Buscar item…"
          value={search}
          onValueChange={setSearch}
        />

        <div className="flex gap-2">
          {canCreate ? (
            <Button
              color="primary"
              onPress={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              Registrar entrada
            </Button>
          ) : null}
          <Button variant="flat" onPress={refresh}>
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Entradas"
          headers={["Item", "Proveedor", "Cantidad", "Fecha", "Acciones"]}
        />
      ) : (
        <Table aria-label="Entradas">
          <TableHeader>
            <TableColumn>Item</TableColumn>
            <TableColumn>Proveedor</TableColumn>
            <TableColumn>Cantidad</TableColumn>
            <TableColumn>Fecha</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={data?.items ?? []}>
            {(entry) => (
              <TableRow key={entry.id}>
                <TableCell>{entry.itemName ?? entry.inventoryItemId ?? "-"}</TableCell>
                <TableCell>{entry.supplierName ?? "-"}</TableCell>
                <TableCell>{entry.quantity ?? "-"}</TableCell>
                <TableCell>
                  {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "-"}
                </TableCell>
                <TableCell>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        isDisabled={Boolean(deletingId)}
                        size="sm"
                        variant="flat"
                      >
                        <BsThreeDotsVertical />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Acciones">
                      {canEdit ? (
                        <DropdownItem
                          key="edit"
                          startContent={<BsPencilSquare />}
                          onPress={() => {
                            setEditing(entry);
                            setModalOpen(true);
                          }}
                        >
                          Editar
                        </DropdownItem>
                      ) : null}

                      {canDelete ? (
                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          startContent={<BsTrash />}
                          onPress={() => {
                            setPendingDelete(entry);
                            setConfirmOpen(true);
                          }}
                        >
                          Eliminar
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

      <InventoryEntryModal
        entry={editing}
        isOpen={modalOpen}
        items={items}
        itemsLoading={loadingItems}
        suppliers={suppliers}
        suppliersLoading={loadingSuppliers}
        onOpenChange={setModalOpen}
        onSaved={refresh}
      />

      <ConfirmActionModal
        cancelLabel="Cancelar"
        confirmLabel="Eliminar"
        description={
          pendingDelete
            ? `¿Eliminar la entrada de ${pendingDelete.itemName ?? "item"}?`
            : undefined
        }
        isLoading={deletingId === pendingDelete?.id}
        isOpen={confirmOpen}
        title="Confirmar eliminación"
        onConfirm={remove}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
          setConfirmOpen(open);
        }}
      />
    </div>
  );
}
