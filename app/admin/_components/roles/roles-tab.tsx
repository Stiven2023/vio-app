"use client";

import type { Role } from "../../_lib/types";

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

import { apiJson, getErrorMessage } from "../../_lib/api";
import { usePaginatedApi } from "../../_hooks/use-paginated-api";
import { Pager } from "../ui/pager";
import { TableSkeleton } from "../ui/table-skeleton";
import { FilterSearch } from "../ui/filter-search";
import { FilterSelect } from "../ui/filter-select";

import { RoleModal } from "./role-modal";

import { ConfirmActionModal } from "@/components/confirm-action-modal";

const ROLE_HIERARCHY: Record<string, number> = {
  ADMINISTRADOR: 1,
  LIDER_JURIDICA: 2,
  LIDER_FINANCIERA: 2,
  LIDER_COMERCIAL: 2,
  LIDER_SUMINISTROS: 2,
  LIDER_DISEÑO: 2,
  LIDER_OPERACIONAL: 2,
  RH: 3,
  AUXILIAR_RH: 3,
  AUXILIAR_CONTABLE: 3,
  TESORERIA_Y_CARTERA: 3,
  ASESOR: 3,
  COMPRA_NACIONAL: 3,
  COMPRA_INTERNACIONAL: 3,
  DISEÑADOR: 3,
  PROGRAMACION: 3,
  OPERARIO_DESPACHO: 4,
  OPERARIO_BODEGA: 4,
  OPERARIO_FLOTER: 4,
  OPERARIO_SUBLIMACION: 4,
  OPERARIO_CORTE_MANUAL: 4,
  OPERARIO_CORTE_LASER: 4,
  OPERARIO_INTEGRACION_CALIDAD: 4,
  OPERARIO_MONTAJE: 4,
  MENSAJERO: 4,
  CONFECCIONISTA: 4,
  EMPAQUE: 4,
};

function getRoleLevel(roleName: string) {
  return ROLE_HIERARCHY[roleName] ?? 99;
}

const ROLE_BRANCHES: Array<{ leader: string; children: string[] }> = [
  { leader: "LIDER_JURIDICA", children: [] },
  { leader: "LIDER_FINANCIERA", children: ["AUXILIAR_CONTABLE", "TESORERIA_Y_CARTERA"] },
  { leader: "LIDER_COMERCIAL", children: ["ASESOR"] },
  { leader: "LIDER_SUMINISTROS", children: ["COMPRA_NACIONAL", "COMPRA_INTERNACIONAL"] },
  { leader: "LIDER_DISEÑO", children: ["DISEÑADOR"] },
  {
    leader: "LIDER_OPERACIONAL",
    children: [
      "PROGRAMACION",
      "OPERARIO_DESPACHO",
      "OPERARIO_BODEGA",
      "OPERARIO_FLOTER",
      "OPERARIO_SUBLIMACION",
      "OPERARIO_CORTE_MANUAL",
      "OPERARIO_CORTE_LASER",
      "OPERARIO_INTEGRACION_CALIDAD",
      "OPERARIO_MONTAJE",
      "MENSAJERO",
      "CONFECCIONISTA",
      "EMPAQUE",
    ],
  },
  { leader: "RH", children: ["AUXILIAR_RH"] },
];

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

    const sorted = [...items].sort((a, b) => {
      const levelDiff = getRoleLevel(a.name) - getRoleLevel(b.name);
      if (levelDiff !== 0) return levelDiff;
      return a.name.localeCompare(b.name, "es");
    });

    if (!q) return sorted;

    return sorted.filter((r) => r.name.toLowerCase().includes(q));
  }, [data, search]);

  const roleTree = useMemo(() => {
    const names = new Set((data?.items ?? []).map((role) => role.name));
    const adminExists = names.has("ADMINISTRADOR");

    const branches = ROLE_BRANCHES.map((branch) => ({
      leader: branch.leader,
      leaderExists: names.has(branch.leader),
      children: branch.children.filter((name) => names.has(name)),
    })).filter((branch) => branch.leaderExists || branch.children.length > 0);

    return { adminExists, branches };
  }, [data]);

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

      <div className="rounded-large border border-default-200 p-4">
        <p className="text-sm font-semibold">Árbol jerárquico de roles</p>
        <p className="mt-1 text-xs text-default-500">
          Estructura tipo organigrama con ADMINISTRADOR en la raíz y ramas por área.
        </p>

        <div className="mt-3">
          <div className="flex justify-center">
            <span className="rounded-medium border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {roleTree.adminExists ? "ADMINISTRADOR" : "ADMINISTRADOR (pendiente)"}
            </span>
          </div>

          <div className="my-2 text-center text-default-400">↓</div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {roleTree.branches.map((branch) => (
              <div key={branch.leader} className="rounded-medium border border-default-200 p-3">
                <div className="text-center">
                  <span className="rounded-medium border border-default-300 bg-default-100 px-2 py-1 text-xs font-medium">
                    {branch.leader}
                  </span>
                </div>

                {branch.children.length > 0 ? (
                  <>
                    <div className="my-2 text-center text-default-400">↓</div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {branch.children.map((child) => (
                        <span
                          key={child}
                          className="rounded-medium border border-default-200 bg-default-50 px-2 py-1 text-xs"
                        >
                          {child}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Roles"
          headers={["Nombre", "Jerarquía", "Acciones"]}
        />
      ) : (
        <Table aria-label="Roles">
          <TableHeader>
            <TableColumn>Nombre</TableColumn>
            <TableColumn>Jerarquía</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={filtered}>
            {(r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell>{`Nivel ${getRoleLevel(r.name)}`}</TableCell>
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
                          setEditing(r);
                          setModalOpen(true);
                        }}
                      >
                        Editar
                      </DropdownItem>
                      <DropdownItem
                        key="delete"
                        className="text-danger"
                        startContent={<BsTrash />}
                        onPress={() => {
                          setPendingDelete(r);
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
