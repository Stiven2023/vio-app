---
name: "ERP Migration Safe Fix"
description: "Aplicar fix seguro de migracion ERP con Drizzle/PostgreSQL, minimizando riesgo de data-loss y validando pre/post checks."
argument-hint: "Pega error actual, comando ejecutado y entorno (dev/staging/prod)."
agent: "ERP Migration Fixer"
---
Ejecuta una correccion segura y completa para una migracion ERP fallida.

Entradas esperadas:
- Error actual completo.
- Comando ejecutado (por ejemplo: pnpm db:migrate:erp).
- Entorno objetivo (dev/staging/prod).

Objetivo:
1. Reproducir o validar el error reportado.
2. Identificar causa raiz (tipos faltantes, enums, drift de esquema, orden de migraciones, constraints).
3. Aplicar el fix minimo seguro en codigo/config/schema segun corresponda.
4. Ejecutar verificaciones pre y post cambio.
5. Reintentar la migracion y confirmar resultado.

Reglas de seguridad:
- En produccion o entorno incierto: no ejecutar acciones destructivas sin confirmacion explicita.
- En desarrollo: si se requiere accion destructiva, registrar riesgo/impacto antes de ejecutar.
- Siempre priorizar cambios aditivos y compatibles.

Formato de salida obligatorio:
1. Causa raiz.
2. Archivos modificados y justificacion.
3. Comandos ejecutados y resultados clave.
4. Estado de riesgo de data-loss.
5. Estado final de la migracion y siguientes pasos.
