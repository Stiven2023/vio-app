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

import { ACCOUNTING_PREVIEW_ROWS } from "./accounting-mock-data";

function statusColor(status: string) {
  switch (status) {
    case "BORRADOR":
      return "default" as const;
    case "PENDIENTE":
      return "warning" as const;
    case "EN_REVISION":
      return "secondary" as const;
    case "CONCILIANDO":
      return "primary" as const;
    case "LISTO":
      return "success" as const;
    default:
      return "default" as const;
  }
}

export function AccountingVisualPreview() {
  return (
    <Card className="border border-warning-200 bg-warning-50" radius="sm" shadow="none">
      <CardHeader className="flex flex-col items-start gap-2 px-4 pb-1 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip color="warning" size="sm" variant="flat">
            Demo visual contabilidad
          </Chip>
          <Chip color="default" size="sm" variant="flat">
            5 casos demo
          </Chip>
          <Chip color="danger" size="sm" variant="flat">
            Sin persistencia
          </Chip>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-default-800">
            Flujo de referencia por niveles contables
          </h2>
          <p className="text-xs text-default-600">
            Ejemplos visuales para mostrar captura, aplicación, conciliación y cierre sin tocar datos reales ni habilitar guardado.
          </p>
        </div>
      </CardHeader>
      <CardBody className="px-4 pb-4 pt-2">
        <div className="overflow-x-auto rounded-medium border border-warning-200 bg-content1">
          <Table removeWrapper aria-label="Vista previa visual de contabilidad">
            <TableHeader>
              <TableColumn>Nivel</TableColumn>
              <TableColumn>Caso</TableColumn>
              <TableColumn>Área</TableColumn>
              <TableColumn>Monto</TableColumn>
              <TableColumn>Estado</TableColumn>
              <TableColumn>Siguiente paso</TableColumn>
              <TableColumn>Acción</TableColumn>
            </TableHeader>
            <TableBody items={ACCOUNTING_PREVIEW_ROWS}>
              {(item) => (
                <TableRow key={item.id}>
                  <TableCell><span className="text-xs font-medium">{item.level}</span></TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-mono text-xs">{item.id}</p>
                      <p className="text-xs text-default-700">{item.caseName}</p>
                    </div>
                  </TableCell>
                  <TableCell><span className="text-xs">{item.area}</span></TableCell>
                  <TableCell><span className="text-xs font-medium">{item.amount}</span></TableCell>
                  <TableCell>
                    <Chip color={statusColor(item.status)} size="sm" variant="flat">
                      {item.status}
                    </Chip>
                  </TableCell>
                  <TableCell><span className="text-xs text-default-600">{item.nextAction}</span></TableCell>
                  <TableCell>
                    <Button isDisabled radius="sm" size="sm" variant="flat">
                      Solo visual
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardBody>
    </Card>
  );
}