"use client";

import type { Paginated } from "@/app/catalog/_lib/types";
import type { ConfectionistFormPrefill } from "./confectionist-modal.types";
import type { ClientFormPrefill } from "@/app/admin/_components/clients/client-modal.types";

import { useEffect, useMemo, useState } from "react";
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
import { BsPencilSquare, BsThreeDotsVertical, BsTrash, BsPersonPlus } from "react-icons/bs";

import { FilterSearch } from "@/app/catalog/_components/ui/filter-search";
import { FilterSelect } from "@/app/catalog/_components/ui/filter-select";
import { Pager } from "@/app/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/catalog/_components/ui/table-skeleton";
import { usePaginatedApi } from "@/app/catalog/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/catalog/_lib/api";
import { ConfirmActionModal } from "@/components/confirm-action-modal";

import { ConfectionistModal } from "./confectionist-modal";

export type Confectionist = {
  id: string;
  confectionistCode: string | null;
  name: string;
  identificationType: string;
  identification: string;
  dv: string | null;
  type: string | null;
  taxRegime: string;
  contactName: string | null;
  email: string | null;
  intlDialCode: string | null;
  mobile: string | null;
  fullMobile: string | null;
  landline: string | null;
  extension: string | null;
  address: string;
  postalCode: string | null;
  country: string | null;
  department: string | null;
  city: string | null;
  isActive: boolean | null;
  createdAt: string | null;
};

type StatusFilter = "all" | "active" | "inactive";

export function ConfectionistsTab({
  canCreate,
  canEdit,
  canDelete,
  prefillCreate,
  onPrefillConsumed,
  onRequestCreateClient,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  prefillCreate?: ConfectionistFormPrefill | null;
  onPrefillConsumed?: () => void;
  onRequestCreateClient?: (prefill: ClientFormPrefill) => void;
}) {
  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<Confectionist>("/api/confectionists", 10);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Confectionist | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [modalPrefill, setModalPrefill] = useState<ConfectionistFormPrefill | null>(
    null,
  );

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Confectionist | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!prefillCreate) return;
    setEditing(null);
    setModalPrefill(prefillCreate);
    setModalOpen(true);
    onPrefillConsumed?.();
  }, [prefillCreate, onPrefillConsumed]);

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();

    return items.filter((c) => {
      if (status === "active" && !c.isActive) return false;
      if (status === "inactive" && c.isActive) return false;
      if (!q) return true;

      const code = c.confectionistCode ?? "";
      const identification = c.identification ?? "";
      const email = c.email ?? "";
      const mobile = c.mobile ?? "";
      const type = c.type ?? "";

      return (
        c.name.toLowerCase().includes(q) ||
        code.toLowerCase().includes(q) ||
        identification.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        mobile.toLowerCase().includes(q) ||
        type.toLowerCase().includes(q)
      );
    });
  }, [data, search, status]);

  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (search.trim() !== "" || status !== "all") return "Sin resultados";

    return "Sin confeccionistas";
  }, [loading, search, status]);

  const remove = async () => {
    const c = pendingDelete;

    if (!c) return;
    if (deletingId) return;

    setDeletingId(c.id);
    try {
      await apiJson(`/api/confectionists`, {
        method: "DELETE",
        body: JSON.stringify({ id: c.id }),
      });
      toast.success("Confeccionista eliminado");
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
            placeholder="Buscar por nombre, tipo o teléfono…"
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
              Crear confeccionista
            </Button>
          ) : null}
          <Button variant="flat" onPress={refresh}>
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Confeccionistas"
          headers={[
            "Código",
            "Nombre",
            "Identificación",
            "Email",
            "Móvil",
            "Tipo",
            "Activo",
            "Acciones",
          ]}
        />
      ) : (
        <Table aria-label="Confeccionistas">
          <TableHeader>
            <TableColumn>Código</TableColumn>
            <TableColumn>Nombre</TableColumn>
            <TableColumn>Identificación</TableColumn>
            <TableColumn>Email</TableColumn>
            <TableColumn>Móvil</TableColumn>
            <TableColumn>Tipo</TableColumn>
            <TableColumn>Activo</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={filtered}>
            {(c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs text-primary">
                  {c.confectionistCode ?? "—"}
                </TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-default-500">
                  {c.identificationType} {c.identification}
                </TableCell>
                <TableCell className="text-default-500">{c.email ?? "-"}</TableCell>
                <TableCell className="text-default-500">
                  {c.fullMobile ?? c.mobile ?? "-"}
                </TableCell>
                <TableCell className="text-default-500">{c.type ?? "-"}</TableCell>
                <TableCell>{c.isActive ? "Sí" : "No"}</TableCell>
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
                        key="to-client"
                        startContent={<BsPersonPlus />}
                        onPress={() => {
                          if (!onRequestCreateClient) {
                            toast(
                              "Navega a la página de administración para crear desde un confeccionista",
                              { icon: "🚧" },
                            );

                            return;
                          }

                          onRequestCreateClient({
                            clientType: "NACIONAL",
                            name: c.name,
                            identificationType: c.identificationType,
                            identification: c.identification,
                            dv: c.dv ?? "",
                            branch: "01",
                            taxRegime: c.taxRegime,
                            contactName: c.contactName ?? c.name,
                            email: c.email ?? "",
                            address: c.address,
                            postalCode: c.postalCode ?? "",
                            country: c.country ?? "COLOMBIA",
                            department: c.department ?? "ANTIOQUIA",
                            city: c.city ?? "Medellín",
                            intlDialCode: c.intlDialCode ?? "57",
                            mobile: c.mobile ?? "",
                            localDialCode: "",
                            landline: c.landline ?? "",
                            extension: c.extension ?? "",
                            status: "ACTIVO",
                            priceClientType: "VIOMAR",
                            isActive: Boolean(c.isActive ?? true),
                            hasCredit: false,
                            promissoryNoteNumber: "",
                            promissoryNoteDate: "",
                          });
                        }}
                      >
                        Crear como cliente
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

      {data ? (
        <Pager
          data={data as Paginated<Confectionist>}
          page={page}
          onChange={setPage}
        />
      ) : null}

      <ConfectionistModal
        confectionist={editing}
        prefill={modalPrefill}
        isOpen={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setEditing(null);
            setModalPrefill(null);
          }
        }}
        onSaved={refresh}
      />

      <ConfirmActionModal
        cancelLabel="Cancelar"
        confirmLabel="Eliminar"
        description={
          pendingDelete
            ? `¿Eliminar el confeccionista ${pendingDelete.name}?`
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
