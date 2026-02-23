"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
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

import { apiJson } from "@/app/orders/_lib/api";
import { FilterSelect } from "@/app/catalog/_components/ui/filter-select";

const BarChartBase = BarChart as unknown as ComponentType<any>;
const LineChartBase = LineChart as unknown as ComponentType<any>;
const ResponsiveContainerBase = ResponsiveContainer as unknown as ComponentType<any>;
const CartesianGridBase = CartesianGrid as unknown as ComponentType<any>;
const XAxisBase = XAxis as unknown as ComponentType<any>;
const YAxisBase = YAxis as unknown as ComponentType<any>;
const TooltipBase = Tooltip as unknown as ComponentType<any>;
const LegendBase = Legend as unknown as ComponentType<any>;
const LineBase = Line as unknown as ComponentType<any>;
const BarBase = Bar as unknown as ComponentType<any>;

type ChartPoint = {
  day: string;
  sold: number;
  paid: number;
  orders: number;
};

type ChartResponse = {
  year: number;
  month: number;
  series: ChartPoint[];
};

export function AdminCharts() {
  const [data, setData] = useState<ChartResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const now = new Date();
  const currentYear = now.getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));

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

    apiJson<ChartResponse>(
      `/api/reports/charts/admin?year=${encodeURIComponent(
        year,
      )}&month=${encodeURIComponent(String(Number(month)))}`,
    )
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [month, year]);

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
      <Card className="min-w-0 border border-default-200">
        <CardHeader className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Ventas vs abonos</div>
            <div className="text-xs text-default-500">Mes {label}</div>
          </div>
          {loading ? <Spinner size="sm" /> : null}
        </CardHeader>
        <CardBody className="h-72 min-w-0">
          <ResponsiveContainerBase width="100%" height="100%">
            <LineChartBase data={data?.series ?? []} margin={{ left: 8, right: 8 }}>
              <CartesianGridBase strokeDasharray="3 3" stroke="var(--viomar-primary-light)" />
              <XAxisBase
                dataKey="day"
                tickFormatter={(v: string) => v.slice(-2)}
                axisLine={{ stroke: "var(--viomar-fg)" }}
                tick={{ fill: "var(--viomar-fg)" }}
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
                type="monotone"
                dataKey="sold"
                name="Vendido"
                stroke="var(--viomar-primary)"
                strokeWidth={2}
              />
              <LineBase
                type="monotone"
                dataKey="paid"
                name="Abonos"
                stroke="var(--viomar-primary-dark)"
                strokeWidth={2}
              />
            </LineChartBase>
          </ResponsiveContainerBase>
        </CardBody>
      </Card>
      <Card className="min-w-0 border border-default-200">
        <CardHeader className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Pedidos del mes</div>
            <div className="text-xs text-default-500">Cantidad por dia</div>
          </div>
          {loading ? <Spinner size="sm" /> : null}
        </CardHeader>
        <CardBody className="h-72 min-w-0">
          <ResponsiveContainerBase width="100%" height="100%">
            <BarChartBase data={data?.series ?? []} margin={{ left: 8, right: 8 }}>
              <CartesianGridBase strokeDasharray="3 3" stroke="var(--viomar-primary-light)" />
              <XAxisBase
                dataKey="day"
                tickFormatter={(v: string) => v.slice(-2)}
                axisLine={{ stroke: "var(--viomar-fg)" }}
                tick={{ fill: "var(--viomar-fg)" }}
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
              <BarBase dataKey="orders" name="Pedidos" fill="var(--viomar-primary-light)" />
            </BarChartBase>
          </ResponsiveContainerBase>
        </CardBody>
      </Card>
      </div>
    </div>
  );
}
