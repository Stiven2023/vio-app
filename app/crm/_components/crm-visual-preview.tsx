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

import { CRM_PREVIEW_ROWS } from "./crm-mock-data";

function stageColor(stage: string) {
  switch (stage) {
    case "LEAD":
      return "default" as const;
    case "CONTACTADO":
      return "primary" as const;
    case "PROPUESTA":
      return "secondary" as const;
    case "NEGOCIACION":
      return "warning" as const;
    case "CIERRE":
      return "success" as const;
    default:
      return "default" as const;
  }
}

export function CrmVisualPreview() {
  return (
    <Card className="mb-6 border border-warning-200 bg-warning-50" radius="sm" shadow="none">
      <CardHeader className="flex flex-col items-start gap-2 px-4 pb-1 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip color="warning" size="sm" variant="flat">
            Demo visual CRM
          </Chip>
          <Chip color="default" size="sm" variant="flat">
            5 oportunidades demo
          </Chip>
          <Chip color="danger" size="sm" variant="flat">
            Sin guardar
          </Chip>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-default-800">
            Pipeline visual de referencia
          </h2>
          <p className="text-xs text-default-600">
            Vista de ejemplo para mostrar cómo deberían verse distintos niveles del proceso comercial. Las acciones están deshabilitadas.
          </p>
        </div>
      </CardHeader>
      <CardBody className="px-4 pb-4 pt-2">
        <div className="overflow-x-auto rounded-medium border border-warning-200 bg-content1">
          <Table removeWrapper aria-label="Vista previa visual de CRM">
            <TableHeader>
              <TableColumn>Nivel</TableColumn>
              <TableColumn>Oportunidad</TableColumn>
              <TableColumn>Empresa</TableColumn>
              <TableColumn>Etapa</TableColumn>
              <TableColumn>Responsable</TableColumn>
              <TableColumn>Valor estimado</TableColumn>
              <TableColumn>Próximo paso</TableColumn>
              <TableColumn>Acción</TableColumn>
            </TableHeader>
            <TableBody items={CRM_PREVIEW_ROWS}>
              {(item) => (
                <TableRow key={item.id}>
                  <TableCell><span className="text-xs font-medium">{item.level}</span></TableCell>
                  <TableCell><span className="font-mono text-xs">{item.id}</span></TableCell>
                  <TableCell><span className="text-xs">{item.company}</span></TableCell>
                  <TableCell>
                    <Chip color={stageColor(item.stage)} size="sm" variant="flat">
                      {item.stage}
                    </Chip>
                  </TableCell>
                  <TableCell><span className="text-xs">{item.owner}</span></TableCell>
                  <TableCell><span className="text-xs font-medium">{item.estimatedValue}</span></TableCell>
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