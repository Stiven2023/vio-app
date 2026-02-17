"use client";

import type { InventoryItem, InventoryOutput } from "../../_lib/types";

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

import { InventoryOutputModal } from "./inventory-output-modal";

import { ConfirmActionModal } from "@/components/confirm-action-modal";

function locationLabel(value: InventoryOutput["location"]) {
  return value === "TIENDA" ? "Tienda" : "Bodega principal";
}

export function InventoryOutputsTab({
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
  const [loadingItems, setLoadingItems] = useState(false);

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

    return () => {
      active = false;
    };
  }, []);

  const endpoint = useMemo(() => {
    const q = search.trim();

    return q ? `/api/inventory-outputs?q=${encodeURIComponent(q)}` : "/api/inventory-outputs";
  }, [search]);

  const { data, loading, page, setPage, refresh } = usePaginatedApi<InventoryOutput>(
    endpoint,
    10,
  );

  useEffect(() => {
    setPage(1);
  }, [search, setPage]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryOutput | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<InventoryOutput | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (search.trim() !== "") return "Sin resultados";

    return "Sin salidas";
  }, [loading, search]);

  const remove = async () => {
    const output = pendingDelete;

    if (!output) return;
    if (deletingId) return;

    setDeletingId(output.id);
    try {
      await apiJson(`/api/inventory-outputs`, {
        method: "DELETE",
        body: JSON.stringify({ id: output.id }),
      });
      toast.success("Salida eliminada");
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
              Registrar salida
            </Button>
          ) : null}
          <Button variant="flat" onPress={refresh}>
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Salidas"
          headers={[
            "Item",
            "Motivo",
            "Ubicación",
            "Cantidad",
            "Orden",
            "Fecha",
            "Acciones",
          ]}
        />
      ) : (
        <Table aria-label="Salidas">
          <TableHeader>
            <TableColumn>Item</TableColumn>
            <TableColumn>Motivo</TableColumn>
            <TableColumn>Ubicación</TableColumn>
            <TableColumn>Cantidad</TableColumn>
            <TableColumn>Orden</TableColumn>
            <TableColumn>Fecha</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={data?.items ?? []}>
            {(output) => (
              <TableRow key={output.id}>
                <TableCell>{output.itemName ?? output.inventoryItemId ?? "-"}</TableCell>
                <TableCell>{output.reason ?? "-"}</TableCell>
                <TableCell>{locationLabel(output.location)}</TableCell>
                <TableCell>{output.quantity ?? "-"}</TableCell>
                <TableCell>{output.orderItemName ?? output.orderItemId ?? "-"}</TableCell>
                <TableCell>
                  {output.createdAt ? new Date(output.createdAt).toLocaleString() : "-"}
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
                            setEditing(output);
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
                            setPendingDelete(output);
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

      <InventoryOutputModal
        output={editing}
        isOpen={modalOpen}
        items={items}
        itemsLoading={loadingItems}
        onOpenChange={setModalOpen}
        onSaved={refresh}
      />

      <ConfirmActionModal
        cancelLabel="Cancelar"
        confirmLabel="Eliminar"
        description={
          pendingDelete
            ? `¿Eliminar la salida de ${pendingDelete.itemName ?? "item"}?`
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
