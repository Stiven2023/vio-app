"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
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
import { BsPlus, BsClockHistory, BsFileEarmarkText } from "react-icons/bs";

import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type LeaveRow = {
  id: string;
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
  employee: { id: string; name: string; employeeCode: string | null } | null;
  items: LeaveRow[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

type PaginatedRequests = {
  items: RequestRow[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

type RequestType = "PERMISO" | "RECLAMO" | "SOLICITUD" | "SUGERENCIA" | "PQR";
type PriorityKey = "BAJA" | "MEDIA" | "ALTA";
type RequestStatus = "PENDIENTE" | "APROBADO" | "RECHAZADO" | "EN_REVISION" | "CERRADO";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(`${value}T00:00:00`);

  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString("es-CO");
}

function leaveStatusLabel(row: LeaveRow) {
  return row.approvedBy ? "Aprobado" : "Pendiente";
}

function leaveStatusColor(row: LeaveRow): "success" | "warning" {
  return row.approvedBy ? "success" : "warning";
}

function requestStatusColor(status: RequestStatus): "success" | "danger" | "warning" | "primary" | "default" {
  switch (status) {
    case "APROBADO": return "success";
    case "RECHAZADO": return "danger";
    case "EN_REVISION": return "primary";
    case "CERRADO": return "default";
    default: return "warning";
  }
}

function priorityColor(p: PriorityKey): "danger" | "warning" | "default" {
  if (p === "ALTA") return "danger";
  if (p === "MEDIA") return "warning";

  return "default";
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

// ── Mis Solicitudes de Permiso (Leaves) ───────────────────────────────────────

function MisSolicitudesTab() {
  const [data, setData] = useState<PaginatedLeaves | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // New leave modal
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  const totalPages = useMemo(() => {
    if (!data) return 1;

    return Math.max(1, Math.ceil(data.total / (data.pageSize ?? 10)));
  }, [data]);

  async function load(p = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "10" });
      const res = await fetch(`/api/hcm/mis-solicitudes?${params}`);

      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error("Las fechas de inicio y fin son obligatorias");

      return;
    }
    if (startDate > endDate) {
      toast.error("La fecha final no puede ser anterior a la inicial");

      return;
    }
    setSaving(true);
    try {
      await apiJson("/api/hcm/mis-solicitudes", {
        method: "POST",
        body: JSON.stringify({ startDate, endDate, notes }),
      });
      toast.success("Solicitud enviada correctamente");
      setOpen(false);
      setStartDate("");
      setEndDate("");
      setNotes("");
      void load(1);
      setPage(1);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-default-500">
            Tus solicitudes de permiso y ausencias. Envía una nueva solicitud para que RR.HH. la revise.
          </p>
          {data?.employee ? (
            <p className="mt-1 text-xs text-default-400">
              Empleado: <strong>{data.employee.name}</strong>
              {data.employee.employeeCode ? ` (${data.employee.employeeCode})` : ""}
            </p>
          ) : null}
        </div>
        <Button
          color="primary"
          startContent={<BsPlus />}
          onPress={() => setOpen(true)}
        >
          Nueva solicitud
        </Button>
      </div>

      <div className="overflow-x-auto">
      <Table aria-label="Mis solicitudes de permiso">
        <TableHeader>
          <TableColumn>Tipo</TableColumn>
          <TableColumn>Desde</TableColumn>
          <TableColumn>Hasta</TableColumn>
          <TableColumn>Días</TableColumn>
          <TableColumn>Estado</TableColumn>
          <TableColumn>Aprobado por</TableColumn>
          <TableColumn>Notas</TableColumn>
          <TableColumn>Fecha solicitud</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent={loading ? "Cargando..." : "No tienes solicitudes registradas"}
          items={data?.items ?? []}
        >
          {(row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Chip size="sm" variant="flat" color={row.leaveType === "PAID" ? "success" : "warning"}>
                  {row.leaveType === "PAID" ? "Remunerado" : "No remunerado"}
                </Chip>
              </TableCell>
              <TableCell>{formatDate(row.startDate)}</TableCell>
              <TableCell>{formatDate(row.endDate)}</TableCell>
              <TableCell>{row.durationDays}</TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color={leaveStatusColor(row)}>
                  {leaveStatusLabel(row)}
                </Chip>
              </TableCell>
              <TableCell>{row.approvedByName || "-"}</TableCell>
              <TableCell className="max-w-[200px] truncate">{row.notes || "-"}</TableCell>
              <TableCell>{formatDate(row.createdAt)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      </div>

      {data && data.total > (data.pageSize ?? 10) ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-default-500">Total: {data.total}</p>
          <Pagination page={page} total={totalPages} onChange={(p) => { setPage(p); }} />
        </div>
      ) : null}

      {/* Modal nueva solicitud */}
      <Modal disableAnimation isOpen={open} size="lg" onClose={() => setOpen(false)}>
        <ModalContent>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <ModalHeader>Nueva solicitud de permiso / ausencia</ModalHeader>
            <ModalBody className="space-y-3">
              <p className="text-sm text-default-500">
                Selecciona el rango de fechas. RR.HH. revisará tu solicitud y la aprobará o rechazará.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  isRequired
                  label="Fecha inicio"
                  min={new Date().toISOString().slice(0, 10)}
                  type="date"
                  value={startDate}
                  variant="bordered"
                  onValueChange={setStartDate}
                />
                <Input
                  isRequired
                  label="Fecha fin"
                  min={startDate || new Date().toISOString().slice(0, 10)}
                  type="date"
                  value={endDate}
                  variant="bordered"
                  onValueChange={setEndDate}
                />
              </div>
              <Textarea
                label="Observaciones (opcional)"
                minRows={3}
                placeholder="Motivo del permiso u observaciones adicionales..."
                value={notes}
                variant="bordered"
                onValueChange={setNotes}
              />
            </ModalBody>
            <ModalFooter>
              <Button isDisabled={saving} variant="flat" onPress={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button color="primary" isDisabled={saving} isLoading={saving} type="submit">
                Enviar solicitud
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}

// ── Mis Peticiones / PQR ──────────────────────────────────────────────────────

const REQUEST_TYPES: Array<{ value: RequestType; label: string }> = [
  { value: "PERMISO", label: "Permiso" },
  { value: "RECLAMO", label: "Reclamo" },
  { value: "SOLICITUD", label: "Solicitud" },
  { value: "SUGERENCIA", label: "Sugerencia" },
  { value: "PQR", label: "PQR" },
];

const PRIORITIES: Array<{ value: PriorityKey; label: string }> = [
  { value: "BAJA", label: "Baja" },
  { value: "MEDIA", label: "Media" },
  { value: "ALTA", label: "Alta" },
];

function MisPeticionesTab() {
  const [data, setData] = useState<PaginatedRequests | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // New request modal
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<RequestType>("SOLICITUD");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const [requestHours, setRequestHours] = useState("");
  const [priority, setPriority] = useState<PriorityKey>("MEDIA");

  // Detail modal
  const [detailRow, setDetailRow] = useState<RequestRow | null>(null);

  const totalPages = useMemo(() => {
    if (!data) return 1;

    return Math.max(1, Math.ceil(data.total / (data.pageSize ?? 10)));
  }, [data]);

  async function load(p = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "10" });
      const res = await fetch(`/api/hcm/mis-peticiones?${params}`);

      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function resetForm() {
    setType("SOLICITUD");
    setSubject("");
    setDescription("");
    setRequestDate("");
    setRequestHours("");
    setPriority("MEDIA");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim()) { toast.error("El asunto es obligatorio"); return; }
    if (!description.trim()) { toast.error("La descripción es obligatoria"); return; }
    if (type === "PERMISO" && !requestDate) {
      toast.error("Para permisos debes indicar la fecha");

      return;
    }

    setSaving(true);
    try {
      await apiJson("/api/hcm/mis-peticiones", {
        method: "POST",
        body: JSON.stringify({
          type,
          subject: subject.trim(),
          description: description.trim(),
          requestDate: requestDate || undefined,
          requestHours: requestHours ? Number(requestHours) : undefined,
          priority,
        }),
      });
      toast.success("Petición enviada correctamente");
      setOpen(false);
      resetForm();
      void load(1);
      setPage(1);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-default-500">
          Tus reclamos, solicitudes, sugerencias y PQR enviados a RR.HH. Puedes ver el estado y la respuesta de cada uno.
        </p>
        <Button
          color="primary"
          startContent={<BsPlus />}
          onPress={() => setOpen(true)}
        >
          Nueva petición
        </Button>
      </div>

      <div className="overflow-x-auto">
      <Table aria-label="Mis peticiones y PQR">
        <TableHeader>
          <TableColumn>Tipo</TableColumn>
          <TableColumn>Asunto</TableColumn>
          <TableColumn>Prioridad</TableColumn>
          <TableColumn>Estado</TableColumn>
          <TableColumn>Fecha solicitada</TableColumn>
          <TableColumn>Respondido por</TableColumn>
          <TableColumn>Creado</TableColumn>
          <TableColumn>Detalle</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent={loading ? "Cargando..." : "No tienes peticiones registradas"}
          items={data?.items ?? []}
        >
          {(row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Chip size="sm" variant="flat">
                  {REQUEST_TYPE_LABELS[row.type]}
                </Chip>
              </TableCell>
              <TableCell className="max-w-[200px] truncate font-medium">
                {row.subject}
              </TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color={priorityColor(row.priority)}>
                  {row.priority}
                </Chip>
              </TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color={requestStatusColor(row.status)}>
                  {REQUEST_STATUS_LABELS[row.status]}
                </Chip>
              </TableCell>
              <TableCell>{row.requestDate ? formatDate(row.requestDate) : "-"}</TableCell>
              <TableCell>{row.resolvedByName || "-"}</TableCell>
              <TableCell>{formatDate(row.createdAt)}</TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => setDetailRow(row)}
                >
                  Ver
                </Button>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      </div>

      {data && data.total > (data.pageSize ?? 10) ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-default-500">Total: {data.total}</p>
          <Pagination page={page} total={totalPages} onChange={(p) => { setPage(p); }} />
        </div>
      ) : null}

      {/* Nueva petición modal */}
      <Modal disableAnimation isOpen={open} size="2xl" onClose={() => { setOpen(false); resetForm(); }}>
        <ModalContent>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <ModalHeader>Nueva petición / PQR</ModalHeader>
            <ModalBody className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select
                  isRequired
                  label="Tipo"
                  selectedKeys={[type]}
                  variant="bordered"
                  onSelectionChange={(keys) => setType(String(Array.from(keys)[0]) as RequestType)}
                >
                  {REQUEST_TYPES.map((t) => (
                    <SelectItem key={t.value}>{t.label}</SelectItem>
                  ))}
                </Select>

                <Select
                  isRequired
                  label="Prioridad"
                  selectedKeys={[priority]}
                  variant="bordered"
                  onSelectionChange={(keys) => setPriority(String(Array.from(keys)[0]) as PriorityKey)}
                >
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value}>{p.label}</SelectItem>
                  ))}
                </Select>
              </div>

              <Input
                isRequired
                label="Asunto"
                maxLength={255}
                placeholder="Describe brevemente el motivo"
                value={subject}
                variant="bordered"
                onValueChange={setSubject}
              />

              <Textarea
                isRequired
                label="Descripción"
                minRows={4}
                placeholder="Explica en detalle tu petición, reclamo o solicitud..."
                value={description}
                variant="bordered"
                onValueChange={setDescription}
              />

              {type === "PERMISO" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    isRequired
                    label="Fecha del permiso"
                    type="date"
                    value={requestDate}
                    variant="bordered"
                    onValueChange={setRequestDate}
                  />
                  <Input
                    label="Horas solicitadas (opcional)"
                    max="24"
                    min="0.5"
                    step="0.5"
                    type="number"
                    value={requestHours}
                    variant="bordered"
                    onValueChange={setRequestHours}
                  />
                </div>
              ) : null}
            </ModalBody>
            <ModalFooter>
              <Button isDisabled={saving} variant="flat" onPress={() => { setOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button color="primary" isDisabled={saving} isLoading={saving} type="submit">
                Enviar petición
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Detalle petición modal */}
      <Modal disableAnimation isOpen={Boolean(detailRow)} size="lg" onClose={() => setDetailRow(null)}>
        <ModalContent>
          <ModalHeader>
            Detalle de petición
          </ModalHeader>
          <ModalBody className="space-y-3">
            {detailRow ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Chip size="sm" variant="flat">{REQUEST_TYPE_LABELS[detailRow.type]}</Chip>
                  <Chip size="sm" variant="flat" color={requestStatusColor(detailRow.status)}>
                    {REQUEST_STATUS_LABELS[detailRow.status]}
                  </Chip>
                  <Chip size="sm" variant="flat" color={priorityColor(detailRow.priority)}>
                    Prioridad: {detailRow.priority}
                  </Chip>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-default-400">Asunto</p>
                  <p className="mt-0.5">{detailRow.subject}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-default-400">Descripción</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm">{detailRow.description}</p>
                </div>

                {detailRow.responseNotes ? (
                  <div className="rounded-medium border border-default-200 bg-content2/50 p-3">
                    <p className="text-xs font-semibold uppercase text-default-400">
                      Respuesta de RR.HH.
                      {detailRow.resolvedByName ? ` — ${detailRow.resolvedByName}` : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{detailRow.responseNotes}</p>
                  </div>
                ) : detailRow.status !== "PENDIENTE" ? (
                  <p className="text-sm text-default-400 italic">Sin notas de respuesta</p>
                ) : null}

                <div className="grid grid-cols-2 gap-2 text-xs text-default-400">
                  <div>
                    <span className="font-semibold">Creado: </span>
                    {formatDate(detailRow.createdAt)}
                  </div>
                  {detailRow.resolvedAt ? (
                    <div>
                      <span className="font-semibold">Resuelto: </span>
                      {formatDate(detailRow.resolvedAt)}
                    </div>
                  ) : null}
                </div>
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

// ── Summary Cards ─────────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Card className="border border-default-200/40">
      <CardBody className="flex flex-row items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-primary/10 text-primary text-xl">
          {icon}
        </div>
        <div>
          <p className="text-base font-semibold">{title}</p>
          <p className="text-xs text-default-500">{subtitle}</p>
        </div>
      </CardBody>
    </Card>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function HcmPortalClient() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SummaryCard
          icon={<BsClockHistory />}
          subtitle="Permisos, ausencias y vacaciones"
          title="Solicitudes de permiso"
        />
        <SummaryCard
          icon={<BsFileEarmarkText />}
          subtitle="Reclamos, PQR, sugerencias y solicitudes"
          title="Peticiones y PQR"
        />
      </div>

      <Tabs
        aria-label="Portal empleado"
        classNames={{
          tabList: "border-b border-default-200/30 bg-transparent rounded-none p-0 gap-0",
          tab: "rounded-none data-[selected=true]:border-b-2 data-[selected=true]:border-primary data-[selected=true]:text-primary text-default-500",
          cursor: "hidden",
        }}
        variant="underlined"
      >
        <Tab key="solicitudes" title="Mis solicitudes de permiso">
          <div className="pt-4">
            <MisSolicitudesTab />
          </div>
        </Tab>
        <Tab key="peticiones" title="Mis peticiones / PQR">
          <div className="pt-4">
            <MisPeticionesTab />
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}
