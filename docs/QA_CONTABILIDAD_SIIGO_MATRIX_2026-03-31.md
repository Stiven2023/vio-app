# QA Matrix - Contabilidad + SIIGO (Beta)

Fecha: 2026-03-31
Alcance: prefacturas, facturas, remisiones, estado SIIGO, sincronizacion de productos, controles admin.
Modalidad: ejecucion manual asistida + smoke tecnico.

## 1. Objetivo

Validar que el flujo contable en vio-app cumpla reglas de negocio y sincronizacion con SIIGO en ambiente beta:
- Tipo F se envia a SIIGO.
- Tipo R no se envia a SIIGO y no liquida IVA.
- Productos quedan mapeados antes de facturar.
- Estado SIIGO y errores quedan trazables en UI.
- Reset SIIGO aplica solo en flujos permitidos.

## 2. Precondiciones

1. Variables de entorno configuradas:
- SIIGO_TOKEN o SIIGO_API_TOKEN
- SIIGO_PARTNER_ID
- SIIGO_INVOICE_DOCUMENT_ID
- SIIGO_IVA_TAX_ID
- SIIGO_SELLER_ID
- SIIGO_PAYMENT_METHOD_ID
- SIIGO_PRODUCT_ACCOUNT_GROUP

2. Datos minimos en base:
- Cliente activo con identificacion valida.
- Al menos 2 productos activos para una orden.
- Una prefactura tipo F en estado editable.
- Una prefactura tipo R en estado editable.
- Usuario admin y usuario no admin.

3. Build y typecheck en verde antes de pruebas:
- pnpm -s tsc --noEmit
- pnpm build

## 3. Criterios de aprobacion global

1. No hay errores bloqueantes en envio F a SIIGO con datos validos.
2. Tipo R queda en NOT_APPLICABLE y no dispara envio.
3. Errores SIIGO quedan persistidos y visibles para soporte.
4. UI bloquea edicion en estados comprometidos con SIIGO.
5. Reset SIIGO no rompe trazabilidad y respeta permisos.

## 4. Matriz de casos

Formato de resultado por caso:
- PASS: cumple resultado esperado.
- FAIL: incumple o genera efecto lateral.
- BLOCKED: no ejecutable por falta de dato o servicio.

### Caso 01 - Envio exitoso de prefactura F

ID: SIIGO-F-01
Prioridad: Alta
Riesgo: Facturacion detenida

Pasos:
1. Abrir prefactura tipo F con items validos.
2. Click en Enviar a SIIGO.
3. Esperar respuesta API.

Esperado:
- API retorna exito.
- Se guarda invoice_id SIIGO.
- Estado pasa a SENT o DRAFT segun respuesta.
- Prefactura queda bloqueada para edicion normal.

Evidencia:
- Captura de UI con estado SIIGO.
- Respuesta de red del endpoint de envio.

### Caso 02 - Bloqueo de envio para tipo R

ID: SIIGO-R-01
Prioridad: Alta
Riesgo: Incumplimiento fiscal

Pasos:
1. Abrir prefactura tipo R.
2. Intentar enviar a SIIGO.

Esperado:
- API responde 400 o bloqueo funcional.
- Estado SIIGO permanece o pasa a NOT_APPLICABLE.
- No se crea invoice_id en SIIGO.

Evidencia:
- Mensaje de error funcional.
- Registro en UI con estado N/A o equivalente.

### Caso 03 - R no liquida IVA

ID: SIIGO-R-02
Prioridad: Alta
Riesgo: Error tributario

Pasos:
1. Crear/editar prefactura R con productos gravados y no gravados.
2. Guardar y revisar totales.

Esperado:
- IVA en remision tipo R es 0.
- Totales no incluyen componente de IVA.

Evidencia:
- Captura de totales antes y despues.

### Caso 04 - Auto sync de productos faltantes

ID: SIIGO-PROD-01
Prioridad: Alta
Riesgo: Factura rechazada por codigos

Pasos:
1. Tomar prefactura F con al menos un producto sin mapping SIIGO.
2. Ejecutar envio a SIIGO.

Esperado:
- Sistema intenta sincronizar producto automaticamente.
- Si sync ok, continua facturacion.
- Si sync falla, registra ERROR con detalle.

Evidencia:
- Estado del producto mapeado.
- Mensaje de error detallado si falla.

### Caso 05 - Error por configuracion incompleta

ID: SIIGO-CONF-01
Prioridad: Alta
Riesgo: Caida operativa en produccion

