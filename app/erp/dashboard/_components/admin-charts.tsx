"use client";

import type { ComponentType, ReactNode } from "react";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Spinner } from "@heroui/spinner";

import { apiJson } from "@/app/erp/orders/_lib/api";
import { FilterSelect } from "@/app/erp/catalog/_components/ui/filter-select";

const AreaChartBase = AreaChart as unknown as ComponentType<any>;
const ComposedChartBase = ComposedChart as unknown as ComponentType<any>;
const ResponsiveContainerBase =
  ResponsiveContainer as unknown as ComponentType<any>;
const CartesianGridBase = CartesianGrid as unknown as ComponentType<any>;
const XAxisBase = XAxis as unknown as ComponentType<any>;
const YAxisBase = YAxis as unknown as ComponentType<any>;
const TooltipBase = Tooltip as unknown as ComponentType<any>;
const LegendBase = Legend as unknown as ComponentType<any>;
const LineBase = Line as unknown as ComponentType<any>;
const BarBase = Bar as unknown as ComponentType<any>;
const AreaBase = Area as unknown as ComponentType<any>;

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

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function numberFmt(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function ChartViewport({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canRenderChart, setCanRenderChart] = useState(false);

  useEffect(() => {
    const node = containerRef.current;

    if (!node) return;

    const update = () => {
      const rect = node.getBoundingClientRect();

      setCanRenderChart(rect.width > 0 && rect.height > 0);
    };

    update();

    const observer = new ResizeObserver(() => {
      update();
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="h-full min-h-[18rem] w-full min-w-0">
      {canRenderChart ? children : null}
    </div>
  );
}

export function AdminCharts() {
  const [data, setData] = useState<ChartResponse | null>(null);
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

  const metrics = useMemo(() => {
    const points = data?.series ?? [];
    const sold = points.reduce((acc, row) => acc + Number(row.sold ?? 0), 0);
    const paid = points.reduce((acc, row) => acc + Number(row.paid ?? 0), 0);
    const orders = points.reduce(
      (acc, row) => acc + Number(row.orders ?? 0),
      0,
    );
    const collectionRate = sold > 0 ? (paid / sold) * 100 : 0;
    const avgTicket = orders > 0 ? sold / orders : 0;

    return { sold, paid, orders, collectionRate, avgTicket };
  }, [data?.series]);

  const bestOrderDay = useMemo(() => {
    const points = data?.series ?? [];

    if (points.length === 0) return null;

    return points.reduce((best, current) =>
      Number(current.orders ?? 0) > Number(best.orders ?? 0) ? current : best,
    );
  }, [data?.series]);

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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-default-200">
          <CardBody className="gap-1 py-4">
            <div className="text-xs uppercase text-default-500">Vendido</div>
            <div className="text-xl font-semibold">{money(metrics.sold)}</div>
            <div className="text-xs text-default-400">Mes {label}</div>
          </CardBody>
        </Card>
        <Card className="border border-default-200">
          <CardBody className="gap-1 py-4">
            <div className="text-xs uppercase text-default-500">Recaudado</div>
            <div className="text-xl font-semibold">{money(metrics.paid)}</div>
            <div className="text-xs text-default-400">
              Eficiencia: {metrics.collectionRate.toFixed(1)}%
            </div>
          </CardBody>
        </Card>
        <Card className="border border-default-200">
          <CardBody className="gap-1 py-4">
            <div className="text-xs uppercase text-default-500">Pedidos</div>
            <div className="text-xl font-semibold">
              {numberFmt(metrics.orders)}
            </div>
            <div className="text-xs text-default-400">
              Ticket prom.: {money(metrics.avgTicket)}
            </div>
          </CardBody>
        </Card>
        <Card className="border border-default-200">
          <CardBody className="gap-1 py-4">
            <div className="text-xs uppercase text-default-500">Mejor día</div>
            <div className="text-xl font-semibold">
              {bestOrderDay ? bestOrderDay.day.slice(-2) : "-"}
            </div>
            <div className="text-xs text-default-400">
              {bestOrderDay
                ? `${numberFmt(bestOrderDay.orders)} pedidos`
                : "Sin datos"}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0 border border-default-200">
          <CardHeader className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Tendencia financiera</div>
              <div className="text-xs text-default-500">
                Ventas y recaudo acumulado diario · {label}
              </div>
            </div>
            {loading ? <Spinner size="sm" /> : null}
          </CardHeader>
          <CardBody className="h-72 min-h-[18rem] min-w-0">
            <ChartViewport>
              <ResponsiveContainerBase
                height="100%"
                minHeight={220}
                minWidth={280}
                width="100%"
              >
                <AreaChartBase
                  data={data?.series ?? []}
                  margin={{ left: 8, right: 8 }}
                >
                  <defs>
                    <linearGradient
                      id="soldGradient"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="var(--viomar-primary)"
                        stopOpacity={0.28}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--viomar-primary)"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                    <linearGradient
                      id="paidGradient"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="var(--viomar-primary-dark)"
                        stopOpacity={0.28}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--viomar-primary-dark)"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGridBase
                    stroke="var(--viomar-primary-light)"
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
                    tickFormatter={(v: number) => numberFmt(v)}
                    tickLine={{ stroke: "var(--viomar-fg)" }}
                  />
                  <TooltipBase
                    formatter={(value: number) => money(Number(value ?? 0))}
                  />
                  <LegendBase />
                  <AreaBase
                    dataKey="sold"
                    fill="url(#soldGradient)"
                    name="Vendido"
                    stroke="var(--viomar-primary)"
                    strokeWidth={2}
                    type="monotone"
                  />
                  <AreaBase
                    dataKey="paid"
                    fill="url(#paidGradient)"
                    name="Recaudado"
                    stroke="var(--viomar-primary-dark)"
                    strokeWidth={2}
                    type="monotone"
                  />
                  <LineBase
                    dataKey="sold"
                    dot={false}
                    name="Vendido (línea)"
                    stroke="var(--viomar-primary)"
                    strokeWidth={1.5}
                    type="monotone"
                  />
                  <LineBase
                    dataKey="paid"
                    dot={false}
                    name="Recaudado (línea)"
                    stroke="var(--viomar-primary-dark)"
                    strokeWidth={1.5}
                    type="monotone"
                  />
                </AreaChartBase>
              </ResponsiveContainerBase>
            </ChartViewport>
          </CardBody>
        </Card>
        <Card className="min-w-0 border border-default-200">
          <CardHeader className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">
                Volumen vs facturación
              </div>
              <div className="text-xs text-default-500">
                Pedidos y vendido por día
              </div>
            </div>
            {loading ? <Spinner size="sm" /> : null}
          </CardHeader>
          <CardBody className="h-72 min-h-[18rem] min-w-0">
            <ChartViewport>
              <ResponsiveContainerBase
                height="100%"
                minHeight={220}
                minWidth={280}
                width="100%"
              >
                <ComposedChartBase
                  data={data?.series ?? []}
                  margin={{ left: 8, right: 8 }}
                >
                  <CartesianGridBase
                    stroke="var(--viomar-primary-light)"
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
                    yAxisId="left"
                  />
                  <YAxisBase
                    axisLine={{ stroke: "var(--viomar-fg)" }}
                    orientation="right"
                    tick={{ fill: "var(--viomar-fg)" }}
                    tickFormatter={(v: number) => numberFmt(v)}
                    tickLine={{ stroke: "var(--viomar-fg)" }}
                    yAxisId="right"
                  />
                  <TooltipBase
                    formatter={(value: number, name: string) =>
                      name === "Vendido"
                        ? money(Number(value ?? 0))
                        : numberFmt(Number(value ?? 0))
                    }
                  />
                  <LegendBase />
                  <BarBase
                    dataKey="orders"
                    fill="var(--viomar-primary-light)"
                    name="Pedidos"
                    radius={[6, 6, 0, 0]}
                    yAxisId="left"
                  />
                  <LineBase
                    dataKey="sold"
                    dot={false}
                    name="Vendido"
                    stroke="var(--viomar-primary)"
                    strokeWidth={2.5}
                    type="monotone"
                    yAxisId="right"
                  />
                </ComposedChartBase>
              </ResponsiveContainerBase>
            </ChartViewport>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
