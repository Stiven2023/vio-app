"use client";

import * as XLSX from "xlsx";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Select, SelectItem } from "@heroui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BsDownload } from "react-icons/bs";

import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type PeriodRow = {
  period: string;
  revenue: number;
  cogs: number;
  payroll: number;
  operatingExpenses: number;
  grossProfit: number;
  operatingIncome: number;
};

type Summary = {
  totalRevenue: string;
  totalCOGS: string;
  grossProfit: string;
  grossMargin: string;
  totalPayroll: string;
  totalOperatingExpenses: string;
  totalOperatingCosts: string;
  operatingIncome: string;
  operatingMargin: string;
};

type IncomeStatementData = {
  year: number;
  periodType: string;
  periods: string[];
  byPeriod: PeriodRow[];
  summary: Summary;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNum(v: string | number) {
  return typeof v === "number" ? v : parseFloat(v ?? "0");
}

function fmt(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtPct(value: number) {
  return `${toNum(value).toFixed(1)}%`;
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: "green" | "orange" | "blue" | "yellow" | "red";
}) {
  const colorMap = {
    green: "text-success-600",
    orange: "text-warning-600",
    blue: "text-primary-600",
    yellow: "text-warning-500",
    red: "text-danger-600",
  };

  return (
    <Card className="shadow-sm">
      <CardBody className="gap-1 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-default-500">{label}</p>
        <p className={`text-xl font-bold ${colorMap[color]}`}>{value}</p>
        {sub && <p className="text-xs text-default-400">{sub}</p>}
      </CardBody>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function IncomeStatementTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [periodType, setPeriodType] = useState("monthly");
  const [data, setData] = useState<IncomeStatementData | null>(null);
  const [loading, setLoading] = useState(true);

  const yearOptions = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => currentYear - 3 + i).map((y) => ({
        value: String(y),
        label: String(y),
      })),
    [currentYear],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    apiJson<IncomeStatementData>(
      `/api/contabilidad/estado-resultados?year=${year}&period=${periodType}`,
    )
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(getErrorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year, periodType]);

  // ── Download Excel ─────────────────────────────────────────────────────────

  function handleDownload() {
    if (!data) return;

    const rows = data.byPeriod.map((r) => {
      const grossMarginPct = r.revenue > 0 ? (r.grossProfit / r.revenue) * 100 : 0;
      const opMarginPct = r.revenue > 0 ? (r.operatingIncome / r.revenue) * 100 : 0;

      return {
        Período: r.period,
        Ingresos: r.revenue,
        "Costo Ventas": r.cogs,
        "Utilidad Bruta": r.grossProfit,
        "Margen Bruto %": parseFloat(grossMarginPct.toFixed(2)),
        Nómina: r.payroll,
        "Gastos Operacionales": r.operatingExpenses,
        "Costos Operacionales": r.payroll + r.operatingExpenses,
        "Utilidad Operacional": r.operatingIncome,
        "Margen Op. %": parseFloat(opMarginPct.toFixed(2)),
      };
    });

    // Summary footer row
    const s = data.summary;

    rows.push({
      Período: "TOTAL",
      Ingresos: toNum(s.totalRevenue),
      "Costo Ventas": toNum(s.totalCOGS),
      "Utilidad Bruta": toNum(s.grossProfit),
      "Margen Bruto %": toNum(s.grossMargin),
      Nómina: toNum(s.totalPayroll),
      "Gastos Operacionales": toNum(s.totalOperatingExpenses),
      "Costos Operacionales": toNum(s.totalOperatingCosts),
      "Utilidad Operacional": toNum(s.operatingIncome),
      "Margen Op. %": toNum(s.operatingMargin),
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Estado de Resultados");
    XLSX.writeFile(wb, `estado-resultados-${year}-${periodType}.xlsx`);
    toast.success("Archivo descargado");
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="shadow-sm">
              <CardBody className="gap-2 p-4">
                <div className="h-3 w-24 animate-pulse rounded bg-default-200" />
                <div className="h-6 w-32 animate-pulse rounded bg-default-200" />
              </CardBody>
            </Card>
          ))}
        </div>
        <TableSkeleton
          ariaLabel="Estado de Resultados"
          headers={[
            "Período",
            "Ingresos",
            "Costo Ventas",
            "Utilidad Bruta",
            "Margen Bruto %",
            "Nómina",
            "Gastos Op.",
            "Costos Op.",
            "Utilidad Op.",
            "Margen Op. %",
          ]}
          rows={12}
        />
      </div>
    );
  }

  if (!data) return null;

  const s = data.summary;
  const operatingIncomeNum = toNum(s.operatingIncome);
  const isProfit = operatingIncomeNum >= 0;

  // Chart data: only show periods with any activity
  const chartData = data.byPeriod.filter(
    (r) => r.revenue > 0 || r.cogs > 0 || r.payroll > 0 || r.operatingExpenses > 0,
  );

  return (
    <div className="space-y-6">
      {/* ── Controls ── */}
      <div className="flex flex-wrap items-end gap-3">
        <Select
          className="w-32"
          label="Año"
          selectedKeys={[String(year)]}
          size="sm"
          onSelectionChange={(keys) => {
            const val = Array.from(keys)[0];

            if (val) setYear(parseInt(String(val), 10));
          }}
        >
          {yearOptions.map((opt) => (
            <SelectItem key={opt.value}>{opt.label}</SelectItem>
          ))}
        </Select>

        <Select
          className="w-40"
          label="Período"
          selectedKeys={[periodType]}
          size="sm"
          onSelectionChange={(keys) => {
            const val = Array.from(keys)[0];

            if (val) setPeriodType(String(val));
          }}
        >
          <SelectItem key="monthly">Mensual</SelectItem>
          <SelectItem key="quarterly">Trimestral</SelectItem>
          <SelectItem key="annual">Anual</SelectItem>
        </Select>

        <div className="ml-auto">
          <Button
            color="success"
            isDisabled={!data}
            size="sm"
            startContent={<BsDownload />}
            variant="flat"
            onPress={handleDownload}
          >
            Descargar Excel
          </Button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard
          color="green"
          label="Ingresos Totales"
          value={fmt(toNum(s.totalRevenue))}
        />
        <SummaryCard
          color="orange"
          label="Costo de Ventas"
          value={fmt(toNum(s.totalCOGS))}
        />
        <SummaryCard
          color="blue"
          label="Utilidad Bruta"
          sub={`Margen: ${fmtPct(toNum(s.grossMargin))}`}
          value={fmt(toNum(s.grossProfit))}
        />
        <SummaryCard
          color="yellow"
          label="Costos Operacionales"
          sub={`Nómina + Gastos Caja Menor`}
          value={fmt(toNum(s.totalOperatingCosts))}
        />
        <SummaryCard
          color={isProfit ? "green" : "red"}
          label="Utilidad Operacional"
          sub={`Margen: ${fmtPct(toNum(s.operatingMargin))}`}
          value={fmt(operatingIncomeNum)}
        />
      </div>

      {/* ── Chart ── */}
      {chartData.length > 0 && (
        <Card className="shadow-sm">
          <CardBody className="p-4">
            <p className="mb-4 text-sm font-semibold text-default-700">
              Tendencia por Período ({year})
            </p>
            <ResponsiveContainer height={320} width="100%">
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="period"
                  style={{ fontSize: 11 }}
                  tick={{ fill: "#71717a" }}
                  tickLine={false}
                />
                <YAxis
                  style={{ fontSize: 11 }}
                  tick={{ fill: "#71717a" }}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(1)}M`
                      : v >= 1_000
                        ? `${(v / 1_000).toFixed(0)}K`
                        : String(v)
                  }
                  tickLine={false}
                  width={60}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: number, name: string) => [fmt(value), name]) as any}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="revenue"
                  fill="#17c964"
                  name="Ingresos"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="cogs"
                  fill="#f5a524"
                  name="Costo Ventas"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="grossProfit"
                  fill="#006FEE"
                  name="Utilidad Bruta"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="operatingIncome"
                  fill="#7828c8"
                  name="Utilidad Op."
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      )}

      {/* ── Detailed Table ── */}
      <Card className="shadow-sm">
        <CardBody className="p-0">
          <Table
            aria-label="Estado de Resultados por Período"
            classNames={{ wrapper: "shadow-none rounded-none" }}
            removeWrapper={false}
          >
            <TableHeader>
              <TableColumn>Período</TableColumn>
              <TableColumn className="text-right">Ingresos</TableColumn>
              <TableColumn className="text-right">Costo Ventas</TableColumn>
              <TableColumn className="text-right">Utilidad Bruta</TableColumn>
              <TableColumn className="text-right">Margen Bruto</TableColumn>
              <TableColumn className="text-right">Nómina</TableColumn>
              <TableColumn className="text-right">Gastos Caja Menor</TableColumn>
              <TableColumn className="text-right">Costos Op.</TableColumn>
              <TableColumn className="text-right">Utilidad Op.</TableColumn>
              <TableColumn className="text-right">Margen Op.</TableColumn>
            </TableHeader>
            <TableBody
              items={[
                ...data.byPeriod,
                {
                  period: `__TOTAL__`,
                  revenue: toNum(s.totalRevenue),
                  cogs: toNum(s.totalCOGS),
                  payroll: toNum(s.totalPayroll),
                  operatingExpenses: toNum(s.totalOperatingExpenses),
                  grossProfit: toNum(s.grossProfit),
                  operatingIncome: toNum(s.operatingIncome),
                },
              ]}
            >
              {(row) => {
                const isTotalRow = row.period === "__TOTAL__";
                const grossMarginPct =
                  row.revenue > 0 ? (row.grossProfit / row.revenue) * 100 : 0;
                const opMarginPct =
                  row.revenue > 0 ? (row.operatingIncome / row.revenue) * 100 : 0;
                const totalOpCosts = row.payroll + row.operatingExpenses;
                const isRowProfit = row.operatingIncome >= 0;

                return (
                  <TableRow
                    key={row.period}
                    className={
                      isTotalRow ? "border-t-2 border-divider bg-default-50" : ""
                    }
                  >
                    <TableCell
                      className={isTotalRow ? "font-bold" : "font-medium"}
                    >
                      {isTotalRow ? `TOTAL ${year}` : row.period}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-success-600 ${isTotalRow ? "font-bold" : ""}`}
                    >
                      {fmt(row.revenue)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-warning-600 ${isTotalRow ? "font-bold" : ""}`}
                    >
                      {fmt(row.cogs)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-primary-600 ${isTotalRow ? "font-bold" : ""}`}
                    >
                      {fmt(row.grossProfit)}
                    </TableCell>
                    <TableCell
                      className={`text-right text-sm text-default-500 ${isTotalRow ? "font-bold" : ""}`}
                    >
                      {isTotalRow ? fmtPct(toNum(s.grossMargin)) : fmtPct(grossMarginPct)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-default-600 ${isTotalRow ? "font-bold" : ""}`}
                    >
                      {fmt(row.payroll)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-default-600 ${isTotalRow ? "font-bold" : ""}`}
                    >
                      {fmt(row.operatingExpenses)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-warning-500 ${isTotalRow ? "font-bold" : ""}`}
                    >
                      {fmt(totalOpCosts)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono ${isTotalRow ? "font-bold" : "font-semibold"} ${isRowProfit ? "text-success-600" : "text-danger-600"}`}
                    >
                      {fmt(row.operatingIncome)}
                    </TableCell>
                    <TableCell
                      className={`text-right text-sm ${isTotalRow ? "font-bold" : "font-semibold"} ${isRowProfit ? "text-success-600" : "text-danger-600"}`}
                    >
                      {isTotalRow ? fmtPct(toNum(s.operatingMargin)) : fmtPct(opMarginPct)}
                    </TableCell>
                  </TableRow>
                );
              }}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
