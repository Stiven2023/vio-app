export type AccountingQaTemplateRow = {
  caseId: string;
  module: string;
  flow: string;
  priority: "ALTA" | "MEDIA" | "BAJA";
  risk: string;
  preconditions: string;
  steps: string;
  expectedResult: string;
  actualResult: string;
  status: "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN";
  evidence: string;
  executedBy: string;
  executedAt: string;
  observations: string;
};

const QA_TEMPLATE_ROWS: AccountingQaTemplateRow[] = [
  {
    caseId: "SIIGO-F-01",
    module: "Facturas",
    flow: "Envio prefactura F a SIIGO",
    priority: "ALTA",
    risk: "Facturacion detenida",
    preconditions:
      "Prefactura tipo F con cliente valido, items activos y configuracion SIIGO completa",
    steps:
      "1) Abrir prefactura F; 2) Enviar a SIIGO; 3) Verificar estado en tabla",
    expectedResult:
      "Se crea tracking SIIGO, estado cambia a SENT/DRAFT y documento queda bloqueado",
    actualResult: "",
    status: "NOT_RUN",
    evidence: "",
    executedBy: "",
    executedAt: "",
    observations: "",
  },
  {
    caseId: "SIIGO-R-01",
    module: "Remisiones",
    flow: "Bloqueo de envio tipo R",
    priority: "ALTA",
    risk: "Incumplimiento fiscal",
    preconditions: "Prefactura tipo R disponible",
    steps: "1) Abrir remision tipo R; 2) Intentar enviar a SIIGO",
    expectedResult:
      "El sistema marca NOT_APPLICABLE y no genera invoice_id en SIIGO",
    actualResult: "",
    status: "NOT_RUN",
    evidence: "",
    executedBy: "",
    executedAt: "",
    observations: "",
  },
  {
    caseId: "SIIGO-R-02",
    module: "Remisiones",
    flow: "Regla fiscal sin IVA",
    priority: "ALTA",
    risk: "Liquidacion tributaria incorrecta",
    preconditions: "Documento tipo R con items gravados y no gravados",
    steps: "1) Crear/editar remision R; 2) Guardar; 3) Revisar totales",
    expectedResult: "IVA = 0 para remision tipo R",
    actualResult: "",
    status: "NOT_RUN",
    evidence: "",
    executedBy: "",
    executedAt: "",
    observations: "",
  },
  {
    caseId: "SIIGO-POLL-01",
    module: "Facturas",
    flow: "Actualizacion manual de estado SIIGO",
    priority: "MEDIA",
    risk: "Seguimiento inexacto",
    preconditions: "Prefactura con invoice_id y estado SENT o DRAFT",
    steps: "1) Clic en actualizar estado SIIGO; 2) Refrescar tabla",
    expectedResult:
      "Se actualiza estado local y se persisten datos legales cuando apliquen",
    actualResult: "",
    status: "NOT_RUN",
    evidence: "",
    executedBy: "",
    executedAt: "",
    observations: "",
  },
  {
    caseId: "SIIGO-ADM-01",
    module: "Facturas",
    flow: "Reset SIIGO solo admin",
    priority: "MEDIA",
    risk: "Reprocesos sin control",
    preconditions:
      "Prefactura con tracking SIIGO y dos usuarios (admin/no-admin)",
    steps:
      "1) Ejecutar reset con admin; 2) Repetir con no-admin; 3) Validar comportamiento",
    expectedResult:
      "Admin puede resetear con motivo; no-admin recibe rechazo",
    actualResult: "",
    status: "NOT_RUN",
    evidence: "",
    executedBy: "",
    executedAt: "",
    observations: "",
  },
];

function escapeCsvCell(value: string): string {
  if (
    value.includes(";") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function buildAccountingQaTemplateCsv(): string {
  const headers = [
    "caseId",
    "module",
    "flow",
    "priority",
    "risk",
    "preconditions",
    "steps",
    "expectedResult",
    "actualResult",
    "status",
    "evidence",
    "executedBy",
    "executedAt",
    "observations",
  ].join(";");

  const data = QA_TEMPLATE_ROWS.map((row) =>
    [
      row.caseId,
      row.module,
      row.flow,
      row.priority,
      row.risk,
      row.preconditions,
      row.steps,
      row.expectedResult,
      row.actualResult,
      row.status,
      row.evidence,
      row.executedBy,
      row.executedAt,
      row.observations,
    ]
      .map((cell) => escapeCsvCell(cell))
      .join(";"),
  );

  return [headers, ...data].join("\n");
}

export function buildAccountingQaTemplateFilename(now = new Date()): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");

  return `contabilidad-qa-template-${yyyy}-${mm}-${dd}.csv`;
}