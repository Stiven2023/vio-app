# Cross-Module Schema Links — Viomar ERP

## Database Distribution

| DB alias | Postgres DB name | Drizzle config |
|---|---|---|
| `erpDb` | ERP_DB | `src/db/erp/index.ts` → `src/db/schema.ts` |
| `mesDb` | MES_DB | `src/db/mes/index.ts` → `app/mes/db/schema.ts` |
| `iamDb` | IAM_DB | `src/db/iam/index.ts` |
| `crmDb` | CRM_DB | `src/db/crm/index.ts` |

---

## ERP_DB — Core FK Chains

```
orders
  └─ order_items           (orderId → orders.id)
  └─ order_payments        (orderId → orders.id, prefacturaId → prefacturas.id)
  └─ prefacturas           (orderId → orders.id)
  └─ shipments             (orderId → orders.id)  ← internal ERP delivery records
  └─ cash_receipts         (orderId? → orders.id)
  └─ accounting_entries    (sourceId = orders.id, sourceType = 'ORDER')
  └─ order_status_history  (orderId → orders.id)

prefacturas
  └─ order_payments        (prefacturaId → prefacturas.id)

accounting_entries
  └─ accounting_entry_lines (entryId → accounting_entries.id)
  └─ accounting_entry_history (entryId → accounting_entries.id)
```

---

## Cross-DB String References (no DB FK constraint)

| Source table (DB) | Reference column | Target table (DB) | Notes |
|---|---|---|---|
| `mes_envios` (MES_DB) | `orderId` (varchar) | `orders.id` (ERP_DB) | UUID string — validate existence at API write time |
| `mes_production_queue` (MES_DB) | `orderId` (varchar) | `orders.id` (ERP_DB) | Same pattern |
| `operative_dashboard_logs` (MES_DB) | `orderId` (varchar) | `orders.id` (ERP_DB) | Same pattern |
| `accounting_entries` (ERP_DB) | `sourceId` (varchar) | Various tables | Disambiguated by `sourceType` |

---

## Accounting Accounts Reference

### PUC Codes used in Viomar

| Cuenta | Descripción | Naturaleza | DB Table | Seeded in migration |
|---|---|---|---|---|
| `110505` | Caja general | Débito | `accounting_accounts` | 0066 |
| `111005` | Bancos / transferencias | Débito | `accounting_accounts` | 0066 |
| `130505` | Clientes / cartera | Débito | `accounting_accounts` | 0066 |
| `280505` | Anticipos recibidos | Crédito | `accounting_accounts` | 0066 |
| `410505` | Ingresos por ventas (gravadas) | Crédito | `accounting_accounts` | — needs seeding |
| `419505` | Ingresos por ventas (no gravadas) | Crédito | `accounting_accounts` | — needs seeding |
| `240801` | IVA generado por ventas | Crédito | `accounting_accounts` | — needs seeding |
| `236505` | Rete-ICA retenida | Crédito | `accounting_accounts` | — needs seeding |
| `236040` | Rete-fuente retenida | Crédito | `accounting_accounts` | — needs seeding |
| `143505` | Materias primas / inventario | Débito | `accounting_accounts` | — needs seeding |
| `220505` | Cuentas por pagar (proveedores) | Crédito | `accounting_accounts` | — needs seeding |
| `623505` | Labor confeccionistas | Débito | `accounting_accounts` | — needs seeding |

### `accounting_event_mappings` Table

Each row stores a reusable event code + JSONB config that the engine in `src/utils/accounting-entries.ts` reads to generate `accounting_entry_lines`:

| Column | Type | Notes |
|---|---|---|
| `eventCode` | varchar (unique) | e.g. `CASH_RECEIPT_CONFIRM`, `CASH_RECEIPT_VOID` |
| `sourceModule` | enum | `SALES\|PURCHASES\|PURCHASING\|INVENTORY\|PRODUCTION\|PAYROLL\|TAX\|TREASURY\|BANKING\|GENERAL` |
| `description` | text | Human-readable description |
| `config` | JSONB | Implementation-defined config (line templates, account overrides) |
| `isActive` | boolean | Disabled rows are skipped by the engine |
| `version` | integer | For optimistic concurrency |

> **Note**: The engine functions (`buildCashReceiptAccountingLines`, `postCashReceiptAccountingEntry`, etc.) in `src/utils/accounting-entries.ts` implement the actual line-generation logic — the `config` JSONB is consulted per function.

> **Rule**: Never insert into `accounting_entries` + `accounting_entry_lines` directly from business code. Always call the event mapping engine at `src/utils/accounting-entries.ts`.

---

## `sourceType` Values for `accounting_entries`

| sourceType | sourceId points to |
|---|---|
| `ORDER` | `orders.id` |
| `PAYMENT` | `order_payments.id` |
| `PREFACTURA` | `prefacturas.id` |
| `CASH_RECEIPT` | `cash_receipts.id` |
| `MANUAL` | null (manual journal entry) |

---

## Bidirectional Lookup Index

| "I have a..." | Query to find the order |
|---|---|
| `order_payments.id` | `order_payments.orderId` directly |
| `prefacturas.id` | `prefacturas.orderId` |
| `cash_receipts.id` | `cash_receipts.orderId` (or via payment) |
| `accounting_entries.id` | `accounting_entries.sourceId` + `sourceType` → then FK chain |
| `mesShipments.id` | `mesShipments.orderId` → cross-DB lookup in ERP_DB |
| `operative_dashboard_logs.id` | `operative_dashboard_logs.orderId` → cross-DB |
| `order_items.id` | `order_items.orderId` |
