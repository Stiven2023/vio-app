"use client";

import { useMemo, useState } from "react";
import { Button } from "@heroui/button";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/table";

import type { AdminUser } from "../../_lib/types";
import { usePaginatedApi } from "../../_hooks/use-paginated-api";
import { CreateUserModal } from "./create-user-modal";
import { EditUserModal } from "./edit-user-modal";
import { Pager } from "../ui/pager";
import { TableSkeleton } from "../ui/table-skeleton";
import { FilterSearch } from "../ui/filter-search";
import { FilterSelect } from "../ui/filter-select";

type StatusFilter = "all" | "active" | "inactive";

export function UsersTab() {
  const { data, loading, page, setPage, refresh } = usePaginatedApi<AdminUser>("/api/admin/users", 10);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

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
          <TableBody items={filtered} emptyContent={emptyContent}>
            {(u) => (
              <TableRow key={u.id}>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.isActive ? "Sí" : "No"}</TableCell>
                <TableCell>{u.emailVerified ? "Sí" : "No"}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      setEditingUser(u);
                      setEditOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {data ? <Pager data={data} page={page} onChange={setPage} /> : null}

      <CreateUserModal isOpen={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
      <EditUserModal user={editingUser} isOpen={editOpen} onOpenChange={setEditOpen} onSaved={refresh} />
    </div>
  );
}
