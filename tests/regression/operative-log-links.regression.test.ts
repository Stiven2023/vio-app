import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOperativeLogLinkFields,
  getEffectiveOperativeLogLookupInput,
  normalizeOperativeLogReference,
  shouldRefreshOperativeLogLink,
} from "@/src/utils/operative-log-links";

test("operative log links: normaliza ids vacíos y undefined", () => {
  assert.equal(normalizeOperativeLogReference(undefined), undefined);
  assert.equal(normalizeOperativeLogReference(null), null);
  assert.equal(normalizeOperativeLogReference("   "), null);
  assert.equal(normalizeOperativeLogReference("  item-1  "), "item-1");
});

test("operative log links: construye campos persistibles con nulls explícitos", () => {
  assert.deepEqual(
    buildOperativeLogLinkFields({
      orderId: " order-1 ",
      orderItemId: "",
      sourceLegacyOrderItemId: " legacy-77 ",
    }),
    {
      orderId: "order-1",
      orderItemId: null,
      sourceLegacyOrderItemId: "legacy-77",
    },
  );
});

test("operative log links: combina patch y estado existente para re-resolver vínculo", () => {
  assert.deepEqual(
    getEffectiveOperativeLogLookupInput(
      {
        orderCode: "VN - 10",
        designName: "Camiseta local",
        size: "M",
        orderId: "order-10",
        orderItemId: "item-10",
      },
      {
        designName: "Camiseta visitante",
        size: null,
      },
    ),
    {
      orderCode: "VN - 10",
      designName: "Camiseta visitante",
      size: null,
      orderId: "order-10",
      orderItemId: "item-10",
    },
  );
});

test("operative log links: refresca cuando cambian claves o faltan ids persistidos", () => {
  assert.equal(
    shouldRefreshOperativeLogLink(
      {
        orderCode: "VN - 11",
        designName: "Diseño 11",
        size: "L",
        orderId: null,
        orderItemId: null,
      },
      {},
    ),
    true,
  );

  assert.equal(
    shouldRefreshOperativeLogLink(
      {
        orderCode: "VN - 11",
        designName: "Diseño 11",
        size: "L",
        orderId: "order-11",
        orderItemId: "item-11",
      },
      { observations: "ajuste menor" },
    ),
    false,
  );

  assert.equal(
    shouldRefreshOperativeLogLink(
      {
        orderCode: "VN - 11",
        designName: "Diseño 11",
        size: "L",
        orderId: "order-11",
        orderItemId: "item-11",
      },
      { orderCode: "VN - 12" },
    ),
    true,
  );
});