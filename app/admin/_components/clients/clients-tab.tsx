"use client";

import type { Client } from "../../_lib/types";
import type { ClientFormPrefill } from "./client-modal.types";
import type { EmployeeFormPrefill } from "../employees/employee-modal.types";
import type { ConfectionistFormPrefill } from "@/app/confectionists/_components/confectionist-modal.types";

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
import {
  BsPencilSquare,
  BsThreeDotsVertical,
  BsTrash,
  BsEyeFill,
  BsPersonPlus,
  BsTruck,
  BsScissors,
  BsFileEarmarkPdf,
  BsShieldCheck,
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
import { ClientDocumentsModal } from "./client-documents-modal";
import { ClientLegalStatusModal } from "./client-legal-status-modal";

import { ConfirmActionModal } from "@/components/confirm-action-modal";

type StatusFilter = "all" | "active" | "inactive";

export function ClientsTab({
  canCreate = true,
  canEdit = true,
  canDelete = true,
  prefillCreate,
  onPrefillConsumed,
  onRequestCreateEmployee,
  onRequestCreateConfectionist,
}: {
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  prefillCreate?: ClientFormPrefill | null;
  onPrefillConsumed?: () => void;
  onRequestCreateEmployee?: (prefill: EmployeeFormPrefill) => void;
  onRequestCreateConfectionist?: (prefill: ConfectionistFormPrefill) => void;
} = {}) {
  const { data, loading, page, setPage, refresh } = usePaginatedApi<Client>(
    "/api/clients",
    10,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [legalStatusModalOpen, setLegalStatusModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [viewing, setViewing] = useState<Client | null>(null);
  const [viewingDocuments, setViewingDocuments] = useState<Client | null>(null);
  const [viewingLegalStatus, setViewingLegalStatus] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modalPrefill, setModalPrefill] = useState<ClientFormPrefill | null>(
    null,
  );

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

  const createAsEmployee = async (client: Client) => {
    if (!client.email) {
      toast.error("Para crear como empleado, el cliente debe tener email.");
      return;
    }

    try {
      await apiJson("/api/employees", {
        method: "POST",
        body: JSON.stringify({
          name: client.name,
          identificationType: client.identificationType,
          identification: client.identification,
          dv: client.dv ?? "",
          email: client.email,
          intlDialCode: client.intlDialCode,
          mobile: client.mobile ?? "",
          landline: client.landline ?? "",
          extension: client.extension ?? "",
          address: client.address,
          city: client.city,
          department: client.department,
          isActive: Boolean(client.isActive ?? true),
        }),
      });

      toast.success("Empleado creado desde cliente");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const createAsSupplier = async (client: Client) => {
    if (!client.email) {
      toast.error("Para crear como proveedor, el cliente debe tener email.");
      return;
    }

    try {
      await apiJson("/api/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: client.name,
          identificationType: client.identificationType,
          identification: client.identification,
          dv: client.dv ?? "",
          branch: client.branch,
          taxRegime: client.taxRegime,
          contactName: client.contactName,
          email: client.email,
          address: client.address,
          postalCode: client.postalCode ?? "",
          country: client.country,
          department: client.department,
          city: client.city,
          intlDialCode: client.intlDialCode,
          mobile: client.mobile ?? "",
          fullMobile: client.fullMobile ?? "",
          localDialCode: client.localDialCode ?? "",
          landline: client.landline ?? "",
          extension: client.extension ?? "",
          fullLandline: client.fullLandline ?? "",
          hasCredit: client.hasCredit ?? false,
          promissoryNoteNumber: client.promissoryNoteNumber ?? "",
          promissoryNoteDate: client.promissoryNoteDate ?? "",
        }),
      });

      toast.success("Proveedor creado desde cliente");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const createAsConfectionist = async (client: Client) => {
    try {
      await apiJson("/api/confectionists", {
        method: "POST",
        body: JSON.stringify({
          name: client.name,
          identificationType: client.identificationType,
          identification: client.identification,
          dv: client.dv ?? "",
          type: "NACIONAL",
          taxRegime: client.taxRegime,
          contactName: client.contactName,
          email: client.email ?? "",
          intlDialCode: client.intlDialCode,
          mobile: client.mobile ?? "",
          fullMobile: client.fullMobile ?? "",
          landline: client.landline ?? "",
          extension: client.extension ?? "",
          address: client.address,
          postalCode: client.postalCode ?? "",
          country: client.country,
          department: client.department,
          city: client.city,
          isActive: Boolean(client.isActive ?? true),
        }),
      });

      toast.success("Confeccionista creado desde cliente");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const createAsPacker = async (client: Client) => {
    try {
      await apiJson("/api/packers", {
        method: "POST",
        body: JSON.stringify({
          name: client.name,
          identificationType: client.identificationType,
          identification: client.identification,
          dv: client.dv ?? "",
          packerType: "EXTERNO",
          specialty: "",
          dailyCapacity: null,
          contactName: client.contactName,
          email: client.email ?? "",
          intlDialCode: client.intlDialCode,
          mobile: client.mobile ?? "",
          fullMobile: client.fullMobile ?? "",
          landline: client.landline ?? "",
          address: client.address,
          postalCode: client.postalCode ?? "",
          city: client.city,
          department: client.department,
          isActive: Boolean(client.isActive ?? true),
        }),
      });

      toast.success("Empaque creado desde cliente");
    } catch (err) {
      toast.error(getErrorMessage(err));
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
                setModalPrefill(null);
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
            <TableColumn>TIPO PRECIO COP</TableColumn>
            <TableColumn>EMAIL</TableColumn>
            <TableColumn>MÓVIL</TableColumn>
            <TableColumn>ESTADO</TableColumn>
            <TableColumn>ESTADO JURÍDICO</TableColumn>
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
                  {c.legalStatus ? (
                    <Chip
                      color={
                        c.legalStatus === "VIGENTE"
                          ? "success"
                          : c.legalStatus === "EN_REVISION"
                            ? "warning"
                            : "danger"
                      }
                      size="sm"
                      variant="flat"
                    >
                      {c.legalStatus === "VIGENTE"
                        ? "Vigente"
                        : c.legalStatus === "EN_REVISION"
                          ? "En Revisión"
                          : "Bloqueado"}
                    </Chip>
                  ) : (
                    <Chip color="default" size="sm" variant="flat">
                      Sin definir
                    </Chip>
                  )}
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
                      <DropdownItem
                        key="documents"
                        startContent={<BsFileEarmarkPdf />}
                        onPress={() => {
                          setViewingDocuments(c);
                          setDocumentsOpen(true);
                        }}
                      >
                        Ver documentos
                      </DropdownItem>
                      <DropdownItem
                        key={`legal-status-${c.id}`}
                        startContent={<span>⚖️</span>}
                        onPress={() => {
                          setViewingLegalStatus(c);
                          setLegalStatusModalOpen(true);
                        }}
                      >
                        Ver estado jurídico
                      </DropdownItem>
                      {canEdit ? (
                        <DropdownItem
                          key="edit"
                          startContent={<BsPencilSquare />}
                          onPress={() => {
                            setEditing(c);
                            setModalPrefill(null);
                            setModalOpen(true);
                          }}
                        >
                          Editar
                        </DropdownItem>
                      ) : null}
                      <DropdownItem
                        key="to-employee"
                        startContent={<BsPersonPlus />}
                        onPress={() => {
                          if (!onRequestCreateEmployee) {
                            toast("Disponible desde el módulo Admin", {
                              icon: "ℹ️",
                            });
                            return;
                          }

                          onRequestCreateEmployee({
                            name: c.name,
                            identificationType: c.identificationType,
                            identification: c.identification,
                            dv: c.dv ?? "",
                            email: c.email,
                            intlDialCode: c.intlDialCode ?? "57",
                            mobile: c.mobile ?? "",
                            landline: c.landline ?? "",
                            extension: c.extension ?? "",
                            address: c.address ?? "",
                            city: c.city ?? "",
                            department: c.department ?? "",
                            isActive: Boolean(c.isActive ?? true),
                            createUserEmail: c.email,
                          });
                        }}
                      >
                        Crear como empleado
                      </DropdownItem>
                      <DropdownItem
                        key="to-supplier"
                        startContent={<BsTruck />}
                        onPress={() => {
                          toast("Próximamente: crear como proveedor", {
                            icon: "🧩",
                          });
                        }}
                      >
                        Crear como proveedor
                      </DropdownItem>
                      <DropdownItem
                        key="to-confectionist"
                        startContent={<BsScissors />}
                        onPress={() => {
                          if (!onRequestCreateConfectionist) {
                            toast(
                              "Navega a la página de confeccionistas para crear desde un cliente",
                              { icon: "🚧" },
                            );

                            return;
                          }

                          onRequestCreateConfectionist({
                            name: c.name,
                            identificationType: c.identificationType,
                            identification: c.identification,
                            dv: c.dv ?? "",
                            taxRegime: c.taxRegime,
                            contactName: c.contactName,
                            email: c.email,
                            intlDialCode: c.intlDialCode ?? "57",
                            mobile: c.mobile ?? "",
                            landline: c.landline ?? "",
                            extension: c.extension ?? "",
                            address: c.address,
                            postalCode: c.postalCode ?? "",
                            country: c.country ?? "COLOMBIA",
                            department: c.department ?? "ANTIOQUIA",
                            city: c.city ?? "Medellín",
                            isActive: Boolean(c.isActive ?? true),
                          });
                        }}
                      >
                        Crear como confeccionista
                      </DropdownItem>
                      <DropdownItem
                        key="legal-status"
                        startContent={<BsShieldCheck />}
                        onPress={() => {
                          setViewingLegalStatus(c);
                          setLegalStatusModalOpen(true);
                        }}
                      >
                        Ver estado jurídico
                      </DropdownItem>
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
        onRequestCreateEmployee={onRequestCreateEmployee}
        prefill={modalPrefill}
        onOpenChange={setModalOpen}
        onSaved={onSaved}
      />

      <ClientDetailsModal
        client={viewing}
        isOpen={detailsOpen}
        onOpenChange={setDetailsOpen}
        onRequestCreateEmployee={() => viewing && createAsEmployee(viewing)}
        onRequestCreateSupplier={() => viewing && createAsSupplier(viewing)}
        onRequestCreateConfectionist={() => viewing && createAsConfectionist(viewing)}
        onRequestCreatePacker={() => viewing && createAsPacker(viewing)}
      />

      <ClientDocumentsModal
        client={viewingDocuments}
        isOpen={documentsOpen}
        onOpenChange={setDocumentsOpen}
      />

      <ClientLegalStatusModal
        client={viewingLegalStatus}
        isOpen={legalStatusModalOpen}
        onOpenChange={setLegalStatusModalOpen}
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
