"use client";

import type { RolePermission } from "../../_lib/types";

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
import { BsThreeDotsVertical, BsTrash } from "react-icons/bs";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { usePaginatedApi } from "../../_hooks/use-paginated-api";
import { useReferenceData } from "../../_hooks/use-reference-data";
import { Pager } from "../ui/pager";
import { TableSkeleton } from "../ui/table-skeleton";
import { FilterSearch } from "../ui/filter-search";
import { FilterSelect } from "../ui/filter-select";

import { RolePermissionsModal } from "./role-permissions-modal";

import { ConfirmActionModal } from "@/components/confirm-action-modal";

export function RolePermissionsTab() {
  const {
    roles,
    permissions,
    roleNameById,
    permNameById,
    refresh: refreshRefs,
  } = useReferenceData();
  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<RolePermission>("/api/role-permissions", 10);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<RolePermission | null>(
    null,
  );
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();

    if (!q) return items;

    return items.filter((rp) => {
      const roleLabel = rp.roleId
        ? (roleNameById.get(rp.roleId) ?? rp.roleId)
        : "";
      const permLabel = rp.permissionId
        ? (permNameById.get(rp.permissionId) ?? rp.permissionId)
        : "";

      return (
        roleLabel.toLowerCase().includes(q) ||
        permLabel.toLowerCase().includes(q)
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

  const remove = async () => {
    const rp = pendingDelete;

    if (!rp?.roleId || !rp?.permissionId) return;
    if (deletingKey) return;

    const key = `${rp.roleId}:${rp.permissionId}`;

    setDeletingKey(key);
    try {
      await apiJson(`/api/role-permissions`, {
        method: "DELETE",
        body: JSON.stringify({
          roleId: rp.roleId,
          permissionId: rp.permissionId,
        }),
      });
      toast.success("Relación eliminada");
      setConfirmOpen(false);
      setPendingDelete(null);
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDeletingKey(null);
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
            isDisabled
            className="sm:w-56"
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
        <TableSkeleton
          ariaLabel="Relaciones rol-permiso"
          headers={["Rol", "Permiso", "Acciones"]}
        />
      ) : (
        <Table aria-label="Relaciones rol-permiso">
          <TableHeader>
            <TableColumn>Rol</TableColumn>
            <TableColumn>Permiso</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={filtered}>
            {(rp) => (
              <TableRow key={`${rp.roleId}:${rp.permissionId}`}>
                <TableCell>
                  {rp.roleId ? (roleNameById.get(rp.roleId) ?? rp.roleId) : "-"}
                </TableCell>
                <TableCell>
                  {rp.permissionId
                    ? (permNameById.get(rp.permissionId) ?? rp.permissionId)
                    : "-"}
                </TableCell>
                <TableCell>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        isDisabled={Boolean(deletingKey)}
                        size="sm"
                        variant="flat"
                      >
                        <BsThreeDotsVertical />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Acciones">
                      <DropdownItem
                        key="delete"
                        className="text-danger"
                        startContent={<BsTrash />}
                        onPress={() => {
                          setPendingDelete(rp);
                          setConfirmOpen(true);
                        }}
                      >
                        Eliminar
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {data ? <Pager data={data} page={page} onChange={setPage} /> : null}

      <RolePermissionsModal
        isOpen={modalOpen}
        permissions={permissions}
        roles={roles}
        onCreated={onCreated}
        onOpenChange={setModalOpen}
      />

      <ConfirmActionModal
        cancelLabel="Cancelar"
        confirmLabel="Eliminar"
        description={
          pendingDelete?.roleId && pendingDelete?.permissionId
            ? `¿Eliminar la relación ${roleNameById.get(pendingDelete.roleId) ?? pendingDelete.roleId} → ${permNameById.get(pendingDelete.permissionId) ?? pendingDelete.permissionId}?`
            : undefined
        }
        isLoading={
          Boolean(deletingKey) &&
          deletingKey ===
            `${pendingDelete?.roleId ?? ""}:${pendingDelete?.permissionId ?? ""}`
        }
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
