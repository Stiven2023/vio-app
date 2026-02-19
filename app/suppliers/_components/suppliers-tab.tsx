"use client";

import type { Paginated } from "@/app/catalog/_lib/types";

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
import { Input } from "@heroui/input";
import { BsPencilSquare, BsThreeDotsVertical, BsTrash, BsEyeFill } from "react-icons/bs";

import { FilterSelect } from "@/app/catalog/_components/ui/filter-select";
import { Pager } from "@/app/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/catalog/_components/ui/table-skeleton";
import { usePaginatedApi } from "@/app/catalog/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/catalog/_lib/api";
import { ConfirmActionModal } from "@/components/confirm-action-modal";

import { SupplierModal } from "./supplier-modal";
import { SupplierDetailsModal } from "./supplier-details-modal";

export type Supplier = {
  id: string;
  supplierCode: string;
  name: string;
  identificationType: string;
  identification: string;
  dv?: string;
  branch: string;
  taxRegime: string;
  contactName: string;
  email: string;
  address: string;
  postalCode?: string;
  country: string;
  department: string;
  city: string;
  intlDialCode: string;
  mobile?: string;
  fullMobile?: string;
  localDialCode?: string;
  landline?: string;
  extension?: string;
  fullLandline?: string;
  isActive?: boolean;
  hasCredit?: boolean;
  promissoryNoteNumber?: string;
  promissoryNoteDate?: string;
};

type StatusFilter = "all" | "active" | "inactive";

