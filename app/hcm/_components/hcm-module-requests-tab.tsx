"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";

type RequestItem = {
  id: string;
  type: "PERMISO" | "RECLAMO" | "SOLICITUD" | "SUGERENCIA" | "PQR";
  subject: string;
  description: string;
  requestDate: string | null;
  status: string;
  priority: string;
  createdAt: string;
};

type RequestsData = {
  items: RequestItem[];
};

const TYPE_OPTIONS: Array<{ value: RequestItem["type"]; label: string }> = [
  { value: "SOLICITUD", label: "Solicitud" },
  { value: "PERMISO", label: "Permiso" },
  { value: "RECLAMO", label: "Reclamo" },
  { value: "SUGERENCIA", label: "Sugerencia" },
  { value: "PQR", label: "PQR" },
];

const PRIORITY_OPTIONS = [
  { value: "BAJA", label: "Baja" },
  { value: "MEDIA", label: "Media" },
  { value: "ALTA", label: "Alta" },
];

export function HcmModuleRequestsTab({
  moduleKey,
  title,
  description,
  defaultType = "SOLICITUD",
}: {
  moduleKey: string;
  title: string;
  description: string;
  defaultType?: RequestItem["type"];
}) {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [type, setType] = useState<RequestItem["type"]>(defaultType);
  const [priority, setPriority] = useState("MEDIA");
  const [subject, setSubject] = useState("");
  const [descriptionText, setDescriptionText] = useState("");
  const [requestDate, setRequestDate] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/hcm/mis-peticiones?page=1&pageSize=10");

      if (!response.ok) throw new Error("No se pudieron cargar peticiones");

      const json = (await response.json()) as RequestsData;

      setRequests(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      type,
      subject: `[${moduleKey}] ${subject}`,
      description: descriptionText,
      requestDate: requestDate || undefined,
      priority,
    };

    const response = await fetch("/api/hcm/mis-peticiones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return;
    }

    setSubject("");
    setDescriptionText("");
    setRequestDate("");
    setPriority("MEDIA");
    setType(defaultType);
    await load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-2">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-default-600">{description}</p>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <form className="space-y-3" onSubmit={submitRequest}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Select
                label="Tipo"
                selectedKeys={[type]}
                variant="bordered"
                onSelectionChange={(keys) => {
                  const value = String(Array.from(keys)[0] ?? defaultType) as RequestItem["type"];

                  setType(value);
                }}
              >
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value}>{option.label}</SelectItem>
                ))}
              </Select>

              <Select
                label="Prioridad"
                selectedKeys={[priority]}
                variant="bordered"
                onSelectionChange={(keys) => {
                  setPriority(String(Array.from(keys)[0] ?? "MEDIA"));
                }}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value}>{option.label}</SelectItem>
                ))}
              </Select>

              <Input
                label="Fecha (solo permisos)"
                type="date"
                value={requestDate}
                variant="bordered"
                onValueChange={setRequestDate}
              />
            </div>

            <Input
              isRequired
              label="Asunto"
              value={subject}
              variant="bordered"
              onValueChange={setSubject}
            />

            <Textarea
              isRequired
              label="Descripcion"
              minRows={3}
              value={descriptionText}
              variant="bordered"
              onValueChange={setDescriptionText}
            />

            <Button color="primary" type="submit">
              Registrar solicitud del modulo
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-2">
          <h4 className="text-sm font-semibold">Ultimas peticiones del empleado</h4>
          <div className="max-h-72 overflow-y-auto rounded-medium border border-default-200">
            <table className="w-full text-sm">
              <thead className="bg-default-100 text-left">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Asunto</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(requests ?? []).map((item) => (
                  <tr key={item.id} className="border-t border-default-100">
                    <td className="px-3 py-2">
                      {new Date(item.createdAt).toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-3 py-2">{item.type}</td>
                    <td className="px-3 py-2">{item.subject}</td>
                    <td className="px-3 py-2">{item.status}</td>
                  </tr>
                ))}
                {!loading && requests.length === 0 ? (
                  <tr>
                    <td className="px-3 py-2 text-default-500" colSpan={4}>
                      No hay peticiones registradas.
                    </td>
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
