"use client";

import type { Employee } from "../../_lib/types";
import type { ClientFormPrefill } from "../clients/client-modal.types";
import type { EmployeeFormPrefill } from "./employee-modal.types";

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
  BsPersonPlus,
  BsEyeFill,
} from "react-icons/bs";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { usePaginatedApi } from "../../_hooks/use-paginated-api";
import { useReferenceData } from "../../_hooks/use-reference-data";
import { Pager } from "../ui/pager";
import { TableSkeleton } from "../ui/table-skeleton";
import { FilterSearch } from "../ui/filter-search";
import { FilterSelect } from "../ui/filter-select";

import { EmployeeModal } from "./employee-modal";
import { EmployeeDetailsModal } from "./employee-details-modal";

import { ConfirmActionModal } from "@/components/confirm-action-modal";

type StatusFilter = "all" | "active" | "inactive";

export function EmployeesTab({
  onRequestCreateClient,
  prefillCreate,
  onPrefillConsumed,
}: {
  onRequestCreateClient?: (prefill: ClientFormPrefill) => void;
  prefillCreate?: EmployeeFormPrefill | null;
  onPrefillConsumed?: () => void;
} = {}) {
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
  const [modalPrefill, setModalPrefill] = useState<EmployeeFormPrefill | null>(
    null,
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState<string | null>(null);
  const [detail, setDetail] = useState<
    { employee: Employee; user: { id: string; email: string; emailVerified: boolean | null; isActive: boolean | null; createdAt: string | null } | null } | null
  >(null);

  useEffect(() => {
    if (!prefillCreate) return;
    setEditing(null);
    setModalPrefill(prefillCreate);
    setModalOpen(true);
    onPrefillConsumed?.();
  }, [onPrefillConsumed, prefillCreate]);

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
          priceClientType: "VIOMAR",
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
      toast.error("Para crear como confeccionista, el empleado debe tener email.");
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

        <div className="flex gap-2">
          <Button
            color="primary"
            onPress={() => {
              setEditing(null);
              setModalPrefill(null);
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
          headers={[
            "Código",
            "Nombre",
            "Identificación",
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
            <TableColumn>Identificación</TableColumn>
            <TableColumn>Email</TableColumn>
            <TableColumn>Móvil</TableColumn>
            <TableColumn>Rol</TableColumn>
            <TableColumn>Activo</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={filtered}>
            {(e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs text-primary">{e.employeeCode ?? "—"}</TableCell>
                <TableCell>{e.name}</TableCell>
                <TableCell>{e.identificationType} {e.identification}</TableCell>
                <TableCell className="text-default-500">{e.email ?? "-"}</TableCell>
                <TableCell className="text-default-500">{e.fullMobile ?? e.mobile ?? "-"}</TableCell>
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
                      <DropdownItem
                        key="edit"
                        startContent={<BsPencilSquare />}
                        onPress={() => {
                          setEditing(e);
                          setModalPrefill(null);
                          setModalOpen(true);
                        }}
                      >
                        Editar
                      </DropdownItem>
                      <DropdownItem
                        key="to-client"
                        startContent={<BsPersonPlus />}
                        onPress={() => {
                          onRequestCreateClient?.({
                            clientType: "EMPLEADO",
                            priceClientType: "VIOMAR",
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
                    </DropdownMenu>
                  </Dropdown>
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
        onRequestCreateClient={onRequestCreateClient}
        prefill={modalPrefill}
        roles={roles}
        users={users}
        onOpenChange={setModalOpen}
        onSaved={onSaved}
      />

      <EmployeeDetailsModal
        detail={detail}
        isOpen={detailsOpen}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
          setDetailsOpen(open);
        }}
        onRequestCreateClient={() => detail?.employee && createAsClient(detail.employee)}
        onRequestCreateSupplier={() => detail?.employee && createAsSupplier(detail.employee)}
        onRequestCreateConfectionist={() => detail?.employee && createAsConfectionist(detail.employee)}
        onRequestCreatePacker={() => detail?.employee && createAsPacker(detail.employee)}
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
