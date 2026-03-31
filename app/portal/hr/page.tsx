"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import { Tab, Tabs } from "@heroui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { toast } from "react-hot-toast";
import {
  BsArrowLeft,
  BsCalendar2Check,
  BsCalendarDate,
  BsChatLeftText,
  BsClipboardCheck,
  BsExclamationTriangle,
  BsFileEarmarkText,
  BsPatchCheck,
  BsPersonBadge,
} from "react-icons/bs";

type LeaveItem = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  notes: string | null;
  approvedByName: string | null;
  createdAt: string | null;
};

type EmployeeInfo = {
  id: string;
  name: string | null;
  employeeCode: string | null;
};

type SolicitudesData = {
  employee: EmployeeInfo | null;
  items: LeaveItem[];
  total: number;
};

type RequestItem = {
  id: string;
  type: string;
  subject: string;
  description: string;
  requestDate: string | null;
  requestHours: string | null;
  priority: string;
  status: string;
  responseNotes: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string | null;
};

type PeticionesData = {
  items: RequestItem[];
  total: number;
};

const COURSES = [
  {
    id: "1",
    title: "Seguridad y Salud en el Trabajo (SST)",
    description: "Curso obligatorio para todos los empleados. Duración: 8 horas.",
    category: "Obligatorio",
    duration: "8h",
    status: "disponible",
  },
  {
    id: "2",
    title: "Manejo de Maquinaria Industrial",
    description: "Capacitación en el uso seguro de máquinas de confección y corte.",
    category: "Operativo",
    duration: "12h",
    status: "disponible",
  },
  {
    id: "3",
    title: "Control de Calidad en Producción",
    description: "Estándares de calidad, inspección de prendas y reportes.",
    category: "Producción",
    duration: "6h",
    status: "próximamente",
  },
  {
    id: "4",
    title: "Excel Básico para Operarios",
    description: "Introducción a herramientas ofimáticas para gestión de datos.",
    category: "Tecnología",
    duration: "10h",
    status: "próximamente",
  },
  {
    id: "5",
    title: "Atención al Cliente y Comunicación",
    description: "Habilidades blandas para el trato con clientes y compañeros.",
    category: "Habilidades",
    duration: "4h",
    status: "disponible",
  },
];

const REQUEST_TYPES = [
  { value: "PERMISO", label: "Permiso de ausencia" },
  { value: "RECLAMO", label: "Reclamo" },
  { value: "SOLICITUD", label: "Solicitud general" },
  { value: "SUGERENCIA", label: "Sugerencia" },
  { value: "PQR", label: "PQR (Petición, Queja o Reclamo)" },
];

const REQUEST_PRIORITIES = [
  { value: "BAJA", label: "Baja" },
  { value: "MEDIA", label: "Media" },
  { value: "ALTA", label: "Alta" },
];

function requestTypeLabel(type: string) {
  return REQUEST_TYPES.find((t) => t.value === type)?.label ?? type;
}

function requestStatusChip(status: string) {
  const map: Record<string, { color: "default" | "warning" | "primary" | "success" | "danger"; label: string }> = {
    PENDIENTE: { color: "warning", label: "Pendiente" },
    EN_REVISION: { color: "primary", label: "En revisión" },
    APROBADO: { color: "success", label: "Aprobado" },
    RECHAZADO: { color: "danger", label: "Rechazado" },
    RESUELTO: { color: "success", label: "Resuelto" },
  };
  const entry = map[status] ?? { color: "default" as const, label: status };

  return (
    <Chip color={entry.color} size="sm" variant="flat">
      {entry.label}
    </Chip>
  );
}

