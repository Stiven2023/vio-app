"use client";

import { useState } from "react";
import { Badge } from "@heroui/badge";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Progress } from "@heroui/progress";
import { Skeleton } from "@heroui/skeleton";
import { Tab, Tabs } from "@heroui/tabs";
import {
  BsArrowUpRight,
  BsBell,
  BsBuilding,
  BsCalendar3,
  BsCurrencyDollar,
  BsFunnel,
  BsGraphUp,
  BsPeople,
  BsPlus,
  BsSearch,
  BsTelephone,
  BsThreeDotsVertical,
} from "react-icons/bs";

// ── Mock pipeline data (visual only) ─────────────────────────────────────────

const PIPELINE_STAGES = [
  { id: "prospecto", label: "Prospecto", color: "bg-default-200", count: 8, value: "$24M" },
  { id: "contactado", label: "Contactado", color: "bg-blue-500", count: 5, value: "$18M" },
  { id: "propuesta", label: "Propuesta", color: "bg-yellow-500", count: 3, value: "$12M" },
  { id: "negociacion", label: "Negociación", color: "bg-orange-500", count: 2, value: "$9M" },
  { id: "cerrado", label: "Cerrado / Ganado", color: "bg-green-500", count: 4, value: "$6.4M" },
];

const MOCK_OPPORTUNITIES = [
  { id: "1", name: "Uniformes Atlético", client: "Atlético FC", stage: "Propuesta", value: "$4.2M", owner: "Carlos M.", days: 12, prob: 65 },
  { id: "2", name: "Kit escolar 2026", client: "Colegio Los Andes", stage: "Negociación", value: "$2.8M", owner: "Laura P.", days: 3, prob: 80 },
  { id: "3", name: "Dotación empresa", client: "Constructora Mega", stage: "Contactado", value: "$1.5M", owner: "Andrés G.", days: 21, prob: 30 },
  { id: "4", name: "Uniformes corporativos", client: "Banco Central", stage: "Prospecto", value: "$6.0M", owner: "María V.", days: 45, prob: 15 },
  { id: "5", name: "Campaña verano", client: "Liga Deportiva", stage: "Propuesta", value: "$3.1M", owner: "Carlos M.", days: 7, prob: 55 },
];

const MOCK_CLIENTS = [
  { id: "1", name: "Atlético FC", type: "Cliente", city: "Medellín", contact: "Juan Pérez", phone: "+57 300 111 2233", status: "Activo", deals: 3 },
  { id: "2", name: "Colegio Los Andes", type: "Prospecto", city: "Bogotá", contact: "Rosa Silva", phone: "+57 311 444 5566", status: "En seguimiento", deals: 1 },
  { id: "3", name: "Constructora Mega", type: "Cliente", city: "Cali", contact: "Pedro Ortiz", phone: "+57 318 777 8899", status: "Activo", deals: 2 },
  { id: "4", name: "Banco Central", type: "Prospecto", city: "Bogotá", contact: "Ana López", phone: "+57 320 222 3344", status: "Nuevo", deals: 0 },
  { id: "5", name: "Liga Deportiva", type: "Cliente", city: "Medellín", contact: "Luis Torres", phone: "+57 301 555 6677", status: "Activo", deals: 4 },
];

