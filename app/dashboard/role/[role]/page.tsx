import type { ReactNode } from "react";

import NextLink from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import {
  BsBoxSeam,
  BsClipboardData,
  BsClockHistory,
  BsPeople,
  BsTruck,
} from "react-icons/bs";

import { verifyAuthToken } from "@/src/utils/auth";
import { isOperarioRole } from "@/src/utils/role-status";
import { OperarioDashboard } from "@/app/dashboard/role/_components/operario-dashboard";
import { RoleCharts } from "@/app/dashboard/role/_components/role-charts";

type RoleConfig = {
  title: string;
  description: string;
  quickActions: Array<{ title: string; description: string; href: string; icon: ReactNode }>;
  metrics: Array<{ label: string; value: string; hint?: string }>;
};

const roleConfigs: Record<string, RoleConfig> = {
  LIDER_DE_PROCESOS: {
    title: "Dashboard Lider de Procesos",
    description: "Seguimiento general de pedidos y estados.",
    metrics: [
      { label: "Pedidos en cola", value: "18" },
      { label: "Atrasados", value: "4" },
      { label: "Finalizados hoy", value: "7" },
      { label: "Revisiones", value: "3" },
    ],
    quickActions: [
      {
        title: "Pedidos",
        description: "Revision y avances de pedidos.",
        href: "/orders",
        icon: <BsClipboardData className="text-lg" />,
      },
      {
        title: "Historial",
        description: "Estados y cambios recientes.",
        href: "/status-history",
        icon: <BsClockHistory className="text-lg" />,
      },
    ],
  },
  ASESOR: {
    title: "Dashboard Asesor",
    description: "Gestiona clientes y pedidos en curso.",
    metrics: [
      { label: "Pedidos activos", value: "12" },
      { label: "Clientes nuevos", value: "5" },
      { label: "Pendientes de pago", value: "3" },
      { label: "Cotizaciones", value: "9" },
    ],
    quickActions: [
      {
        title: "Clientes",
        description: "Lista de clientes.",
        href: "/clients",
        icon: <BsPeople className="text-lg" />,
      },
      {
        title: "Pedidos",
        description: "Pedidos asignados.",
        href: "/orders",
        icon: <BsClipboardData className="text-lg" />,
      },
    ],
  },
  COMPRAS: {
    title: "Dashboard Compras",
    description: "Control de proveedores y abastecimiento.",
    metrics: [
      { label: "Ordenes abiertas", value: "6" },
      { label: "Pendientes de entrega", value: "2" },
      { label: "Insumos criticos", value: "5" },
      { label: "Proveedores activos", value: "11" },
    ],
    quickActions: [
      {
        title: "Proveedores",
        description: "Gestion de proveedores.",
        href: "/suppliers",
        icon: <BsTruck className="text-lg" />,
      },
      {
        title: "Catalogo",
        description: "Inventario disponible.",
        href: "/catalog",
        icon: <BsBoxSeam className="text-lg" />,
      },
    ],
  },
  DISEÑADOR: {
    title: "Dashboard Disenador",
    description: "Organiza diseños y pedidos pendientes.",
    metrics: [
      { label: "Disenos en cola", value: "8" },
      { label: "En revision", value: "4" },
      { label: "Cambios solicitados", value: "2" },
      { label: "Aprobados hoy", value: "5" },
    ],
    quickActions: [
      {
        title: "Pedidos",
        description: "Diseños por pedido.",
        href: "/orders",
        icon: <BsClipboardData className="text-lg" />,
      },
    ],
  },
  OPERARIO_EMPAQUE: {
    title: "Dashboard Operario Empaque",
    description: "Tareas de empaque y seguimiento.",
    metrics: [
      { label: "Pendientes de empaque", value: "14" },
      { label: "Empaques hoy", value: "6" },
      { label: "Revisiones", value: "1" },
      { label: "Enviados", value: "9" },
    ],
    quickActions: [
      {
        title: "Pedidos",
        description: "Empaque pendiente.",
        href: "/orders",
        icon: <BsClipboardData className="text-lg" />,
      },
    ],
  },
  OPERARIO_INVENTARIO: {
    title: "Dashboard Operario Inventario",
    description: "Control de entradas y salidas.",
    metrics: [
      { label: "Entradas hoy", value: "5" },
      { label: "Salidas hoy", value: "7" },
      { label: "Items bajos", value: "4" },
      { label: "Ajustes", value: "2" },
    ],
    quickActions: [
      {
        title: "Catalogo",
        description: "Inventario y movimientos.",
        href: "/catalog",
        icon: <BsBoxSeam className="text-lg" />,
      },
    ],
  },
  OPERARIO_INTEGRACION: {
    title: "Dashboard Operario Integracion",
    description: "Integracion de pedidos y procesos.",
    metrics: [
      { label: "Ordenes en integracion", value: "6" },
      { label: "Pendientes de revision", value: "3" },
      { label: "Listos para produccion", value: "4" },
      { label: "Bloqueados", value: "1" },
    ],
    quickActions: [
      {
        title: "Pedidos",
        description: "Seguimiento de integracion.",
        href: "/orders",
        icon: <BsClipboardData className="text-lg" />,
      },
    ],
  },
  OPERARIO_CORTE_LASER: {
    title: "Dashboard Operario Corte Laser",
    description: "Cola de trabajo para corte laser.",
    metrics: [
      { label: "Cortes en cola", value: "10" },
      { label: "En proceso", value: "2" },
      { label: "Completados", value: "5" },
      { label: "Pendientes de ajuste", value: "1" },
    ],
    quickActions: [
      {
        title: "Pedidos",
        description: "Corte laser en cola.",
        href: "/orders",
        icon: <BsClipboardData className="text-lg" />,
      },
    ],
  },
  OPERARIO_CORTE_MANUAL: {
    title: "Dashboard Operario Corte Manual",
    description: "Cola de trabajo para corte manual.",
    metrics: [
      { label: "Cortes en cola", value: "9" },
      { label: "En proceso", value: "3" },
      { label: "Completados", value: "4" },
      { label: "Pendientes de ajuste", value: "2" },
    ],
    quickActions: [
      {
        title: "Pedidos",
        description: "Corte manual en cola.",
        href: "/orders",
        icon: <BsClipboardData className="text-lg" />,
      },
    ],
  },
  OPERARIO_IMPRESION: {
    title: "Dashboard Operario Impresion",
    description: "Pedidos en impresion.",
    metrics: [
      { label: "Impresiones en cola", value: "11" },
      { label: "En proceso", value: "2" },
      { label: "Completadas", value: "6" },
      { label: "Reimpresiones", value: "1" },
    ],
    quickActions: [
      {
        title: "Pedidos",
        description: "Impresion pendiente.",
        href: "/orders",
        icon: <BsClipboardData className="text-lg" />,
      },
    ],
  },
  OPERARIO_ESTAMPACION: {
    title: "Dashboard Operario Estampacion",
    description: "Pedidos en estampacion.",
    metrics: [
      { label: "Estampacion en cola", value: "8" },
      { label: "En proceso", value: "3" },
      { label: "Completados", value: "4" },
      { label: "Reprocesos", value: "1" },
    ],
    quickActions: [
      {
        title: "Pedidos",
        description: "Estampacion pendiente.",
        href: "/orders",
        icon: <BsClipboardData className="text-lg" />,
      },
    ],
  },
  OPERARIO_MONTAJE: {
    title: "Dashboard Operario Montaje",
    description: "Pedidos en montaje.",
    metrics: [
      { label: "Montajes en cola", value: "7" },
      { label: "En proceso", value: "2" },
      { label: "Completados", value: "5" },
      { label: "Retrabajos", value: "1" },
    ],
    quickActions: [
      {
        title: "Pedidos",
        description: "Montaje pendiente.",
        href: "/orders",
        icon: <BsClipboardData className="text-lg" />,
      },
    ],
  },
  OPERARIO_SUBLIMACION: {
    title: "Dashboard Operario Sublimacion",
    description: "Pedidos en sublimacion.",
    metrics: [
      { label: "Sublimaciones en cola", value: "9" },
      { label: "En proceso", value: "3" },
      { label: "Completadas", value: "4" },
      { label: "Revisiones", value: "2" },
    ],
    quickActions: [
      {
        title: "Pedidos",
        description: "Sublimacion pendiente.",
        href: "/orders",
        icon: <BsClipboardData className="text-lg" />,
      },
    ],
  },
};

