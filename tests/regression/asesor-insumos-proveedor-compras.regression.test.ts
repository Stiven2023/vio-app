/**
 * Tests de regresión — Flujo Asesor: Insumos, Proveedor y Órdenes de Compra
 *
 * Escenario: VN-014229 · Mundialito Alcaldía de Pereira (El Olímpico) 2026
 * Para producir 150 camisillas (NOVAK), 80 cortavientos (SPRING) y 50 conjuntos (SUDAPLUS)
 * se necesita comprar tela al proveedor TEXTILES COLOMBIANOS S.A.S.
 *
 * Flujo que se prueba:
 *  1. El asesor verifica que el pedido tiene aprobación contable (via anticipo recibido)
 *  2. El sistema bloquea pedidos sin aprobación de contabilidad de la cola de producción
 *  3. El anticipo recibido ($8.500.000) desbloquea la cola de programación automáticamente
 *  4. Validación del schema de envío para mover insumos VIOMAR → INTEGRACION
 *  5. Validación del schema de insumos: transporte propio vs línea tercero
 *  6. Reglas de banco al registrar pagos al proveedor (campos de validación)
 *
 * Cubre:
 *  - hasAccountingApproval() con anticipo positivo
 *  - findBlockedOrdersForQueueConfirmation() para pedidos sin anticipo
 *  - mesEnvioCreateSchema para envíos internos VIOMAR→INTEGRACION (llegada de insumos)
 *  - Validación de transporteTipo LINEA_TERCERO requiere empresaTercero
 *  - Regla de porcentaje de retención (parseRatePercentage)
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  hasAccountingApproval,
  findBlockedOrdersForQueueConfirmation,
  mesEnvioCreateSchema,
  type QueueAccountingSnapshot,
} from "@/src/utils/mes-workflow";

import {
  parseRatePercentage,
  hasDuplicateOrderAllocations,
} from "@/src/utils/business-rule-guards";

// ---------------------------------------------------------------------------
// 1. Aprobación contable via anticipo — Desbloqueo de programación
// ---------------------------------------------------------------------------

test("asesor — anticipo recibido $8.500.000 desbloquea la aprobación contable del pedido", () => {
  const snapshot = {
    accountingStatus: "PENDIENTE_CONTABILIDAD",
    advanceReceived: "8500000",
    advanceStatus: null,
  };
  assert.equal(hasAccountingApproval(snapshot), true);
});

test("asesor — anticipo recibido 8500000 (número) también desbloquea aprobación", () => {
  const snapshot = {
    accountingStatus: "PENDIENTE_CONTABILIDAD",
    advanceReceived: 8500000,
    advanceStatus: null,
  };
  assert.equal(hasAccountingApproval(snapshot), true);
});

test("asesor — advanceStatus RECIBIDO desbloquea la aprobación aunque no haya monto", () => {
  const snapshot = {
    accountingStatus: "PENDIENTE_CONTABILIDAD",
    advanceReceived: null,
    advanceStatus: "RECIBIDO",
  };
  assert.equal(hasAccountingApproval(snapshot), true);
});

test("asesor — advanceStatus PAGADO desbloquea la aprobación (banco confirmó el pago)", () => {
  const snapshot = {
    accountingStatus: "PENDIENTE_CONTABILIDAD",
    advanceReceived: null,
    advanceStatus: "PAGADO",
  };
  assert.equal(hasAccountingApproval(snapshot), true);
});

test("asesor — accountingStatus APROBADO_CONTABILIDAD ya tiene aprobación (proceso formal)", () => {
  const snapshot = {
    accountingStatus: "APROBADO_CONTABILIDAD",
    advanceReceived: null,
    advanceStatus: null,
  };
  assert.equal(hasAccountingApproval(snapshot), true);
});

test("asesor — sin anticipo ni aprobación formal: pedido bloqueado en cola de programación", () => {
  const snapshot = {
    accountingStatus: "PENDIENTE_CONTABILIDAD",
    advanceReceived: null,
    advanceStatus: null,
  };
  assert.equal(hasAccountingApproval(snapshot), false);
});

// ---------------------------------------------------------------------------
// 2. Cola de programación — Pedidos bloqueados vs desbloqueados
// ---------------------------------------------------------------------------

test("asesor — pedido VN-014229 con anticipo no aparece en lista de bloqueados", () => {
  const snapshots: QueueAccountingSnapshot[] = [
    {
      orderCode: "VN-014229",
      accountingStatus: "PENDIENTE_CONTABILIDAD",
      advanceReceived: "8500000",
      advanceStatus: null,
    },
    {
      orderCode: "VN-014230",
      accountingStatus: "PENDIENTE_CONTABILIDAD",
      advanceReceived: null,
      advanceStatus: null,
    },
  ];
  const blocked = findBlockedOrdersForQueueConfirmation(snapshots);
  assert.ok(!blocked.includes("VN-014229"), "VN-014229 NO debe estar bloqueado");
  assert.ok(blocked.includes("VN-014230"), "VN-014230 SÍ debe estar bloqueado");
});

test("asesor — lista vacía de pedidos retorna lista vacía de bloqueados", () => {
  const blocked = findBlockedOrdersForQueueConfirmation([]);
  assert.equal(blocked.length, 0);
});

test("asesor — múltiples pedidos del mismo cliente sin anticipo solo aparecen una vez en bloqueados", () => {
  const snapshots: QueueAccountingSnapshot[] = [
    { orderCode: "VN-014231", accountingStatus: "PENDIENTE_CONTABILIDAD", advanceReceived: null },
    { orderCode: "VN-014231", accountingStatus: "PENDIENTE_CONTABILIDAD", advanceReceived: null }, // duplicado
  ];
  const blocked = findBlockedOrdersForQueueConfirmation(snapshots);
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0], "VN-014231");
});

// ---------------------------------------------------------------------------
// 3. Schema de envío — Mover insumos de VIOMAR a INTEGRACION (llegada de tela)
// ---------------------------------------------------------------------------

test("asesor — envío de insumos VIOMAR→INTEGRACION con mensajero es válido", () => {
  const payload = {
    orderId: "order-vn-014229",
    origenArea: "VIOMAR",
    destinoArea: "INTEGRACION",
    transporteTipo: "MENSAJERO",
    items: [
      { orderItemId: "item-camisilla-001", quantity: 150 },
      { orderItemId: "item-cortavientos-002", quantity: 80 },
    ],
  };
  const result = mesEnvioCreateSchema.safeParse(payload);
  assert.equal(result.success, true, JSON.stringify(result.error?.issues));
});

test("asesor — envío con LINEA_TERCERO requiere campo empresaTercero (proveedor de transporte)", () => {
  const payload = {
    orderId: "order-vn-014229",
    origenArea: "VIOMAR",
    destinoArea: "INTEGRACION",
    transporteTipo: "LINEA_TERCERO",
    // empresaTercero ausente → debe fallar
    items: [{ orderItemId: "item-conjunto-003", quantity: 50 }],
  };
  const result = mesEnvioCreateSchema.safeParse(payload);
  assert.equal(result.success, false, "Debe fallar sin empresaTercero");
  const paths = result.error!.issues.map((i) => i.path.join("."));
  assert.ok(
    paths.some((p) => p.includes("empresaTercero")),
    `Se esperaba error en empresaTercero, paths: ${paths.join(", ")}`
  );
});

test("asesor — envío con LINEA_TERCERO y empresaTercero presente es válido", () => {
  const payload = {
    orderId: "order-vn-014229",
    origenArea: "VIOMAR",
    destinoArea: "INTEGRACION",
    transporteTipo: "LINEA_TERCERO",
    empresaTercero: "SERVIENTREGA S.A.",
    items: [{ orderItemId: "item-camisilla-001", quantity: 150 }],
  };
  const result = mesEnvioCreateSchema.safeParse(payload);
  assert.equal(result.success, true, JSON.stringify(result.error?.issues));
});

test("asesor — envío con segunda parada requiere tipo y destino de la segunda parada", () => {
  const payload = {
    orderId: "order-vn-014229",
    origenArea: "VIOMAR",
    destinoArea: "CONFECCION_EXTERNA",
    transporteTipo: "CONDUCTOR_PROPIO",
    requiereSegundaParada: true,
    // segundaParadaTipo y segundaParadaDestino ausentes → debe fallar
    items: [{ orderItemId: "item-camisilla-001", quantity: 150 }],
  };
  const result = mesEnvioCreateSchema.safeParse(payload);
  assert.equal(result.success, false, "Debe fallar sin datos de segunda parada");
});

test("asesor — no se puede enviar el mismo ítem dos veces en el mismo envío (IDs duplicados)", () => {
  const payload = {
    orderId: "order-vn-014229",
    origenArea: "VIOMAR",
    destinoArea: "CONFECCION_EXTERNA",
    transporteTipo: "MENSAJERO",
    items: [
      { orderItemId: "item-camisilla-001", quantity: 100 },
      { orderItemId: "item-camisilla-001", quantity: 50 }, // duplicado
    ],
  };
  const result = mesEnvioCreateSchema.safeParse(payload);
  assert.equal(result.success, false, "Debe fallar con IDs de item duplicados");
});

// ---------------------------------------------------------------------------
// 4. Retenciones del proveedor — Reglas de porcentaje
// ---------------------------------------------------------------------------

test("asesor — retención de renta 3.5% al proveedor de telas es válida", () => {
  const parsed = parseRatePercentage(3.5);
  assert.notEqual(parsed, null);
  assert.equal(parsed, "3.5000");
});

test("asesor — retención ICA 0.966% es válida", () => {
  const parsed = parseRatePercentage(0.966);
  assert.notEqual(parsed, null);
  assert.match(parsed!, /^0\.\d{4}$/);
});

test("asesor — retención 0% (proveedor exento) es válida", () => {
  const parsed = parseRatePercentage(0);
  assert.equal(parsed, "0.0000");
});

test("asesor — retención 100% es válida (caso extremo de pago íntegro retenido)", () => {
  const parsed = parseRatePercentage(100);
  assert.equal(parsed, "100.0000");
});

test("asesor — retención negativa es inválida (no se puede retener valor negativo)", () => {
  assert.equal(parseRatePercentage(-1), null);
});

test("asesor — retención mayor al 100% es inválida", () => {
  assert.equal(parseRatePercentage(101), null);
});

// ---------------------------------------------------------------------------
// 5. Pagos al proveedor — Sin duplicados de pedidos en la distribución
// ---------------------------------------------------------------------------

test("asesor — pago proveedor para un solo pedido VN-014229 no tiene duplicados", () => {
  const allocations = [{ orderId: "vn-014229-uuid" }];
  assert.equal(hasDuplicateOrderAllocations(allocations), false);
});

test("asesor — pago distribuido entre VN-014229 y VN-014227 no tiene duplicados", () => {
  const allocations = [
    { orderId: "vn-014229-uuid" },
    { orderId: "vn-014227-uuid" },
  ];
  assert.equal(hasDuplicateOrderAllocations(allocations), false);
});

test("asesor — el mismo pedido dos veces en distribución de pago es error de datos", () => {
  const allocations = [
    { orderId: "vn-014229-uuid" },
    { orderId: "vn-014229-uuid" }, // duplicado
  ];
  assert.equal(hasDuplicateOrderAllocations(allocations), true);
});
