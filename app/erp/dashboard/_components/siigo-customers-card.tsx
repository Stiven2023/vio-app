"use client";

import { useMemo, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { Chip } from "@heroui/chip";
import { toast } from "react-hot-toast";

type SiigoCustomer = {
  id: string | null;
  name: string;
  identification: string | null;
  email: string | null;
  phone: string | null;
  active: boolean | null;
  type: string | null;
  personType: string | null;
};

type CustomersResponse = {
  ok: boolean;
  items?: SiigoCustomer[];
  total?: number;
  error?: string;
};

function formatActive(value: boolean | null) {
  if (value === true) return "Activo";
  if (value === false) return "Inactivo";

  return "N/D";
}

export function SiigoCustomersCard() {
  const [loading, setLoading] = useState(false);
  const [identification, setIdentification] = useState("");
  const [rows, setRows] = useState<SiigoCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({ page: "1", page_size: "25" });

    if (identification.trim()) {
      params.set("identification", identification.trim());
    }

    return `/api/siigo/customers?${params.toString()}`;
  }, [identification]);

  const loadCustomers = async () => {
    if (loading || !identification.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        credentials: "include",
      });

      const payload = (await response
        .json()
        .catch(() => null)) as CustomersResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error || "No se pudo consultar clientes Siigo",
        );
      }

      setRows(payload.items ?? []);
      setTotal(Number(payload.total ?? payload.items?.length ?? 0));
      setSearched(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo consultar clientes Siigo",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void loadCustomers();
  };

  return (
    <Card className="border border-default-200 bg-content1">
      <CardHeader className="flex flex-col items-start gap-2">
        <div className="text-base font-semibold">Buscar cliente Siigo</div>
        <p className="text-sm text-default-500">
          Ingrese el número de identificación para consultar en Siigo.
        </p>
      </CardHeader>

      <CardBody className="gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="Identificación"
            placeholder="Ej: 13832081"
            value={identification}
            onKeyDown={handleKeyDown}
            onValueChange={setIdentification}
          />
          <Button
            isDisabled={loading || !identification.trim()}
            onPress={() => void loadCustomers()}
          >
            {loading ? "Buscando..." : "Buscar"}
          </Button>
        </div>

        {searched && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-default-500">
              Resultados: {total}
            </span>
            {loading ? <Spinner size="sm" /> : null}
          </div>
        )}

        {searched ? (
          <Table removeWrapper aria-label="Clientes Siigo">
            <TableHeader>
              <TableColumn>Cliente</TableColumn>
              <TableColumn>Identificación</TableColumn>
              <TableColumn>Email</TableColumn>
              <TableColumn>Teléfono</TableColumn>
              <TableColumn>Estado</TableColumn>
            </TableHeader>
            <TableBody
              emptyContent="No se encontró ningún cliente con esa identificación."
              items={rows}
            >
              {(row) => (
                <TableRow key={row.id ?? `${row.identification}-${row.name}`}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{row.name}</span>
                      <span className="text-xs text-default-500">
                        {row.personType ?? "N/D"} / {row.type ?? "N/D"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{row.identification ?? "-"}</TableCell>
                  <TableCell>{row.email ?? "-"}</TableCell>
                  <TableCell>{row.phone ?? "-"}</TableCell>
                  <TableCell>
                    <Chip
                      color={
                        row.active
                          ? "success"
                          : row.active === false
                            ? "default"
                            : "warning"
                      }
                      size="sm"
                      variant="flat"
                    >
                      {formatActive(row.active)}
                    </Chip>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-default-400">
            Ingrese una identificación y presione Buscar para consultar el
            cliente en Siigo.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
