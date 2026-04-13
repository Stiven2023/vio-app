"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";

type OvertimeType =
  | "DIURNA_ORDINARIA"
  | "NOCTURNA_ORDINARIA"
  | "DOMINICAL_DIURNA"
  | "DOMINICAL_NOCTURNA"
  | "FESTIVO_DIURNO"
  | "FESTIVO_NOCTURNO";

type OvertimeItem = {
  id: string;
  fecha: string;
  tipo: OvertimeType;
  totalHoras: string;
  status: string;
};

type OvertimeResponse = {
  items: OvertimeItem[];
};

const OVERTIME_TYPES: Array<{ value: OvertimeType; label: string }> = [
  { value: "DIURNA_ORDINARIA", label: "Daytime ordinary" },
  { value: "NOCTURNA_ORDINARIA", label: "Night ordinary" },
  { value: "DOMINICAL_DIURNA", label: "Sunday daytime" },
  { value: "DOMINICAL_NOCTURNA", label: "Sunday night" },
  { value: "FESTIVO_DIURNO", label: "Holiday daytime" },
  { value: "FESTIVO_NOCTURNO", label: "Holiday night" },
];

export function OvertimePanel() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<OvertimeItem[]>([]);
  const [supervisorId, setSupervisorId] = useState("");
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [totalHoras, setTotalHoras] = useState("");
  const [actividad, setActividad] = useState("");
  const [tipo, setTipo] = useState<OvertimeType>("DIURNA_ORDINARIA");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/hcm/horas-extras?page=1&pageSize=10");

      if (!response.ok) throw new Error("Unable to load overtime requests.");

      const json = (await response.json()) as OvertimeResponse;

      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/hcm/horas-extras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supervisorId,
          fecha,
          horaInicio,
          horaFin,
          tipo,
          totalHoras,
          actividad,
        }),
      });

      if (!response.ok) throw new Error("Unable to create overtime request.");

      setFecha("");
      setHoraInicio("");
      setHoraFin("");
      setTotalHoras("");
      setActividad("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border border-default-200/50">
        <CardBody className="space-y-3 p-5">
          <h3 className="text-lg font-semibold">Overtime</h3>
          <p className="text-sm text-default-500">Submit overtime requests and monitor approval status.</p>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input isRequired label="Supervisor ID" value={supervisorId} variant="bordered" onValueChange={setSupervisorId} />
              <Input isRequired label="Date" type="date" value={fecha} variant="bordered" onValueChange={setFecha} />
              <Input isRequired label="Start time" type="time" value={horaInicio} variant="bordered" onValueChange={setHoraInicio} />
              <Input isRequired label="End time" type="time" value={horaFin} variant="bordered" onValueChange={setHoraFin} />
              <Input isRequired label="Total hours" type="number" value={totalHoras} variant="bordered" onValueChange={setTotalHoras} />
              <Select isRequired label="Overtime type" selectedKeys={[tipo]} variant="bordered" onSelectionChange={(keys) => setTipo(String(Array.from(keys)[0]) as OvertimeType)}>
                {OVERTIME_TYPES.map((option) => (
                  <SelectItem key={option.value}>{option.label}</SelectItem>
                ))}
              </Select>
            </div>
            <Textarea isRequired label="Activity" minRows={3} value={actividad} variant="bordered" onValueChange={setActividad} />
            <Button color="primary" isDisabled={saving} isLoading={saving} type="submit">Submit overtime request</Button>
          </form>
        </CardBody>
      </Card>

      <Card className="border border-default-200/50">
        <CardBody className="space-y-2 p-5">
          <h4 className="text-sm font-semibold">Recent overtime requests</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-default-100">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Hours</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-default-200/60">
                    <td className="px-3 py-2">{item.fecha}</td>
                    <td className="px-3 py-2">{item.tipo}</td>
                    <td className="px-3 py-2">{item.totalHoras}</td>
                    <td className="px-3 py-2">{item.status}</td>
                  </tr>
                ))}
                {!loading && items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-2 text-default-500" colSpan={4}>No overtime requests found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
