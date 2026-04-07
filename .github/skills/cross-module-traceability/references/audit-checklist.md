# Cross-Module Traceability — Audit Checklist

Use this checklist before and after implementing cross-module links.

---

## Phase 1: Schema Integrity Checks

Run against **ERP_DB**:

```sql
-- 1. Pagos huérfanos (sin orderId)
SELECT COUNT(*) AS orphan_payments
FROM order_payments
WHERE order_id IS NULL;

-- 2. Asientos contables sin fuente
SELECT COUNT(*) AS entries_without_source
FROM accounting_entries
WHERE source_id IS NULL AND source_type IS NULL;

-- 3. Prefacturas sin pedido vinculado
SELECT COUNT(*) AS orphan_prefacturas
FROM prefacturas
WHERE order_id IS NULL;

-- 4. Líneas de IVA con cuenta incorrecta
SELECT ael.account_code, ae.description
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ael.entry_id = ae.id
WHERE ae.description ILIKE '%iva%'
  AND ael.account_code NOT LIKE '2408%';

-- 5. Líneas de rete-ica con cuenta incorrecta
SELECT ael.account_code, ae.description
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ael.entry_id = ae.id
WHERE (ae.description ILIKE '%rete%' OR ae.description ILIKE '%ica%')
  AND ael.account_code NOT LIKE '2365%';

-- 6. Anticipos registrados con cuenta incorrecta
SELECT ael.account_code, ae.description
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ael.entry_id = ae.id
WHERE ae.source_type = 'PAYMENT'
  AND ael.side = 'CREDIT'
  AND ael.account_code NOT IN ('280505', '130505');
```

Run against **MES_DB** (and validate cross-reference in ERP_DB):

```sql
-- 7. Envíos MES sin pedido válido en ERP
-- (manual step: export mes_envios.order_id list and check against ERP orders.id)
SELECT DISTINCT order_id FROM mes_envios WHERE order_id IS NOT NULL;
-- Then in ERP_DB:
-- SELECT id FROM orders WHERE id IN (...list above...);
-- Any missing = phantom envíos
```

---

## Phase 2: API Completeness Checks

- [ ] `GET /api/orders/[id]/history` exists and returns `{ payments, prefacturas, mesShipments, productionLogs, accountingEntries }`
- [ ] `GET /api/orders` supports `?paymentId=` reverse lookup param
- [ ] `GET /api/contabilidad/recibos-caja/[id]` includes `sourceOrder` in response
- [ ] `GET /api/mes/envios?orderId=` returns envíos for the order
- [ ] All cross-DB queries use `Promise.all()` (parallel, not sequential)

---

## Phase 3: Accounting Mapping Completeness

- [ ] `accounting_event_mappings` has a row for `CASH_RECEIPT_CONFIRM`
- [ ] `accounting_event_mappings` has a row for `CASH_RECEIPT_VOID` (reversal)
- [ ] `accounting_event_mappings` has a row for `ORDER_INVOICE` (if invoice generation is implemented)
- [ ] `accounting_event_mappings` has a row for `ADVANCE_PAYMENT` (anticipo)
- [ ] All seeded accounts in `accounting_accounts` cover: 110505, 111005, 130505, 280505, and any tax accounts used

---

## Phase 4: UI Integration Checks

- [x] Order detail page exists: `app/erp/orders/[id]/detail/`
- [x] Order detail page shows payment history (`/api/orders/${orderId}/payments`)
- [x] Order detail page shows prefactura totals
- [ ] Order detail page shows MES production status / envíos tab (not yet implemented)
- [ ] Order detail page shows accounting entries tab (not yet implemented)
- [ ] Payment confirmation screen shows the linked pedido code
- [ ] Accounting entries list links back to source (pedido, recibo, prefactura)

---

## Completion Criteria

All items above checked OR documented as "out of scope" with a reason. No orphan payments, no missing source references in accounting entries, tax accounts validated against PUC.
