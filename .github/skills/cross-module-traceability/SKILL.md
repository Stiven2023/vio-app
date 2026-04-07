---
name: cross-module-traceability
description: 'Use when implementing, auditing, or debugging cross-module data traceability in the Viomar ERP. Covers bidirectional order lookup (order→payments, order→MES, order→accounting), payment-to-order linking, accounting entry validation (rete-ica, IVA, ventas), and code restructuring for integral data traversal across ERP/MES/Contabilidad/CRM. Trigger words: trazabilidad, mapeo integral, cruzar informacion, rastrear pedido, vinculacion pagos, sistema transversal, integral system, bidireccional, cross-module, accounting mapping, rete-ica, IVA cuentas contables, historial pedido, seguimiento completo.'
argument-hint: 'Specify scope (all|orders|payments|mes|accounting) and mode (audit|implement|validate)'
---

# Cross-Module Traceability — Viomar ERP

## Purpose

Implement and verify that **any movement in the system can be traced from any entry point**:

- Search by **pedido** → everything that happened (MES production, envíos, pagos, contabilidad)
- Search by **pago** → find the exact pedido it belongs to
- Search by **asiento contable** → find the source transaction (pedido, recibo, prefactura)
- Validate that **rete-ica, IVA, y ventas** caen en las cuentas contables correctas

---

## Step-by-Step Procedure

### 1. Map Existing Cross-Module Links

Read [schema reference](./references/schema-links.md) and then:

```bash
# Read the ERP schema
read src/db/schema.ts                  # ERP: orders, order_payments, prefacturas, accounting_*
read app/mes/db/schema.ts              # MES: mes_envios, mes_production_queue, operative_dashboard_logs
```

Build a mental graph of FK chains:
- `orders.id` ← `order_items.orderId`
- `orders.id` ← `order_payments.orderId`
- `orders.id` ← `prefacturas.orderId`
- `orders.id` ← `mesShipments.orderId` (cross-DB, stored as string ref)
- `orders.id` ← `accounting_entries.sourceId` (when sourceType = 'ORDER' | 'PAYMENT')
- `prefacturas.id` ← `order_payments.prefacturaId`
- `accounting_entries.id` ← `accounting_entry_lines.entryId`

### 2. Audit for Missing Links

Run the [audit checklist](./references/audit-checklist.md). Look for:

- [ ] `order_payments` rows with `orderId = NULL` (pagos huérfanos)
- [ ] `mesShipments` where no matching `orders.id` exists in ERP DB (phantom envíos)
- [ ] `accounting_entries` generated from recibos-caja with no `sourceId` / `sourceType` set
- [ ] `prefacturas` with `balance > 0` but no `order_payments` linked
- [ ] Tax lines (`accounting_entry_lines` for cuentas 23xxxx / 24xxxx) with wrong accountCode

```sql
-- Pagos huérfanos (ERP_DB)
SELECT id, amount, method, created_at 
FROM order_payments 
WHERE order_id IS NULL;

-- Asientos sin fuente (ERP_DB)
SELECT id, description, total_debit 
FROM accounting_entries 
WHERE source_id IS NULL AND source_type IS NULL;
```

### 3. Implement Bidirectional Lookup API

Each domain needs a **lookup endpoint** that returns all cross-module data for one entity.

#### 3a. Order Full History Endpoint

Create or extend `GET /api/orders/[id]/history`:

```typescript
// Returns:
{
  order: { id, code, status, client, total, ... },
  items: [...],
  payments: [...],          // order_payments linked to this order
  prefacturas: [...],       // prefacturas for this order
  mesShipments: [...],      // from MES_DB via orderId ref
  productionLogs: [...],    // operative_dashboard_logs from MES_DB
  accountingEntries: [...]  // from accounting_entries where sourceId = order.id
}
```

#### 3b. Payment Reverse Lookup

Extend `GET /api/contabilidad/recibos-caja/[id]` (or add `/api/orders/by-payment/[paymentId]`):

```typescript
// Reverse: given a payment → find the order
const payment = await db.query.orderPayments.findFirst({
  where: eq(orderPayments.id, paymentId),
  with: { order: true, prefactura: true }
});
```

#### 3c. Accounting Entry ↔ Source

`GET /api/contabilidad/asientos/[id]/source` — returns the originating business object:

