/**
 * MES Endpoint Contract Regression Tests
 * ----------------------------------------
 * Pruebas de contrato para las reglas de negocio de los endpoints MES.
 * No requieren base de datos – validan esquemas Zod, lógica de helpers
 * y contratos de error JSON tal como los exponen las rutas.
 *
 * Cobertura:
 *  - mesEnvioCreateSchema: casos válidos e inválidos
 *  - mesEnvioUpdateSchema: transiciones de estado
 *  - getDispatchBlockingRule: reglas de despacho con aprobaciones
 *  - normalizeDispatchApprovals: normalización de snapshot
 *  - jsonError / zodFirstErrorEnvelope: forma del envelope
 *  - Reglas de negocio de despacho: legal, vendedor, cartera, contabilidad, parcial
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import {
  generateRepositionCode,
  getDispatchBlockingRule,
  hasAccountingApproval,
  isDispatchShipment,
  isValidEnvioStatusTransition,
  mesDispatchApprovalsSchema,
  mesEnvioCreateSchema,
  mesEnvioSalidaSchema,
  mesEnvioUpdateSchema,
  mesProductionStageCreateSchema,
  mesReposicionCreateSchema,
  mesReposicionUpdateSchema,
  mesSampleApprovalUpsertSchema,
  normalizeDispatchApprovals,
} from "@/src/utils/mes-workflow";

// ─── Helpers de fixture ────────────────────────────────────────────────────────

function validApprovals() {
  return {
    seller: { approved: true, approverName: "Juan Pérez" },
    cartera: { approved: true, approverName: "Cartera Viomar" },
    accounting: { approved: true, approverName: "Contabilidad OK" },
  };
}

function baseDispatchCreate() {
  return {
    orderId: "order-abc-123",
    origenArea: "DESPACHO" as const,
    destinoArea: "DESPACHO" as const,
    transporteTipo: "MENSAJERO" as const,
    items: [{ orderItemId: "item-xyz-1", quantity: 5 }],
    dispatchApprovals: validApprovals(),
  };
}

// ─── 1. Validación de creación de envío ─────────────────────────────────────

test("mes contrato: rechaza envío sin orderId", () => {
  const result = mesEnvioCreateSchema.safeParse({
    origenArea: "INTEGRACION",
    destinoArea: "CONFECCION_EXTERNA",
    transporteTipo: "MENSAJERO",
    items: [{ orderItemId: "item-1", quantity: 3 }],
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("orderId"), "Debe requerir orderId");
});

test("mes contrato: rechaza envío sin ítems", () => {
  const result = mesEnvioCreateSchema.safeParse({
    orderId: "order-1",
    origenArea: "INTEGRACION",
    destinoArea: "CONFECCION_EXTERNA",
    transporteTipo: "MENSAJERO",
    items: [],
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("items"), "Debe requerir al menos un ítem");
});

test("mes contrato: rechaza ítems con cantidad 0 o negativa", () => {
  const result = mesEnvioCreateSchema.safeParse({
    orderId: "order-1",
    origenArea: "INTEGRACION",
    destinoArea: "CONFECCION_EXTERNA",
    transporteTipo: "MENSAJERO",
    items: [{ orderItemId: "item-1", quantity: 0 }],
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.some((p) => p.startsWith("items.")), "Debe rechazar cantidad 0");
});

test("mes contrato: rechaza ítems duplicados en el mismo envío", () => {
  const result = mesEnvioCreateSchema.safeParse({
    orderId: "order-1",
    origenArea: "INTEGRACION",
    destinoArea: "CONFECCION_EXTERNA",
    transporteTipo: "MENSAJERO",
    items: [
      { orderItemId: "item-1", quantity: 3 },
      { orderItemId: "item-1", quantity: 2 },
    ],
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const msgs = result.error.issues.map((i) => i.message);
  assert.ok(msgs.some((m) => m.includes("No repitas")), "Debe detectar duplicado");
});

test("mes contrato: acepta envío interno válido sin aprobaciones", () => {
  const result = mesEnvioCreateSchema.safeParse({
    orderId: "order-2",
    origenArea: "INTEGRACION",
    destinoArea: "CONFECCION_EXTERNA",
    transporteTipo: "MENSAJERO",
    items: [{ orderItemId: "item-A", quantity: 10 }],
  });
  assert.equal(result.success, true);
});

test("mes contrato: acepta envío LÍNEA_TERCERO con empresa informada", () => {
  const result = mesEnvioCreateSchema.safeParse({
    orderId: "order-3",
    origenArea: "INTEGRACION",
    destinoArea: "CONFECCION_EXTERNA",
    transporteTipo: "LINEA_TERCERO",
    empresaTercero: "Servientrega SA",
    items: [{ orderItemId: "item-B", quantity: 4 }],
  });
  assert.equal(result.success, true);
});

test("mes contrato: rechaza LÍNEA_TERCERO sin empresa", () => {
  const result = mesEnvioCreateSchema.safeParse({
    orderId: "order-3",
    origenArea: "INTEGRACION",
    destinoArea: "CONFECCION_EXTERNA",
    transporteTipo: "LINEA_TERCERO",
    items: [{ orderItemId: "item-B", quantity: 4 }],
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("empresaTercero"));
});

// ─── 2. Reglas de despacho (DESPACHO→DESPACHO) ──────────────────────────────

test("mes contrato: despacho requiere aprobaciones", () => {
  const result = mesEnvioCreateSchema.safeParse({
    orderId: "order-dispatch-1",
    origenArea: "DESPACHO",
    destinoArea: "DESPACHO",
    transporteTipo: "MENSAJERO",
    items: [{ orderItemId: "item-D", quantity: 2 }],
    // sin dispatchApprovals
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("dispatchApprovals"), "Debe requerir dispatchApprovals en despacho");
});

test("mes contrato: despacho rechaza aprobación de vendedor no marcada", () => {
  const result = mesEnvioCreateSchema.safeParse({
    ...baseDispatchCreate(),
    dispatchApprovals: {
      seller: { approved: false }, // ← no aprobado
      cartera: { approved: true, approverName: "Cartera" },
      accounting: { approved: true, approverName: "Contabilidad" },
    },
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(
    paths.some((p) => p.includes("seller")),
    "Debe rechazar seller no aprobado",
  );
});

test("mes contrato: despacho rechaza aprobación sin nombre de quien aprueba", () => {
  const result = mesEnvioCreateSchema.safeParse({
    ...baseDispatchCreate(),
    dispatchApprovals: {
      seller: { approved: true, approverName: "" }, // sin nombre
      cartera: { approved: true, approverName: "Cartera" },
      accounting: { approved: true, approverName: "Contabilidad" },
    },
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(
    paths.some((p) => p.includes("approverName")),
    "Debe requerir nombre de quien aprueba",
  );
});

test("mes contrato: despacho correcto con aprobaciones completas", () => {
  const result = mesEnvioCreateSchema.safeParse(baseDispatchCreate());
  assert.equal(result.success, true, "Debe parsear correctamente el despacho válido");
});

// ─── 3. getDispatchBlockingRule: prioridad de bloqueos ─────────────────────

const fullApproval = {
  legalEnabled: true,
  sellerApproved: true,
  carteraApproved: true,
  accountingApproved: true,
  isPartialDispatch: false,
  partialDispatchApproved: true,
};

test("mes bloqueo: cliente sin habilitación jurídica bloquea primero", () => {
  const rule = getDispatchBlockingRule({ ...fullApproval, legalEnabled: false });
  assert.equal(rule?.code, "CLIENT_LEGAL_BLOCK");
});

test("mes bloqueo: vendedor sin aprobar bloquea antes que cartera", () => {
  const rule = getDispatchBlockingRule({ ...fullApproval, sellerApproved: false });
  assert.equal(rule?.code, "SELLER_APPROVAL_REQUIRED");
});

test("mes bloqueo: cartera bloquea antes que contabilidad", () => {
  const rule = getDispatchBlockingRule({ ...fullApproval, carteraApproved: false });
  assert.equal(rule?.code, "RECEIVABLES_APPROVAL_REQUIRED");
});

test("mes bloqueo: contabilidad sin OK bloquea antes que parcial", () => {
  const rule = getDispatchBlockingRule({ ...fullApproval, accountingApproved: false });
  assert.equal(rule?.code, "ACCOUNTING_APPROVAL_REQUIRED");
});

test("mes bloqueo: parcial no aprobado bloquea cuando hay despacho parcial", () => {
  const rule = getDispatchBlockingRule({
    ...fullApproval,
    isPartialDispatch: true,
    partialDispatchApproved: false,
  });
  assert.equal(rule?.code, "PARTIAL_DISPATCH_APPROVAL_REQUIRED");
});

test("mes bloqueo: ningún bloqueo cuando todo OK", () => {
  const rule = getDispatchBlockingRule(fullApproval);
  assert.equal(rule, null, "No debe haber bloqueo cuando todo está aprobado");
});

test("mes bloqueo: envío no-despacho no es afectado por lógica de despacho", () => {
  assert.equal(
    isDispatchShipment({ origenArea: "INTEGRACION", destinoArea: "CONFECCION_EXTERNA" }),
    false,
  );
  assert.equal(
    isDispatchShipment({ origenArea: "DESPACHO", destinoArea: "DESPACHO" }),
    true,
  );
});

// ─── 4. normalizeDispatchApprovals ─────────────────────────────────────────

test("mes aprobaciones: normaliza campos vacíos a null", () => {
  const snap = normalizeDispatchApprovals({
    seller: { approved: true, approverName: "  " }, // solo espacios
    cartera: { approved: true, approverName: "Cartera" },
    accounting: { approved: false },
  } as any);
  assert.equal(snap?.seller.approverName, null, "Nombre vacío debe ser null");
  assert.equal(snap?.accounting.approved, false);
  assert.equal(snap?.accounting.approvedAt, null, "No aprobado no debe tener fecha");
});

test("mes aprobaciones: seller aprobado recibe approvedAt automático si no se pasa", () => {
  const beforeMs = Date.now();
  const snap = normalizeDispatchApprovals({
    seller: { approved: true, approverName: "Juan" },
    cartera: { approved: true, approverName: "Ana" },
    accounting: { approved: true, approverName: "Luis" },
  } as any);
  const afterMs = Date.now();

  assert.ok(snap?.seller.approvedAt, "Debe asignar approvedAt");
  const parsedAt = new Date(snap!.seller.approvedAt!).getTime();
  assert.ok(parsedAt >= beforeMs && parsedAt <= afterMs, "approvedAt debe ser reciente");
});

test("mes aprobaciones: normaliza sin partial como null", () => {
  const snap = normalizeDispatchApprovals(validApprovals() as any);
  assert.equal(snap?.partial, null, "partial ausente debe quedar null");
});

test("mes aprobaciones: retorna null cuando no se pasan aprobaciones", () => {
  const snap = normalizeDispatchApprovals(undefined);
  assert.equal(snap, null);
});

// ─── 5. mesEnvioUpdateSchema: transiciones de estado ───────────────────────

test("mes update: acepta transición CREADO→EN_RUTA", () => {
  const result = mesEnvioUpdateSchema.safeParse({ status: "EN_RUTA" });
  assert.equal(result.success, true);
});

test("mes update: rechaza estado desconocido", () => {
  const result = mesEnvioUpdateSchema.safeParse({ status: "INEXISTENTE" });
  assert.equal(result.success, false);
});

test("mes update: acepta URL de evidencia válida", () => {
  const result = mesEnvioUpdateSchema.safeParse({
    status: "ENTREGADO",
    evidenciaUrl: "https://drive.google.com/file/d/abc123",
  });
  assert.equal(result.success, true);
});

test("mes update: rechaza URL de evidencia inválida", () => {
  const result = mesEnvioUpdateSchema.safeParse({
    status: "ENTREGADO",
    evidenciaUrl: "no-es-una-url",
  });
  assert.equal(result.success, false);
});

test("mes transiciones: tabla completa de transiciones válidas", () => {
  const valid: [string, string][] = [
    ["CREADO", "EN_RUTA"],
    ["CREADO", "INCIDENTE"],
    ["EN_RUTA", "ENTREGADO"],
    ["EN_RUTA", "RETORNADO"],
    ["EN_RUTA", "INCIDENTE"],
    ["ENTREGADO", "RETORNADO"],
  ];

  for (const [from, to] of valid) {
    assert.equal(
      isValidEnvioStatusTransition(from, to),
      true,
      `${from}→${to} debe ser válida`,
    );
  }
});

test("mes transiciones: tabla de transiciones inválidas", () => {
  const invalid: [string, string][] = [
    ["CREADO", "ENTREGADO"],
    ["CREADO", "RETORNADO"],
    ["ENTREGADO", "EN_RUTA"],
    ["RETORNADO", "EN_RUTA"],
    ["INCIDENTE", "ENTREGADO"],
  ];

  for (const [from, to] of invalid) {
    assert.equal(
      isValidEnvioStatusTransition(from, to),
      false,
      `${from}→${to} debe ser inválida`,
    );
  }
});

// ─── 6. Contratos de error API (envelope shape) ────────────────────────────

test("mes error envelope: jsonError produce forma correcta", async () => {
  const resp = jsonError(422, "SELLER_APPROVAL_REQUIRED", "El vendedor debe aprobar.", {
    sellerApproval: ["No aprobado"],
  });
  assertStatus(resp.status, 422);
  const body = await resp.json();
  assertErrorEnvelopeShape(body);
  assert.equal(body.code, "SELLER_APPROVAL_REQUIRED");
  assertFieldError(body, "sellerApproval");
});

test("mes error envelope: zodFirstErrorEnvelope apunta al primer campo inválido", async () => {
  const parsed = mesEnvioCreateSchema.safeParse({});
  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const resp = zodFirstErrorEnvelope(parsed.error, "Datos inválidos.");
  assertStatus(resp.status, 400);
  const body = await resp.json();
  assertErrorEnvelopeShape(body);
  assert.equal(body.code, "VALIDATION_ERROR");
  assert.equal(typeof body.fieldErrors, "object");
});

// ─── 7. hasAccountingApproval: tabla de escenarios ─────────────────────────

test("mes contabilidad: anticipo recibido es OK", () => {
  assert.equal(hasAccountingApproval({ advanceReceived: "500000" }), true);
  assert.equal(hasAccountingApproval({ advanceReceived: 100 }), true);
});

test("mes contabilidad: advanceStatus RECIBIDO es OK", () => {
  assert.equal(hasAccountingApproval({ advanceStatus: "RECIBIDO" }), true);
  assert.equal(hasAccountingApproval({ advanceStatus: "PAGADO" }), true);
});

test("mes contabilidad: estado contable PENDIENTE_CONTABILIDAD sin anticipo bloquea", () => {
  assert.equal(
    hasAccountingApproval({
      accountingStatus: "PENDIENTE_CONTABILIDAD",
      advanceReceived: "0",
      advanceStatus: "PENDIENTE",
    }),
    false,
  );
});

test("mes contabilidad: estado contable distinto de PENDIENTE es OK", () => {
  assert.equal(
    hasAccountingApproval({ accountingStatus: "APROBADA" }),
    true,
  );
});

test("mes contabilidad: sin datos (todo null) bloquea", () => {
  assert.equal(
    hasAccountingApproval({
      accountingStatus: null,
      advanceReceived: null,
      advanceStatus: null,
    }),
    false,
  );
});

// ─── 8. mesDispatchApprovalsSchema: validación del schema de aprobaciones ───

test("mes aprobaciones schema: acepta aprobaciones mínimas", () => {
  const result = mesDispatchApprovalsSchema.safeParse({
    seller: { approved: true },
    cartera: { approved: true },
    accounting: { approved: false },
  });
  assert.equal(result.success, true);
});

test("mes aprobaciones schema: rechaza approverName mayor a 150 caracteres", () => {
  const result = mesDispatchApprovalsSchema.safeParse({
    seller: { approved: true, approverName: "A".repeat(151) },
    cartera: { approved: true },
    accounting: { approved: false },
  });
  assert.equal(result.success, false);
});

test("mes aprobaciones schema: acepta partial como undefined", () => {
  const result = mesDispatchApprovalsSchema.safeParse({
    seller: { approved: true, approverName: "Juan" },
    cartera: { approved: true, approverName: "Ana" },
    accounting: { approved: true, approverName: "Luis" },
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.partial, undefined);
});

// ─── 9. mesEnvioSalidaSchema ────────────────────────────────────────────────

test("mes salida: rechaza cuando falta salidaAt", () => {
  const result = mesEnvioSalidaSchema.safeParse({
    logisticOperator: "Servientrega",
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("salidaAt"), "Debe requerir salidaAt");
});

test("mes salida: rechaza salidaAt con formato inválido", () => {
  const result = mesEnvioSalidaSchema.safeParse({
    salidaAt: "no-es-fecha",
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("salidaAt"), "Debe rechazar fecha inválida");
});

test("mes salida: acepta registro mínimo con salidaAt", () => {
  const result = mesEnvioSalidaSchema.safeParse({
    salidaAt: "2026-04-03T10:30:00Z",
  });
  assert.equal(result.success, true);
});

test("mes salida: acepta registro completo con todos los campos", () => {
  const result = mesEnvioSalidaSchema.safeParse({
    salidaAt: "2026-04-03T10:30:00Z",
    logisticOperator: "Servientrega",
    courierBroughtBy: "Pedro Mensajero",
    destinationAddress: "Calle 123 # 45-67, Bogotá",
    requiresDeclaredValue: true,
    observaciones: "Fragil - Manejar con cuidado",
  });
  assert.equal(result.success, true);
});

// ─── 10. mesProductionStageCreateSchema ────────────────────────────────────

test("mes etapa: rechaza cuando falta orderId", () => {
  const result = mesProductionStageCreateSchema.safeParse({
    area: "MONTAJE",
    stageName: "Etapa Montaje",
    startedAt: "2026-04-03T08:00:00Z",
    quantityProcessed: 10,
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("orderId"), "Debe requerir orderId");
});

test("mes etapa: rechaza area fuera del enum permitido", () => {
  const result = mesProductionStageCreateSchema.safeParse({
    orderId: "order-abc-123",
    area: "AREA_INVALIDA",
    stageName: "Etapa",
    startedAt: "2026-04-03T08:00:00Z",
    quantityProcessed: 5,
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("area"), "Debe rechazar area inválida");
});

test("mes etapa: rechaza quantityProcessed negativo", () => {
  const result = mesProductionStageCreateSchema.safeParse({
    orderId: "order-abc-123",
    area: "SUBLIMACION",
    stageName: "Sublimación",
    startedAt: "2026-04-03T08:00:00Z",
    quantityProcessed: -5,
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("quantityProcessed"), "Debe rechazar cantidad negativa");
});

test("mes etapa: acepta etapa de producción válida mínima", () => {
  const result = mesProductionStageCreateSchema.safeParse({
    orderId: "order-abc-123",
    orderItemId: "item-xyz-1",
    area: "CORTE_LASER",
    stageName: "Corte Laser Inicial",
    startedAt: "2026-04-03T08:00:00Z",
    quantityProcessed: 20,
  });
  assert.equal(result.success, true);
});

test("mes etapa: acepta etapa completa con máquina y operario", () => {
  const result = mesProductionStageCreateSchema.safeParse({
    orderId: "order-abc-123",
    orderItemId: "item-xyz-1",
    area: "CONFECCION",
    stageName: "Confección Camisas",
    startedAt: "2026-04-03T08:00:00Z",
    endedAt: "2026-04-03T14:00:00Z",
    operatorId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    operatorName: "María Operaria",
    machineId: "MAQUINA-01",
    machineName: "Máquina de coser industrial",
    quantityProcessed: 50,
    notes: "Sin novedad",
  });
  assert.equal(result.success, true);
});

// ─── 11. mesReposicionCreateSchema + generateRepositionCode ────────────────

test("mes reposición: rechaza cuando falta orderId", () => {
  const result = mesReposicionCreateSchema.safeParse({
    causeCode: "FALTANTE",
    requestingProcess: "MONTAJE",
    quantityRequested: 2,
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("orderId"), "Debe requerir orderId");
});

test("mes reposición: rechaza causeCode fuera del enum", () => {
  const result = mesReposicionCreateSchema.safeParse({
    orderId: "order-123",
    causeCode: "CAUSA_INVALIDA",
    requestingProcess: "MONTAJE",
    quantityRequested: 1,
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("causeCode"), "Debe rechazar causeCode inválido");
});

test("mes reposición: rechaza quantityRequested menor a 1", () => {
  const result = mesReposicionCreateSchema.safeParse({
    orderId: "order-123",
    causeCode: "DAÑO",
    requestingProcess: "SUBLIMACION",
    quantityRequested: 0,
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("quantityRequested"), "Debe requerir al menos 1 unidad");
});

test("mes reposición: acepta reposición válida mínima", () => {
  const result = mesReposicionCreateSchema.safeParse({
    orderId: "order-abc-123",
    orderItemId: "item-xyz-1",
    causeCode: "INCORRECTO",
    requestingProcess: "CONTROL_CALIDAD",
    quantityRequested: 3,
  });
  assert.equal(result.success, true);
});

test("mes reposición: generateRepositionCode genera código con prefijo RD", () => {
  const code = generateRepositionCode();
  assert.match(code, /^RD[0-9A-Z]{5}$/, "Código debe ser RD seguido de 5 chars alfanuméricos");
});

test("mes reposición: generateRepositionCode genera códigos distintos en llamadas sucesivas", () => {
  const codes = new Set(Array.from({ length: 5 }, () => generateRepositionCode()));
  assert.ok(codes.size > 1, "Debe generar códigos únicos en llamadas sucesivas");
});

test("mes reposición update: rechaza status inválido", () => {
  const result = mesReposicionUpdateSchema.safeParse({
    status: "INVENTADO",
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("status"), "Debe rechazar status inválido");
});

test("mes reposición update: acepta cierre con closedAt", () => {
  const result = mesReposicionUpdateSchema.safeParse({
    status: "CERRADA",
    closedAt: "2026-04-04T16:00:00Z",
    notes: "Reposición completada sin novedades",
  });
  assert.equal(result.success, true);
});

// ─── 11b. mesReposicionCreateSchema: historial por proceso (requestingProcess) ──

test("mes reposición historial: acepta requestingProcess MONTAJE", () => {
  const result = mesReposicionCreateSchema.safeParse({
    orderId: "order-abc-123",
    orderItemId: "item-xyz-1",
    causeCode: "FALTANTE",
    requestingProcess: "MONTAJE",
    quantityRequested: 5,
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.requestingProcess, "MONTAJE");
});

test("mes reposición historial: requestingProcess es opcional", () => {
  const result = mesReposicionCreateSchema.safeParse({
    orderId: "order-abc-123",
    orderItemId: "item-xyz-1",
    causeCode: "DAÑO",
    quantityRequested: 1,
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.requestingProcess, undefined);
});

test("mes reposición historial: cada área tiene su propia causa", () => {
  const areas = [
    { area: "SUBLIMACION", causa: "FALTANTE" },
    { area: "PLOTTER", causa: "INCORRECTO" },
    { area: "CONFECCION", causa: "DAÑO" },
    { area: "CONTROL_CALIDAD", causa: "FALTANTE" },
  ];
  for (const { area, causa } of areas) {
    const result = mesReposicionCreateSchema.safeParse({
      orderId: "order-abc-123",
      orderItemId: "item-xyz-1",
      causeCode: causa,
      requestingProcess: area,
      quantityRequested: 2,
    });
    assert.equal(result.success, true, `Debe aceptar proceso ${area} con causa ${causa}`);
  }
});

// ─── 11c. Anti-duplicidad: clave de deduplicación ──────────────────────────

test("mes reposición duplicidad: mismos campos producen el mismo fingerprint clave", () => {
  // La clave de deduplicación es: orderId + orderItemId + causeCode + requestingProcess
  // Dos reposiciones con estos mismos campos deben ser detectadas como duplicadas.
  const base = {
    orderId: "order-abc-123",
    orderItemId: "item-xyz-1",
    causeCode: "FALTANTE" as const,
    requestingProcess: "MONTAJE",
    quantityRequested: 5,
  };
  const r1 = mesReposicionCreateSchema.safeParse(base);
  const r2 = mesReposicionCreateSchema.safeParse({ ...base, quantityRequested: 3, notes: "Otra nota" });
  // Ambas pasan validación (el schema no detecta duplicados, eso es responsabilidad del endpoint)
  assert.equal(r1.success, true);
  assert.equal(r2.success, true);
  if (!r1.success || !r2.success) return;
  // La clave de deduplicación coincide en ambas
  const key1 = `${r1.data.orderId}:${r1.data.orderItemId}:${r1.data.causeCode}:${r1.data.requestingProcess}`;
  const key2 = `${r2.data.orderId}:${r2.data.orderItemId}:${r2.data.causeCode}:${r2.data.requestingProcess}`;
  assert.equal(key1, key2, "La clave de deduplicación debe ser idéntica para reposiciones duplicadas");
});

test("mes reposición duplicidad: diferente causeCode no es duplicado", () => {
  const r1 = mesReposicionCreateSchema.safeParse({
    orderId: "order-abc-123",
    orderItemId: "item-xyz-1",
    causeCode: "FALTANTE",
    requestingProcess: "MONTAJE",
    quantityRequested: 2,
  });
  const r2 = mesReposicionCreateSchema.safeParse({
    orderId: "order-abc-123",
    orderItemId: "item-xyz-1",
    causeCode: "DAÑO",       // ← causa diferente
    requestingProcess: "MONTAJE",
    quantityRequested: 2,
  });
  assert.equal(r1.success, true);
  assert.equal(r2.success, true);
  if (!r1.success || !r2.success) return;
  const key1 = `${r1.data.orderId}:${r1.data.orderItemId}:${r1.data.causeCode}:${r1.data.requestingProcess}`;
  const key2 = `${r2.data.orderId}:${r2.data.orderItemId}:${r2.data.causeCode}:${r2.data.requestingProcess}`;
  assert.notEqual(key1, key2, "Causas diferentes no deben considerarse duplicadas");
});

test("mes reposición duplicidad: diferente requestingProcess no es duplicado", () => {
  const r1 = mesReposicionCreateSchema.safeParse({
    orderId: "order-abc-123",
    orderItemId: "item-xyz-1",
    causeCode: "FALTANTE",
    requestingProcess: "MONTAJE",
    quantityRequested: 2,
  });
  const r2 = mesReposicionCreateSchema.safeParse({
    orderId: "order-abc-123",
    orderItemId: "item-xyz-1",
    causeCode: "FALTANTE",
    requestingProcess: "SUBLIMACION",   // ← proceso diferente
    quantityRequested: 2,
  });
  assert.equal(r1.success, true);
  assert.equal(r2.success, true);
  if (!r1.success || !r2.success) return;
  const key1 = `${r1.data.orderId}:${r1.data.orderItemId}:${r1.data.causeCode}:${r1.data.requestingProcess}`;
  const key2 = `${r2.data.orderId}:${r2.data.orderItemId}:${r2.data.causeCode}:${r2.data.requestingProcess}`;
  assert.notEqual(key1, key2, "Procesos diferentes no deben considerarse duplicados");
});

// ─── 12. mesSampleApprovalUpsertSchema ─────────────────────────────────────

test("mes muestra: rechaza cuando falta orderId", () => {
  const result = mesSampleApprovalUpsertSchema.safeParse({
    sampleApprovalStatus: "APROBADO",
    sampleApprovedBy: "Supervisor",
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("orderId"), "Debe requerir orderId");
});

test("mes muestra: rechaza sampleApprovalStatus fuera del enum", () => {
  const result = mesSampleApprovalUpsertSchema.safeParse({
    orderId: "order-abc-123",
    sampleApprovalStatus: "INVALIDO",
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("sampleApprovalStatus"), "Debe rechazar status inválido");
});

test("mes muestra: acepta aprobación mínima válida", () => {
  const result = mesSampleApprovalUpsertSchema.safeParse({
    orderId: "order-abc-123",
    sampleApprovalStatus: "APROBADO",
    sampleApprovedBy: "Jefe de Producción",
    sampleApprovedAt: "2026-04-03T11:00:00Z",
  });
  assert.equal(result.success, true);
});

test("mes muestra: acepta rechazo de muestra sin fecha de aprobación", () => {
  const result = mesSampleApprovalUpsertSchema.safeParse({
    orderId: "order-abc-123",
    sampleApprovalStatus: "RECHAZADO",
    notes: "No cumple con el diseño aprobado por el cliente",
  });
  assert.equal(result.success, true);
});

test("mes muestra: acepta estado PENDIENTE sin aprobador", () => {
  const result = mesSampleApprovalUpsertSchema.safeParse({
    orderId: "order-abc-123",
    sampleApprovalStatus: "PENDIENTE",
  });
  assert.equal(result.success, true);
});

test("mes muestra: acepta upsert completo con todos los campos", () => {
  const result = mesSampleApprovalUpsertSchema.safeParse({
    orderId: "order-abc-123",
    assemblyPin: "PIN-001-A",
    sampleApprovalStatus: "APROBADO",
    sampleApprovedAt: "2026-04-03T11:00:00Z",
    sampleApprovedBy: "Gerente de Producción",
    notes: "Muestra aprobada con correcciones menores",
  });
  assert.equal(result.success, true);
});
