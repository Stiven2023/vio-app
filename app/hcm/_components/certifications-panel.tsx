"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";

type CertificationItem = {
  key: string;
  label: string;
  url: string | null;
};

type Data = {
  employee: {
    id: string;
    name: string | null;
    employeeCode: string | null;
  };
  certifications: CertificationItem[];
};

export function CertificationsPanel() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    void fetch("/api/hcm/certifications")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.statusText)))
      .then((json: Data) => setData(json))
      .catch(() => setData(null));
  }, []);

  return (
    <Card>
      <CardBody className="space-y-3">
        <h3 className="text-base font-semibold">Certificaciones del empleado</h3>
        <p className="text-sm text-default-600">
          Consulta y descarga de certificados disponibles en tu perfil laboral.
        </p>

        <div className="space-y-2">
          {(data?.certifications ?? []).map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-medium border border-default-200 px-3 py-2"
            >
              <span className="text-sm">{item.label}</span>
              {item.url ? (
                <Button
                  as="a"
                  href={item.url}
                  rel="noreferrer"
                  size="sm"
                  target="_blank"
                  variant="flat"
                >
                  Ver
                </Button>
              ) : (
                <span className="text-xs text-default-500">No disponible</span>
              )}
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