```typescript
const entry = await db.query.accountingEntries.findFirst({
  where: eq(accountingEntries.id, entryId)
});
// entry.sourceType: 'ORDER' | 'PAYMENT' | 'PREFACTURA' | 'CASH_RECEIPT'
// entry.sourceId: UUID of source
```

### 4. Validate Accounting Entry Mapping

Use [accounting mapping reference](./references/schema-links.md#accounting-accounts) to verify:

| Concepto | Cuenta PUC correcta | Naturaleza |
|---|---|---|
| Ingreso por ventas | 4135xxxx | Crédito |
| IVA generado | 240805xx | Crédito |
| Rete-ICA retenida | 236505xx | Crédito |
| Rete-fuente retenida | 236040xx | Crédito |
| Anticipo recibido | 280505 | Crédito |
| Efectivo / caja | 110505 | Débito |
| Bancos / transferencias | 111005 | Débito |
| Cartera / cuentas por cobrar | 130505 | Débito |

Check `accounting_event_mappings` table — each `eventCode` maps to a `sourceModule` + JSONB `config` that the engine reads to generate debit/credit lines.

```sql
-- Validate IVA lines have correct account
SELECT ael.account_code, ae.description, ae.source_type
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ael.entry_id = ae.id
WHERE ael.account_code NOT LIKE '24%'
  AND ae.description ILIKE '%iva%';
```

### 5. Cross-DB Reference Pattern

Since Viomar uses 4 separate DBs (ERP, MES, IAM, CRM), cross-DB FKs are stored as **string references** (not DB-level FK constraints). When implementing cross-module lookup:

```typescript
// Pattern: always look up in the target DB using the string ref
import { erpDb } from '@/src/db/erp';
import { mesDb } from '@/src/db/mes';

// From ERP order → MES shipments
const order = await erpDb.query.orders.findFirst({ where: eq(orders.id, orderId) });
const shipments = await mesDb.query.mesShipments.findMany({
  where: eq(mesShipments.orderId, order.id)  // mesShipments.orderId is a string ref
});
```

> **Rule**: Never assume a cross-DB reference is valid. Always handle `null` / not-found cases explicitly.

### 6. Code Restructuring for Clean Traversal

Prefer **service layer functions** over duplicating join logic in routes:

```typescript
// src/services/order-history.service.ts
export async function getOrderFullHistory(orderId: string) {
  const [order, items, payments, shipments, logs, entries] = await Promise.all([
    fetchOrderById(orderId),
    fetchOrderItems(orderId),
    fetchOrderPayments(orderId),
    fetchMesShipments(orderId),     // → MES_DB query
    fetchProductionLogs(orderId),   // → MES_DB query
    fetchAccountingEntries(orderId) // → ERP_DB accounting tables
  ]);
  return { order, items, payments, shipments, logs, entries };
}
```

### 7. Validate End-to-End

After implementing:

- [ ] `GET /api/orders/[id]/history` returns complete data for a known pedido
- [ ] Search by a known payment ID returns the correct pedido
- [ ] `accounting_entry_lines` for an IVA-bearing order have account 240805xx
- [ ] `accounting_entry_lines` for rete-ica have account 236505xx
- [ ] Reverse: find pedido from accounting entry ID works

---

## Decision Points

### Missing payment-order link?
→ Check if the `order_payments` row has `orderId` populated. If not, it was created before the link was enforced. Run a backfill using `prefacturaId → prefacturas.orderId`.

### Envíos in MES with no matching ERP order?
→ These are historical envíos imported before the system was live. They can be linked via `orderCode` string matching against `orders.code`.

### Accounting event mapping missing for a transaction type?
→ Add a row to `accounting_event_mappings` with the correct template. Do not create entries manually — always use the event mapping system.

---

## Quality Criteria

A fully integral system satisfies:

1. **Any payment → order lookup** in ≤2 DB queries
2. **Any order → full history** in ≤1 parallel batch of queries (Promise.all)
3. **Zero orphan payments** (`order_payments.orderId IS NULL`)
4. **All accounting entries have `sourceId` + `sourceType`**
5. **Tax lines use PUC codes from the mapping table above**
6. **Cross-DB refs are validated at write time** (API rejects unknown IDs)
