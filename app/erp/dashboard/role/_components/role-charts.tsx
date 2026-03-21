"use client";

import type { ComponentType } from "react";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Spinner } from "@heroui/spinner";

import { apiJson } from "@/app/erp/orders/_lib/api";
import { FilterSelect } from "@/app/erp/catalog/_components/ui/filter-select";

const BarChartBase = BarChart as unknown as ComponentType<any>;
const LineChartBase = LineChart as unknown as ComponentType<any>;
const ResponsiveContainerBase =
  ResponsiveContainer as unknown as ComponentType<any>;
const CartesianGridBase = CartesianGrid as unknown as ComponentType<any>;
const XAxisBase = XAxis as unknown as ComponentType<any>;
const YAxisBase = YAxis as unknown as ComponentType<any>;
const TooltipBase = Tooltip as unknown as ComponentType<any>;
const LegendBase = Legend as unknown as ComponentType<any>;
const LineBase = Line as unknown as ComponentType<any>;
const BarBase = Bar as unknown as ComponentType<any>;

const ROLE_CHART_COLORS = {
  sold: "#0F766E",
  paid: "#F59E0B",
  orders: "#2563EB",
  status: "#8B5CF6",
  grid: "#D1FAE5",
};

type ChartPoint = {
  day: string;
  sold: number;
  paid: number;
  orders: number;
};

type AdvisorResponse = {
  year: number;
  month: number;
  series: ChartPoint[];
  status: Array<{ status: string; count: number }>;
};

type AdminResponse = {
  year: number;
  month: number;
  series: ChartPoint[];
};