function priorityChip(priority: string) {
  const map: Record<string, { color: "default" | "warning" | "danger"; label: string }> = {
    BAJA: { color: "default", label: "Baja" },
    MEDIA: { color: "warning", label: "Media" },
    ALTA: { color: "danger", label: "Alta" },
  };
  const entry = map[priority] ?? { color: "default" as const, label: priority };

  return (
    <Chip color={entry.color} size="sm" variant="flat">
      {entry.label}
    </Chip>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return value;

  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function StatusChip({ approved }: { approved: string | null }) {
  if (approved) {
    return (
      <Chip color="success" size="sm" variant="flat">
        Aprobado por {approved}
      </Chip>
    );
  }

  return (
    <Chip color="warning" size="sm" variant="flat">
      Pendiente aprobación
    </Chip>
  );
}

export default function PortalHrPage() {
  const router = useRouter();

  // ── Vacaciones ──
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [requests, setRequests] = useState<LeaveItem[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Peticiones (permiso, reclamo, solicitud, PQR) ──
  const [peticiones, setPeticiones] = useState<RequestItem[]>([]);
  const [totalPeticiones, setTotalPeticiones] = useState(0);

  // Permiso form
  const [permisoDate, setPermisoDate] = useState("");
  const [permisoHours, setPermisoHours] = useState("");
  const [permisoNotes, setPermisoNotes] = useState("");
  const [submittingPermiso, setSubmittingPermiso] = useState(false);

  // PQR / Reclamo form
  const [pqrType, setPqrType] = useState("RECLAMO");
  const [pqrSubject, setPqrSubject] = useState("");
  const [pqrDescription, setPqrDescription] = useState("");
  const [pqrPriority, setPqrPriority] = useState("MEDIA");
  const [submittingPqr, setSubmittingPqr] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res1, res2] = await Promise.all([
        fetch("/api/hr/mis-solicitudes", { credentials: "include" }),
        fetch("/api/hr/mis-peticiones", { credentials: "include" }),
      ]);

      if (res1.status === 401 || res2.status === 401) {
        router.push("/login");

        return;
      }

      if (res1.ok) {
        const data = (await res1.json()) as SolicitudesData;

        setEmployee(data.employee);
        setRequests(data.items ?? []);
        setTotalRequests(data.total ?? 0);
      } else {
        toast.error("No se pudieron cargar las solicitudes de vacaciones");
      }

      if (res2.ok) {
        const data2 = (await res2.json()) as PeticionesData;

        setPeticiones(data2.items ?? []);
        setTotalPeticiones(data2.total ?? 0);
      } else {
        toast.error("No se pudieron cargar las peticiones");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error("Debes indicar las fechas de inicio y fin");

      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/hr/mis-solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ startDate, endDate, notes }),
      });

      if (!res.ok) {
        const text = await res.text();

        toast.error(text || "No se pudo enviar la solicitud");

        return;
      }

      toast.success("Solicitud enviada correctamente");
      setStartDate("");
      setEndDate("");
      setNotes("");
      void loadData();
    } catch {
      toast.error("Error al enviar la solicitud");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePermisoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permisoDate) {
      toast.error("La fecha del permiso es requerida");

      return;
    }

    setSubmittingPermiso(true);
    try {
      const res = await fetch("/api/hr/mis-peticiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "PERMISO",
          subject: `Permiso del ${permisoDate}`,
          description: permisoNotes || "Solicitud de permiso de ausencia",
          requestDate: permisoDate,
          requestHours: permisoHours || null,
          priority: "MEDIA",
        }),
      });

      if (!res.ok) {
        const text = await res.text();

        toast.error(text || "No se pudo enviar el permiso");

        return;
      }

      toast.success("Solicitud de permiso enviada correctamente");
      setPermisoDate("");
      setPermisoHours("");
      setPermisoNotes("");
      void loadData();
    } catch {
      toast.error("Error al enviar la solicitud");
    } finally {
      setSubmittingPermiso(false);
    }
  };

  const handlePqrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pqrSubject.trim()) {
      toast.error("El asunto es requerido");

      return;
    }

    if (!pqrDescription.trim()) {
      toast.error("La descripción es requerida");

      return;
    }

    setSubmittingPqr(true);
    try {
      const res = await fetch("/api/hr/mis-peticiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: pqrType,
          subject: pqrSubject,
          description: pqrDescription,
          priority: pqrPriority,
        }),
      });

      if (!res.ok) {
        const text = await res.text();

        toast.error(text || "No se pudo enviar la petición");

        return;
      }

      toast.success("Petición enviada correctamente");
      setPqrSubject("");
      setPqrDescription("");
      setPqrType("RECLAMO");
      setPqrPriority("MEDIA");
      void loadData();
    } catch {
      toast.error("Error al enviar la petición");
    } finally {
      setSubmittingPqr(false);
    }
  };

  const durationDays =
    startDate && endDate && startDate <= endDate
      ? Math.round(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
            86_400_000,
        ) + 1
      : null;

  return (
    <div className="min-h-screen bg-default-50">
      {/* Header */}
      <div className="border-b border-default-200 bg-content1">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => router.push("/home")}
          >
            <BsArrowLeft />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Portal del Empleado — RR.HH.</h1>
            {employee ? (
              <p className="text-sm text-default-500">
                {employee.name ?? "Empleado"}{" "}
                {employee.employeeCode ? `(${employee.employeeCode})` : ""}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <Tabs
            aria-label="Portal RR.HH."
            color="primary"
            variant="underlined"
          >
            {/* ── TAB 1: Solicitar Vacaciones ── */}
            <Tab
              key="solicitar"
              title={
                <div className="flex items-center gap-2">
                  <BsCalendarDate />
                  <span>Solicitar Vacaciones</span>
                </div>
              }
            >
              <div className="grid gap-6 md:grid-cols-2 mt-4">
                {/* Form */}
                <Card>
                  <CardHeader>
                    <div className="font-semibold">Nueva solicitud</div>
                  </CardHeader>
                  <CardBody>
                    <form className="space-y-4" onSubmit={handleSubmit}>
                      <Input
                        isRequired
                        label="Fecha de inicio"
                        max={endDate || undefined}
                        type="date"
                        value={startDate}
                        onValueChange={setStartDate}
                      />
                      <Input
                        isRequired
                        label="Fecha de fin"
                        min={startDate || undefined}
                        type="date"
                        value={endDate}
                        onValueChange={setEndDate}
                      />
                      {durationDays !== null ? (
                        <p className="text-sm text-primary font-medium">
                          Duración: {durationDays}{" "}
                          {durationDays === 1 ? "día" : "días"}
                        </p>
                      ) : null}
                      <Textarea
                        label="Motivo / Notas (opcional)"
                        maxRows={3}
                        placeholder="Ej: vacaciones familiares, viaje..."
                        value={notes}
                        onValueChange={setNotes}
                      />
                      <Button
                        fullWidth
                        color="primary"
                        isLoading={submitting}
                        type="submit"
                      >
                        Enviar solicitud
                      </Button>
                    </form>
                  </CardBody>
                </Card>

                {/* Info */}
                <Card>
                  <CardHeader>
                    <div className="font-semibold">¿Cómo funciona?</div>
                  </CardHeader>
                  <CardBody className="space-y-4 text-sm text-default-600">
                    <div className="flex gap-3">
                      <BsCalendar2Check className="mt-0.5 shrink-0 text-primary" />
                      <p>
                        Selecciona las fechas de inicio y fin de tus vacaciones y
                        envía la solicitud. El equipo de RR.HH. la revisará a la
                        brevedad.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <BsPersonBadge className="mt-0.5 shrink-0 text-primary" />
                      <p>
                        Recibirás confirmación del estado una vez sea procesada
                        por tu supervisor o el área de RR.HH.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <BsFileEarmarkText className="mt-0.5 shrink-0 text-primary" />
                      <p>
                        Puedes ver el historial de todas tus solicitudes en la
                        pestaña <strong>Mis Solicitudes</strong>.
                      </p>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            {/* ── TAB 2: Mis Solicitudes ── */}
            <Tab
              key="solicitudes"
              title={
                <div className="flex items-center gap-2">
                  <BsCalendar2Check />
                  <span>
                    Mis Solicitudes
                    {totalRequests > 0 ? (
                      <Chip
                        className="ml-1"
                        color="primary"
                        size="sm"
                        variant="flat"
                      >
                        {totalRequests}
                      </Chip>
                    ) : null}
                  </span>
                </div>
              }
            >
              <div className="mt-4">
                <Card>
                  <CardBody>
                    <Table
                      removeWrapper
                      aria-label="Solicitudes de vacaciones"
                    >
                      <TableHeader>
                        <TableColumn>TIPO</TableColumn>
                        <TableColumn>FECHA INICIO</TableColumn>
                        <TableColumn>FECHA FIN</TableColumn>
                        <TableColumn>DÍAS</TableColumn>
                        <TableColumn>NOTAS</TableColumn>
                        <TableColumn>ESTADO</TableColumn>
                        <TableColumn>REGISTRADO</TableColumn>
                      </TableHeader>
                      <TableBody
                        emptyContent="No tienes solicitudes registradas"
                        items={requests}
                      >
                        {(row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Chip
                                color={
                                  row.leaveType === "PAID"
                                    ? "success"
                                    : "default"
                                }
                                size="sm"
                                variant="flat"
                              >
                                {row.leaveType === "PAID"
                                  ? "Remunerado"
                                  : "No remunerado"}
                              </Chip>
                            </TableCell>
                            <TableCell>{formatDate(row.startDate)}</TableCell>
                            <TableCell>{formatDate(row.endDate)}</TableCell>
                            <TableCell>{row.durationDays}</TableCell>
                            <TableCell>
                              {row.notes ? (
                                <span className="text-sm">{row.notes}</span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              <StatusChip approved={row.approvedByName} />
                            </TableCell>
                            <TableCell>{formatDate(row.createdAt)}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            {/* ── TAB 3: Solicitar Permiso ── */}
            <Tab
              key="permiso"
              title={
                <div className="flex items-center gap-2">
                  <BsClipboardCheck />
                  <span>Solicitar Permiso</span>
                </div>
              }
            >
              <div className="grid gap-6 md:grid-cols-2 mt-4">
                <Card>
                  <CardHeader>
                    <div className="font-semibold">Nuevo permiso de ausencia</div>
                  </CardHeader>
                  <CardBody>
                    <form className="space-y-4" onSubmit={handlePermisoSubmit}>
                      <Input
                        isRequired
                        label="Fecha del permiso"
                        type="date"
                        value={permisoDate}
                        onValueChange={setPermisoDate}
                      />
                      <Input
                        label="Horas de ausencia (opcional)"
                        max="24"
                        min="0.5"
                        placeholder="Ej: 4"
                        step="0.5"
                        type="number"
                        value={permisoHours}
                        onValueChange={setPermisoHours}
                      />
                      <Textarea
                        label="Motivo del permiso"
                        maxRows={4}
                        placeholder="Describe brevemente el motivo de tu ausencia..."
                        value={permisoNotes}
                        onValueChange={setPermisoNotes}
                      />
                      <Button
                        fullWidth
                        color="primary"
                        isLoading={submittingPermiso}
                        type="submit"
                      >
                        Enviar solicitud de permiso
                      </Button>
                    </form>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="font-semibold">¿Qué es un permiso?</div>
                  </CardHeader>
                  <CardBody className="space-y-4 text-sm text-default-600">
                    <div className="flex gap-3">
                      <BsClipboardCheck className="mt-0.5 shrink-0 text-primary" />
                      <p>
                        Un permiso es una ausencia puntual de horas o un día por
                        motivos personales, médicos, familiares u otros. Es
                        diferente a las vacaciones.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <BsPersonBadge className="mt-0.5 shrink-0 text-primary" />
                      <p>
                        El permiso debe ser aprobado por tu supervisor o el área
                        de RR.HH. antes de ausentarte.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <BsFileEarmarkText className="mt-0.5 shrink-0 text-primary" />
                      <p>
                        Puedes hacer seguimiento a todos tus permisos y
                        peticiones en la pestaña{" "}
                        <strong>Mis Peticiones</strong>.
                      </p>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            {/* ── TAB 4: Reclamos y PQR ── */}
            <Tab
              key="pqr"
              title={
                <div className="flex items-center gap-2">
                  <BsExclamationTriangle />
                  <span>Reclamos y PQR</span>
                </div>
              }
            >
              <div className="grid gap-6 md:grid-cols-2 mt-4">
                <Card>
                  <CardHeader>
                    <div className="font-semibold">Nueva petición / reclamo</div>
                  </CardHeader>
                  <CardBody>
                    <form className="space-y-4" onSubmit={handlePqrSubmit}>
                      <Select
                        isRequired
                        label="Tipo de petición"
                        selectedKeys={[pqrType]}
                        onSelectionChange={(keys) => {
                          const val = Array.from(keys)[0];

                          if (typeof val === "string") setPqrType(val);
                        }}
                      >
                        {REQUEST_TYPES.filter(
                          (t) => t.value !== "PERMISO",
                        ).map((t) => (
                          <SelectItem key={t.value}>{t.label}</SelectItem>
                        ))}
                      </Select>
                      <Select
                        label="Prioridad"
                        selectedKeys={[pqrPriority]}
                        onSelectionChange={(keys) => {
                          const val = Array.from(keys)[0];

                          if (typeof val === "string") setPqrPriority(val);
                        }}
                      >
                        {REQUEST_PRIORITIES.map((p) => (
                          <SelectItem key={p.value}>{p.label}</SelectItem>
                        ))}
                      </Select>
                      <Input
                        isRequired
                        label="Asunto"
                        maxLength={255}
                        placeholder="Resume tu petición en pocas palabras..."
                        value={pqrSubject}
                        onValueChange={setPqrSubject}
                      />
                      <Textarea
                        isRequired
                        label="Descripción detallada"
                        maxRows={6}
                        placeholder="Describe con detalle tu reclamo, solicitud o sugerencia..."
                        value={pqrDescription}
                        onValueChange={setPqrDescription}
                      />
                      <Button
                        fullWidth
                        color="primary"
                        isLoading={submittingPqr}
                        type="submit"
                      >
                        Enviar petición
                      </Button>
                    </form>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="font-semibold">Tipos de peticiones</div>
                  </CardHeader>
                  <CardBody className="space-y-4 text-sm text-default-600">
                    <div className="flex gap-3">
                      <BsExclamationTriangle className="mt-0.5 shrink-0 text-warning" />
                      <div>
                        <p className="font-medium text-foreground">Reclamo</p>
                        <p>
                          Manifiesta tu inconformidad ante una situación laboral
                          que consideras injusta o incorrecta.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <BsFileEarmarkText className="mt-0.5 shrink-0 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">Solicitud</p>
                        <p>
                          Pide elementos, permisos especiales, ajustes de
                          horario, certificados laborales u otros.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <BsChatLeftText className="mt-0.5 shrink-0 text-success" />
                      <div>
                        <p className="font-medium text-foreground">Sugerencia</p>
                        <p>
                          Propón mejoras en procesos, ambiente laboral o
                          cualquier aspecto de la empresa.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <BsPersonBadge className="mt-0.5 shrink-0 text-secondary" />
                      <div>
                        <p className="font-medium text-foreground">PQR</p>
                        <p>
                          Peticiones, Quejas y Reclamos formales que requieren
                          respuesta oficial por parte de la empresa.
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            {/* ── TAB 5: Mis Peticiones ── */}
            <Tab
              key="peticiones"
              title={
                <div className="flex items-center gap-2">
                  <BsFileEarmarkText />
                  <span>
                    Mis Peticiones
                    {totalPeticiones > 0 ? (
                      <Chip
                        className="ml-1"
                        color="primary"
                        size="sm"
                        variant="flat"
                      >
                        {totalPeticiones}
                      </Chip>
                    ) : null}
                  </span>
                </div>
              }
            >
              <div className="mt-4">
                <Card>
                  <CardBody>
                    <Table removeWrapper aria-label="Mis peticiones y reclamos">
                      <TableHeader>
                        <TableColumn>TIPO</TableColumn>
                        <TableColumn>ASUNTO</TableColumn>
                        <TableColumn>FECHA SOLICITADA</TableColumn>
                        <TableColumn>PRIORIDAD</TableColumn>
                        <TableColumn>ESTADO</TableColumn>
                        <TableColumn>RESPUESTA</TableColumn>
                        <TableColumn>REGISTRADO</TableColumn>
                      </TableHeader>
                      <TableBody
                        emptyContent="No tienes peticiones registradas"
                        items={peticiones}
                      >
                        {(row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Chip color="default" size="sm" variant="flat">
                                {requestTypeLabel(row.type)}
                              </Chip>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[180px]">
                                <p className="font-medium text-sm truncate">
                                  {row.subject}
                                </p>
                                {row.requestDate ? (
                                  <p className="text-xs text-default-500">
                                    Fecha: {formatDate(row.requestDate)}
                                    {row.requestHours
                                      ? ` · ${row.requestHours}h`
                                      : ""}
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              {row.requestDate
                                ? formatDate(row.requestDate)
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {priorityChip(row.priority)}
                            </TableCell>
                            <TableCell>
                              {requestStatusChip(row.status)}
                            </TableCell>
                            <TableCell>
                              {row.responseNotes ? (
                                <span className="text-sm">
                                  {row.responseNotes}
                                </span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>{formatDate(row.createdAt)}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            {/* ── TAB 6: Certificados y Cursos ── */}
            <Tab
              key="cursos"
              title={
                <div className="flex items-center gap-2">
                  <BsPatchCheck />
                  <span>Certificados y Cursos</span>
                </div>
              }
            >
              <div className="mt-4 space-y-4">
                <p className="text-sm text-default-500">
                  Capacitaciones disponibles y próximamente disponibles para los
                  empleados de Viomar.
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {COURSES.map((course) => (
                    <Card
                      key={course.id}
                      className={
                        course.status === "próximamente" ? "opacity-60" : ""
                      }
                    >
                      <CardHeader className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm leading-snug">
                            {course.title}
                          </p>
                          <Chip
                            className="mt-1"
                            color="primary"
                            size="sm"
                            variant="flat"
                          >
                            {course.category}
                          </Chip>
                        </div>
                        <BsPatchCheck className="shrink-0 text-primary mt-0.5" />
                      </CardHeader>
                      <CardBody className="space-y-3 pt-0">
                        <p className="text-sm text-default-600">
                          {course.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-default-500">
                            Duración: {course.duration}
                          </span>
                          {course.status === "disponible" ? (
                            <Button color="primary" size="sm" variant="flat">
                              Ver curso
                            </Button>
                          ) : (
                            <Chip color="default" size="sm" variant="flat">
                              Próximamente
                            </Chip>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>
          </Tabs>
        )}
      </div>
    </div>
  );
}
