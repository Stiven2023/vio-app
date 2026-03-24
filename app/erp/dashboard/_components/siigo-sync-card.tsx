"use client";

import type { SyncStats } from "@/app/api/siigo/sync-customers/route";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { toast } from "react-hot-toast";

type SyncResponse = SyncStats | { ok: false; error: string };

export function SiigoSyncCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncStats | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const handleSync = async () => {
    if (loading) return;
    setLoading(true);
    setResult(null);
    setShowErrors(false);

    try {
      const response = await fetch("/api/siigo/sync-customers", {
        method: "POST",
        credentials: "include",
      });

      const payload = (await response
        .json()
        .catch(() => null)) as SyncResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          (!payload?.ok && payload?.error) ||
            "No se pudo completar la sincronización",
        );
      }

      setResult(payload);

      const { created, updated, errors } = payload;

      if (errors.length > 0) {
        toast.error(
          `Sincronización completa con ${errors.length} error(es). ${created} creados, ${updated} actualizados.`,
        );
      } else {
        toast.success(
          `Sincronización exitosa: ${created} creados, ${updated} actualizados.`,
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al sincronizar clientes Siigo",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border border-default-200 bg-content1">
      <CardHeader className="flex flex-col items-start gap-1">
        <div className="text-base font-semibold">
          Sincronizar clientes Siigo
        </div>
        <p className="text-sm text-default-500">
          Importa todos los clientes de Siigo a la base de datos local. Los
          existentes (mismo número de identificación) se actualizan; los nuevos
          se crean con estado{" "}
          <span className="font-semibold">EN REVISIÓN</span>.
        </p>
      </CardHeader>

      <CardBody className="gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            color="primary"
            isDisabled={loading}
            isLoading={loading}
            onPress={() => void handleSync()}
          >
            {loading ? "Sincronizando..." : "Sincronizar ahora"}
          </Button>

          {loading && (
            <span className="text-sm text-default-500">
              Descargando clientes de Siigo y actualizando la base de datos…
            </span>
          )}
        </div>

        {result && (
          <div className="flex flex-col gap-3">
            {/* Resumen */}
            <div className="flex flex-wrap gap-2">
              <Chip color="default" size="sm" variant="flat">
                Total Siigo: {result.total}
              </Chip>
              <Chip color="success" size="sm" variant="flat">
                Creados: {result.created}
              </Chip>
              <Chip color="primary" size="sm" variant="flat">
                Actualizados: {result.updated}
              </Chip>
              {result.errors.length > 0 && (
                <Chip color="danger" size="sm" variant="flat">
                  Errores: {result.errors.length}
                </Chip>
              )}
              <Chip color="default" size="sm" variant="flat">
                Tiempo: {(result.durationMs / 1000).toFixed(1)}s
              </Chip>
            </div>

            {/* Detalle de errores */}
            {result.errors.length > 0 && (
              <div className="flex flex-col gap-2">
                <Button
                  className="h-auto min-w-0 px-0 text-xs underline"
                  size="sm"
                  variant="light"
                  onPress={() => setShowErrors((v) => !v)}
                >
                  {showErrors ? "Ocultar errores" : "Ver errores"}
                </Button>

                {showErrors && (
                  <Table removeWrapper aria-label="Errores de sincronización">
                    <TableHeader>
                      <TableColumn>Identificación</TableColumn>
                      <TableColumn>Nombre</TableColumn>
                      <TableColumn>Motivo</TableColumn>
                    </TableHeader>
                    <TableBody items={result.errors}>
                      {(row) => (
                        <TableRow key={row.identification}>
                          <TableCell>{row.identification}</TableCell>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>
                            <span className="text-xs text-danger">
                              {row.reason}
                            </span>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