const MOCK_ACTIVITIES = [
  { id: "1", type: "Llamada", desc: "Seguimiento propuesta Kit escolar 2026", client: "Colegio Los Andes", date: "Hoy 10:30", user: "Laura P.", done: false },
  { id: "2", type: "Reunión", desc: "Demo producto — uniformes corporativos", client: "Banco Central", date: "Mañana 14:00", user: "María V.", done: false },
  { id: "3", type: "Email", desc: "Enviar cotización actualizada", client: "Atlético FC", date: "Ayer", user: "Carlos M.", done: true },
  { id: "4", type: "Tarea", desc: "Preparar muestras para visita", client: "Constructora Mega", date: "En 3 días", user: "Andrés G.", done: false },
  { id: "5", type: "Reunión", desc: "Cierre de contrato campaña verano", client: "Liga Deportiva", date: "Viernes 09:00", user: "Carlos M.", done: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function stageColor(stage: string): "default" | "primary" | "warning" | "danger" | "success" {
  switch (stage) {
    case "Prospecto": return "default";
    case "Contactado": return "primary";
    case "Propuesta": return "warning";
    case "Negociación": return "danger";
    case "Cerrado / Ganado": return "success";
    default: return "default";
  }
}

function ComingSoonBadge() {
  return (
    <Chip className="ml-2" color="warning" size="sm" variant="flat">
      Próximamente
    </Chip>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  trend?: string;
}) {
  return (
    <Card className="border border-default-200/40">
      <CardBody className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-medium bg-primary/10 text-primary text-xl">
            {icon}
          </div>
          {trend ? (
            <Chip color="success" size="sm" startContent={<BsArrowUpRight />} variant="flat">
              {trend}
            </Chip>
          ) : null}
        </div>
        <p className="mt-3 text-2xl font-black tracking-tight">{value}</p>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {sub ? <p className="mt-0.5 text-xs text-default-400">{sub}</p> : null}
      </CardBody>
    </Card>
  );
}

// ── Pipeline Tab ──────────────────────────────────────────────────────────────

function PipelineTab() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          className="max-w-64"
          placeholder="Buscar oportunidad..."
          size="sm"
          startContent={<BsSearch className="text-default-400" />}
          variant="bordered"
        />
        <div className="flex gap-2">
          <Button size="sm" startContent={<BsFunnel />} variant="flat">
            Filtrar
          </Button>
          <Button color="primary" size="sm" startContent={<BsPlus />}>
            Nueva oportunidad
          </Button>
        </div>
      </div>

      {/* Pipeline stages summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {PIPELINE_STAGES.map((stage) => (
          <Card key={stage.id} className="border border-default-200/40 cursor-default">
            <CardBody className="p-3">
              <div className={`mb-2 h-1.5 w-full rounded-full ${stage.color}`} />
              <p className="text-xs font-semibold text-default-500">{stage.label}</p>
              <p className="text-lg font-black">{stage.count}</p>
              <p className="text-xs text-default-400">{stage.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Opportunities table */}
      <div className="overflow-x-auto rounded-large border border-default-200/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-default-200/40 bg-content2/50">
              <th className="p-3 text-left font-semibold text-default-600">Oportunidad</th>
              <th className="p-3 text-left font-semibold text-default-600">Cliente</th>
              <th className="p-3 text-left font-semibold text-default-600">Etapa</th>
              <th className="p-3 text-left font-semibold text-default-600">Valor</th>
              <th className="p-3 text-left font-semibold text-default-600">Responsable</th>
              <th className="p-3 text-left font-semibold text-default-600">Días abierto</th>
              <th className="p-3 text-left font-semibold text-default-600">Prob.</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {MOCK_OPPORTUNITIES.map((opp) => (
              <tr key={opp.id} className="border-b border-default-200/20 hover:bg-content2/30 transition-colors">
                <td className="p-3 font-medium">{opp.name}</td>
                <td className="p-3 text-default-600">{opp.client}</td>
                <td className="p-3">
                  <Chip color={stageColor(opp.stage)} size="sm" variant="flat">
                    {opp.stage}
                  </Chip>
                </td>
                <td className="p-3 font-semibold">{opp.value}</td>
                <td className="p-3 text-default-600">{opp.owner}</td>
                <td className="p-3">
                  <span className={opp.days > 30 ? "text-danger font-semibold" : opp.days > 14 ? "text-warning" : "text-default-600"}>
                    {opp.days}d
                  </span>
                </td>
                <td className="p-3 w-28">
                  <div className="flex items-center gap-2">
                    <Progress
                      aria-label="Probabilidad"
                      className="flex-1"
                      color={opp.prob >= 70 ? "success" : opp.prob >= 40 ? "warning" : "danger"}
                      size="sm"
                      value={opp.prob}
                    />
                    <span className="text-xs text-default-500 w-8">{opp.prob}%</span>
                  </div>
                </td>
                <td className="p-3">
                  <Button isIconOnly size="sm" variant="light">
                    <BsThreeDotsVertical />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-center text-xs text-default-400 italic">
        Datos de muestra — funcionalidad en desarrollo
      </p>
    </div>
  );
}

// ── Clients Tab ───────────────────────────────────────────────────────────────

function ClientsTab() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          className="max-w-64"
          placeholder="Buscar cliente..."
          size="sm"
          startContent={<BsSearch className="text-default-400" />}
          variant="bordered"
        />
        <Button color="primary" size="sm" startContent={<BsPlus />}>
          Nuevo cliente
        </Button>
      </div>

      <div className="overflow-x-auto rounded-large border border-default-200/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-default-200/40 bg-content2/50">
              <th className="p-3 text-left font-semibold text-default-600">Empresa</th>
              <th className="p-3 text-left font-semibold text-default-600">Tipo</th>
              <th className="p-3 text-left font-semibold text-default-600">Ciudad</th>
              <th className="p-3 text-left font-semibold text-default-600">Contacto</th>
              <th className="p-3 text-left font-semibold text-default-600">Teléfono</th>
              <th className="p-3 text-left font-semibold text-default-600">Estado</th>
              <th className="p-3 text-left font-semibold text-default-600">Negocios</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_CLIENTS.map((c) => (
              <tr key={c.id} className="border-b border-default-200/20 hover:bg-content2/30 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {c.name[0]}
                    </div>
                    <span className="font-medium">{c.name}</span>
                  </div>
                </td>
                <td className="p-3">
                  <Chip color={c.type === "Cliente" ? "success" : "default"} size="sm" variant="flat">
                    {c.type}
                  </Chip>
                </td>
                <td className="p-3 text-default-600">{c.city}</td>
                <td className="p-3 text-default-600">{c.contact}</td>
                <td className="p-3 text-default-500 text-xs">{c.phone}</td>
                <td className="p-3">
                  <Chip
                    color={c.status === "Activo" ? "success" : c.status === "En seguimiento" ? "primary" : "default"}
                    size="sm"
                    variant="flat"
                  >
                    {c.status}
                  </Chip>
                </td>
                <td className="p-3 font-semibold">{c.deals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-center text-xs text-default-400 italic">
        Datos de muestra — funcionalidad en desarrollo
      </p>
    </div>
  );
}

// ── Activities Tab ────────────────────────────────────────────────────────────

function ActivitiesTab() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-default-500">Próximas actividades y seguimientos programados.</p>
        <Button color="primary" size="sm" startContent={<BsPlus />}>
          Nueva actividad
        </Button>
      </div>

      <div className="space-y-3">
        {MOCK_ACTIVITIES.map((act) => (
          <Card key={act.id} className={`border ${act.done ? "opacity-50 border-default-200/20" : "border-default-200/40"}`}>
            <CardBody className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                  act.type === "Llamada" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30" :
                  act.type === "Reunión" ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30" :
                  act.type === "Email" ? "bg-green-100 text-green-600 dark:bg-green-900/30" :
                  "bg-orange-100 text-orange-600 dark:bg-orange-900/30"
                }`}>
                  {act.type === "Llamada" ? <BsTelephone /> :
                   act.type === "Reunión" ? <BsPeople /> :
                   act.type === "Email" ? <BsArrowUpRight /> :
                   <BsCalendar3 />}
                </div>
                <div>
                  <p className={`font-medium ${act.done ? "line-through text-default-400" : ""}`}>
                    {act.desc}
                  </p>
                  <p className="text-xs text-default-400">{act.client} · {act.user}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 pl-11 sm:pl-0">
                <Chip size="sm" variant="flat">{act.type}</Chip>
                <span className={`text-xs font-medium ${
                  act.date === "Ayer" ? "text-default-400" :
                  act.date === "Hoy 10:30" ? "text-primary" :
                  "text-default-500"
                }`}>
                  {act.date}
                </span>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-default-400 italic">
        Datos de muestra — funcionalidad en desarrollo
      </p>
    </div>
  );
}

// ── Reports Tab (skeleton) ────────────────────────────────────────────────────

function ReportsTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border border-default-200/40">
          <CardHeader className="pb-0">
            <p className="font-semibold">Embudo de conversión</p>
          </CardHeader>
          <CardBody className="space-y-2 pt-3">
            {PIPELINE_STAGES.map((s, i) => (
              <div key={s.id} className="space-y-1">
                <div className="flex justify-between text-xs text-default-500">
                  <span>{s.label}</span>
                  <span>{s.count} negocios · {s.value}</span>
                </div>
                <Progress
                  aria-label={s.label}
                  color={i === PIPELINE_STAGES.length - 1 ? "success" : "primary"}
                  size="sm"
                  value={100 - i * 18}
                />
              </div>
            ))}
          </CardBody>
        </Card>

        <Card className="border border-default-200/40">
          <CardHeader className="pb-0">
            <p className="font-semibold">Actividad por asesor</p>
          </CardHeader>
          <CardBody className="space-y-3 pt-3">
            {[
              { name: "Carlos M.", deals: 2, value: "$7.3M", activity: 85 },
              { name: "Laura P.", deals: 1, value: "$2.8M", activity: 60 },
              { name: "María V.", deals: 1, value: "$6.0M", activity: 40 },
              { name: "Andrés G.", deals: 1, value: "$1.5M", activity: 25 },
            ].map((a) => (
              <div key={a.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-default-500">{a.deals} oportunidades · {a.value}</span>
                </div>
                <Progress aria-label={a.name} color="primary" size="sm" value={a.activity} />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card className="border border-default-200/40">
        <CardHeader>
          <p className="font-semibold">Proyección de ingresos</p>
          <ComingSoonBadge />
        </CardHeader>
        <CardBody>
          <div className="flex h-40 items-center justify-center rounded-large bg-content2/30">
            <div className="text-center">
              <BsGraphUp className="mx-auto mb-2 text-3xl text-default-300" />
              <p className="text-sm text-default-400">Gráfico de proyección en desarrollo</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <p className="text-center text-xs text-default-400 italic">
        Datos de muestra — funcionalidad en desarrollo
      </p>
    </div>
  );
}

// ── Main CRM Skeleton ─────────────────────────────────────────────────────────

export function CrmSkeleton() {
  const [tab, setTab] = useState("pipeline");

  return (
    <div className="space-y-6">
      {/* Header notice */}
      <div className="flex items-center gap-3 rounded-large border border-warning-200 bg-warning-50/30 px-4 py-3 dark:border-warning-800/40 dark:bg-warning-900/10">
        <BsBell className="shrink-0 text-warning" />
        <p className="text-sm text-warning-700 dark:text-warning-400">
          <strong>Módulo en construcción.</strong> Esta es una vista previa visual del CRM de Viomar. Los datos mostrados son de muestra.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<BsPeople />}
          label="Clientes activos"
          sub="3 nuevos este mes"
          trend="+12%"
          value="127"
        />
        <StatCard
          icon={<BsBuilding />}
          label="Oportunidades abiertas"
          sub="Pipeline total $69.8M"
          trend="+5"
          value="18"
        />
        <StatCard
          icon={<BsCurrencyDollar />}
          label="Cerrado este mes"
          sub="vs $4.8M mes anterior"
          trend="+33%"
          value="$6.4M"
        />
        <StatCard
          icon={<BsGraphUp />}
          label="Tasa de conversión"
          sub="Promedio industria: 18%"
          value="24%"
        />
      </div>

      {/* Main tabs */}
      <Tabs
        aria-label="CRM módulos"
        classNames={{
          tabList: "border-b border-default-200/30 bg-transparent rounded-none p-0 gap-0",
          tab: "rounded-none data-[selected=true]:border-b-2 data-[selected=true]:border-primary data-[selected=true]:text-primary text-default-500",
          cursor: "hidden",
        }}
        selectedKey={tab}
        variant="underlined"
        onSelectionChange={(k) => setTab(String(k))}
      >
        <Tab key="pipeline" title="Pipeline de ventas">
          <div className="pt-4"><PipelineTab /></div>
        </Tab>
        <Tab key="clientes" title="Clientes y prospectos">
          <div className="pt-4"><ClientsTab /></div>
        </Tab>
        <Tab key="actividades" title="Actividades">
          <div className="pt-4"><ActivitiesTab /></div>
        </Tab>
        <Tab key="reportes" title={<span>Reportes <ComingSoonBadge /></span>}>
          <div className="pt-4"><ReportsTab /></div>
        </Tab>
      </Tabs>
    </div>
  );
}
