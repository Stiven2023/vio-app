import React from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tooltip,
} from "@heroui/react";
import { MdExpandLess, MdExpandMore, MdTag } from "react-icons/md";

import { ESTADO_CONFIG, PEDIDO_ESTADO_CONFIG } from "./mes-config";
import { formatDate } from "./mes-utils";
import type { DisenoGroup, MontajeAssignment, PedidoGroup } from "./mes-types";

function TicketBadge({ ticket, proceso }: { ticket: string; proceso: string }) {
  const colors: Record<string, string> = {
    MO: "bg-violet-600 dark:bg-violet-500",
    MON: "bg-violet-600 dark:bg-violet-500",
    PLO: "bg-cyan-600 dark:bg-cyan-500",
    SUB: "bg-orange-500 dark:bg-orange-400",
    COR: "bg-rose-600 dark:bg-rose-500",
    INT: "bg-teal-600 dark:bg-teal-500",
    CON: "bg-indigo-600 dark:bg-indigo-500",
    EMP: "bg-amber-600 dark:bg-amber-500",
    DES: "bg-emerald-600 dark:bg-emerald-500",
  };
  const prefix = String(ticket.split("-")[0] ?? "").toUpperCase();
  const bg = colors[prefix] ?? "bg-gray-600";

  return (
    <Tooltip content={`Ticket de ${proceso}`} placement="left">
      <div
        className={`absolute -top-2 -right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full shadow-lg text-white text-[10px] font-bold tracking-wide ${bg}`}
      >
        <MdTag size={10} />
        {ticket}
      </div>
    </Tooltip>
  );
}

