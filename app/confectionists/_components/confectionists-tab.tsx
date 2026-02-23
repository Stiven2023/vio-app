"use client";

import type { Paginated } from "@/app/catalog/_lib/types";
import type { ConfectionistFormPrefill } from "./confectionist-modal.types";
import type { ClientFormPrefill } from "@/app/admin/_components/clients/client-modal.types";
import type { Confectionist as AdminConfectionist } from "@/app/admin/_lib/types";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
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
import { BsPencilSquare, BsThreeDotsVertical, BsTrash, BsPersonPlus, BsEyeFill } from "react-icons/bs";

import { FilterSearch } from "@/app/catalog/_components/ui/filter-search";
import { FilterSelect } from "@/app/catalog/_components/ui/filter-select";
import { Pager } from "@/app/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/catalog/_components/ui/table-skeleton";
import { usePaginatedApi } from "@/app/catalog/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/catalog/_lib/api";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import { ThirdPartyDocumentsModal } from "@/components/third-party-documents-modal";

import { ConfectionistModal } from "./confectionist-modal";
import { ConfectionistDetailsModal } from "./confectionist-details-modal";
import { ConfectionistLegalStatusModal } from "@/app/admin/_components/confectionists/confectionist-legal-status-modal";

export type Confectionist = AdminConfectionist & {
  specialty: string | null;
  dailyCapacity: number | null;
  legalStatus: "VIGENTE" | "EN_REVISION" | "BLOQUEADO" | null;
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

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewing, setViewing] = useState<Confectionist | null>(null);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [viewingDocuments, setViewingDocuments] = useState<Confectionist | null>(null);
  const [legalStatusModalOpen, setLegalStatusModalOpen] = useState(false);
  const [viewingLegalStatus, setViewingLegalStatus] = useState<Confectionist | null>(null);

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
      const specialty = c.specialty ?? "";
      const dailyCapacity = c.dailyCapacity === null ? "" : String(c.dailyCapacity);

      return (
        c.name.toLowerCase().includes(q) ||
        code.toLowerCase().includes(q) ||
        identification.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        mobile.toLowerCase().includes(q) ||
        type.toLowerCase().includes(q) ||
        specialty.toLowerCase().includes(q) ||
        dailyCapacity.includes(q)
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

  const createAsEmployee = async (confectionist: Confectionist) => {
    if (!confectionist.email) {
      toast.error("Para crear como empleado, el confeccionista debe tener email.");
      return;
    }

    try {
      await apiJson("/api/employees", {
        method: "POST",
        body: JSON.stringify({
          name: confectionist.name,
          identificationType: confectionist.identificationType,
          identification: confectionist.identification,
          dv: confectionist.dv ?? "",
          email: confectionist.email,
          intlDialCode: confectionist.intlDialCode ?? "57",
          mobile: confectionist.mobile ?? "",
          landline: confectionist.landline ?? "",
          extension: confectionist.extension ?? "",
          address: confectionist.address,
          city: confectionist.city ?? "Medellín",
          department: confectionist.department ?? "ANTIOQUIA",
          isActive: Boolean(confectionist.isActive ?? true),
        }),
      });

      toast.success("Empleado creado desde confeccionista");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const createAsSupplier = async (confectionist: Confectionist) => {
    if (!confectionist.email) {
      toast.error("Para crear como proveedor, el confeccionista debe tener email.");
      return;
    }

    try {
      await apiJson("/api/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: confectionist.name,
          identificationType: confectionist.identificationType,
          identification: confectionist.identification,
          dv: confectionist.dv ?? "",
          branch: "01",
          taxRegime: confectionist.taxRegime,
          contactName: confectionist.contactName ?? confectionist.name,
          email: confectionist.email,
          address: confectionist.address,
          postalCode: confectionist.postalCode ?? "",
          country: confectionist.country ?? "COLOMBIA",
          department: confectionist.department ?? "ANTIOQUIA",
          city: confectionist.city ?? "Medellín",
          intlDialCode: confectionist.intlDialCode ?? "57",
          mobile: confectionist.mobile ?? "",
          fullMobile: confectionist.fullMobile ?? "",
          localDialCode: "",
          landline: confectionist.landline ?? "",
          extension: confectionist.extension ?? "",
          fullLandline: "",
          hasCredit: false,
          promissoryNoteNumber: "",
          promissoryNoteDate: "",
        }),
      });

      toast.success("Proveedor creado desde confeccionista");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const createAsPacker = async (confectionist: Confectionist) => {
    try {
      await apiJson("/api/packers", {
        method: "POST",
        body: JSON.stringify({
          name: confectionist.name,
          identificationType: confectionist.identificationType,
          identification: confectionist.identification,
          dv: confectionist.dv ?? "",
          packerType: "EXTERNO",
          contactName: confectionist.contactName ?? confectionist.name,
          email: confectionist.email ?? "",
          intlDialCode: confectionist.intlDialCode ?? "57",
          mobile: confectionist.mobile ?? "",
          fullMobile: confectionist.fullMobile ?? "",
          landline: confectionist.landline ?? "",
          extension: confectionist.extension ?? "",
          address: confectionist.address,
          postalCode: confectionist.postalCode ?? "",
          country: confectionist.country ?? "COLOMBIA",
          city: confectionist.city ?? "Medellín",
          department: confectionist.department ?? "ANTIOQUIA",
          taxRegime: confectionist.taxRegime,
          isActive: Boolean(confectionist.isActive ?? true),
          specialty: confectionist.specialty ?? "",
          dailyCapacity:
            confectionist.dailyCapacity === null ? null : confectionist.dailyCapacity,
        }),
      });

      toast.success("Empaque creado desde confeccionista");
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
            "Tipo ID",
            "Email",
            "Móvil",
            "Tipo",
            "Especialidad",
            "Capacidad",
            "Activo",
            "Estado jurídico",
            "Acciones",
          ]}
        />
      ) : (
        <Table aria-label="Confeccionistas">
          <TableHeader>
            <TableColumn>Código</TableColumn>
            <TableColumn>Nombre</TableColumn>
            <TableColumn>Tipo ID</TableColumn>
            <TableColumn>Email</TableColumn>
            <TableColumn>Móvil</TableColumn>
            <TableColumn>Tipo</TableColumn>
            <TableColumn>Especialidad</TableColumn>
            <TableColumn>Capacidad</TableColumn>
            <TableColumn>Activo</TableColumn>
            <TableColumn>Estado jurídico</TableColumn>
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
                  {c.identificationType}
                </TableCell>
                <TableCell className="text-default-500">{c.email ?? "-"}</TableCell>
                <TableCell className="text-default-500">
                  {c.fullMobile ?? c.mobile ?? "-"}
                </TableCell>
                <TableCell className="text-default-500">{c.type ?? "-"}</TableCell>
                <TableCell className="text-default-500">{c.specialty ?? "-"}</TableCell>
                <TableCell className="text-default-500">
                  {c.dailyCapacity === null ? "-" : c.dailyCapacity}
                </TableCell>
                <TableCell>{c.isActive ? "Sí" : "No"}</TableCell>
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
                        Ver información completa
                      </DropdownItem>

                      <DropdownItem
                        key="view-docs"
                        startContent={<BsEyeFill />}
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

      <ConfectionistDetailsModal
        confectionist={viewing}
        isOpen={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setViewing(null);
        }}
        onRequestCreateClient={
          onRequestCreateClient
            ? () => {
                if (!viewing) return;
                onRequestCreateClient({
                  clientType: "NACIONAL",
                  name: viewing.name,
                  identificationType: viewing.identificationType,
                  identification: viewing.identification,
                  dv: viewing.dv ?? "",
                  branch: "01",
                  taxRegime: viewing.taxRegime,
                  contactName: viewing.contactName ?? viewing.name,
                  email: viewing.email ?? "",
                  address: viewing.address,
                  postalCode: viewing.postalCode ?? "",
                  country: viewing.country ?? "COLOMBIA",
                  department: viewing.department ?? "ANTIOQUIA",
                  city: viewing.city ?? "Medellín",
                  intlDialCode: viewing.intlDialCode ?? "57",
                  mobile: viewing.mobile ?? "",
                  localDialCode: "",
                  landline: viewing.landline ?? "",
                  extension: viewing.extension ?? "",
                  status: "ACTIVO",
                  priceClientType: "VIOMAR",
                  isActive: Boolean(viewing.isActive ?? true),
                  hasCredit: false,
                  promissoryNoteNumber: "",
                  promissoryNoteDate: "",
                });
                setDetailsOpen(false);
              }
            : undefined
        }
        onRequestCreateEmployee={() => viewing && createAsEmployee(viewing)}
        onRequestCreateSupplier={() => viewing && createAsSupplier(viewing)}
        onRequestCreatePacker={() => viewing && createAsPacker(viewing)}
      />

      <ConfectionistLegalStatusModal
        confectionist={viewingLegalStatus}
        isOpen={legalStatusModalOpen}
        onOpenChange={setLegalStatusModalOpen}
      />

      <ThirdPartyDocumentsModal
        title={`Documentos de ${viewingDocuments?.name ?? ""}`}
        subtitle={
          viewingDocuments
            ? `${viewingDocuments.identificationType} - ${viewingDocuments.identification}`
            : undefined
        }
        emptyMessage="Este confeccionista no tiene documentos cargados."
        documents={
          viewingDocuments
            ? [
                { label: "Documento de identidad", url: viewingDocuments.identityDocumentUrl },
                { label: "RUT", url: viewingDocuments.rutDocumentUrl },
                { label: "Cámara de comercio", url: viewingDocuments.commerceChamberDocumentUrl },
                { label: "Pasaporte", url: viewingDocuments.passportDocumentUrl },
                { label: "Certificado tributario", url: viewingDocuments.taxCertificateDocumentUrl },
                { label: "Documento empresa", url: viewingDocuments.companyIdDocumentUrl },
              ]
            : []
        }
        isOpen={documentsOpen}
        onOpenChange={(open) => {
          setDocumentsOpen(open);
          if (!open) setViewingDocuments(null);
        }}
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
