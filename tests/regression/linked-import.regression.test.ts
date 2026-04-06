import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLinkedImportOrderId,
  buildLinkedImportOrderItemId,
  buildLinkedImportOrderItemName,
  hasValidLinkedImportPrefix,
  mapLinkedImportOrderType,
  resolveLinkedImportOrderStatus,
  shouldUpgradeImportedOrderToProduction,
} from "@/src/imports/historical-excel/linked-import";

test("linked import: valida prefijos y mapea tipo de pedido", () => {
  assert.equal(hasValidLinkedImportPrefix("VN - 123"), true);
  assert.equal(hasValidLinkedImportPrefix("VX - 070"), false);
  assert.equal(mapLinkedImportOrderType("VI - 200"), "VI");
  assert.equal(mapLinkedImportOrderType("VR - 99"), "VN");
});

test("linked import: genera ids deterministas y nombre fallback", () => {
  assert.equal(buildLinkedImportOrderId("VN - 123"), buildLinkedImportOrderId("vn123"));
  assert.equal(
    buildLinkedImportOrderItemId("VN - 123", 4),
    buildLinkedImportOrderItemId("vn123", 4),
  );
  assert.equal(buildLinkedImportOrderItemName(7), "DISEÑO 7 migrado");
});

test("linked import: pedidos importados nuevos quedan en produccion", () => {
  assert.equal(
    resolveLinkedImportOrderStatus({
      trackingStatus: null,
      hasVentas: true,
      hasEnvios: false,
      hasSeguimiento: false,
    }),
    "PRODUCCION",
  );
  assert.equal(
    resolveLinkedImportOrderStatus({
      trackingStatus: "EN_PRODUCCION",
      hasVentas: false,
      hasEnvios: false,
      hasSeguimiento: true,
    }),
    "PRODUCCION",
  );
});

test("linked import: placeholders importados en aprobacion se actualizan a produccion", () => {
  assert.equal(
    shouldUpgradeImportedOrderToProduction({
      currentStatus: "APROBACION",
      clientId: null,
      orderName: null,
      hasImportSignals: true,
    }),
    true,
  );
  assert.equal(
    shouldUpgradeImportedOrderToProduction({
      currentStatus: "PRODUCCION",
      clientId: null,
      orderName: null,
      hasImportSignals: true,
    }),
    false,
  );
});