export function SuppliersTab({
  canCreate,
  canEdit,
  canDelete,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<Supplier>("/api/suppliers", 10);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewing, setViewing] = useState<Supplier | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Supplier | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();

    return items.filter((s) => {
      if (status === "active" && !s.isActive) return false;
      if (status === "inactive" && s.isActive) return false;
      if (!q) return true;

      const email = s.email ?? "";
      const contactName = s.contactName ?? "";

      return (
        s.name.toLowerCase().includes(q) ||
        s.supplierCode.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        contactName.toLowerCase().includes(q)
      );
    });
  }, [data, search, status]);

  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (search.trim() !== "" || status !== "all") return "Sin resultados";

    return "Sin proveedores";
  }, [loading, search, status]);

  const remove = async () => {
    const s = pendingDelete;

    if (!s) return;
    if (deletingId) return;

    setDeletingId(s.id);
    try {
      await apiJson(`/api/suppliers`, {
        method: "DELETE",
        body: JSON.stringify({ id: s.id }),
      });
      toast.success("Proveedor eliminado");
      setConfirmOpen(false);
      setPendingDelete(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const createAsClient = async (supplier: Supplier) => {
    if (!supplier.email) {
      toast.error("Para crear como cliente, el proveedor debe tener email.");
      return;
    }

    try {
      await apiJson("/api/clients", {
        method: "POST",
        body: JSON.stringify({
          clientType: "NACIONAL",
          priceClientType: "VIOMAR",
          name: supplier.name,
          identificationType: supplier.identificationType,
          identification: supplier.identification,
          dv: supplier.dv ?? "",
          branch: supplier.branch,
          taxRegime: supplier.taxRegime,
          contactName: supplier.contactName,
          email: supplier.email,
          address: supplier.address,
          postalCode: supplier.postalCode ?? "",
          country: supplier.country,
          department: supplier.department,
          city: supplier.city,
          intlDialCode: supplier.intlDialCode,
          mobile: supplier.mobile ?? "",
          localDialCode: supplier.localDialCode ?? "",
          landline: supplier.landline ?? "",
          extension: supplier.extension ?? "",
          status: "ACTIVO",
          isActive: Boolean(supplier.isActive ?? true),
          hasCredit: Boolean(supplier.hasCredit ?? false),
          promissoryNoteNumber: supplier.promissoryNoteNumber ?? "",
          promissoryNoteDate: supplier.promissoryNoteDate ?? "",
        }),
      });

      toast.success("Cliente creado desde proveedor");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const createAsEmployee = async (supplier: Supplier) => {
    if (!supplier.email) {
      toast.error("Para crear como empleado, el proveedor debe tener email.");
      return;
    }

    try {
      await apiJson("/api/employees", {
        method: "POST",
        body: JSON.stringify({
          name: supplier.name,
          identificationType: supplier.identificationType,
          identification: supplier.identification,
          dv: supplier.dv ?? "",
          email: supplier.email,
          intlDialCode: supplier.intlDialCode,
          mobile: supplier.mobile ?? "",
          landline: supplier.landline ?? "",
          extension: supplier.extension ?? "",
          address: supplier.address,
          city: supplier.city,
          department: supplier.department,
          isActive: Boolean(supplier.isActive ?? true),
        }),
      });

      toast.success("Empleado creado desde proveedor");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const createAsConfectionist = async (supplier: Supplier) => {
    try {
      await apiJson("/api/confectionists", {
        method: "POST",
        body: JSON.stringify({
          name: supplier.name,
          identificationType: supplier.identificationType,
          identification: supplier.identification,
          dv: supplier.dv ?? "",
          type: "NACIONAL",
          taxRegime: supplier.taxRegime,
          contactName: supplier.contactName,
          email: supplier.email ?? "",
          intlDialCode: supplier.intlDialCode,
          mobile: supplier.mobile ?? "",
          fullMobile: supplier.fullMobile ?? "",
          landline: supplier.landline ?? "",
          extension: supplier.extension ?? "",
          address: supplier.address,
          postalCode: supplier.postalCode ?? "",
          country: supplier.country,
          department: supplier.department,
          city: supplier.city,
          isActive: Boolean(supplier.isActive ?? true),
        }),
      });

      toast.success("Confeccionista creado desde proveedor");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const createAsPacker = async (supplier: Supplier) => {
    try {
      await apiJson("/api/packers", {
        method: "POST",
        body: JSON.stringify({
          name: supplier.name,
          identificationType: supplier.identificationType,
          identification: supplier.identification,
          dv: supplier.dv ?? "",
          packerType: "EXTERNO",
          specialty: "",
          dailyCapacity: null,
          contactName: supplier.contactName,
          email: supplier.email ?? "",
          intlDialCode: supplier.intlDialCode,
          mobile: supplier.mobile ?? "",
          fullMobile: supplier.fullMobile ?? "",
          landline: supplier.landline ?? "",
          address: supplier.address,
          postalCode: supplier.postalCode ?? "",
          city: supplier.city,
          department: supplier.department,
          isActive: Boolean(supplier.isActive ?? true),
        }),
      });

      toast.success("Empaque creado desde proveedor");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Input
          className="sm:w-72"
          placeholder="Buscar por código, nombre, email o contacto…"
          value={search}
          onValueChange={setSearch}
          isClearable
          onClear={() => setSearch("")}
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
              Crear proveedor
            </Button>
          ) : null}
          <Button variant="flat" onPress={refresh}>
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Proveedores"
          headers={["Código", "Nombre", "Email", "Contacto", "Móvil", "Ciudad", "Activo", "Acciones"]}
        />
      ) : (
        <Table aria-label="Proveedores">
          <TableHeader>
            <TableColumn>Código</TableColumn>
            <TableColumn>Nombre</TableColumn>
            <TableColumn>Email</TableColumn>
            <TableColumn>Contacto</TableColumn>
            <TableColumn>Móvil</TableColumn>
            <TableColumn>Ciudad</TableColumn>
            <TableColumn>Activo</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={filtered}>
            {(s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.supplierCode}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-default-500">
                  {s.email ?? "-"}
                </TableCell>
                <TableCell className="text-default-500">
                  {s.contactName ?? "-"}
                </TableCell>
                <TableCell className="text-default-500">
                  {s.mobile ?? "-"}
                </TableCell>
                <TableCell className="text-default-500">
                  {s.city ?? "-"}
                </TableCell>
                <TableCell>{s.isActive ? "Sí" : "No"}</TableCell>
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
                          setViewing(s);
                          setDetailsOpen(true);
                        }}
                      >
                        Ver información completa
                      </DropdownItem>
                      {canEdit ? (
                        <DropdownItem
                          key="edit"
                          startContent={<BsPencilSquare />}
                          onPress={() => {
                            setEditing(s);
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
                            setPendingDelete(s);
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
        <Pager data={data as Paginated<Supplier>} page={page} onChange={setPage} />
      ) : null}

      <SupplierModal
        supplier={editing}
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={refresh}
      />

      <SupplierDetailsModal
        supplier={viewing}
        isOpen={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setViewing(null);
        }}
        onRequestCreateClient={() => viewing && createAsClient(viewing)}
        onRequestCreateEmployee={() => viewing && createAsEmployee(viewing)}
        onRequestCreateConfectionist={() => viewing && createAsConfectionist(viewing)}
        onRequestCreatePacker={() => viewing && createAsPacker(viewing)}
      />

      <ConfirmActionModal
        cancelLabel="Cancelar"
        confirmLabel="Eliminar"
        description={
          pendingDelete ? `¿Eliminar el proveedor ${pendingDelete.name}?` : undefined
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
