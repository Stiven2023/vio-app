"use client";

import type { Employee } from "../../_lib/types";
import type { ClientFormPrefill } from "../clients/client-modal.types";

import { useMemo, useRef, useState } from "react";
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
  BsPersonPlus,
  BsEyeFill,
  BsShieldCheck,
} from "react-icons/bs";
import { Chip } from "@heroui/chip";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { usePaginatedApi } from "../../_hooks/use-paginated-api";
import { useReferenceData } from "../../_hooks/use-reference-data";
import { Pager } from "../ui/pager";
import { TableSkeleton } from "../ui/table-skeleton";
import { FilterSearch } from "../ui/filter-search";
import { FilterSelect } from "../ui/filter-select";

import { EmployeeDetailsModal } from "./employee-details-modal";
import { EmployeeDocumentsModal } from "./employee-documents-modal";
import { EmployeeLegalStatusModal } from "./employee-legal-status-modal";

import { ConfirmActionModal } from "@/components/confirm-action-modal";

type StatusFilter = "all" | "active" | "inactive";

export function EmployeesTab({
  canCreate = true,
  canEdit = true,
  canDelete = true,
  canChangeLegalStatus = true,
  legalOnlyMode = false,
  onRequestCreateClient,
}: {
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canChangeLegalStatus?: boolean;
  legalOnlyMode?: boolean;
  onRequestCreateClient?: (prefill: ClientFormPrefill) => void;
} = {}) {
  const { roleNameById, refresh: refreshRefs } = useReferenceData();
  const { data, loading, page, setPage, refresh } = usePaginatedApi<Employee>(
    "/api/employees",
    10,
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Employee | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState<string | null>(null);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [viewingDocuments, setViewingDocuments] = useState<Employee | null>(
    null,
  );
  const [legalStatusModalOpen, setLegalStatusModalOpen] = useState(false);
  const [viewingLegalStatus, setViewingLegalStatus] = useState<Employee | null>(
    null,
  );
  const [detail, setDetail] = useState<{
    employee: Employee;
    user: {
      id: string;
      email: string;
      emailVerified: boolean | null;
      isActive: boolean | null;
      createdAt: string | null;
    } | null;
  } | null>(null);

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();

    return items.filter((e) => {
      if (status === "active" && !e.isActive) return false;
      if (status === "inactive" && e.isActive) return false;
      if (!q) return true;

      const roleName = e.roleId ? (roleNameById.get(e.roleId) ?? e.roleId) : "";
      const userId = e.userId ?? "";
      const identification = e.identification ?? "";
      const email = e.email ?? "";
      const mobile = e.mobile ?? "";

      return (
        e.name.toLowerCase().includes(q) ||
        (e.employeeCode ?? "").toLowerCase().includes(q) ||
        userId.toLowerCase().includes(q) ||
        roleName.toLowerCase().includes(q) ||
        identification.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        mobile.toLowerCase().includes(q)
      );
    });
  }, [data, roleNameById, search, status]);
  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (search.trim() !== "" || status !== "all") return "Sin resultados";

    return "Sin empleados";
  }, [loading, search, status]);

  const exportCsv = () => {
    const anchor = document.createElement("a");
    anchor.href = "/api/employees/export";
    anchor.download = "employees-export.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const downloadTemplate = () => {
    const anchor = document.createElement("a");
    anchor.href = "/api/employees/import/template";
    anchor.download = "employees-import-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const importCsv = async (file: File) => {
    if (importing) return;
    const isCsv =
      file.type === "text/csv" ||
      file.name.toLowerCase().endsWith(".csv") ||
      file.type === "application/vnd.ms-excel";
    if (!isCsv) {
      toast.error("Selecciona un archivo CSV válido");
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/employees/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.message || (typeof payload === "string" ? payload : "No se pudo importar el CSV"),
        );
      }
      const createdCount = Number(payload?.createdCount ?? 0);
      const updatedCount = Number(payload?.updatedCount ?? 0);
      const failedCount = Number(payload?.failedCount ?? 0);
      const firstError = Array.isArray(payload?.errors)
        ? String(payload.errors[0]?.message ?? "")
        : "";
      if (createdCount === 0 && updatedCount === 0 && failedCount > 0) {
        toast.error(`No se importó ningún registro. ${firstError || "Revisa el archivo CSV."}`);
        return;
      }
      if (failedCount > 0) {
        toast.success(`Importación parcial: ${createdCount} creados, ${updatedCount} editados, ${failedCount} con error`);
      } else {
        toast.success(`Importación exitosa: ${createdCount} creados, ${updatedCount} editados`);
      }
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onSaved = () => {
    refreshRefs();
    refresh();
  };

  const openDetails = async (employeeId: string) => {
    if (detailsLoading) return;

    setDetailsLoading(employeeId);
    try {
      const data = await apiJson<{
        employee: Employee;
        user: {
          id: string;
          email: string;
          emailVerified: boolean | null;
          isActive: boolean | null;
          createdAt: string | null;
        } | null;
      }>(`/api/employees/${employeeId}/detail`);

      setDetail(data);
      setDetailsOpen(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDetailsLoading(null);
    }
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

  const createAsClient = async (employee: Employee) => {
    if (!employee.email) {
      toast.error("Para crear como cliente, el empleado debe tener email.");

      return;
    }

    try {
      await apiJson("/api/clients", {
        method: "POST",
        body: JSON.stringify({
          clientType: "EMPLEADO",
          name: employee.name,
          identificationType: employee.identificationType,
          identification: employee.identification,
          dv: employee.dv ?? "",
          branch: "01",
          taxRegime: "REGIMEN_COMUN",
          contactName: employee.name,
          email: employee.email,
          address: employee.address,
          postalCode: "",
          country: "COLOMBIA",
          department: employee.department,
          city: employee.city,
          intlDialCode: employee.intlDialCode,
          mobile: employee.mobile ?? "",
          localDialCode: "",
          landline: employee.landline ?? "",
          extension: employee.extension ?? "",
          status: "ACTIVO",
          isActive: Boolean(employee.isActive ?? true),
          hasCredit: false,
          promissoryNoteNumber: "",
          promissoryNoteDate: "",
        }),
      });

      toast.success("Cliente creado desde empleado");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const createAsSupplier = async (employee: Employee) => {
    if (!employee.email) {
      toast.error("Para crear como proveedor, el empleado debe tener email.");

      return;
    }

    try {
      await apiJson("/api/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: employee.name,
          identificationType: employee.identificationType,
          identification: employee.identification,
          dv: employee.dv ?? "",
          branch: "01",
          taxRegime: "REGIMEN_COMUN",
          contactName: employee.name,
          email: employee.email,
          address: employee.address,
          postalCode: "",
          country: "COLOMBIA",
          department: employee.department,
          city: employee.city,
          intlDialCode: employee.intlDialCode,
          mobile: employee.mobile ?? "",
          fullMobile: "",
          localDialCode: "",
          landline: employee.landline ?? "",
          extension: employee.extension ?? "",
          fullLandline: "",
          hasCredit: false,
          promissoryNoteNumber: "",
          promissoryNoteDate: "",
        }),
      });

      toast.success("Proveedor creado desde empleado");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const createAsConfectionist = async (employee: Employee) => {
    if (!employee.email) {
      toast.error(
        "Para crear como confeccionista, el empleado debe tener email.",
      );

      return;
    }

    try {
      await apiJson("/api/confectionists", {
        method: "POST",
        body: JSON.stringify({
          name: employee.name,
          identificationType: employee.identificationType,
          identification: employee.identification,
          dv: employee.dv ?? "",
          type: "NACIONAL",
          taxRegime: "REGIMEN_COMUN",
          contactName: employee.name,
          email: employee.email,
          intlDialCode: employee.intlDialCode,
          mobile: employee.mobile ?? "",
          fullMobile: "",
          landline: employee.landline ?? "",
          extension: employee.extension ?? "",
          address: employee.address,
          postalCode: "",
          country: "COLOMBIA",
          department: employee.department,
          city: employee.city,
          isActive: Boolean(employee.isActive ?? true),
        }),
      });

      toast.success("Confeccionista creado desde empleado");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const createAsPacker = async (employee: Employee) => {
    if (!employee.email) {
      toast.error("Para crear como empaque, el empleado debe tener email.");

      return;
    }

    try {
      await apiJson("/api/packers", {
        method: "POST",
        body: JSON.stringify({
          name: employee.name,
          identificationType: employee.identificationType,
          identification: employee.identification,
          dv: employee.dv ?? "",
          packerType: "INTERNO",
          specialty: "",
          dailyCapacity: null,
          contactName: employee.name,
          email: employee.email,
          intlDialCode: employee.intlDialCode,
          mobile: employee.mobile ?? "",
          fullMobile: "",
          landline: employee.landline ?? "",
          address: employee.address,
          postalCode: "",
          city: employee.city,
          department: employee.department,
          isActive: Boolean(employee.isActive ?? true),
        }),
      });

      toast.success("Empaque creado desde empleado");
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
            placeholder="Buscar por nombre, identificación, email, rol o usuario…"
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

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            accept=".csv"
            className="hidden"
            type="file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); }}
          />
          <Button variant="flat" onPress={exportCsv}>
            Exportar CSV
          </Button>
          <Button variant="flat" onPress={downloadTemplate}>
            Descargar plantilla CSV
          </Button>
          <Button color="secondary" isDisabled={importing} onPress={() => fileInputRef.current?.click()}>
            {importing ? "Importando..." : "Importar CSV"}
          </Button>
          {canCreate ? (
            <Button
              color="primary"
              onPress={() => {
                window.location.href = "/employee-register";
              }}
            >
              Crear empleado
            </Button>
          ) : null}
          <Button variant="flat" onPress={onSaved}>
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Empleados"
          headers={[
            "Código",
            "Nombre",
            "Tipo ID",
            "Email",
            "Móvil",
            "Rol",
            "Activo",
            "Acciones",
          ]}
        />
      ) : (
        <Table aria-label="Empleados">
          <TableHeader>
            <TableColumn>Código</TableColumn>
            <TableColumn>Nombre</TableColumn>
            <TableColumn>Tipo ID</TableColumn>
            <TableColumn>Email</TableColumn>
            <TableColumn>Móvil</TableColumn>
            <TableColumn>Rol</TableColumn>
            <TableColumn>Activo</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={filtered}>
            {(e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs text-primary">
                  {e.employeeCode ?? "—"}
                </TableCell>
                <TableCell>{e.name}</TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat">
                    {e.identificationType}
                  </Chip>
                </TableCell>
                <TableCell className="text-default-500">
                  {e.email ?? "-"}
                </TableCell>
                <TableCell className="text-default-500">
                  {e.fullMobile ?? e.mobile ?? "-"}
                </TableCell>
                <TableCell>
                  {e.roleId ? (roleNameById.get(e.roleId) ?? e.roleId) : "-"}
                </TableCell>
                <TableCell>{e.isActive ? "Sí" : "No"}</TableCell>
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
                        onPress={() => openDetails(e.id)}
                      >
                        Ver detalles completos
                      </DropdownItem>
                      {canEdit ? (
                        <DropdownItem
                          key="edit"
                          startContent={<BsPencilSquare />}
                          onPress={() => {
                            window.location.href = `/employee-register?id=${e.id}`;
                          }}
                        >
                          Editar
                        </DropdownItem>
                      ) : null}
                      <DropdownItem
                        key="view-docs"
                        startContent={<BsEyeFill />}
                        onPress={() => {
                          setViewingDocuments(e);
                          setDocumentsOpen(true);
                        }}
                      >
                        Ver documentos
                      </DropdownItem>
                      {canChangeLegalStatus ? (
                        <DropdownItem
                          key={`legal-status-${e.id}`}
                          startContent={<BsShieldCheck />}
                          onPress={() => {
                            setViewingLegalStatus(e);
                            setLegalStatusModalOpen(true);
                          }}
                        >
                          Ver estado jurídico
                        </DropdownItem>
                      ) : null}
                      {!legalOnlyMode ? (
                        <DropdownItem
                          key="to-client"
                          startContent={<BsPersonPlus />}
                          onPress={() => {
                            onRequestCreateClient?.({
                              clientType: "EMPLEADO",
                              name: e.name,
                              identificationType: e.identificationType,
                              identification: e.identification,
                              dv: e.dv ?? "",
                              taxRegime: "REGIMEN_COMUN",
                              contactName: e.name,
                              email: e.email,
                              address: e.address ?? "",
                              city: e.city ?? "",
                              department: e.department ?? "",
                              intlDialCode: e.intlDialCode ?? "57",
                              mobile: e.mobile ?? "",
                              landline: e.landline ?? "",
                              extension: e.extension ?? "",
                              isActive: Boolean(e.isActive ?? true),
                              status: e.isActive ? "ACTIVO" : "INACTIVO",
                            });
                          }}
                        >
                          Crear como cliente
                        </DropdownItem>
                      ) : null}
                      {canDelete ? (
                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          startContent={<BsTrash />}
                          onPress={() => {
                            setPendingDelete(e);
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

      <EmployeeDetailsModal
        detail={detail}
        isOpen={detailsOpen}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
          setDetailsOpen(open);
        }}
        onRequestCreateClient={
          legalOnlyMode
            ? undefined
            : () => detail?.employee && createAsClient(detail.employee)
        }
        onRequestCreateConfectionist={
          legalOnlyMode
            ? undefined
            : () => detail?.employee && createAsConfectionist(detail.employee)
        }
        onRequestCreatePacker={
          legalOnlyMode
            ? undefined
            : () => detail?.employee && createAsPacker(detail.employee)
        }
        onRequestCreateSupplier={
          legalOnlyMode
            ? undefined
            : () => detail?.employee && createAsSupplier(detail.employee)
        }
      />

      <EmployeeDocumentsModal
        employee={viewingDocuments}
        isOpen={documentsOpen}
        onOpenChange={(open) => {
          if (!open) setViewingDocuments(null);
          setDocumentsOpen(open);
        }}
      />

      <EmployeeLegalStatusModal
        employee={viewingLegalStatus}
        isOpen={legalStatusModalOpen}
        onOpenChange={setLegalStatusModalOpen}
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
