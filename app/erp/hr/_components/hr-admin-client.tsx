"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Input, Textarea } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Pagination } from "@heroui/pagination";
import { Select, SelectItem } from "@heroui/select";
import { Tab, Tabs } from "@heroui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";

import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type EmployeeOption = { id: string; name: string; employeeCode: string | null };

type LeaveRow = {
  id: string;
  employeeId: string;
  employeeName: string | null;
  employeeCode: string | null;
  leaveType: "PAID" | "UNPAID";
  startDate: string;
  endDate: string;
  durationDays: number;
  hoursAbsent: string | null;
  payrollDeduction: boolean | null;
  notes: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  createdAt: string;
};

type RequestRow = {
  id: string;
  employeeId: string;
  employeeName: string | null;
  employeeCode: string | null;
  type: RequestType;
  subject: string;
  description: string;
  requestDate: string | null;
  requestHours: string | null;
  priority: PriorityKey;
  status: RequestStatus;
  responseNotes: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

type PaginatedLeaves = {
  items: LeaveRow[];
  employeeOptions: EmployeeOption[];
  monthlySummary: any[];
  summaryPeriod: string;
  page: number;
  pageSize: number;
  total: number;
};

type PaginatedRequests = {
  items: RequestRow[];
  employeeOptions: EmployeeOption[];
  page: number;
  pageSize: number;
  total: number;
};

type RequestType = "PERMISO" | "RECLAMO" | "SOLICITUD" | "SUGERENCIA" | "PQR";
type PriorityKey = "BAJA" | "MEDIA" | "ALTA";
type RequestStatus = "PENDIENTE" | "APROBADO" | "RECHAZADO" | "EN_REVISION" | "CERRADO";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(v: string | null | undefined) {
  if (!v) return "-";
  const d = new Date(`${v}T00:00:00`);

  if (Number.isNaN(d.getTime())) return v;

  return d.toLocaleDateString("es-CO");
}

function requestStatusColor(s: RequestStatus): "success" | "danger" | "warning" | "primary" | "default" {
  switch (s) {
    case "APROBADO": return "success";
    case "RECHAZADO": return "danger";
    case "EN_REVISION": return "primary";
    case "CERRADO": return "default";
    default: return "warning";
  }
}

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  PERMISO: "Permiso",
  RECLAMO: "Reclamo",
  SOLICITUD: "Solicitud",
  SUGERENCIA: "Sugerencia",
  PQR: "PQR",
};

const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  EN_REVISION: "En revisión",
  CERRADO: "Cerrado",
};

const RESOLVE_STATUSES: Array<{ value: RequestStatus; label: string }> = [
  { value: "APROBADO", label: "Aprobar" },
  { value: "RECHAZADO", label: "Rechazar" },
  { value: "EN_REVISION", label: "Marcar en revisión" },
  { value: "CERRADO", label: "Cerrar" },
];

// ── Leaves Tab (HR Admin view) ────────────────────────────────────────────────

