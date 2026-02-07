"use client";

import type { Role } from "../../_lib/types";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { usePaginatedApi } from "../../_hooks/use-paginated-api";
import { Pager } from "../ui/pager";
import { TableSkeleton } from "../ui/table-skeleton";
import { FilterSearch } from "../ui/filter-search";
import { FilterSelect } from "../ui/filter-select";

import { RoleModal } from "./role-modal";

import { ConfirmActionModal } from "@/components/confirm-action-modal";

export function RolesTab() {
  const { data, loading, page, setPage, refresh } = usePaginatedApi<Role>(
    "/api/roles",
    10,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Role | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();

    if (!q) return items;

    return items.filter((r) => r.name.toLowerCase().includes(q));
  }, [data, search]);

  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (search.trim() !== "") return "Sin resultados";

    return "Sin roles";
  }, [loading, search]);

  const remove = async () => {
    const r = pendingDelete;

    if (!r) return;
    if (deletingId) return;

    setDeletingId(r.id);
    try {
      await apiJson(`/api/roles`, {
        method: "DELETE",
        body: JSON.stringify({ id: r.id }),
      });
      toast.success("Rol eliminado");
      setConfirmOpen(false);
      setPendingDelete(null);
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <FilterSearch
            className="sm:w-72"
            placeholder="Buscar rol…"
            value={search}
            onValueChange={setSearch}
          />
          <FilterSelect
            isDisabled
            className="sm:w-56"
            label="Estado"
            options={[{ value: "all", label: "Todos" }]}
            value="all"
            onChange={() => {}}
          />
        </div>

        <div className="flex gap-2">
          <Button
            color="primary"
            onPress={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            Crear rol
          </Button>
          <Button variant="flat" onPress={refresh}>
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton ariaLabel="Roles" headers={["Nombre", "Acciones"]} />
      ) : (
        <Table aria-label="Roles">
          <TableHeader>
            <TableColumn>Nombre</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={filtered}>
            {(r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell className="flex gap-2">
                  <Button
                    isDisabled={Boolean(deletingId)}
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      setEditing(r);
                      setModalOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    color="danger"
                    isDisabled={Boolean(deletingId)}
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      setPendingDelete(r);
                      setConfirmOpen(true);
                    }}
                  >
                    Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {data ? <Pager data={data} page={page} onChange={setPage} /> : null}

      <RoleModal
        isOpen={modalOpen}
        role={editing}
        onOpenChange={setModalOpen}
        onSaved={refresh}
      />

      <ConfirmActionModal
        cancelLabel="Cancelar"
        confirmLabel="Eliminar"
        description={
          pendingDelete ? `¿Eliminar el rol ${pendingDelete.name}?` : undefined
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
