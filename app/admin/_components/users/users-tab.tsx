"use client";

import type { AdminUser } from "../../_lib/types";

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
import { BsPencilSquare, BsThreeDotsVertical, BsTrash } from "react-icons/bs";

import { usePaginatedApi } from "../../_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "../../_lib/api";
import { Pager } from "../ui/pager";
import { TableSkeleton } from "../ui/table-skeleton";
import { FilterSearch } from "../ui/filter-search";
import { FilterSelect } from "../ui/filter-select";

import { EditUserModal } from "./edit-user-modal";
import { CreateUserModal } from "./create-user-modal";

import { ConfirmActionModal } from "@/components/confirm-action-modal";

type StatusFilter = "all" | "active" | "inactive";

export function UsersTab() {
  const { data, loading, page, setPage, refresh } = usePaginatedApi<AdminUser>(
    "/api/admin/users",
    10,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);

  const deleteUser = async () => {
    const u = pendingDelete;

    if (!u) return;
    if (deletingId) return;

    setDeletingId(u.id);
    try {
      await apiJson(`/api/admin/users`, {
        method: "DELETE",
        body: JSON.stringify({ id: u.id }),
      });
      toast.success("Usuario eliminado");
      setConfirmOpen(false);
      setPendingDelete(null);
      refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();

    return items.filter((u) => {
      if (status === "active" && !u.isActive) return false;
      if (status === "inactive" && u.isActive) return false;
      if (!q) return true;

      return u.email.toLowerCase().includes(q);
    });
  }, [data, search, status]);

  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (search.trim() !== "" || status !== "all") return "Sin resultados";

    return "Sin usuarios";
  }, [loading, search, status]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <FilterSearch
            className="sm:w-72"
            placeholder="Buscar por email…"
            value={search}
            onValueChange={setSearch}
          />
          <FilterSelect
            className="sm:w-56"
            label="Estado"
            options={[
              { value: "all", label: "Todos" },
              { value: "active", label: "Activos" },
              { value: "inactive", label: "Desactivados" },
            ]}
            value={status}
            onChange={(v) => setStatus(v as StatusFilter)}
          />
        </div>

        <div className="flex gap-2">
          <Button color="primary" onPress={() => setCreateOpen(true)}>
            Crear usuario
          </Button>
          <Button variant="flat" onPress={refresh}>
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Usuarios"
          headers={["Email", "Activo", "Verificado", "Acciones"]}
        />
      ) : (
        <Table aria-label="Usuarios">
          <TableHeader>
            <TableColumn>Email</TableColumn>
            <TableColumn>Activo</TableColumn>
            <TableColumn>Verificado</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={filtered}>
            {(u) => (
              <TableRow key={u.id}>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.isActive ? "Sí" : "No"}</TableCell>
                <TableCell>{u.emailVerified ? "Sí" : "No"}</TableCell>
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
                      <DropdownItem
                        key="edit"
                        startContent={<BsPencilSquare />}
                        onPress={() => {
                          setEditingUser(u);
                          setEditOpen(true);
                        }}
                      >
                        Editar
                      </DropdownItem>
                      <DropdownItem
                        key="delete"
                        className="text-danger"
                        startContent={<BsTrash />}
                        onPress={() => {
                          setPendingDelete(u);
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

      <CreateUserModal
        isOpen={createOpen}
        onCreated={refresh}
        onOpenChange={setCreateOpen}
      />
      <EditUserModal
        isOpen={editOpen}
        user={editingUser}
        onOpenChange={setEditOpen}
        onSaved={refresh}
      />

      <ConfirmActionModal
        cancelLabel="Cancelar"
        confirmLabel="Eliminar"
        description={
          pendingDelete
            ? `¿Eliminar el usuario ${pendingDelete.email}? Esto también eliminará el empleado asociado.`
            : undefined
        }
        isLoading={Boolean(deletingId)}
        isOpen={confirmOpen}
        title="Confirmar eliminación"
        onConfirm={deleteUser}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
          setConfirmOpen(open);
        }}
      />
    </div>
  );
}
