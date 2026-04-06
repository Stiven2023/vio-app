import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMissingOrdersCsv,
  classifyMissingOrders,
  parseMissingOrderCode,
} from "@/src/imports/historical-excel/missing-orders";

test("missing orders: parsea prefijo y consecutivo", () => {
  assert.deepEqual(parseMissingOrderCode(" vn-123 "), {
    normalized: "VN - 123",
    prefix: "VN",
    numericPart: "123",
  });
});

test("missing orders: clasifica invalidos, compartidos y flujo unico", () => {
  const items = classifyMissingOrders({
    despacho: ["VN - 123", "VX - 070"],
    ventas: ["VN - 123", "VI - 200"],
  });

  const byCode = new Map(items.map((item) => [item.orderCode, item]));

  assert.equal(byCode.get("VX - 070")?.classification, "invalid_prefix");
  assert.equal(byCode.get("VN - 123")?.classification, "shared_missing");
  assert.equal(byCode.get("VI - 200")?.classification, "single_flow_missing");
});

test("missing orders: exporta csv con encabezado", () => {
  const csv = buildMissingOrdersCsv(
    classifyMissingOrders({ despacho: ["VN - 123"], ventas: [] }),
  );

  assert.match(csv, /"orderCode","prefix","numericPart","isValidPrefix","appearsIn","classification","recommendedAction"/);
  assert.match(csv, /VN - 123/);
});