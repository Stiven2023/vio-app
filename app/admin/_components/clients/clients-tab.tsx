"use client";

import type { Client } from "../../_lib/types";

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
import {
  BsPencilSquare,
  BsThreeDotsVertical,
  BsTrash,
  BsEyeFill,
} from "react-icons/bs";
import { Chip } from "@heroui/chip";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { usePaginatedApi } from "../../_hooks/use-paginated-api";
import { Pager } from "../ui/pager";
import { TableSkeleton } from "../ui/table-skeleton";
import { FilterSearch } from "../ui/filter-search";
import { FilterSelect } from "../ui/filter-select";

import { ClientModal } from "./client-modal";
import { ClientDetailsModal } from "./client-details-modal";

import { ConfirmActionModal } from "@/components/confirm-action-modal";

type StatusFilter = "all" | "active" | "inactive";

export function ClientsTab({
  canCreate = true,
  canEdit = true,
  canDelete = true,
}: {
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
} = {}) {
  const { data, loading, page, setPage, refresh } = usePaginatedApi<Client>(
    "/api/clients",
    10,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [viewing, setViewing] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();

    return items.filter((c) => {
      if (status === "active" && !c.isActive) return false;
      if (status === "inactive" && c.isActive) return false;
      if (!q) return true;

      const email = c.email ?? "";
      const mobile = c.mobile ?? "";
      const contactName = c.contactName ?? "";
      const clientCode = c.clientCode ?? "";
      const priceClientType = c.priceClientType ?? "";

      return (
        c.name.toLowerCase().includes(q) ||
        c.identification.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        mobile.toLowerCase().includes(q) ||
        contactName.toLowerCase().includes(q) ||
        clientCode.toLowerCase().includes(q) ||
        priceClientType.toLowerCase().includes(q)
      );
    });
  }, [data, search, status]);

  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (search.trim() !== "" || status !== "all") return "Sin resultados";

    return "Sin clientes";
  }, [loading, search, status]);

  const onSaved = () => {
    refresh();
  };

  const remove = async () => {
    const c = pendingDelete;

    if (!c) return;
    if (deletingId) return;

    setDeletingId(c.id);
    try {
      await apiJson(`/api/clients`, {
        method: "DELETE",
        body: JSON.stringify({ id: c.id }),
      });
      toast.success("Cliente eliminado");
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
            placeholder="Buscar por código, nombre, identificación, email, móvil…"
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
          {canCreate ? (
            <Button
              color="primary"
              onPress={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              Crear cliente
            </Button>
          ) : null}
          <Button variant="flat" onPress={onSaved}>
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Clientes"
          headers={[
            "Código",
            "Nombre",
            "Tipo ID",
            "Identificación",
            "Tipo precio COP",
            "Email",
            "Móvil",
            "Estado",
            "Acciones",
          ]}
        />
      ) : (
        <Table aria-label="Clientes">
          <TableHeader>
            <TableColumn>CÓDIGO</TableColumn>
            <TableColumn>NOMBRE</TableColumn>
            <TableColumn>TIPO ID</TableColumn>
            <TableColumn>IDENTIFICACIÓN</TableColumn>
            <TableColumn>TIPO PRECIO COP</TableColumn>
            <TableColumn>EMAIL</TableColumn>
            <TableColumn>MÓVIL</TableColumn>
            <TableColumn>ESTADO</TableColumn>
            <TableColumn>ACCIONES</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={filtered}>
            {(c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Chip
                    color={
                      c.clientType === "NACIONAL"
                        ? "primary"
                        : c.clientType === "EXTRANJERO"
                          ? "secondary"
                          : "warning"
                    }
                    size="sm"
                    variant="flat"
                  >
                    {c.clientCode}
                  </Chip>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-default-500">
                      {c.contactName}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat">
                    {c.identificationType}
                  </Chip>
                </TableCell>
                <TableCell className="font-mono text-xs text-default-600">
                  {c.identification}
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat">
                    {c.priceClientType === "AUTORIZADO"
                      ? "Autorizado"
                      : c.priceClientType === "MAYORISTA"
                        ? "Mayorista"
                        : c.priceClientType === "COLANTA"
                          ? "Colanta"
                          : "Viomar"}
                  </Chip>
                </TableCell>
                <TableCell className="text-sm text-default-500">
                  <span className="flex items-center gap-1">
                    <span className="text-danger" title="Campo crítico">
                      *
                    </span>
                    {c.email}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-default-500">
                  <span className="flex items-center gap-1">
                    <span className="text-danger" title="Campo crítico">
                      *
                    </span>
                    {c.fullMobile || c.mobile || "-"}
                  </span>
                </TableCell>
                <TableCell>
                  <Chip
                    color={
                      c.status === "ACTIVO"
                        ? "success"
                        : c.status === "SUSPENDIDO"
                          ? "warning"
                          : "default"
                    }
                    size="sm"
                    variant="flat"
                  >
                    {c.status || (c.isActive ? "Activo" : "Inactivo")}
                  </Chip>
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
                      <DropdownItem
                        key="view"
                        startContent={<BsEyeFill />}
                        onPress={() => {
                          setViewing(c);
                          setDetailsOpen(true);
                        }}
                      >
                        Ver detalles completos
                      </DropdownItem>
                      {canEdit ? (
                        <DropdownItem
                          key="edit"
                          startContent={<BsPencilSquare />}
                          onPress={() => {
                            setEditing(c);
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
                            setPendingDelete(c);
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

      <ClientModal
        client={editing}
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={onSaved}
      />

      <ClientDetailsModal
        client={viewing}
        isOpen={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <ConfirmActionModal
        cancelLabel="Cancelar"
        confirmLabel="Eliminar"
        description={
          pendingDelete
            ? `¿Eliminar el cliente ${pendingDelete.name}?`
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
