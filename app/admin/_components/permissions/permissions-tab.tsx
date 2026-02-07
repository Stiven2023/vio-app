"use client";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/table";

import type { Permission } from "../../_lib/types";
import { apiJson, getErrorMessage } from "../../_lib/api";
import { usePaginatedApi } from "../../_hooks/use-paginated-api";
import { Pager } from "../ui/pager";
import { TableSkeleton } from "../ui/table-skeleton";
import { FilterSearch } from "../ui/filter-search";
import { FilterSelect } from "../ui/filter-select";
import { PermissionModal } from "./permission-modal";

export function PermissionsTab() {
  const { data, loading, page, setPage, refresh } = usePaginatedApi<Permission>("/api/permissions", 10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Permission | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((p) => p.name.toLowerCase().includes(q));
  }, [data, search]);

  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (search.trim() !== "") return "Sin resultados";
    return "Sin permisos";
  }, [loading, search]);

  const remove = async (p: Permission) => {
    try {
      await apiJson(`/api/permissions`, { method: "DELETE", body: JSON.stringify({ id: p.id }) });
      toast.success("Permiso eliminado");
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <FilterSearch
            className="sm:w-72"
            placeholder="Buscar permiso…"
            value={search}
            onValueChange={setSearch}
          />
          <FilterSelect
            className="sm:w-56"
            isDisabled
            label="Estado"
            options={[{ value: "all", label: "Todos" }]}
            value="all"
            onChange={() => {}}
          />
        </div>

        <div className="flex gap-2">
          <Button color="primary" onPress={() => { setEditing(null); setModalOpen(true); }}>
            Crear permiso
          </Button>
          <Button variant="flat" onPress={refresh}>
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton ariaLabel="Permisos" headers={["Nombre", "Acciones"]} />
      ) : (
        <Table aria-label="Permisos">
          <TableHeader>
            <TableColumn>Nombre</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody items={filtered} emptyContent={emptyContent}>
            {(p) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell className="flex gap-2">
                  <Button size="sm" variant="flat" onPress={() => { setEditing(p); setModalOpen(true); }}>
                    Editar
                  </Button>
                  <Button size="sm" color="danger" variant="flat" onPress={() => remove(p)}>
                    Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {data ? <Pager data={data} page={page} onChange={setPage} /> : null}

      <PermissionModal permission={editing} isOpen={modalOpen} onOpenChange={setModalOpen} onSaved={refresh} />
    </div>
  );
}
