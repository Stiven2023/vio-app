---
description: "Use when: migraciones Drizzle/PostgreSQL, db:migrate:erp, cambios de schema, constraints, enums, o cualquier operacion SQL con riesgo de perdida de datos."
name: "No Data Loss Migrations Policy"
---
# No Data Loss Policy for Migrations

Aplica esta politica al trabajar en migraciones y cambios de esquema:

- No ejecutar automaticamente `truncate`, `drop`, `delete masivo`, `reset`, ni comandos equivalentes en entornos productivos o inciertos.
- Antes de aplicar constraints `unique`, validar duplicados con consultas de diagnostico y reportar impacto.
- Priorizar cambios aditivos y compatibles (crear tipo/enum faltante, backfill, rename seguro, migraciones en etapas).
- Si una accion destructiva es inevitable, documentar:
  - riesgo,
  - tablas/filas impactadas,
  - consulta de verificacion previa,
  - plan de rollback.
- En desarrollo se permite automatizar acciones destructivas solo cuando el usuario lo haya solicitado para ese flujo y quede registrada la justificacion.

Checklist minimo antes de ejecutar cambios:
1. Confirmar base de datos objetivo y entorno.
2. Ejecutar pre-check de integridad (duplicados, nulos, tipos faltantes, FKs rotas).
3. Mostrar el plan exacto de comandos SQL o CLI.
4. Ejecutar verificaciones post-cambio y resumir resultado.
