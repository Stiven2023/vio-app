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
import { Input } from "@heroui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import {
  BsEyeFill,
  BsPencilSquare,
  BsThreeDotsVertical,
  BsTrash,
  BsPersonPlus,
  BsPeople,
  BsTruck,
} from "react-icons/bs";

import { FilterSelect } from "@/app/catalog/_components/ui/filter-select";
import { Pager } from "@/app/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/catalog/_components/ui/table-skeleton";
import { usePaginatedApi } from "@/app/catalog/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/catalog/_lib/api";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import { PackerDetailsModal } from "@/app/packers/_components/packer-details-modal";

import { PackerModal } from "./packer-modal";

export type Packer = {
  id: string;
  packerCode: string;
  name: string;
  identificationType: string;
  identification: string;
  dv: string | null;
  packerType: string | null;
  specialty: string | null;
  contactName: string | null;
  email: string | null;
  intlDialCode: string | null;
  mobile: string | null;
  fullMobile: string | null;
  landline: string | null;
  address: string;
  postalCode: string | null;
  city: string | null;
  department: string | null;
  isActive: boolean | null;
  dailyCapacity: number | null;
};

type StatusFilter = "all" | "active" | "inactive";

export function PackersTab({
  canCreate,
  canEdit,
  canDelete,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<Packer>("/api/packers", 10);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Packer | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Packer | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewing, setViewing] = useState<Packer | null>(null);

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();

    return items.filter((p) => {
      if (status === "active" && !p.isActive) return false;
      if (status === "inactive" && p.isActive) return false;
      if (!q) return true;

      const email = p.email ?? "";
      const contactName = p.contactName ?? "";

      return (
        p.name.toLowerCase().includes(q) ||
        p.packerCode.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        contactName.toLowerCase().includes(q)
      );
    });
  }, [data, search, status]);

  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (search.trim() !== "" || status !== "all") return "Sin resultados";

    return "Sin empacadores";
  }, [loading, search, status]);

  const remove = async () => {
    const p = pendingDelete;

    if (!p || deletingId) return;

    setDeletingId(p.id);
    try {
      await apiJson(`/api/packers`, {
        method: "DELETE",
        body: JSON.stringify({ id: p.id }),
      });
      toast.success("Empacador eliminado");
      setConfirmOpen(false);
      setPendingDelete(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const createAsClient = async (packer: Packer) => {
    if (!packer.mobile || !packer.email) {
      toast.error("Para crear como cliente, el empaque debe tener email y móvil.");
      return;
    }

    try {
      await apiJson("/api/clients", {
        method: "POST",
        body: JSON.stringify({
          clientType: "NACIONAL",
          priceClientType: "VIOMAR",
          name: packer.name,
          identificationType: packer.identificationType,
          identification: packer.identification,
          dv: packer.dv ?? "",
          branch: "01",
          taxRegime: "REGIMEN_COMUN",
          contactName: packer.contactName ?? packer.name,
          email: packer.email,
          address: packer.address,
          postalCode: packer.postalCode ?? "",
          country: "COLOMBIA",
          department: packer.department ?? "ANTIOQUIA",
          city: packer.city ?? "Medellín",
          intlDialCode: packer.intlDialCode ?? "57",
          mobile: packer.mobile,
          localDialCode: "",
          landline: packer.landline ?? "",
          extension: "",
          status: "ACTIVO",
          isActive: Boolean(packer.isActive ?? true),
          hasCredit: false,
          promissoryNoteNumber: "",
          promissoryNoteDate: "",
        }),
      });

      toast.success("Cliente creado desde empaque");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const createAsEmployee = async (packer: Packer) => {
    if (!packer.email) {
      toast.error("Para crear como empleado, el empaque debe tener email.");
      return;
    }

    try {
      await apiJson("/api/employees", {
        method: "POST",
        body: JSON.stringify({
          name: packer.name,
          identificationType: packer.identificationType,
          identification: packer.identification,
          dv: packer.dv ?? "",
          email: packer.email,
          intlDialCode: packer.intlDialCode ?? "57",
          mobile: packer.mobile ?? "",
          landline: packer.landline ?? "",
          extension: "",
          address: packer.address,
          city: packer.city ?? "Medellín",
          department: packer.department ?? "ANTIOQUIA",
          isActive: Boolean(packer.isActive ?? true),
        }),
      });

      toast.success("Empleado creado desde empaque");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const createAsSupplier = async (packer: Packer) => {
    if (!packer.email) {
      toast.error("Para crear como proveedor, el empaque debe tener email.");
      return;
    }

    try {
      await apiJson("/api/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: packer.name,
          identificationType: packer.identificationType,
          identification: packer.identification,
          dv: packer.dv ?? "",
          branch: "01",
          taxRegime: "REGIMEN_COMUN",
          contactName: packer.contactName ?? packer.name,
          email: packer.email,
          address: packer.address,
          postalCode: packer.postalCode ?? "",
          country: "COLOMBIA",
          department: packer.department ?? "ANTIOQUIA",
          city: packer.city ?? "Medellín",
          intlDialCode: packer.intlDialCode ?? "57",
          mobile: packer.mobile ?? "",
          fullMobile: packer.fullMobile ?? "",
          localDialCode: "",
          landline: packer.landline ?? "",
          extension: "",
          fullLandline: "",
          hasCredit: false,
          promissoryNoteNumber: "",
          promissoryNoteDate: "",
        }),
      });

      toast.success("Proveedor creado desde empaque");
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
              Crear empaque
            </Button>
          ) : null}
          <Button variant="flat" onPress={refresh}>
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Empacadores"
          headers={[
            "Código",
            "Nombre",
            "Email",
            "Tipo",
            "Especialidad",
            "Ciudad",
            "Activo",
            "Acciones",
          ]}
        />
      ) : (
        <Table aria-label="Empacadores">
          <TableHeader>
            <TableColumn>Código</TableColumn>
            <TableColumn>Nombre</TableColumn>
            <TableColumn>Email</TableColumn>
            <TableColumn>Tipo</TableColumn>
            <TableColumn>Especialidad</TableColumn>
            <TableColumn>Ciudad</TableColumn>
            <TableColumn>Activo</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={filtered}>
            {(p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.packerCode}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-default-500">{p.email ?? "-"}</TableCell>
                <TableCell className="text-default-500">{p.packerType ?? "-"}</TableCell>
                <TableCell className="text-default-500">{p.specialty ?? "-"}</TableCell>
                <TableCell className="text-default-500">{p.city ?? "-"}</TableCell>
                <TableCell>{p.isActive ? "Sí" : "No"}</TableCell>
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
                          setViewing(p);
                          setDetailsOpen(true);
                        }}
                      >
                        Ver información completa
                      </DropdownItem>

                      <DropdownItem
                        key="to-client"
                        startContent={<BsPeople />}
                        onPress={() => createAsClient(p)}
                      >
                        Crear como cliente
                      </DropdownItem>

                      <DropdownItem
                        key="to-employee"
                        startContent={<BsPersonPlus />}
                        onPress={() => createAsEmployee(p)}
                      >
                        Crear como empleado
                      </DropdownItem>

                      <DropdownItem
                        key="to-supplier"
                        startContent={<BsTruck />}
                        onPress={() => createAsSupplier(p)}
                      >
                        Crear como proveedor
                      </DropdownItem>

                      {canEdit ? (
                        <DropdownItem
                          key="edit"
                          startContent={<BsPencilSquare />}
                          onPress={() => {
                            setEditing(p);
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
                            setPendingDelete(p);
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

      {data ? <Pager data={data as Paginated<Packer>} page={page} onChange={setPage} /> : null}

      <PackerModal
        packer={editing}
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={refresh}
      />

      <PackerDetailsModal
        packer={viewing}
        isOpen={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <ConfirmActionModal
        cancelLabel="Cancelar"
        confirmLabel="Eliminar"
        description={
          pendingDelete ? `¿Eliminar el empacador ${pendingDelete.name}?` : undefined
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
