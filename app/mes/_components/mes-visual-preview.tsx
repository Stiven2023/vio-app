"use client";

import type { PedidoGroup, TallaRow } from "@/app/mes/_components/mes-types";

import React, { useMemo } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { MdOutlineVisibility, MdOutlineVisibilityOff } from "react-icons/md";

import { MOCK_DATA } from "@/app/mes/_components/mes-mock-data";

type PreviewRow = {
  pedido: string;
  cliente: string;
  estado: PedidoGroup["estado"];
  nivel: string;
  totalDisenos: number;
  totalUnidades: number;
  siguienteAccion: string;
};

function sumTallas(tallas: TallaRow[]) {
  return tallas.reduce((acc, talla) => acc + Number(talla.cantidad ?? 0), 0);
}

function resolveNivel(pedido: PedidoGroup) {
  if (pedido.estado === "SIN TRAMITAR") {
    return "Nivel 1 · Ingreso";
  }

  if (pedido.estado === "COMPLETADO") {
    return "Nivel 5 · Cerrado";
  }

  const hasRepo = pedido.disenos.some((diseno) =>
    diseno.tallas.some((talla) => talla.estado === "reponer"),
  );

  if (pedido.estado === "TARDE") {
    return hasRepo ? "Nivel 4 · Crítico con reposición" : "Nivel 4 · Crítico";
  }

  if (hasRepo) {
    return "Nivel 3 · Reposición";
  }

  return "Nivel 2 · Producción activa";
}

function resolveSiguienteAccion(pedido: PedidoGroup) {
  if (pedido.estado === "SIN TRAMITAR") {
    return "Confirmar cola y asignar líder de producción";
  }

  if (pedido.estado === "COMPLETADO") {
    return "Solo visual: listo para consulta histórica";
  }

  const hasRepo = pedido.disenos.some((diseno) =>
    diseno.tallas.some((talla) => talla.estado === "reponer"),
  );

  if (pedido.estado === "TARDE") {
    return "Escalar prioridad y revisar cuello de botella";
  }

  if (hasRepo) {
    return "Generar reposición controlada y validar impacto";
  }

  return "Continuar avance por proceso y monitorear tiempos";
}

function statusColor(estado: PedidoGroup["estado"]) {
  switch (estado) {
    case "SIN TRAMITAR":
      return "default" as const;
    case "EN PROCESO":
      return "primary" as const;
    case "COMPLETADO":
      return "success" as const;
    case "TARDE":
      return "danger" as const;
    default:
      return "default" as const;
  }
}

export function MesVisualPreview() {
  const previewRows = useMemo<PreviewRow[]>(() => {
    return MOCK_DATA.slice(0, 5).map((pedido) => ({
      pedido: pedido.pedido,
      cliente: pedido.cliente,
      estado: pedido.estado,
      nivel: resolveNivel(pedido),
      totalDisenos: pedido.disenos.length,
      totalUnidades: pedido.disenos.reduce(
        (acc, diseno) => acc + sumTallas(diseno.tallas),
        0,
      ),
      siguienteAccion: resolveSiguienteAccion(pedido),
    }));
  }, []);

  return (
    <Card className="border border-warning-200 bg-warning-50" radius="sm" shadow="none">
      <CardHeader className="flex flex-col items-start gap-1 px-4 pb-1 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip color="warning" size="sm" variant="flat">
            Demo visual MES
          </Chip>
          <Chip color="default" size="sm" variant="flat">
            5 pedidos de prueba
          </Chip>
          <Chip color="danger" size="sm" variant="flat">
            Guardado deshabilitado
          </Chip>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-default-800">
            Vista previa de niveles de pedido
          </h2>
          <p className="text-xs text-default-600">
            Esta sección solo muestra cómo debería verse el flujo en MES. No persiste datos ni habilita acciones reales por ahora.
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-3 px-4 pb-4 pt-2">
        <div className="overflow-x-auto rounded-medium border border-warning-200 bg-content1">
          <Table removeWrapper aria-label="Vista previa visual de pedidos demo en MES">
            <TableHeader>
              <TableColumn>Nivel</TableColumn>
              <TableColumn>Pedido</TableColumn>
              <TableColumn>Cliente</TableColumn>
              <TableColumn>Estado</TableColumn>
              <TableColumn>Diseños</TableColumn>
              <TableColumn>Unidades</TableColumn>
              <TableColumn>Qué debería hacer</TableColumn>
              <TableColumn>Acción</TableColumn>
            </TableHeader>
            <TableBody items={previewRows}>
              {(item) => (
                <TableRow key={item.pedido}>
                  <TableCell>
                    <span className="text-xs font-medium text-default-700">
                      {item.nivel}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{item.pedido}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{item.cliente}</span>
                  </TableCell>
                  <TableCell>
                    <Chip color={statusColor(item.estado)} size="sm" variant="flat">
                      {item.estado}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{item.totalDisenos}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium">{item.totalUnidades}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-default-600">
                      {item.siguienteAccion}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      isDisabled
                      radius="sm"
                      size="sm"
                      startContent={<MdOutlineVisibilityOff />}
                      variant="flat"
                    >
                      Solo visual
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-default-600">
          <Button
            isDisabled
            radius="sm"
            size="sm"
            startContent={<MdOutlineVisibility />}
            variant="flat"
          >
            Ver simulación
          </Button>
          <span>
            Las acciones quedan bloqueadas hasta habilitar persistencia y reglas finales de guardado.
          </span>
        </div>
      </CardBody>
    </Card>
  );
}