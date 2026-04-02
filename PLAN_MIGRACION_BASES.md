# PLAN_MIGRACION_BASES

## Objetivo
Alinear el codigo de la app Next.js con 4 bases de datos separadas (ERP_DB, MES_DB, CRM_DB, IAM_DB), manteniendo compatibilidad durante la transicion.

## Estado asumido
- Las 4 bases ya existen en Postgres.
- Esta fase prioriza alinear codigo y conexiones por dominio.
- CRM queda preparado sin tablas en esta iteracion.

## Variables de entorno requeridas
- ERP_DATABASE_URL
- MES_DATABASE_URL
- CRM_DATABASE_URL
- IAM_DATABASE_URL

## Mapeo de dominios en codigo
- ERP schema: src/db/erp/schema.ts
- MES schema: src/db/mes/schema.ts
- IAM schema: src/db/iam/schema.ts
- CRM schema: src/db/crm/schema.ts (placeholder)

## Checklist de alineacion codigo -> DB
1. Confirmar .env.local con las 4 URLs correctas.
2. Ejecutar migraciones por dominio:
   - pnpm db:migrate:erp
   - pnpm db:migrate:mes
   - pnpm db:migrate:iam
   - pnpm db:migrate:crm
3. Validar typecheck: pnpm -s tsc --noEmit
4. Validar build: pnpm build

## Checklist de movimiento de datos (si vienes de una sola DB)
1. Respaldar base origen completa.
2. Exportar tablas IAM y restaurarlas en IAM_DB:
   - users, roles, permissions, role_permissions, email_verification_tokens, password_reset_tokens, external_access_otps
3. Exportar tablas MES y restaurarlas en MES_DB:
   - mes_production_queue, mes_ticket_assignments, mes_item_tags, mes_envios, mes_envio_items, operative_dashboard_logs
4. Mantener tablas ERP/HCM en ERP_DB en esta fase.
5. CRM_DB queda sin tablas por ahora (solo conexion preparada).

Ejemplo por tabla con pg_dump/pg_restore:
```bash
pg_dump -h localhost -U postgres -d DB_ORIGEN -t mes_production_queue -f mes_production_queue.sql
psql -h localhost -U postgres -d MES_DB -f mes_production_queue.sql
```

## Regla de referencias cruzadas
- No usar FKs entre bases distintas.
- En MES e IAM usar UUID externos sin .references para ids que viven en ERP/IAM externos.
- Agregar indices en esos external ids para performance.

## Validaciones post migracion
1. Conteo de filas por tabla origen vs destino.
2. Smoke queries de lectura/escritura por dominio.
3. Verificacion de tablas MES/IAM sin FKs cruzadas.
4. Verificacion de endpoints criticos por dominio.

## Estrategia de transicion
- src/db/index.ts mantiene export db (compatibilidad) apuntando temporalmente a ERP.
- src/db/schema.ts se conserva como capa legacy durante la migracion progresiva de imports.
- Migrar imports por dominio de forma incremental hasta eliminar dependencia del schema monolitico.
