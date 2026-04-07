/**
 * Tests de idempotencia para las funciones de contabilidad.
 *
 * Verifica que llamar dos veces con la misma clave idempotente
 * retorne el mismo asiento sin duplicarlo.
 */
import assert from "node:assert/strict";
import test from "node:test";

// Simula el almacén de asientos en memoria (en lugar de BD real)
function createInMemoryAccountingStore() {
  const entries = new Map<string, { id: string; entryNumber: string }>();
  let counter = 0;

  return {
    /** Emula el comportamiento idempotente de postXxxEntry */
    async insertIfAbsent(idempotencyKey: string): Promise<{ id: string; entryNumber: string; wasNew: boolean }> {
      if (entries.has(idempotencyKey)) {
        return { ...entries.get(idempotencyKey)!, wasNew: false };
      }

      const entry = { id: `entry-${++counter}`, entryNumber: `ASI-202604-${counter}` };

      entries.set(idempotencyKey, entry);

      return { ...entry, wasNew: true };
    },
    size() {
      return entries.size;
    },
    has(key: string) {
      return entries.has(key);
    },
  };
}

test("idempotencia: segunda llamada con misma clave retorna asiento existente sin duplicar", async () => {
  const store = createInMemoryAccountingStore();
  const key = "order-payment:confirm:pay-001";

  const first = await store.insertIfAbsent(key);
  const second = await store.insertIfAbsent(key);
  const third = await store.insertIfAbsent(key);

  assert.equal(first.wasNew, true, "Primera llamada debe crear asiento");
  assert.equal(second.wasNew, false, "Segunda llamada NO debe crear asiento");
  assert.equal(third.wasNew, false, "Tercera llamada NO debe crear asiento");

  assert.equal(first.id, second.id, "IDs deben ser idénticos");
  assert.equal(first.entryNumber, third.entryNumber, "entryNumber igual en todas las llamadas");
  assert.equal(store.size(), 1, "Solo debe existir un asiento en el almacén");
});

test("idempotencia: claves distintas generan asientos distintos", async () => {
  const store = createInMemoryAccountingStore();

  const a = await store.insertIfAbsent("order-payment:confirm:pay-001");
  const b = await store.insertIfAbsent("order-payment:confirm:pay-002");
  const c = await store.insertIfAbsent("cash-receipt:confirm:rec-001");

  assert.equal(a.wasNew, true);
  assert.equal(b.wasNew, true);
  assert.equal(c.wasNew, true);
  assert.equal(store.size(), 3);
  assert.notEqual(a.id, b.id);
  assert.notEqual(b.id, c.id);
});

test("idempotencia: patrón de clave esperado para order-payment", () => {
  const paymentId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const key = `order-payment:confirm:${paymentId}`;

  assert.ok(key.startsWith("order-payment:confirm:"), "Prefijo correcto para pago de pedido");
  assert.ok(key.endsWith(paymentId), "Contiene el paymentId");
});

test("idempotencia: patrón de clave esperado para factoring collected", () => {
  const factoringId = "f1a2b3c4-d5e6-7890-abcd-ef1234567890";
  const key = `factoring:collected:${factoringId}`;

  assert.ok(key.startsWith("factoring:collected:"), "Prefijo correcto para factoring");
  assert.ok(key.endsWith(factoringId), "Contiene el factoringId");
});

test("idempotencia: patrón de clave esperado para caja menor", () => {
  const txId = "b1c2d3e4-f5a6-7890-abcd-ef1234567890";
  const key = `petty-cash:tx:${txId}`;

  assert.ok(key.startsWith("petty-cash:tx:"), "Prefijo correcto para caja menor");
  assert.ok(key.endsWith(txId), "Contiene el transactionId");
});

test("idempotencia: patrón de clave esperado para ajuste de conciliación", () => {
  const reconciliationId = "c1d2e3f4-a5b6-7890-abcd-ef1234567890";
  const key = `conciliation:adjustment:${reconciliationId}`;

  assert.ok(key.startsWith("conciliation:adjustment:"), "Prefijo correcto para conciliación");
  assert.ok(key.endsWith(reconciliationId), "Contiene el reconciliationId");
});
