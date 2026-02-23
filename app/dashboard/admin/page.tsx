import type { ReactNode } from "react";

import NextLink from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import {
  BsBoxSeam,
  BsClipboardData,
  BsGear,
  BsPeople,
  BsTruck,
} from "react-icons/bs";
import { and, desc, eq, sql } from "drizzle-orm";

import { verifyAuthToken } from "@/src/utils/auth";
import { db } from "@/src/db";
import {
  exchangeRates,
  notifications,
  orderPayments,
  orders,
  orderStatusEnum,
} from "@/src/db/schema";
import { AdminCharts } from "@/app/dashboard/_components/admin-charts";
import { ExchangeRateWidget } from "@/app/dashboard/_components/exchange-rate-widget";

type QuickAction = {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
};

const quickActions: QuickAction[] = [
  {
    title: "Pedidos",
    description: "Gestiona pedidos y estados.",
    href: "/orders",
    icon: <BsClipboardData className="text-lg" />,
  },
  {
    title: "Catalogo",
    description: "Productos, inventario y precios.",
    href: "/catalog",
    icon: <BsBoxSeam className="text-lg" />,
  },
  {
    title: "Clientes",
    description: "Listado y gestion de clientes.",
    href: "/clients",
    icon: <BsPeople className="text-lg" />,
  },
  {
    title: "Proveedores",
    description: "Administra proveedores.",
    href: "/suppliers",
    icon: <BsTruck className="text-lg" />,
  },
  {
    title: "Administracion",
    description: "Roles, permisos y configuracion.",
    href: "/admin",
    icon: <BsGear className="text-lg" />,
  },
];

