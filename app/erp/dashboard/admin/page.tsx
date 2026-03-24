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
} from "@/src/db/schema";
import { orderStatusValues } from "@/src/db/enums";
import { AdminCharts } from "@/app/erp/dashboard/_components/admin-charts";
import { ExchangeRateWidget } from "@/app/erp/dashboard/_components/exchange-rate-widget";
import { SiigoStatusCard } from "@/app/erp/dashboard/_components/siigo-status-card";
import { SiigoSyncCard } from "@/app/erp/dashboard/_components/siigo-sync-card";
import { SiigoCustomersCard } from "@/app/erp/dashboard/_components/siigo-customers-card";
import { getSiigoTokenStatus } from "@/src/utils/siigo";

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
        sql`${orderPayments.status} = 'PAGADO'`,
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

  for (const status of orderStatusValues) {
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
  const siigoStatus = getSiigoTokenStatus();

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16 pb-10">
      <div className="rounded-large border border-default-200 bg-content1 p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-default-600">
            Executive view of operations, sales and daily performance.
          </p>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Key metrics</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border border-default-200">
            <CardBody className="flex flex-col gap-2">
              <div className="text-sm text-default-500">Total orders</div>
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
                Unread notifications
              </div>
              <div className="text-2xl font-semibold">{unreadCount}</div>
              <div className="text-xs text-default-400">
                Includes all areas.
              </div>
            </CardBody>
          </Card>
          <Card className="border border-default-200">
            <CardBody className="flex flex-col gap-2">
              <div className="text-sm text-default-500">Monthly sales</div>
              <div className="text-2xl font-semibold">
                {salesFormatter.format(monthSalesValue)}
              </div>
              <div className="text-xs text-default-400">
                Confirmed payments for the current month.
              </div>
            </CardBody>
          </Card>
          <Card className="border border-default-200">
            <CardBody className="p-3">
              <ExchangeRateWidget
                adjustmentApplied={
                  effectiveUsdCop > 0 ? adjustmentApplied : null
                }
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
        <h2 className="text-lg font-semibold">Quick access</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action) => (
            <Card
              key={action.href}
              className="border border-default-200 transition-transform hover:-translate-y-0.5"
            >
              <CardBody className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-medium bg-primary-50 text-primary">
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
                  prefetch={false}
                  size="sm"
                  variant="flat"
                >
                  Go now
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <div className="mt-4 grid gap-4">
          <SiigoStatusCard initialStatus={siigoStatus} />
          <SiigoSyncCard />
          <SiigoCustomersCard />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Visual analytics</h2>
        <div className="mt-4">
          <AdminCharts />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Reports</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="border border-default-200">
            <CardBody className="flex flex-col gap-3">
              <div>
                <div className="text-sm font-semibold">Current inventory</div>
                <div className="text-xs text-default-500">
                  Snapshot of available stock.
                </div>
              </div>
              <Button
                as={NextLink}
                href="/api/exports/reports/inventory"
                prefetch={false}
                size="sm"
                variant="flat"
              >
                Download Excel
              </Button>
            </CardBody>
          </Card>
          <Card className="border border-default-200">
            <CardBody className="flex flex-col gap-3">
              <div>
                <div className="text-sm font-semibold">Monthly sales</div>
                <div className="text-xs text-default-500">
                  {reportYear}-{reportMonthLabel}
                </div>
              </div>
              <Button
                as={NextLink}
                href={`/api/exports/reports/sales-month?year=${reportYear}&month=${reportMonth}`}
                prefetch={false}
                size="sm"
                variant="flat"
              >
                Download Excel
              </Button>
            </CardBody>
          </Card>
          <Card className="border border-default-200">
            <CardBody className="flex flex-col gap-3">
              <div>
                <div className="text-sm font-semibold">Monthly orders</div>
                <div className="text-xs text-default-500">
                  Includes top advisor and collections.
                </div>
              </div>
              <Button
                as={NextLink}
                href={`/api/exports/reports/orders-month?year=${reportYear}&month=${reportMonth}`}
                prefetch={false}
                size="sm"
                variant="flat"
              >
                Download Excel
              </Button>
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
