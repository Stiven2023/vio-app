"use client";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/table";

import type { Role } from "../../_lib/types";
import { apiJson, getErrorMessage } from "../../_lib/api";
import { usePaginatedApi } from "../../_hooks/use-paginated-api";
import { Pager } from "../ui/pager";
import { TableSkeleton } from "../ui/table-skeleton";
import { FilterSearch } from "../ui/filter-search";
import { FilterSelect } from "../ui/filter-select";
import { RoleModal } from "./role-modal";

export function RolesTab() {
  const { data, loading, page, setPage, refresh } = usePaginatedApi<Role>("/api/roles", 10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [search, setSearch] = useState("");

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

  const remove = async (r: Role) => {
    try {
      await apiJson(`/api/roles`, { method: "DELETE", body: JSON.stringify({ id: r.id }) });
      toast.success("Rol eliminado");
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
            placeholder="Buscar rol…"
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
          <TableBody items={filtered} emptyContent={emptyContent}>
            {(r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell className="flex gap-2">
                  <Button size="sm" variant="flat" onPress={() => { setEditing(r); setModalOpen(true); }}>
                    Editar
                  </Button>
                  <Button size="sm" color="danger" variant="flat" onPress={() => remove(r)}>
                    Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {data ? <Pager data={data} page={page} onChange={setPage} /> : null}

      <RoleModal role={editing} isOpen={modalOpen} onOpenChange={setModalOpen} onSaved={refresh} />
    </div>
  );
}