export default async function RoleDashboardPage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const token = (await cookies()).get("auth_token")?.value;
  const payload = token ? verifyAuthToken(token) : null;

  if (!payload) redirect("/login");

  const role =
    payload && typeof payload === "object"
      ? (payload as { role?: unknown }).role
      : null;
  const roleName = typeof role === "string" ? role : "";
  const overrideRole = (await cookies()).get("role_override")?.value ?? "";
  const effectiveRole =
    process.env.NODE_ENV !== "production" && roleName === "ADMINISTRADOR"
      ? overrideRole || roleName
      : roleName;

  const { role: roleParam } = await params;
  const requestedRole = String(roleParam ?? "").trim();

  if (!requestedRole || requestedRole !== effectiveRole) {
    redirect("/unauthorized");
  }

  const config = roleConfigs[requestedRole];

  if (!config) {
    redirect("/unauthorized");
  }

  const useOperarioDashboard = isOperarioRole(requestedRole);

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{config.title}</h1>
        <p className="text-default-600">{config.description}</p>
      </div>

      {useOperarioDashboard ? (
        <div className="mt-6">
          <OperarioDashboard role={requestedRole} />
        </div>
      ) : (
        <>
          {(requestedRole === "ASESOR" || requestedRole === "LIDER_DE_PROCESOS") ? (
            <section className="mt-6">
              <h2 className="text-lg font-semibold">Reportes visuales</h2>
              <div className="mt-4">
                <RoleCharts role={requestedRole} />
              </div>
            </section>
          ) : null}
          <section className="mt-6">
            <h2 className="text-lg font-semibold">Metricas</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {config.metrics.map((metric) => (
                <Card key={metric.label} className="border border-default-200">
                  <CardBody className="flex flex-col gap-2">
                    <div className="text-sm text-default-500">
                      {metric.label}
                    </div>
                    <div className="text-2xl font-semibold">
                      {metric.value}
                    </div>
                    {metric.hint ? (
                      <div className="text-xs text-default-400">
                        {metric.hint}
                      </div>
                    ) : null}
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Accesos rapidos</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {config.quickActions.map((action) => (
                <Card key={action.href} className="border border-default-200">
                  <CardBody className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-medium bg-success-50 text-success">
                        {action.icon}
                      </div>
                      <div>
                        <div className="text-base font-semibold">
                          {action.title}
                        </div>
                        <div className="text-sm text-default-500">
                          {action.description}
                        </div>
                      </div>
                    </div>
                    <Button
                      as={NextLink}
                      href={action.href}
                      size="sm"
                      variant="flat"
                    >
                      Ir ahora
                    </Button>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
