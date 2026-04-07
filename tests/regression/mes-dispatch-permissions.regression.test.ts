import assert from "node:assert/strict";
import test from "node:test";

import {
  canApproveDispatchShipment,
  canCancelDispatchShipment,
  canCreateDispatchShipment,
  canUpdateDispatchShipment,
  getMesDispatchCapabilities,
  hasFinalDispatchApprovalInput,
} from "@/src/utils/mes-dispatch-permissions";

test("mes dispatch permissions: admin tiene control total", () => {
  assert.equal(canCreateDispatchShipment("ADMINISTRADOR"), true);
  assert.equal(canUpdateDispatchShipment("ADMINISTRADOR"), true);
  assert.equal(canApproveDispatchShipment("ADMINISTRADOR"), true);
  assert.equal(canCancelDispatchShipment("ADMINISTRADOR"), true);
});

test("mes dispatch permissions: lider puede crear/editar/aprobar pero no anular", () => {
  assert.equal(canCreateDispatchShipment("LIDER_OPERACIONAL"), true);
  assert.equal(canUpdateDispatchShipment("LIDER_OPERACIONAL"), true);
  assert.equal(canApproveDispatchShipment("LIDER_OPERACIONAL"), true);
  assert.equal(canCancelDispatchShipment("LIDER_OPERACIONAL"), false);
});

test("mes dispatch permissions: operario despacho puede crear/editar sin aprobación ni anulación", () => {
  assert.equal(canCreateDispatchShipment("OPERARIO_DESPACHO"), true);
  assert.equal(canUpdateDispatchShipment("OPERARIO_DESPACHO"), true);
  assert.equal(canApproveDispatchShipment("OPERARIO_DESPACHO"), false);
  assert.equal(canCancelDispatchShipment("OPERARIO_DESPACHO"), false);
});

test("mes dispatch permissions: roles sin alcance no pueden mutar despacho", () => {
  assert.equal(canCreateDispatchShipment("ASESOR"), false);
  assert.equal(canUpdateDispatchShipment("ASESOR"), false);
  assert.equal(canApproveDispatchShipment("ASESOR"), false);
  assert.equal(canCancelDispatchShipment("ASESOR"), false);
});

test("mes dispatch permissions: detecta payload de aprobación final", () => {
  assert.equal(
    hasFinalDispatchApprovalInput({
      seller: { approved: false },
      cartera: { approved: false },
      accounting: { approved: false },
    }),
    false,
  );

  assert.equal(
    hasFinalDispatchApprovalInput({
      seller: { approved: true, approverName: "Lider" },
      cartera: { approved: false },
      accounting: { approved: false },
    }),
    true,
  );

  assert.equal(
    hasFinalDispatchApprovalInput({
      seller: { approved: false, approverName: "Intento" },
      cartera: { approved: false },
      accounting: { approved: false },
    }),
    true,
  );
});

test("mes dispatch permissions: resumen de capacidades", () => {
  const caps = getMesDispatchCapabilities("OPERARIO_DESPACHO");

  assert.deepEqual(caps, {
    canCreate: true,
    canUpdate: true,
    canApprove: false,
    canCancel: false,
  });
});