export function RoleCharts({ role }: { role: string }) {
  const [advisorData, setAdvisorData] = useState<AdvisorResponse | null>(null);
  const [adminData, setAdminData] = useState<AdminResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const now = new Date();
  const currentYear = now.getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(
    String(now.getMonth() + 1).padStart(2, "0"),
  );

  const monthOptions = [
    { value: "01", label: "Ene" },
    { value: "02", label: "Feb" },
    { value: "03", label: "Mar" },
    { value: "04", label: "Abr" },
    { value: "05", label: "May" },
    { value: "06", label: "Jun" },
    { value: "07", label: "Jul" },
    { value: "08", label: "Ago" },
    { value: "09", label: "Sep" },
    { value: "10", label: "Oct" },
    { value: "11", label: "Nov" },
    { value: "12", label: "Dic" },
  ];

  const yearOptions = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const value = String(currentYear - index);

      return { value, label: value };
    });
  }, [currentYear]);

  const label = useMemo(() => `${year}/${month}`, [month, year]);

  useEffect(() => {
    let active = true;

    setLoading(true);

    const endpoint =
      role === "ASESOR"
        ? "/api/reports/charts/advisor"
        : "/api/reports/charts/admin";
    const url = `${endpoint}?year=${encodeURIComponent(
      year,
    )}&month=${encodeURIComponent(String(Number(month)))}`;

    apiJson(url)
      .then((res) => {
        if (!active) return;
        if (role === "ASESOR") {
          setAdvisorData(res as AdvisorResponse);
        } else {
          setAdminData(res as AdminResponse);
        }
      })
      .catch(() => {
        if (!active) return;
        setAdvisorData(null);
        setAdminData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [month, role, year]);

  if (
    role !== "ASESOR" &&
    role !== "LIDER_OPERACIONAL" &&
    role !== "ADMINISTRADOR"
  ) {
    return null;
  }

  const series =
    role === "ASESOR" ? (advisorData?.series ?? []) : (adminData?.series ?? []);
  const status = role === "ASESOR" ? (advisorData?.status ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-end">
        <FilterSelect
          className="sm:w-40"
          label="Mes"
          options={monthOptions}
          value={month}
          onChange={setMonth}
        />
        <FilterSelect
          className="sm:w-36"
          label="Año"
          options={yearOptions}
          value={year}
          onChange={setYear}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border border-default-200">
          <CardHeader className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Ventas vs abonos</div>
              <div className="text-xs text-default-500">Mes {label}</div>
            </div>
            {loading ? <Spinner size="sm" /> : null}
          </CardHeader>
          <CardBody className="h-72">
            <ResponsiveContainerBase height="100%" width="100%">
              <LineChartBase data={series} margin={{ left: 8, right: 8 }}>
                <CartesianGridBase
                  stroke={ROLE_CHART_COLORS.grid}
                  strokeDasharray="3 3"
                />
                <XAxisBase
                  axisLine={{ stroke: "var(--viomar-fg)" }}
                  dataKey="day"
                  tick={{ fill: "var(--viomar-fg)" }}
                  tickFormatter={(v: string) => v.slice(-2)}
                  tickLine={{ stroke: "var(--viomar-fg)" }}
                />
                <YAxisBase
                  axisLine={{ stroke: "var(--viomar-fg)" }}
                  tick={{ fill: "var(--viomar-fg)" }}
                  tickLine={{ stroke: "var(--viomar-fg)" }}
                />
                <TooltipBase />
                <LegendBase />
                <LineBase
                  dataKey="sold"
                  name="Vendido"
                  stroke={ROLE_CHART_COLORS.sold}
                  strokeWidth={2}
                  type="monotone"
                />
                <LineBase
                  dataKey="paid"
                  name="Abonos"
                  stroke={ROLE_CHART_COLORS.paid}
                  strokeWidth={2}
                  type="monotone"
                />
              </LineChartBase>
            </ResponsiveContainerBase>
          </CardBody>
        </Card>
        {role === "ASESOR" ? (
          <Card className="border border-default-200">
            <CardHeader className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Pedidos por estado</div>
                <div className="text-xs text-default-500">Mes {label}</div>
              </div>
              {loading ? <Spinner size="sm" /> : null}
            </CardHeader>
            <CardBody className="h-72">
              <ResponsiveContainerBase height="100%" width="100%">
                <BarChartBase data={status} margin={{ left: 8, right: 8 }}>
                  <CartesianGridBase
                    stroke={ROLE_CHART_COLORS.grid}
                    strokeDasharray="3 3"
                  />
                  <XAxisBase
                    axisLine={{ stroke: "var(--viomar-fg)" }}
                    dataKey="status"
                    tick={{ fill: "var(--viomar-fg)" }}
                    tickFormatter={(v: string) => v.slice(0, 6)}
                    tickLine={{ stroke: "var(--viomar-fg)" }}
                  />
                  <YAxisBase
                    allowDecimals={false}
                    axisLine={{ stroke: "var(--viomar-fg)" }}
                    tick={{ fill: "var(--viomar-fg)" }}
                    tickLine={{ stroke: "var(--viomar-fg)" }}
                  />
                  <TooltipBase />
                  <LegendBase />
                  <BarBase
                    dataKey="count"
                    fill={ROLE_CHART_COLORS.status}
                    name="Pedidos"
                  />
                </BarChartBase>
              </ResponsiveContainerBase>
            </CardBody>
          </Card>
        ) : (
          <Card className="border border-default-200">
            <CardHeader className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Pedidos del mes</div>
                <div className="text-xs text-default-500">Cantidad por dia</div>
              </div>
              {loading ? <Spinner size="sm" /> : null}
            </CardHeader>
            <CardBody className="h-72">
              <ResponsiveContainerBase height="100%" width="100%">
                <BarChartBase data={series} margin={{ left: 8, right: 8 }}>
                  <CartesianGridBase
                    stroke={ROLE_CHART_COLORS.grid}
                    strokeDasharray="3 3"
                  />
                  <XAxisBase
                    axisLine={{ stroke: "var(--viomar-fg)" }}
                    dataKey="day"
                    tick={{ fill: "var(--viomar-fg)" }}
                    tickFormatter={(v: string) => v.slice(-2)}
                    tickLine={{ stroke: "var(--viomar-fg)" }}
                  />
                  <YAxisBase
                    allowDecimals={false}
                    axisLine={{ stroke: "var(--viomar-fg)" }}
                    tick={{ fill: "var(--viomar-fg)" }}
                    tickLine={{ stroke: "var(--viomar-fg)" }}
                  />
                  <TooltipBase />
                  <LegendBase />
                  <BarBase
                    dataKey="orders"
                    fill={ROLE_CHART_COLORS.orders}
                    name="Pedidos"
                  />
                </BarChartBase>
              </ResponsiveContainerBase>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
