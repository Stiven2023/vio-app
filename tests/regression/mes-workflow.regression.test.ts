import assert from "node:assert/strict";
import test from "node:test";

import {
  findBlockedOrdersForQueueConfirmation,
  getDispatchBlockingRule,
  hasAccountingApproval,
  isValidEnvioStatusTransition,
  mesEnvioCreateSchema,
} from "@/src/utils/mes-workflow";

test("mes workflow: bloquea cola con contabilidad pendiente", () => {
  const blocked = findBlockedOrdersForQueueConfirmation([
    {
      orderCode: "VN-001",
      accountingStatus: "PENDIENTE_CONTABILIDAD",
      advanceReceived: "0",
      advanceStatus: "PENDIENTE",
    },
    {
      orderCode: "VN-002",
      accountingStatus: "APROBADA",
      advanceReceived: "0",
      advanceStatus: "PENDIENTE",
    },
  ]);

  assert.deepEqual(blocked, ["VN-001"]);
});

test("mes workflow: acepta anticipo recibido como OK contable", () => {
  assert.equal(
    hasAccountingApproval({
      accountingStatus: "PENDIENTE_CONTABILIDAD",
      advanceReceived: "250000",
      advanceStatus: "PENDIENTE",
    }),
    true,
  );
});

test("mes workflow: valida empresa de transporte y segunda parada", () => {
  const parsed = mesEnvioCreateSchema.safeParse({
    orderId: "order-1",
    origenArea: "INTEGRACION",
    destinoArea: "CONFECCION_EXTERNA",
    transporteTipo: "LINEA_TERCERO",
    requiereSegundaParada: true,
    items: [{ orderItemId: "item-1", quantity: 12 }],
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const paths = parsed.error.issues.map((issue) => issue.path.join("."));

  assert.equal(paths.includes("empresaTercero"), true);
  assert.equal(paths.includes("segundaParadaTipo"), true);
  assert.equal(paths.includes("segundaParadaDestino"), true);
});

test("mes workflow: bloquea despacho cuando falta aprobación del vendedor", () => {
  const blockingRule = getDispatchBlockingRule({
    legalEnabled: true,
    sellerApproved: false,
    carteraApproved: true,
    accountingApproved: true,
    isPartialDispatch: false,
    partialDispatchApproved: true,
  });

  assert.equal(blockingRule?.code, "SELLER_APPROVAL_REQUIRED");
});

test("mes workflow: bloquea despacho cuando falta aprobación de cartera", () => {
  const blockingRule = getDispatchBlockingRule({
    legalEnabled: true,
    sellerApproved: true,
    carteraApproved: false,
    accountingApproved: true,
    isPartialDispatch: false,
    partialDispatchApproved: true,
  });

  assert.equal(blockingRule?.code, "RECEIVABLES_APPROVAL_REQUIRED");
});

test("mes workflow: bloquea despacho cuando falta aprobación parcial", () => {
  const blockingRule = getDispatchBlockingRule({
    legalEnabled: true,
    sellerApproved: true,
    carteraApproved: true,
    accountingApproved: true,
    isPartialDispatch: true,
    partialDispatchApproved: false,
  });

  assert.equal(blockingRule?.code, "PARTIAL_DISPATCH_APPROVAL_REQUIRED");
});

test("mes workflow: valida transiciones de estado de envío", () => {
  assert.equal(isValidEnvioStatusTransition("CREADO", "EN_RUTA"), true);
  assert.equal(isValidEnvioStatusTransition("CREADO", "ENTREGADO"), false);
  assert.equal(isValidEnvioStatusTransition("EN_RUTA", "RETORNADO"), true);
});