Pasos:
1. Remover temporalmente una variable critica (ej. SIIGO_SELLER_ID) en entorno de pruebas.
2. Intentar envio F.

Esperado:
- Falla temprana con mensaje claro de configuracion faltante.
- No se genera envio parcial.
- UI muestra error trazable.

Evidencia:
- Mensaje exacto de validacion.

### Caso 06 - Poll manual de estado SIIGO

ID: SIIGO-POLL-01
Prioridad: Media
Riesgo: Seguimiento inexacto

Pasos:
1. Seleccionar prefactura en SENT o DRAFT.
2. Ejecutar Actualizar estado SIIGO.

Esperado:
- Se consulta invoice por id SIIGO.
- Se actualiza estado local (ACCEPTED, REJECTED, etc.).
- Se persiste numero legal y CUFE cuando aplique.

Evidencia:
- Cambio de estado en tabla.
- Datos legales visibles si existen.

### Caso 07 - Manejo de rechazo SIIGO

ID: SIIGO-ERR-01
Prioridad: Alta
Riesgo: Perdida de trazabilidad

Pasos:
1. Forzar payload invalido en ambiente controlado (dato fiscal incorrecto).
2. Enviar prefactura F.

Esperado:
- Estado pasa a ERROR o REJECTED.
- Mensaje de SIIGO queda almacenado en tracking.
- UI permite ver detalle de error.

Evidencia:
- Mensaje persistido y visible en interfaz.

### Caso 08 - Reset SIIGO por admin

ID: SIIGO-ADM-01
Prioridad: Media
Riesgo: Reproceso sin control

Pasos:
1. Ingresar con perfil admin.
2. Ejecutar Reset SIIGO en prefactura con tracking.
3. Repetir con usuario no admin.

Esperado:
- Admin: reset permitido y estado coherente para reproceso.
- No admin: accion denegada.
- Queda registro de operacion (si aplica auditoria).

Evidencia:
- Resultado por rol.

### Caso 09 - Bloqueo de edicion por estado SIIGO

ID: SIIGO-LOCK-01
Prioridad: Alta
Riesgo: Inconsistencia documento-factura

Pasos:
1. Tomar prefactura con estado SIIGO comprometido (SENT/DRAFT/INVOICED/ACCEPTED).
2. Intentar editar campos sensibles.

Esperado:
- UI y/o backend bloquean edicion.
- Mensaje explica motivo.

Evidencia:
- Captura de bloqueo.

### Caso 10 - Idempotencia basica de envio

ID: SIIGO-IDEMP-01
Prioridad: Media
Riesgo: Duplicado de factura

Pasos:
1. En prefactura F ya enviada, intentar reenvio sin reset.

Esperado:
- Reenvio bloqueado.
- No se genera nuevo invoice_id.

Evidencia:
- Comparacion antes/despues de tracking.

## 5. Smoke tecnico recomendado

1. Typecheck:
- pnpm -s tsc --noEmit

2. Build:
- pnpm build

3. Verificacion de rutas API principales (manual/API client):
- POST /api/prefacturas/{id}/siigo/send
- POST /api/prefacturas/{id}/siigo/poll
- POST /api/prefacturas/{id}/siigo/reset
- POST /api/siigo/products/sync

## 6. Registro de ejecucion sugerido

Por cada caso, documentar:
- Resultado: PASS/FAIL/BLOCKED
- Ambiente y fecha/hora
- Usuario/rol ejecutor
- ID prefactura usada
- Evidencia (captura/log)
- Observacion breve

## 7. Defectos y severidad

- Critico: incumplimiento fiscal, duplicado de factura, perdida de integridad.
- Alto: bloqueo operativo de envio o tracking.
- Medio: error de UX con workaround.
- Bajo: texto/copy no bloqueante.

## 8. Evidencia tecnica de ejecucion (2026-03-31)

Resultado actual en este workspace:
1. Typecheck: PASS
2. Build: PASS
3. Regression tests: PASS (6/6)

Detalle de regression tests ejecutados:
- vacaciones: detecta solapamiento de rangos
- permisos: horas entre 0.5 y 24
- permisos: normalizacion de horas por tipo
- pagos distribuidos: duplicados de orderId
- cotizaciones: elegibilidad de cliente
- retenciones: tasa en rango [0,100]

Nota:
- Esta evidencia confirma salud tecnica base, pero no reemplaza la ejecucion funcional de los casos SIIGO de esta matriz.
