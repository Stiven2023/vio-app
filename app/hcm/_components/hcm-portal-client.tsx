"use client";

import { useEffect, useMemo, useState } from "react";

type Vista =
  | "inicio"
  | "solicitudes"
  | "nomina"
  | "colillas"
  | "certificados220"
  | "cartas"
  | "formacion"
  | "horas_extras";

type TipoSolicitud =
  | "licencia_no_remunerada"
  | "licencia_remunerada"
  | "licencia_maternidad"
  | "licencia_paternidad"
  | "incapacidad"
  | "vacaciones"
  | "horas_extras"
  | "permiso_puntual";

type LeaveItem = {
  id: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  notes: string | null;
  approvedByName: string | null;
};

type ColillaItem = {
  id: string;
  period: string;
  status: string;
  netoAPagar: string;
  totalDevengado: string;
  totalDeducciones: string;
  pdfUrl: string | null;
};

type Certificado220Item = {
  id: string;
  vigenciaFiscal: number;
  totalIngresos: string;
  totalRetenciones: string;
  status: string;
  pdfUrl: string | null;
};

type HoraExtraItem = {
  id: string;
  fecha: string;
  tipo: string;
  totalHoras: string;
  status: string;
};

type CertificacionItem = {
  key: string;
  label: string;
  url: string | null;
};

const MENU_ITEMS: { id: Vista; label: string; icon: string; badge?: string }[] = [
  { id: "inicio", label: "Mi perfil", icon: "👤" },
  { id: "solicitudes", label: "Mis solicitudes", icon: "📋", badge: "2" },
  { id: "nomina", label: "Reporte de nómina", icon: "💰" },
  { id: "colillas", label: "Colillas de pago", icon: "🧾" },
  { id: "certificados220", label: "Certificado 220", icon: "📄" },
  { id: "cartas", label: "Cartas laborales", icon: "✉️" },
  { id: "formacion", label: "Formación", icon: "🎓" },
  { id: "horas_extras", label: "Horas extras", icon: "⏰" },
];

const SOLICITUD_TIPOS: { value: TipoSolicitud; label: string; requiereDoc: boolean; diasMax?: number }[] = [
  { value: "licencia_no_remunerada", label: "Licencia no remunerada", requiereDoc: false },
  { value: "licencia_remunerada", label: "Licencia remunerada", requiereDoc: true },
  { value: "licencia_maternidad", label: "Licencia de maternidad", requiereDoc: true, diasMax: 126 },
  { value: "licencia_paternidad", label: "Licencia de paternidad", requiereDoc: true, diasMax: 14 },
  { value: "incapacidad", label: "Incapacidad médica", requiereDoc: true },
  { value: "vacaciones", label: "Vacaciones", requiereDoc: false },
  { value: "permiso_puntual", label: "Permiso puntual", requiereDoc: false },
];

const CARTA_TIPOS = [
  { value: "LABORAL_GENERAL", label: "Carta laboral general" },
  { value: "LABORAL_BANCO", label: "Carta para entidad bancaria" },
  { value: "LABORAL_VISA", label: "Carta para trámite de visa" },
  { value: "INGRESO_SALARIO", label: "Constancia de ingresos y salario" },
  { value: "PAZ_Y_SALVO", label: "Paz y salvo laboral" },
] as const;

const EMPLEADO_MOCK = {
  nombres: "Empleado",
  apellidos: "VIOMAR",
  codigo: "EMP-0001",
  cargo: "Colaborador",
  departamento: "HCM",
  fechaIngreso: "2024-01-01",
  salarioBase: 2500000,
  diasVacacionesPendientes: 8,
  solicitudesPendientes: 2,
};

