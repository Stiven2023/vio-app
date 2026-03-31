"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input, Textarea } from "@heroui/input";
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

  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [requests, setRequests] = useState<LeaveItem[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hr/mis-solicitudes", {
        credentials: "include",
      });

      if (res.status === 401) {
        router.push("/login");

        return;
      }

      if (!res.ok) {
        toast.error("No se pudieron cargar las solicitudes");

        return;
      }

      const data = (await res.json()) as SolicitudesData;

      setEmployee(data.employee);
      setRequests(data.items ?? []);
      setTotalRequests(data.total ?? 0);
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

            {/* ── TAB 3: Certificados y Cursos ── */}
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