function DisenoCard({ diseno }: { diseno: DisenoGroup }) {
  const total = diseno.tallas.reduce((s, t) => s + t.cantidad, 0);
  const completadas = diseno.tallas
    .filter((t) => t.estado === "completado")
    .reduce((s, t) => s + t.cantidad, 0);
  const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;

  return (
    <Card className="relative border border-divider shadow-sm mb-3" radius="sm">
      <CardHeader className="pb-1 pt-3 px-4 flex flex-col items-start gap-0">
        <div className="flex items-center gap-2 w-full">
          <span className="text-xs font-semibold uppercase tracking-widest text-default-400">
            Diseno {diseno.diseno}
          </span>
          <Chip
            className="ml-auto text-[10px]"
            color="default"
            size="sm"
            variant="flat"
          >
            {pct}% completado
          </Chip>
        </div>
        <p className="text-sm font-bold text-foreground mt-0.5">{diseno.detalle}</p>
        <div className="flex gap-3 mt-1">
          <span className="text-xs text-default-400">
            Tela: <span className="text-foreground font-medium">{diseno.tela}</span>
          </span>
          <span className="text-xs text-default-400">
            Genero: <span className="text-foreground font-medium">{diseno.genero}</span>
          </span>
          <span className="text-xs text-default-400">
            Total: <span className="text-foreground font-bold">{total} uds</span>
          </span>
        </div>
        <div className="w-full h-1 bg-default-100 rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-success rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Chip className="text-[10px] h-5 font-bold" color="secondary" size="sm" variant="flat">
            Montaje: {diseno.ticketMontaje}
          </Chip>
        </div>
      </CardHeader>

      <Divider />

      <CardBody className="px-2 py-2">
        <Table
          removeWrapper
          aria-label={`Tallas diseno ${diseno.diseno}`}
          classNames={{
            th: "bg-default-50 dark:bg-default-100 text-default-500 text-[11px] h-7 uppercase tracking-wide",
            td: "py-1.5 text-xs",
          }}
        >
          <TableHeader>
            <TableColumn>Talla</TableColumn>
            <TableColumn>Cantidad</TableColumn>
            <TableColumn>Estado</TableColumn>
            <TableColumn>Responsable</TableColumn>
            <TableColumn>Fecha inicio</TableColumn>
            <TableColumn>Fecha fin</TableColumn>
            <TableColumn>Observacion</TableColumn>
          </TableHeader>
          <TableBody>
            {diseno.tallas.map((talla, ti) => {
              const cfg = ESTADO_CONFIG[talla.estado];

              return (
                <TableRow key={ti}>
                  <TableCell>
                    <span className="font-semibold text-foreground">{talla.talla}</span>
                  </TableCell>
                  <TableCell>{talla.cantidad}</TableCell>
                  <TableCell>
                    <Chip
                      className="text-[10px] h-5"
                      color={cfg.color}
                      size="sm"
                      startContent={cfg.icon}
                      variant="flat"
                    >
                      {cfg.label}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <span className="text-default-500">{talla.responsable ?? "-"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-default-500">{talla.fechaInicio ?? "-"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-default-500">{talla.fechaFin ?? "-"}</span>
                  </TableCell>
                  <TableCell>
                    {talla.observacion ? (
                      <Chip
                        className="text-[10px] h-5"
                        color="warning"
                        size="sm"
                        variant="dot"
                      >
                        {talla.observacion}
                      </Chip>
                    ) : (
                      <span className="text-default-300">-</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="flex justify-end mt-2 pr-2">
          <span className="text-[10px] text-default-400">Ticket unico de montaje por diseno</span>
        </div>
      </CardBody>
      <TicketBadge ticket={diseno.ticketMontaje} proceso="Montaje" />
    </Card>
  );
}

export function PedidoSection({
  pedido,
  onToggle,
}: {
  pedido: PedidoGroup;
  onToggle: () => void;
}) {
  const cfg = PEDIDO_ESTADO_CONFIG[pedido.estado];
  const totalUds = pedido.disenos
    .flatMap((d) => d.tallas)
    .reduce((s, t) => s + t.cantidad, 0);

  return (
    <Card className="mb-4 border border-divider shadow-sm overflow-visible" radius="md">
      <CardHeader
        className="flex items-center gap-3 cursor-pointer hover:bg-default-50 dark:hover:bg-default-100 transition-colors px-4 py-3"
        onClick={onToggle}
      >
        <button className="text-default-400 shrink-0">
          {pedido.expanded ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
        </button>

        <div className="flex flex-col">
          <span className="text-sm font-bold text-foreground leading-tight">{pedido.pedido}</span>
          <span className="text-xs text-default-400">{pedido.cliente}</span>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
          <span className="text-xs text-default-400">
            Vendedor: <span className="text-foreground font-medium">{pedido.vendedor}</span>
          </span>
          <Divider className="h-4" orientation="vertical" />
          <span className="text-xs text-default-400">
            Plazo: <span className="text-foreground font-medium">{pedido.plazo}d</span>
          </span>
          <Divider className="h-4" orientation="vertical" />
          <span className="text-xs text-default-400">
            Entrega: <span className="text-foreground font-medium">{pedido.fechaEntrega}</span>
          </span>
          <Divider className="h-4" orientation="vertical" />
          <span className="text-xs text-default-400">
            Total: <span className="text-foreground font-bold">{totalUds} uds</span>
          </span>
          <Chip className="text-[10px]" color={cfg.color} size="sm" variant="flat">
            {pedido.estado}
          </Chip>
          <Chip className="text-[10px] font-mono" color="default" size="sm" variant="bordered">
            {pedido.disenos.length} diseno{pedido.disenos.length !== 1 ? "s" : ""}
          </Chip>
        </div>
      </CardHeader>

      {pedido.expanded && (
        <CardBody className="pt-0 px-3 pb-3">
          <Divider className="mb-3" />
          {pedido.disenos.map((d, i) => (
            <DisenoCard key={i} diseno={d} />
          ))}
        </CardBody>
      )}
    </Card>
  );
}

export function MontajeAssignmentHeader({
  assignment,
  currentUserId,
  activeProceso,
}: {
  assignment: MontajeAssignment | null;
  currentUserId: string;
  activeProceso: string;
}) {
  const isTakenByMe = Boolean(
    assignment?.userId && currentUserId && assignment.userId === currentUserId,
  );
  const isTakenByOther = Boolean(
    assignment?.userId && currentUserId && assignment.userId !== currentUserId,
  );

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {isTakenByMe ? (
          <Chip color="success" size="sm" variant="flat">
            Tomado por mi
          </Chip>
        ) : null}
        {isTakenByOther ? (
          <Chip color="warning" size="sm" variant="flat">
            Tomado por otro operario
          </Chip>
        ) : null}
        {!assignment ? (
          <Chip color="default" size="sm" variant="flat">
            Sin tomar
          </Chip>
        ) : null}
      </div>
      {activeProceso === "montaje" ? (
        <div className="text-xs text-default-500">
          Tomado por {assignment?.userLabel ?? "-"}
          {assignment?.takenAt ? ` · ${formatDate(assignment.takenAt)}` : ""}
        </div>
      ) : null}
      {activeProceso === "montaje" && isTakenByOther ? (
        <div className="mt-2 rounded-medium border border-warning-300 bg-warning-50 px-3 py-2 text-xs text-warning-800">
          Este pedido esta tomado por otro operario. No puedes registrar produccion hasta que sea liberado.
        </div>
      ) : null}
    </>
  );
}
