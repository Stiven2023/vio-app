# DB English Rename Plan

## Current state

- [src/db/erp/schema.ts](src/db/erp/schema.ts) now exposes only the ERP subset instead of re-exporting the full monolithic schema.
- The physical SQL schema is still mixed: most table names are already in English, but some legacy identifiers remain in Spanish.
- The safest immediate step is to introduce English TypeScript aliases first, then apply physical SQL renames with explicit Drizzle migrations.

## First batch already addressed

- `prefacturas` -> `preInvoices` alias in ERP schema facade.
- `moldingTemplateInsumos` -> `moldingTemplateSupplies` alias in ERP schema facade.
- `orderItemMoldingInsumos` -> `orderItemMoldingSupplies` alias in ERP schema facade.

## Remaining high-priority physical renames

### ERP tables

- `prefacturas` -> `pre_invoices`

### MES tables

- `mes_envios` -> `mes_shipments`
- `mes_envio_items` -> `mes_shipment_items`

### High-risk Spanish columns to migrate in a dedicated batch

- `origen_area` -> `origin_area`
- `origen_nombre` -> `origin_name`
- `destino_area` -> `destination_area`
- `destino_nombre` -> `destination_name`
- `transporte_tipo` -> `transport_type`
- `transportista_empleado_id` -> `carrier_employee_id`
- `transportista_nombre` -> `carrier_name`
- `empresa_tercero` -> `third_party_company`
- `guia_numero` -> `guide_number`
- `requiere_segunda_parada` -> `requires_second_stop`
- `segunda_parada_tipo` -> `second_stop_type`
- `segunda_parada_destino` -> `second_stop_destination`
- `observaciones` -> `observations`
- `evidencia_url` -> `evidence_url`
- `salida_at` -> `departed_at`
- `llegada_at` -> `arrived_at`
- `retorno_at` -> `returned_at`
- `envio_id` -> `shipment_id`

## Execution order

1. Keep adding English aliases at the TypeScript layer for the remaining legacy identifiers.
2. Migrate API/routes/components to the English aliases first.
3. Generate Drizzle migrations for physical SQL renames per database, not in one global batch.
4. Deploy with backward-compatible code only after each DB migration is verified in staging.

## Guardrails

- Do not rename physical columns and table names across ERP, MES, IAM at once.
- Keep compatibility aliases until every import and query stops using the Spanish identifiers.
- Validate each batch with `pnpm -s tsc --noEmit` before moving to the next one.