"use client";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/table";

import type { RolePermission } from "../../_lib/types";
import { apiJson, getErrorMessage } from "../../_lib/api";
import { usePaginatedApi } from "../../_hooks/use-paginated-api";
import { useReferenceData } from "../../_hooks/use-reference-data";
import { Pager } from "../ui/pager";
import { TableSkeleton } from "../ui/table-skeleton";
import { FilterSearch } from "../ui/filter-search";
import { FilterSelect } from "../ui/filter-select";
import { RolePermissionsModal } from "./role-permissions-modal";

export function RolePermissionsTab() {
  const { roles, permissions, roleNameById, permNameById, refresh: refreshRefs } = useReferenceData();
  const { data, loading, page, setPage, refresh } = usePaginatedApi<RolePermission>("/api/role-permissions", 10);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((rp) => {
      const roleLabel = rp.roleId ? roleNameById.get(rp.roleId) ?? rp.roleId : "";
      const permLabel = rp.permissionId
        ? permNameById.get(rp.permissionId) ?? rp.permissionId
        : "";

      return (
        roleLabel.toLowerCase().includes(q) || permLabel.toLowerCase().includes(q)
      );
    });
  }, [data, permNameById, roleNameById, search]);

  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (search.trim() !== "") return "Sin resultados";
    return "Sin relaciones";
  }, [loading, search]);

  const onCreated = () => {
    refreshRefs();
    refresh();
  };

  const remove = async (rp: RolePermission) => {
    if (!rp.roleId || !rp.permissionId) return;
    try {
      await apiJson(`/api/role-permissions`, { method: "DELETE", body: JSON.stringify({ roleId: rp.roleId, permissionId: rp.permissionId }) });
      toast.success("Relación eliminada");
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
            placeholder="Buscar por rol o permiso…"
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
          <Button color="primary" onPress={() => setModalOpen(true)}>
            Crear relación
          </Button>
          <Button variant="flat" onPress={onCreated}>
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton ariaLabel="Relaciones rol-permiso" headers={["Rol", "Permiso", "Acciones"]} />
      ) : (
        <Table aria-label="Relaciones rol-permiso">
          <TableHeader>
            <TableColumn>Rol</TableColumn>
            <TableColumn>Permiso</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody items={filtered} emptyContent={emptyContent}>
            {(rp) => (
              <TableRow key={`${rp.roleId}:${rp.permissionId}`}>
                <TableCell>{rp.roleId ? roleNameById.get(rp.roleId) ?? rp.roleId : "-"}</TableCell>
                <TableCell>{rp.permissionId ? permNameById.get(rp.permissionId) ?? rp.permissionId : "-"}</TableCell>
                <TableCell>
                  <Button size="sm" color="danger" variant="flat" onPress={() => remove(rp)}>
                    Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {data ? <Pager data={data} page={page} onChange={setPage} /> : null}

      <RolePermissionsModal roles={roles} permissions={permissions} isOpen={modalOpen} onOpenChange={setModalOpen} onCreated={onCreated} />
    </div>
  );
}
