"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";

type WorkScheduleEntry = {
  date: string;
  hours: number;
  shift: "MORNING" | "AFTERNOON" | "NIGHT" | "OFF";
  isOperator: boolean;
};

type EmployeeMonthSchedule = {
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  contractType: string | null;
  totalHours: number;
  entries: WorkScheduleEntry[];
};

type HrScheduleResponse = {
  month: string;
  schedules: EmployeeMonthSchedule[];
};

function currentMonth() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${now.getFullYear()}-${month}`;
}

const SHIFT_LABEL: Record<WorkScheduleEntry["shift"], string> = {
  MORNING: "Manana",
  AFTERNOON: "Tarde",
  NIGHT: "Noche",
  OFF: "Descanso",
};

export function EmployeeScheduleCalendar() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<HrScheduleResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/hr/work-schedules?month=${encodeURIComponent(month)}`,
      );

      if (!response.ok) throw new Error("No se pudo cargar el calendario");

      const json = (await response.json()) as HrScheduleResponse;

      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [month]);

  const selected = useMemo(() => {
    if (!data?.schedules.length) return null;
    if (!employeeId) return data.schedules[0];

    return data.schedules.find((item) => item.employeeId === employeeId) ?? null;
  }, [data?.schedules, employeeId]);

  const operators = useMemo(
    () => (data?.schedules ?? []).filter((item) => item.entries.some((d) => d.isOperator)),
    [data?.schedules],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="gap-3">
          <h3 className="text-base font-semibold">Calendario RH de horarios por empleado</h3>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              className="sm:w-56"
              label="Mes"
              type="month"
              value={month}
              variant="bordered"
              onValueChange={setMonth}
            />
            <Select
              className="sm:w-80"
              label="Empleado"
              selectedKeys={employeeId ? [employeeId] : []}
              variant="bordered"
              onSelectionChange={(keys) => {
                const value = String(Array.from(keys)[0] ?? "");

                setEmployeeId(value);
              }}
            >
              {(data?.schedules ?? []).map((item) => (
                <SelectItem key={item.employeeId}>
                  {item.employeeName}
                  {item.employeeCode ? ` (${item.employeeCode})` : ""}
                </SelectItem>
              ))}
            </Select>
            <Button isDisabled={loading} variant="flat" onPress={load}>
              {loading ? "Cargando..." : "Actualizar"}
            </Button>
          </div>

          {selected ? (
            <div className="rounded-medium border border-default-200 p-3 text-sm">
              <p className="font-medium">{selected.employeeName}</p>
              <p className="text-default-600">Horas del mes: {selected.totalHours}</p>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {selected ? (
        <Card>
          <CardBody>
            <h4 className="mb-2 text-sm font-semibold">Detalle diario del mes</h4>
            <div className="max-h-72 overflow-y-auto rounded-medium border border-default-200">
              <table className="w-full text-sm">
                <thead className="bg-default-100 text-left">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Horas</th>
                    <th className="px-3 py-2">Turno</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.entries.map((entry) => (
                    <tr key={entry.date} className="border-t border-default-100">
                      <td className="px-3 py-2">{entry.date}</td>
                      <td className="px-3 py-2">{entry.hours}</td>
                      <td className="px-3 py-2">{SHIFT_LABEL[entry.shift]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody>
          <h4 className="mb-2 text-sm font-semibold">Turnos de operarios (mes)</h4>
          <div className="max-h-72 overflow-y-auto rounded-medium border border-default-200">
            <table className="w-full text-sm">
              <thead className="bg-default-100 text-left">
                <tr>
                  <th className="px-3 py-2">Operario</th>
                  <th className="px-3 py-2">Codigo</th>
                  <th className="px-3 py-2">Horas</th>
                  <th className="px-3 py-2">Turno referencia</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((item) => {
                  const firstWorkDay = item.entries.find((entry) => entry.shift !== "OFF");

                  return (
                    <tr key={item.employeeId} className="border-t border-default-100">
                      <td className="px-3 py-2">{item.employeeName}</td>
                      <td className="px-3 py-2">{item.employeeCode ?? "-"}</td>
                      <td className="px-3 py-2">{item.totalHours}</td>
                      <td className="px-3 py-2">
                        {firstWorkDay ? SHIFT_LABEL[firstWorkDay.shift] : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