function Badge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    APROBADO: "bg-green-100 text-green-800",
    aprobada: "bg-green-100 text-green-800",
    PAGADA: "bg-green-100 text-green-800",
    pagado: "bg-green-100 text-green-800",
    EN_REVISION: "bg-yellow-100 text-yellow-800",
    en_revision: "bg-yellow-100 text-yellow-800",
    PENDIENTE: "bg-gray-100 text-gray-700",
    pendiente: "bg-gray-100 text-gray-700",
    RECHAZADO: "bg-red-100 text-red-800",
    rechazada: "bg-red-100 text-red-800",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[estado] ?? "bg-gray-100 text-gray-600"}`}>
      {estado}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

function VistaPerfil() {
  const e = EMPLEADO_MOCK;

  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
          {e.nombres[0]}
          {e.apellidos[0]}
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{e.nombres} {e.apellidos}</p>
          <p className="text-sm text-gray-500">{e.cargo} · {e.departamento}</p>
          <p className="text-xs text-gray-400">Código: {e.codigo} · Ingreso: {e.fechaIngreso}</p>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Salario base", value: `$${(e.salarioBase / 1000).toFixed(0)}K` },
          { label: "Vacaciones pendientes", value: `${e.diasVacacionesPendientes} días` },
          { label: "Solicitudes activas", value: e.solicitudesPendientes },
          { label: "Antigüedad", value: "2 años" },
        ].map((item) => (
          <Card key={item.label} className="text-center">
            <p className="text-2xl font-bold text-blue-700">{item.value}</p>
            <p className="mt-1 text-xs text-gray-500">{item.label}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function VistaSolicitudes() {
  const [forma, setForma] = useState(false);
  const [tipo, setTipo] = useState<TipoSolicitud | "">("");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [items, setItems] = useState<LeaveItem[]>([]);

  const tipoInfo = SOLICITUD_TIPOS.find((t) => t.value === tipo);

  async function cargar() {
    const res = await fetch("/api/hcm/mis-solicitudes?page=1&pageSize=10", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { items?: LeaveItem[] };
    setItems(data.items ?? []);
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function enviar() {
    if (!tipo || !inicio || !motivo) {
      setMsg("Completa todos los campos requeridos.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/hcm/mis-solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: inicio,
          endDate: fin || inicio,
          notes: `[${tipo}] ${motivo}`,
        }),
      });

      if (res.ok) {
        setMsg("Solicitud enviada correctamente.");
        setForma(false);
        setTipo("");
        setInicio("");
        setFin("");
        setMotivo("");
        await cargar();
      } else {
        setMsg("No se pudo enviar la solicitud.");
      }
    } catch {
      setMsg("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Mis solicitudes</h2>
        <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700" onClick={() => setForma((v) => !v)} type="button">
          {forma ? "Cancelar" : "+ Nueva solicitud"}
        </button>
      </div>

      {msg ? <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{msg}</div> : null}

      {forma ? (
        <Card>
          <p className="mb-3 font-medium text-gray-800">Nueva solicitud</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-gray-500">Tipo de solicitud *</label>
              <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" onChange={(e) => setTipo(e.target.value as TipoSolicitud)} value={tipo}>
                <option value="">Seleccionar...</option>
                {SOLICITUD_TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {tipoInfo?.diasMax ? <p className="mt-1 text-xs text-amber-600">Máximo legal: {tipoInfo.diasMax} días</p> : null}
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Fecha inicio *</label>
              <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" onChange={(e) => setInicio(e.target.value)} type="date" value={inicio} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Fecha fin</label>
              <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" onChange={(e) => setFin(e.target.value)} type="date" value={fin} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-gray-500">Descripción / Motivo *</label>
              <textarea className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" onChange={(e) => setMotivo(e.target.value)} placeholder="Describe brevemente el motivo de tu solicitud..." rows={3} value={motivo} />
            </div>
          </div>
          <button className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50" disabled={loading} onClick={enviar} type="button">
            {loading ? "Enviando..." : "Enviar solicitud"}
          </button>
        </Card>
      ) : null}

      <div className="space-y-2">
        {items.map((s) => (
          <Card key={s.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Solicitud</p>
              <p className="text-xs text-gray-500">{s.startDate} → {s.endDate} · {s.durationDays} días · Cód. {s.id}</p>
            </div>
            <Badge estado={s.approvedByName ? "aprobada" : "pendiente"} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function VistaNomina() {
  const [items, setItems] = useState<ColillaItem[]>([]);

  useEffect(() => {
    async function cargar() {
      const res = await fetch("/api/hcm/colillas?page=1&pageSize=24", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: ColillaItem[] };
      setItems(data.items ?? []);
    }

    void cargar();
  }, []);

  const resumen = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.dev += Number(item.totalDevengado || 0);
        acc.ded += Number(item.totalDeducciones || 0);
        acc.net += Number(item.netoAPagar || 0);
        return acc;
      },
      { dev: 0, ded: 0, net: 0 },
    );
  }, [items]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Card className="text-center"><p className="text-xs text-gray-500">Total devengado</p><p className="text-xl font-bold text-blue-700">${resumen.dev.toFixed(2)}</p></Card>
      <Card className="text-center"><p className="text-xs text-gray-500">Total deducciones</p><p className="text-xl font-bold text-amber-700">${resumen.ded.toFixed(2)}</p></Card>
      <Card className="text-center"><p className="text-xs text-gray-500">Neto a pagar</p><p className="text-xl font-bold text-green-700">${resumen.net.toFixed(2)}</p></Card>
    </div>
  );
}

function VistaColillas() {
  const [items, setItems] = useState<ColillaItem[]>([]);

  useEffect(() => {
    async function cargar() {
      const res = await fetch("/api/hcm/colillas?page=1&pageSize=12", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: ColillaItem[] };
      setItems(data.items ?? []);
    }

    void cargar();
  }, []);

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-gray-800">Colillas de pago</h2>
      {items.map((c) => (
        <Card key={c.id} className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Período {c.period}</p>
            <p className="text-xs text-gray-500">Neto pagado: <strong className="text-green-700">${Number(c.netoAPagar || 0).toLocaleString("es-CO")}</strong></p>
          </div>
          <div className="flex items-center gap-2">
            <Badge estado={c.status} />
            {c.pdfUrl ? <a className="text-xs text-blue-600 hover:underline" href={c.pdfUrl} rel="noreferrer" target="_blank">Descargar PDF</a> : null}
          </div>
        </Card>
      ))}
    </div>
  );
}

function VistaCertificados220() {
  const [items, setItems] = useState<Certificado220Item[]>([]);

  useEffect(() => {
    async function cargar() {
      const res = await fetch("/api/hcm/certificados220?page=1&pageSize=10", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: Certificado220Item[] };
      setItems(data.items ?? []);
    }

    void cargar();
  }, []);

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-gray-800">Certificado de ingresos y retenciones (220)</h2>
      <p className="text-sm text-gray-500">Documento oficial para declaración de renta.</p>
      {items.map((item) => (
        <Card key={item.id} className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Vigencia fiscal {item.vigenciaFiscal}</p>
            <p className="text-xs text-gray-500">Ingresos: {item.totalIngresos} · Retenciones: {item.totalRetenciones}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge estado={item.status} />
            {item.pdfUrl ? <a className="text-xs text-blue-600 hover:underline" href={item.pdfUrl} rel="noreferrer" target="_blank">Descargar PDF</a> : null}
          </div>
        </Card>
      ))}
    </div>
  );
}

function VistaCartas() {
  const [tipo, setTipo] = useState<string>("");
  const [dest, setDest] = useState("");
  const [prop, setProp] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function solicitar() {
    if (!tipo) {
      setMsg("Selecciona el tipo de carta.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/hcm/cartas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, destinatario: dest, proposito: prop }),
      });

      setMsg(res.ok ? "Carta en cola. RH la generará en 24 h hábiles." : "No se pudo enviar la solicitud de carta.");
    } catch {
      setMsg("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-gray-800">Cartas laborales</h2>
      {msg ? <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{msg}</div> : null}
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-gray-500">Tipo de carta *</label>
            <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" onChange={(e) => setTipo(e.target.value)} value={tipo}>
              <option value="">Seleccionar...</option>
              {CARTA_TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Dirigida a (opcional)</label>
            <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" onChange={(e) => setDest(e.target.value)} value={dest} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Propósito (opcional)</label>
            <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" onChange={(e) => setProp(e.target.value)} value={prop} />
          </div>
        </div>
        <button className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50" disabled={loading} onClick={solicitar} type="button">
          {loading ? "Enviando..." : "Solicitar carta"}
        </button>
      </Card>
    </div>
  );
}

function VistaFormacion() {
  const [items, setItems] = useState<CertificacionItem[]>([]);

  useEffect(() => {
    async function cargar() {
      const res = await fetch("/api/hcm/certifications", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { certifications?: CertificacionItem[] };
      setItems(data.certifications ?? []);
    }

    void cargar();
  }, []);

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-gray-800">Mi plan de formación</h2>
      {items.map((f) => (
        <Card key={f.key} className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">{f.label}</p>
            <p className="text-xs text-gray-500">Certificación</p>
          </div>
          {f.url ? <a className="text-xs text-blue-600 hover:underline" href={f.url} rel="noreferrer" target="_blank">Descargar</a> : <Badge estado="pendiente" />}
        </Card>
      ))}
    </div>
  );
}

function VistaHorasExtras() {
  const [fecha, setFecha] = useState("");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [tipo, setTipo] = useState("DIURNA_ORDINARIA");
  const [actividad, setActividad] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [totalHoras, setTotalHoras] = useState("1");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [items, setItems] = useState<HoraExtraItem[]>([]);

  async function cargar() {
    const res = await fetch("/api/hcm/horas-extras?page=1&pageSize=10", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { items?: HoraExtraItem[] };
    setItems(data.items ?? []);
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function enviar() {
    if (!fecha || !inicio || !fin || !tipo || !actividad || !supervisorId) {
      setMsg("Completa todos los campos requeridos.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/hcm/horas-extras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supervisorId,
          fecha,
          horaInicio: inicio,
          horaFin: fin,
          tipo,
          totalHoras,
          actividad,
        }),
      });

      setMsg(res.ok ? "Solicitud enviada a tu supervisor." : "No se pudo enviar la solicitud.");
      if (res.ok) await cargar();
    } catch {
      setMsg("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-gray-800">Solicitud de horas extras</h2>
      {msg ? <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{msg}</div> : null}
      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" onChange={(e) => setFecha(e.target.value)} type="date" value={fecha} />
          <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" onChange={(e) => setInicio(e.target.value)} type="time" value={inicio} />
          <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" onChange={(e) => setFin(e.target.value)} type="time" value={fin} />
          <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" onChange={(e) => setSupervisorId(e.target.value)} placeholder="Supervisor ID" value={supervisorId} />
          <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" onChange={(e) => setTotalHoras(e.target.value)} placeholder="Total horas" type="number" value={totalHoras} />
          <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" onChange={(e) => setTipo(e.target.value)} value={tipo}>
            <option value="DIURNA_ORDINARIA">Diurna ordinaria</option>
            <option value="NOCTURNA_ORDINARIA">Nocturna ordinaria</option>
            <option value="DOMINICAL_DIURNA">Dominical diurna</option>
            <option value="DOMINICAL_NOCTURNA">Dominical nocturna</option>
            <option value="FESTIVO_DIURNO">Festivo diurno</option>
            <option value="FESTIVO_NOCTURNO">Festivo nocturno</option>
          </select>
          <textarea className="sm:col-span-3 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" onChange={(e) => setActividad(e.target.value)} placeholder="Actividad realizada" rows={2} value={actividad} />
        </div>
        <button className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50" disabled={loading} onClick={enviar} type="button">
          {loading ? "Enviando..." : "Enviar solicitud"}
        </button>
      </Card>

      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">{item.fecha} · {item.tipo}</p>
              <p className="text-xs text-gray-500">{item.totalHoras} horas</p>
            </div>
            <Badge estado={item.status} />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function HcmPortalClient() {
  const [vista, setVista] = useState<Vista>("inicio");

  const vistas: Record<Vista, React.ReactNode> = {
    inicio: <VistaPerfil />,
    solicitudes: <VistaSolicitudes />,
    nomina: <VistaNomina />,
    colillas: <VistaColillas />,
    certificados220: <VistaCertificados220 />,
    cartas: <VistaCartas />,
    formacion: <VistaFormacion />,
    horas_extras: <VistaHorasExtras />,
  };

  return (
    <div className="flex min-h-[75vh] overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
      <aside className="hidden w-60 flex-col border-r border-gray-200 bg-white px-3 py-6 md:flex">
        <div className="mb-6 px-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">VIOMAR · Portal RH</p>
          <p className="mt-1 text-sm font-semibold text-gray-800">Portal del empleado</p>
          <p className="text-xs text-gray-400">{EMPLEADO_MOCK.codigo}</p>
        </div>
        <nav className="flex-1 space-y-0.5">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                vista === item.id ? "bg-blue-50 font-medium text-blue-700" : "text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => setVista(item.id)}
              type="button"
            >
              <span className="text-base" style={{ fontSize: 16 }}>{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge ? <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-xs text-white">{item.badge}</span> : null}
            </button>
          ))}
        </nav>
      </aside>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-200 bg-white">
        {MENU_ITEMS.slice(0, 5).map((item) => (
          <button
            key={item.id}
            className={`flex-1 px-1 py-2 text-xs ${vista === item.id ? "text-blue-600" : "text-gray-400"}`}
            onClick={() => setVista(item.id)}
            type="button"
          >
            <div style={{ fontSize: 18 }}>{item.icon}</div>
            <div className="truncate">{item.label.split(" ")[0]}</div>
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="mx-auto max-w-3xl px-4 py-6">{vistas[vista]}</div>
      </main>
    </div>
  );
}