function LeavesAdminTab() {
  const [data, setData] = useState<PaginatedLeaves | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const totalPages = useMemo(() => {
    if (!data) return 1;

    return Math.max(1, Math.ceil(data.total / (data.pageSize ?? 15)));
  }, [data]);

  async function load(p = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "15" });

      if (employeeFilter) params.set("employeeId", employeeFilter);
      if (leaveTypeFilter !== "ALL") params.set("leaveType", leaveTypeFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/hr/permisos-ausencias?${params}`);

      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(1); setPage(1); }, [employeeFilter, leaveTypeFilter, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <p className="text-sm text-default-500">
        Permisos y ausencias de todos los empleados. Aquí puedes revisar y gestionar las solicitudes.
      </p>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <Select
          className="col-span-2 sm:w-56"
          label="Empleado"
          placeholder="Todos"
          selectedKeys={employeeFilter ? [employeeFilter] : []}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => setEmployeeFilter(String(Array.from(keys)[0] ?? ""))}
        >
          {(data?.employeeOptions ?? []).map((e) => (
            <SelectItem key={e.id}>{e.name}{e.employeeCode ? ` (${e.employeeCode})` : ""}</SelectItem>
          ))}
        </Select>

        <Select
          className="sm:w-40"
          label="Tipo"
          selectedKeys={[leaveTypeFilter]}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => setLeaveTypeFilter(String(Array.from(keys)[0] ?? "ALL"))}
        >
          <SelectItem key="ALL">Todos</SelectItem>
          <SelectItem key="PAID">Remunerado</SelectItem>
          <SelectItem key="UNPAID">No remunerado</SelectItem>
        </Select>

        <Input
          className="sm:w-40"
          label="Desde"
          size="sm"
          type="date"
          value={dateFrom}
          variant="bordered"
          onValueChange={setDateFrom}
        />
        <Input
          className="sm:w-40"
          label="Hasta"
          size="sm"
          type="date"
          value={dateTo}
          variant="bordered"
          onValueChange={setDateTo}
        />
        <Button className="self-end" size="sm" variant="flat" onPress={() => { setEmployeeFilter(""); setLeaveTypeFilter("ALL"); setDateFrom(""); setDateTo(""); }}>
          Limpiar
        </Button>
      </div>

      <div className="overflow-x-auto">
      <Table aria-label="Permisos y ausencias">
        <TableHeader>
          <TableColumn>Empleado</TableColumn>
          <TableColumn>Tipo</TableColumn>
          <TableColumn>Desde</TableColumn>
          <TableColumn>Hasta</TableColumn>
          <TableColumn>Días</TableColumn>
          <TableColumn>Descuento nómina</TableColumn>
          <TableColumn>Estado</TableColumn>
          <TableColumn>Aprobado por</TableColumn>
          <TableColumn>Notas</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent={loading ? "Cargando..." : "Sin registros"}
          items={data?.items ?? []}
        >
          {(row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{row.employeeName ?? "-"}</span>
                  <span className="text-xs text-default-400">{row.employeeCode ?? ""}</span>
                </div>
              </TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color={row.leaveType === "PAID" ? "success" : "warning"}>
                  {row.leaveType === "PAID" ? "Remunerado" : "No remunerado"}
                </Chip>
              </TableCell>
              <TableCell>{formatDate(row.startDate)}</TableCell>
              <TableCell>{formatDate(row.endDate)}</TableCell>
              <TableCell>{row.durationDays}</TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color={row.payrollDeduction ? "danger" : "default"}>
                  {row.payrollDeduction ? "Sí" : "No"}
                </Chip>
              </TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color={row.approvedBy ? "success" : "warning"}>
                  {row.approvedBy ? "Aprobado" : "Pendiente"}
                </Chip>
              </TableCell>
              <TableCell>{row.approvedByName || "-"}</TableCell>
              <TableCell className="max-w-[180px] truncate text-sm">{row.notes || "-"}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      </div>

      {data && data.total > (data.pageSize ?? 15) ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-default-500">Total: {data.total}</p>
          <Pagination page={page} total={totalPages} onChange={setPage} />
        </div>
      ) : null}
    </div>
  );
}

// ── Requests Admin Tab ────────────────────────────────────────────────────────

function PeticionesAdminTab() {
  const [data, setData] = useState<PaginatedRequests | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Resolve modal
  const [resolveRow, setResolveRow] = useState<RequestRow | null>(null);
  const [resolveStatus, setResolveStatus] = useState<RequestStatus>("APROBADO");
  const [resolveNotes, setResolveNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Detail modal
  const [detailRow, setDetailRow] = useState<RequestRow | null>(null);

  const totalPages = useMemo(() => {
    if (!data) return 1;

    return Math.max(1, Math.ceil(data.total / (data.pageSize ?? 15)));
  }, [data]);

  async function load(p = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "15" });

      if (employeeFilter) params.set("employeeId", employeeFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/hr/peticiones?${params}`);

      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(1); setPage(1); }, [employeeFilter, statusFilter, typeFilter, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleResolve() {
    if (!resolveRow) return;
    setSaving(true);
    try {
      await apiJson(`/api/hr/peticiones/${resolveRow.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: resolveStatus, responseNotes: resolveNotes }),
      });
      toast.success("Petición actualizada");
      setResolveRow(null);
      setResolveNotes("");
      void load(page);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-default-500">
        Todas las peticiones, reclamos y PQR enviados por los empleados. Gestiona el estado y proporciona una respuesta.
      </p>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <Select
          className="col-span-2 sm:w-56"
          label="Empleado"
          placeholder="Todos"
          selectedKeys={employeeFilter ? [employeeFilter] : []}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => setEmployeeFilter(String(Array.from(keys)[0] ?? ""))}
        >
          {(data?.employeeOptions ?? []).map((e) => (
            <SelectItem key={e.id}>{e.name}{e.employeeCode ? ` (${e.employeeCode})` : ""}</SelectItem>
          ))}
        </Select>

        <Select
          className="sm:w-40"
          label="Tipo"
          selectedKeys={[typeFilter]}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => setTypeFilter(String(Array.from(keys)[0] ?? "ALL"))}
        >
          <SelectItem key="ALL">Todos</SelectItem>
          <SelectItem key="PERMISO">Permiso</SelectItem>
          <SelectItem key="RECLAMO">Reclamo</SelectItem>
          <SelectItem key="SOLICITUD">Solicitud</SelectItem>
          <SelectItem key="SUGERENCIA">Sugerencia</SelectItem>
          <SelectItem key="PQR">PQR</SelectItem>
        </Select>

        <Select
          className="sm:w-40"
          label="Estado"
          selectedKeys={[statusFilter]}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => setStatusFilter(String(Array.from(keys)[0] ?? "ALL"))}
        >
          <SelectItem key="ALL">Todos</SelectItem>
          <SelectItem key="PENDIENTE">Pendiente</SelectItem>
          <SelectItem key="EN_REVISION">En revisión</SelectItem>
          <SelectItem key="APROBADO">Aprobado</SelectItem>
          <SelectItem key="RECHAZADO">Rechazado</SelectItem>
          <SelectItem key="CERRADO">Cerrado</SelectItem>
        </Select>

        <Input className="sm:w-40" label="Desde" size="sm" type="date" value={dateFrom} variant="bordered" onValueChange={setDateFrom} />
        <Input className="sm:w-40" label="Hasta" size="sm" type="date" value={dateTo} variant="bordered" onValueChange={setDateTo} />
        <Button className="self-end" size="sm" variant="flat" onPress={() => { setEmployeeFilter(""); setStatusFilter("ALL"); setTypeFilter("ALL"); setDateFrom(""); setDateTo(""); }}>
          Limpiar
        </Button>
      </div>

      <div className="overflow-x-auto">
      <Table aria-label="Peticiones y PQR de empleados">
        <TableHeader>
          <TableColumn>Empleado</TableColumn>
          <TableColumn>Tipo</TableColumn>
          <TableColumn>Asunto</TableColumn>
          <TableColumn>Prioridad</TableColumn>
          <TableColumn>Estado</TableColumn>
          <TableColumn>Creado</TableColumn>
          <TableColumn>Acciones</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent={loading ? "Cargando..." : "Sin peticiones"}
          items={data?.items ?? []}
        >
          {(row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{row.employeeName ?? "-"}</span>
                  <span className="text-xs text-default-400">{row.employeeCode ?? ""}</span>
                </div>
              </TableCell>
              <TableCell>
                <Chip size="sm" variant="flat">{REQUEST_TYPE_LABELS[row.type]}</Chip>
              </TableCell>
              <TableCell className="max-w-[200px] truncate">{row.subject}</TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color={row.priority === "ALTA" ? "danger" : row.priority === "MEDIA" ? "warning" : "default"}>
                  {row.priority}
                </Chip>
              </TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color={requestStatusColor(row.status)}>
                  {REQUEST_STATUS_LABELS[row.status]}
                </Chip>
              </TableCell>
              <TableCell>{formatDate(row.createdAt)}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button size="sm" variant="flat" onPress={() => setDetailRow(row)}>
                    Ver
                  </Button>
                  {row.status === "PENDIENTE" || row.status === "EN_REVISION" ? (
                    <Button
                      color="primary"
                      size="sm"
                      variant="flat"
                      onPress={() => {
                        setResolveRow(row);
                        setResolveStatus("APROBADO");
                        setResolveNotes(row.responseNotes ?? "");
                      }}
                    >
                      Responder
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      </div>

      {data && data.total > (data.pageSize ?? 15) ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-default-500">Total: {data.total}</p>
          <Pagination page={page} total={totalPages} onChange={setPage} />
        </div>
      ) : null}

      {/* Resolve modal */}
      <Modal disableAnimation isOpen={Boolean(resolveRow)} size="lg" onClose={() => setResolveRow(null)}>
        <ModalContent>
          <ModalHeader>Responder petición</ModalHeader>
          <ModalBody className="space-y-3">
            {resolveRow ? (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase text-default-400">Empleado</p>
                  <p>{resolveRow.employeeName ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-default-400">Asunto</p>
                  <p>{resolveRow.subject}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-default-400">Descripción</p>
                  <p className="text-sm whitespace-pre-wrap">{resolveRow.description}</p>
                </div>
                <Select
                  isRequired
                  label="Acción / nuevo estado"
                  selectedKeys={[resolveStatus]}
                  variant="bordered"
                  onSelectionChange={(keys) => setResolveStatus(String(Array.from(keys)[0]) as RequestStatus)}
                >
                  {RESOLVE_STATUSES.map((s) => (
                    <SelectItem key={s.value}>{s.label}</SelectItem>
                  ))}
                </Select>
                <Textarea
                  label="Notas de respuesta"
                  minRows={3}
                  placeholder="Escribe la respuesta o justificación para el empleado..."
                  value={resolveNotes}
                  variant="bordered"
                  onValueChange={setResolveNotes}
                />
              </>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button isDisabled={saving} variant="flat" onPress={() => setResolveRow(null)}>Cancelar</Button>
            <Button color="primary" isDisabled={saving} isLoading={saving} onPress={() => void handleResolve()}>
              Guardar respuesta
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Detail modal */}
      <Modal disableAnimation isOpen={Boolean(detailRow)} size="lg" onClose={() => setDetailRow(null)}>
        <ModalContent>
          <ModalHeader>Detalle de petición</ModalHeader>
          <ModalBody className="space-y-3">
            {detailRow ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Chip size="sm" variant="flat">{REQUEST_TYPE_LABELS[detailRow.type]}</Chip>
                  <Chip size="sm" variant="flat" color={requestStatusColor(detailRow.status)}>
                    {REQUEST_STATUS_LABELS[detailRow.status]}
                  </Chip>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-default-400">Empleado</p>
                  <p>{detailRow.employeeName ?? "-"} {detailRow.employeeCode ? `(${detailRow.employeeCode})` : ""}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-default-400">Asunto</p>
                  <p>{detailRow.subject}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-default-400">Descripción</p>
                  <p className="text-sm whitespace-pre-wrap">{detailRow.description}</p>
                </div>
                {detailRow.responseNotes ? (
                  <div className="rounded-medium border border-default-200 bg-content2/50 p-3">
                    <p className="text-xs font-semibold uppercase text-default-400">
                      Respuesta{detailRow.resolvedByName ? ` — ${detailRow.resolvedByName}` : ""}
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{detailRow.responseNotes}</p>
                  </div>
                ) : null}
              </>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setDetailRow(null)}>Cerrar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function HrAdminClient() {
  return (
    <Tabs
      aria-label="Gestión RR.HH."
      classNames={{
        tabList: "border-b border-default-200/30 bg-transparent rounded-none p-0 gap-0",
        tab: "rounded-none data-[selected=true]:border-b-2 data-[selected=true]:border-primary data-[selected=true]:text-primary text-default-500",
        cursor: "hidden",
      }}
      variant="underlined"
    >
      <Tab key="permisos" title="Permisos y ausencias">
        <div className="pt-4">
          <LeavesAdminTab />
        </div>
      </Tab>
      <Tab key="peticiones" title="Peticiones y PQR">
        <div className="pt-4">
          <PeticionesAdminTab />
        </div>
      </Tab>
    </Tabs>
  );
}
