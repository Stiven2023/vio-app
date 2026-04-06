import assert from "node:assert/strict";
import test from "node:test";

import {
  isSeguimientoLogSheetCandidate,
  resolveSeguimientoOperationType,
  resolveSeguimientoProcessCode,
  resolveSeguimientoRoleArea,
} from "@/src/imports/historical-excel/seguimiento";

test("seguimiento helpers: infiere operacion desde el nombre de la hoja", () => {
  assert.equal(resolveSeguimientoOperationType(null, "Plotter Abril"), "PLOTTER");
  assert.equal(resolveSeguimientoOperationType("corte laser", null), "CORTE_LASER");
  assert.equal(resolveSeguimientoOperationType("manual", null), "CORTE_MANUAL");
});

test("seguimiento helpers: deriva roleArea coherente", () => {
  assert.equal(resolveSeguimientoRoleArea(null, "DESPACHO"), "MENSAJERIA");
  assert.equal(resolveSeguimientoRoleArea(null, "CONFECCION"), "CONFECCIONISTAS");
  assert.equal(resolveSeguimientoRoleArea("empaque", null), "EMPAQUE");
});

test("seguimiento helpers: normaliza processCode y detecta hojas de logs", () => {
  assert.equal(resolveSeguimientoProcessCode("secundario"), "S");
  assert.equal(resolveSeguimientoProcessCode("control"), "C");
  assert.equal(resolveSeguimientoProcessCode(null), "P");
  assert.equal(isSeguimientoLogSheetCandidate("Seguimiento Plotter"), true);
  assert.equal(isSeguimientoLogSheetCandidate("Pedidos"), false);
});