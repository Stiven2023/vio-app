---
name: "ERP Migration Precheck"
description: "Pre-check completo para migraciones ERP con Drizzle/PostgreSQL: tipos faltantes, enums, constraints, duplicados y riesgo de data-loss."
argument-hint: "Pega error, comando ejecutado y entorno (dev/staging/prod)."
agent: "ERP Migration Fixer"
---
Realiza un pre-check completo antes de ejecutar migraciones ERP.

Entradas esperadas:
- Error actual (si existe).
- Comando usado (por ejemplo: pnpm db:migrate:erp).
- Entorno objetivo (dev/staging/prod).

Objetivo:
1. Detectar causas probables del fallo (tipos faltantes como payment_method, orden de migraciones, drift de esquema).
2. Evaluar riesgo de perdida de datos por constraints o cambios destructivos.
3. Proponer plan de correccion minimo y seguro.
4. Listar comandos de verificacion pre y post cambio.

Formato de salida obligatorio:
1. Diagnostico resumido.
2. Hallazgos por severidad.
3. Consultas/comandos de pre-check.
4. Plan de fix paso a paso (sin ejecutar acciones destructivas en prod sin confirmacion).
5. Criterios de exito para volver a correr la migracion.