export default async function AdminDashboardPage() {
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

  if (effectiveRole !== "ADMINISTRADOR") redirect("/unauthorized");

  const ordersByStatus = await db
    .select({
      status: orders.status,
      total: sql<number>`count(*)::int`,
    })
    .from(orders)
    .groupBy(orders.status);

  const unreadNotifications = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(notifications)
    .where(eq(notifications.isRead, false));

  const monthlySales = await db
    .select({
      total: sql<string>`coalesce(sum(${orderPayments.amount}), 0)::text`,
    })
    .from(orderPayments)
    .where(
      and(
        sql`date_trunc('month', ${orderPayments.createdAt}) = date_trunc('month', now())`,
        sql`${orderPayments.status} <> 'ANULADO'`,
      ),
    );

  const latestExchangeRates = await db
    .select({
      provider: exchangeRates.provider,
      sourceRate: exchangeRates.sourceRate,
      floorRate: exchangeRates.floorRate,
      effectiveRate: exchangeRates.effectiveRate,
      adjustmentApplied: exchangeRates.adjustmentApplied,
      sourceDate: exchangeRates.sourceDate,
      createdAt: exchangeRates.createdAt,
    })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.baseCurrency, "USD"),
        eq(exchangeRates.targetCurrency, "COP"),
      ),
    )
    .orderBy(desc(exchangeRates.createdAt))
    .limit(2);

  const latestExchangeRate = latestExchangeRates[0] ?? null;
  const previousExchangeRate = latestExchangeRates[1] ?? null;

  const statusTotals = new Map<string, number>();
  for (const status of orderStatusEnum.enumValues) {
    statusTotals.set(status, 0);
  }
  for (const row of ordersByStatus) {
    if (row.status) statusTotals.set(row.status, Number(row.total || 0));
  }

  const totalOrders = Array.from(statusTotals.values()).reduce(
    (acc, value) => acc + value,
    0,
  );
  const unreadCount = Number(unreadNotifications[0]?.total ?? 0);
  const monthSalesValue = Number(monthlySales[0]?.total ?? 0);
  const salesFormatter = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
  const now = new Date();
  const reportYear = now.getFullYear();
  const reportMonth = now.getMonth() + 1;
  const reportMonthLabel = String(reportMonth).padStart(2, "0");

  const effectiveUsdCop = Number(latestExchangeRate?.effectiveRate ?? 0);
  const sourceUsdCop = Number(latestExchangeRate?.sourceRate ?? 0);
  const floorUsdCop = Number(latestExchangeRate?.floorRate ?? 3600);
  const adjustmentApplied = Number(latestExchangeRate?.adjustmentApplied ?? 0);

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Dashboard Admin</h1>
        <p className="text-default-600">
          Accesos rapidos y resumen general de la operacion.
        </p>
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Metricas</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border border-default-200">
            <CardBody className="flex flex-col gap-2">
              <div className="text-sm text-default-500">Pedidos totales</div>
              <div className="text-2xl font-semibold">{totalOrders}</div>
              <div className="flex flex-wrap gap-2 text-xs text-default-500">
                {Array.from(statusTotals.entries()).map(([status, value]) => (
                  <span key={status}>
                    {status}: {value}
                  </span>
                ))}
              </div>
            </CardBody>
          </Card>
          <Card className="border border-default-200">
            <CardBody className="flex flex-col gap-2">
              <div className="text-sm text-default-500">
                Notificaciones sin leer
              </div>
              <div className="text-2xl font-semibold">{unreadCount}</div>
              <div className="text-xs text-default-400">
                Incluye todas las areas.
              </div>
            </CardBody>
          </Card>
          <Card className="border border-default-200">
            <CardBody className="flex flex-col gap-2">
              <div className="text-sm text-default-500">Ventas del mes</div>
              <div className="text-2xl font-semibold">
                {salesFormatter.format(monthSalesValue)}
              </div>
              <div className="text-xs text-default-400">
                Pagos confirmados o parciales.
              </div>
            </CardBody>
          </Card>
          <Card className="border border-default-200">
            <CardBody className="p-3">
              <ExchangeRateWidget
                adjustmentApplied={effectiveUsdCop > 0 ? adjustmentApplied : null}
                baseLabel="USD"
                currentRate={effectiveUsdCop > 0 ? effectiveUsdCop : null}
                floorRate={floorUsdCop}
                pairLabel="USD / COP"
                previousRate={
                  previousExchangeRate
                    ? Number(previousExchangeRate.effectiveRate ?? 0)
                    : null
                }
                provider={latestExchangeRate?.provider ?? "N/D"}
                sourceRate={effectiveUsdCop > 0 ? sourceUsdCop : null}
              />
            </CardBody>
          </Card>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Accesos rapidos</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action) => (
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
                <Button as={NextLink} href={action.href} size="sm" variant="flat">
                  Ir ahora
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Reportes visuales</h2>
        <div className="mt-4">
          <AdminCharts />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Reportes</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="border border-default-200">
            <CardBody className="flex flex-col gap-3">
              <div>
                <div className="text-sm font-semibold">Inventario actual</div>
                <div className="text-xs text-default-500">
                  Snapshot del stock disponible.
                </div>
              </div>
              <Button
                as={NextLink}
                href="/api/exports/reports/inventory"
                size="sm"
                variant="flat"
              >
                Descargar Excel
              </Button>
            </CardBody>
          </Card>
          <Card className="border border-default-200">
            <CardBody className="flex flex-col gap-3">
              <div>
                <div className="text-sm font-semibold">Ventas del mes</div>
                <div className="text-xs text-default-500">
                  {reportYear}-{reportMonthLabel}
                </div>
              </div>
              <Button
                as={NextLink}
                href={`/api/exports/reports/sales-month?year=${reportYear}&month=${reportMonth}`}
                size="sm"
                variant="flat"
              >
                Descargar Excel
              </Button>
            </CardBody>
          </Card>
          <Card className="border border-default-200">
            <CardBody className="flex flex-col gap-3">
              <div>
                <div className="text-sm font-semibold">Pedidos del mes</div>
                <div className="text-xs text-default-500">
                  Incluye top asesor y recaudo.
                </div>
              </div>
              <Button
                as={NextLink}
                href={`/api/exports/reports/orders-month?year=${reportYear}&month=${reportMonth}`}
                size="sm"
                variant="flat"
              >
                Descargar Excel
              </Button>
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
