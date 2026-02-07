"use client";

import type { Employee } from "../../_lib/types";

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
import { useReferenceData } from "../../_hooks/use-reference-data";
import { Pager } from "../ui/pager";
import { TableSkeleton } from "../ui/table-skeleton";
import { FilterSearch } from "../ui/filter-search";
import { FilterSelect } from "../ui/filter-select";

import { EmployeeModal } from "./employee-modal";

import { ConfirmActionModal } from "@/components/confirm-action-modal";

type StatusFilter = "all" | "active" | "inactive";

export function EmployeesTab() {
  const {
    roles,
    users,
    roleNameById,
    refresh: refreshRefs,
  } = useReferenceData();
  const { data, loading, page, setPage, refresh } = usePaginatedApi<Employee>(
    "/api/employees",
    10,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Employee | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();

    return items.filter((e) => {
      if (status === "active" && !e.isActive) return false;
      if (status === "inactive" && e.isActive) return false;
      if (!q) return true;

      const roleName = e.roleId ? (roleNameById.get(e.roleId) ?? e.roleId) : "";
      const userId = e.userId ?? "";

      return (
        e.name.toLowerCase().includes(q) ||
        userId.toLowerCase().includes(q) ||
        roleName.toLowerCase().includes(q)
      );
    });
  }, [data, roleNameById, search, status]);
  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (search.trim() !== "" || status !== "all") return "Sin resultados";

    return "Sin empleados";
  }, [loading, search, status]);

  const onSaved = () => {
    refreshRefs();
    refresh();
  };

  const remove = async () => {
    const e = pendingDelete;

    if (!e) return;
    if (deletingId) return;

    setDeletingId(e.id);
    try {
      await apiJson(`/api/employees`, {
        method: "DELETE",
        body: JSON.stringify({ id: e.id }),
      });
      toast.success("Empleado eliminado");
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <FilterSearch
            className="sm:w-72"
            placeholder="Buscar por nombre, rol o usuario…"
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
          <Button
            color="primary"
            onPress={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            Crear empleado
          </Button>
          <Button variant="flat" onPress={onSaved}>
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Empleados"
          headers={["Nombre", "Usuario", "Rol", "Activo", "Acciones"]}
        />
      ) : (
        <Table aria-label="Empleados">
          <TableHeader>
            <TableColumn>Nombre</TableColumn>
            <TableColumn>Usuario</TableColumn>
            <TableColumn>Rol</TableColumn>
            <TableColumn>Activo</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={filtered}>
            {(e) => (
              <TableRow key={e.id}>
                <TableCell>{e.name}</TableCell>
                <TableCell className="text-default-500">
                  {e.userId ?? "-"}
                </TableCell>
                <TableCell>
                  {e.roleId ? (roleNameById.get(e.roleId) ?? e.roleId) : "-"}
                </TableCell>
                <TableCell>{e.isActive ? "Sí" : "No"}</TableCell>
                <TableCell className="flex gap-2">
                  <Button
                    isDisabled={Boolean(deletingId)}
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      setEditing(e);
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
                      setPendingDelete(e);
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

      <EmployeeModal
        employee={editing}
        isOpen={modalOpen}
        roles={roles}
        users={users}
        onOpenChange={setModalOpen}
        onSaved={onSaved}
      />

      <ConfirmActionModal
        cancelLabel="Cancelar"
        confirmLabel="Eliminar"
        description={
          pendingDelete
            ? `¿Eliminar el empleado ${pendingDelete.name}?`
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
