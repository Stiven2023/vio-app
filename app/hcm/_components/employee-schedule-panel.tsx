"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";

type Entry = {
  date: string;
  hours: number;
  shift: "MORNING" | "AFTERNOON" | "NIGHT" | "OFF";
};

type ResponseData = {
  month: string;
  employee: {
    id: string;
    name: string | null;
    employeeCode: string | null;
  };
  monthSchedule: {
    totalHours: number;
    entries: Entry[];
  };
  weekSchedule: Entry[];
};

const SHIFT_LABEL: Record<Entry["shift"], string> = {
  MORNING: "Manana",
  AFTERNOON: "Tarde",
  NIGHT: "Noche",
  OFF: "Descanso",
};

function currentMonth() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${now.getFullYear()}-${month}`;
}

function mondayOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);

  monday.setDate(now.getDate() + diff);

  return monday.toISOString().slice(0, 10);
}

export function EmployeeSchedulePanel() {
  const [month, setMonth] = useState(currentMonth());
  const [weekStart, setWeekStart] = useState(mondayOfCurrentWeek());
  const [data, setData] = useState<ResponseData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ month, weekStart });

    void fetch(`/api/hcm/work-schedules?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.statusText)))
      .then((json: ResponseData) => setData(json))
      .catch(() => setData(null));
  }, [month, weekStart]);

  const weekHours = useMemo(
    () => (data?.weekSchedule ?? []).reduce((acc, item) => acc + item.hours, 0),
    [data?.weekSchedule],
  );

  return (
    <Card>
      <CardBody className="space-y-4">
        <h3 className="text-base font-semibold">Mi horario (semana y mes)</h3>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            className="sm:w-52"
            label="Mes"
            type="month"
            value={month}
            variant="bordered"
            onValueChange={setMonth}
          />
          <Input
            className="sm:w-52"
            label="Inicio semana"
            type="date"
            value={weekStart}
            variant="bordered"
            onValueChange={setWeekStart}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-medium border border-default-200 p-3">
            <p className="text-xs text-default-500">Horas de la semana</p>
            <p className="text-xl font-semibold">{weekHours}</p>
          </div>
          <div className="rounded-medium border border-default-200 p-3">
            <p className="text-xs text-default-500">Horas del mes</p>
            <p className="text-xl font-semibold">{data?.monthSchedule.totalHours ?? 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-medium border border-default-200">
            <p className="border-b border-default-100 px-3 py-2 text-sm font-medium">
              Semana
            </p>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-default-50 text-left">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Horas</th>
                    <th className="px-3 py-2">Turno</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.weekSchedule ?? []).map((entry) => (
                    <tr key={`week-${entry.date}`} className="border-t border-default-100">
                      <td className="px-3 py-2">{entry.date}</td>
                      <td className="px-3 py-2">{entry.hours}</td>
                      <td className="px-3 py-2">{SHIFT_LABEL[entry.shift]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-medium border border-default-200">
            <p className="border-b border-default-100 px-3 py-2 text-sm font-medium">
              Mes
            </p>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-default-50 text-left">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Horas</th>
                    <th className="px-3 py-2">Turno</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.monthSchedule.entries ?? []).map((entry) => (
                    <tr key={`month-${entry.date}`} className="border-t border-default-100">
                      <td className="px-3 py-2">{entry.date}</td>
                      <td className="px-3 py-2">{entry.hours}</td>
                      <td className="px-3 py-2">{SHIFT_LABEL[entry.shift]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
