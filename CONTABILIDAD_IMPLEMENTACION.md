# Implementación de Contabilidad en el Proyecto

## Objetivo
Este documento consolida todo lo implementado en el proyecto relacionado con contabilidad: módulos funcionales, interfaces, endpoints, permisos, reglas de negocio, cálculos y estado actual.

## Alcance revisado
Se revisaron páginas y componentes del módulo contable en ERP, junto con todos los endpoints bajo app/api/contabilidad.

## Mapa funcional del módulo

### Entrada al módulo
- app/erp/contabilidad-modulo/page.tsx redirige a /erp/pre-invoices.

### Submódulos visibles en la navegación de contabilidad
- Cartera
- Retenciones
- Conciliación bancaria
- Factoring
- Recibo de caja
- Caja menor
- Estado de resultados
- Consignaciones
- Accesos puente hacia prefacturas, facturas y remisiones

### Rutas puente (redirigen a otros módulos ERP)
- app/erp/contabilidad-modulo/prefacturas/page.tsx redirige a /erp/pre-invoices.
- app/erp/contabilidad-modulo/facturas/page.tsx redirige a /erp/invoices.
- app/erp/contabilidad-modulo/remisiones/page.tsx redirige a /erp/remissions.
- app/erp/contabilidad-modulo/consignaciones/page.tsx redirige a /erp/depositos.

## Endpoints de contabilidad implementados

### 1) Cartera
Archivo: app/api/contabilidad/cartera/route.ts

Operación:
- GET con paginación y filtros.

Filtros principales:
- q (búsqueda)
- clientId
- taxZone
- paymentType (CASH o CREDIT)
- agingBucket (CURRENT, 1_30, 31_60, 61_90, 90_PLUS)
- creditBacked (true o false)

Reglas y cálculos:
- Valor base de prefactura usa totalAfterWithholdings cuando existe y es mayor a cero; de lo contrario usa total.
- Aplicado se calcula con sumatoria de cashReceiptApplications solo para recibos de caja en estado CONFIRMED.
- Saldo pendiente por documento = max(0, totalBase - aplicado).
- Días de mora se calculan con fecha de aprobación.
- Segmentación de cartera por antigüedad según días de mora.
- Resumen incluye total cartera, vencida, corriente, aplicado y promedio de días de mora.

Permiso requerido:
- VER_CARTERA

Rate limit:
- contabilidad:cartera:get

### 2) Retenciones
Archivo: app/api/contabilidad/retenciones/route.ts

Operación:
- GET con paginación, filtros y resumen.

Filtros principales:
- q
- clientId
- taxZone
- dateFrom, dateTo

Reglas y cálculos:
- Trae prefacturas aprobadas/finalizadas con cliente y zona tributaria.
- Calcula porcentajes por zona: withholdingFuentePercent, withholdingIcaPercent, withholdingIvaPercent.
- Montos retenidos por tipo = totalBase * porcentaje / 100.
- Total retenciones = suma de los tres tipos.
- Neto a pagar = totalBase - total retenciones.
- Resumen agregado por periodo filtrado.

Permiso requerido:
- VER_RETENCIONES

Rate limit:
- contabilidad:retenciones:get

### 3) Conciliaciones bancarias
Archivos:
- app/api/contabilidad/conciliaciones-bancarias/route.ts
- app/api/contabilidad/conciliaciones-bancarias/[id]/close/route.ts

Operaciones:
- GET listado con filtros y resumen.
- POST creación de conciliación.
- POST close para cerrar conciliación existente.

Modelo y reglas:
- Entidad principal de conciliación por banco y periodo.
- Puede incluir ítems de conciliación (transacciones/ajustes).
- Validación para evitar duplicados de banco + periodo.
- Al cerrar:
  - isClosed pasa a true
  - se registran closedAt y closedBy
  - no permite cerrar si ya está cerrada

Permisos requeridos:
- GET: VER_CONCILIACION_BANCARIA
- POST: CREAR_CONCILIACION_BANCARIA
- CLOSE: CERRAR_CONCILIACION_BANCARIA

Rate limit:
- contabilidad:conciliaciones-bancarias:get
- contabilidad:conciliaciones-bancarias:post
- contabilidad:conciliaciones-bancarias:close:post

### 4) Factoring
Archivos:
- app/api/contabilidad/factoring/route.ts
- app/api/contabilidad/factoring/[id]/status/route.ts

Operaciones:
- GET listado de operaciones de factoring.
- POST creación de factoring sobre prefactura elegible.
- PATCH/PUT de estado de factoring (según implementación del handler).

Reglas clave:
- Solo aplica a prefacturas de tipo CREDIT.
- Genera código FAC-######.
- Cálculos típicos:
  - grossAmount desde prefactura
  - discountAmount por tasa de descuento
  - netAmount = grossAmount - discountAmount
- Estados soportados:
  - ACTIVE
  - COLLECTED
  - VOIDED
- Cambios de estado se gestionan en endpoint dedicado de status.

Permisos requeridos:
- VER_FACTORING
- CREAR_FACTORING
- ACTUALIZAR_ESTADO_FACTORING

Rate limit:
- contabilidad:factoring:get
- contabilidad:factoring:post
- contabilidad:factoring:status:patch

### 5) Recibos de caja
Archivos:
- app/api/contabilidad/recibos-caja/route.ts
- app/api/contabilidad/recibos-caja/options/route.ts
- app/api/contabilidad/recibos-caja/[id]/status/route.ts

Operaciones:
- GET listado con paginación/filtros y resumen.
- POST creación de recibo de caja con aplicaciones a prefacturas.
- GET options de prefacturas abiertas por cliente.
- PATCH/PUT de estado del recibo.

Reglas y validaciones:
- Genera código RC-######.
- Estados del recibo:
  - PENDING
  - CONFIRMED
  - VOIDED
- Método de pago normalizado entre UI y BD.
- En creación, valida:
  - datos obligatorios
  - montos positivos
  - que cada aplicación no exceda saldo pendiente del documento
  - consistencia total recibido vs aplicaciones
- Calcula y guarda creditBalance cuando corresponde.
- Dispara notificaciones de negocio tras creación.

Lógica de options:
- Lista prefacturas de cliente.
- Calcula remaining = totalBase - aplicadoConfirmado.
- Devuelve solo documentos con remaining mayor a cero.

Permisos requeridos:
- VER_RECIBO_CAJA
- CREAR_RECIBO_CAJA
- ACTUALIZAR_ESTADO_RECIBO_CAJA

Rate limit:
- cash-receipts:options:get
- contabilidad:recibos-caja:get
- contabilidad:recibos-caja:post
- contabilidad:recibos-caja:status:patch

### 6) Caja menor
Archivos:
- app/api/contabilidad/caja-menor/route.ts
- app/api/contabilidad/caja-menor/funds/route.ts

Operaciones en movimientos:
- GET transacciones de caja menor con filtros y resumen.
- POST creación de transacción.

Operaciones en fondos:
- GET fondos de caja menor.
- POST creación de fondo.

Tipos de transacción soportados:
- EXPENSE
- REPLENISHMENT
- OPENING
- ADJUSTMENT

Reglas y cálculos:
- Para EXPENSE, valida saldo suficiente del fondo.
- Balance nuevo:
  - EXPENSE resta
  - demás tipos suman
- Cada transacción guarda:
  - balanceBefore
  - balanceAfter
  - metadatos de referencia y notas
- Se actualiza currentBalance del fondo en la misma transacción de BD.
- Código de transacción tipo CM-###### con sufijo temporal para reducir colisiones.

Permisos requeridos:
- Movimientos GET: VER_CAJA_MENOR
- Movimientos POST: CREAR_CAJA_MENOR
- Fondos GET: VER_CAJA_MENOR
- Fondos POST: GESTIONAR_CAJA_MENOR

Rate limit:
- contabilidad:caja-menor:get
- contabilidad:caja-menor:post
- contabilidad:caja-menor-funds:get
- contabilidad:caja-menor-funds:post

### 7) Estado de resultados
Archivo: app/api/contabilidad/estado-resultados/route.ts

Operación:
- GET por año y granularidad de periodo (monthly, quarterly, annual).

Fuentes de datos usadas para el PYG operativo:
- Ingresos: prefacturas aprobadas/finalizadas (excluye anuladas y pendientes de contabilidad).
- Costo de ventas: purchase_orders finalizadas/recibidas/aprobadas.
- Nómina: payroll_provisions por periodo.
- Gastos operativos: petty_cash_transactions tipo EXPENSE.

Métricas calculadas:
- revenue
- cogs
- grossProfit
- grossMargin
- payroll
- totalOperatingExpenses
- totalOperatingCosts
- operatingIncome
- operatingMargin

Salida:
- periods
- byPeriod
- summary con todos los totales y márgenes

Permiso requerido:
- VER_ESTADO_RESULTADOS

Rate limit:
- contabilidad:estado-resultados:get

### 8) Consignaciones
Archivos:
- app/api/contabilidad/consignaciones/route.ts
- app/api/contabilidad/consignaciones/[id]/status/route.ts

Operaciones:
- GET listado de consignaciones desde orderPayments con filtros y resumen.
- PUT cambio de estado de consignación.

Filtros principales:
- q
- bank
- method (EFECTIVO, TRANSFERENCIA, CREDITO)
- currency
- dateFrom, dateTo
- status

Estados contemplados:
- PENDIENTE
- PARCIAL
- PAGADO
- ANULADO
- CONFIRMADO_CAJA

Normalización de estado en update:
- CONSIGNADO se mapea a PAGADO.
- DESECHADO/NO_CONSIGNADO se mapean a ANULADO.

Cálculo adicional por fila:
- creditBalance = max(0, depositAmount - orderTotal)

Permisos requeridos:
- GET: VER_PEDIDO
- PUT status: APROBAR_PAGO

Rate limit:
- contabilidad:consignaciones:get
- contabilidad:consignaciones:status:put

## Permisos de contabilidad observados
- VER_CARTERA
- VER_RETENCIONES
- VER_CONCILIACION_BANCARIA
- CREAR_CONCILIACION_BANCARIA
- CERRAR_CONCILIACION_BANCARIA
- VER_FACTORING
- CREAR_FACTORING
- ACTUALIZAR_ESTADO_FACTORING
- VER_RECIBO_CAJA
- CREAR_RECIBO_CAJA
- ACTUALIZAR_ESTADO_RECIBO_CAJA
- VER_CAJA_MENOR
- CREAR_CAJA_MENOR
- GESTIONAR_CAJA_MENOR
- VER_ESTADO_RESULTADOS
- VER_PEDIDO
- APROBAR_PAGO

## Patrones técnicos comunes
- Todos los endpoints revisados aplican rate limiting.
- Todos los endpoints revisados aplican control de permisos por endpoint.
- La capa de persistencia usa Drizzle ORM y SQL expresivo para agregados.
- Se usa parsePagination en listados largos.
- El manejo de errores DB se centraliza con dbErrorResponse.

## Integraciones contables entre módulos
- Cartera y recibos de caja se integran por cashReceiptApplications y estado CONFIRMED.
- Retenciones usa configuración tributaria por zona del cliente.
- Estado de resultados consume datos de ventas, compras, nómina y caja menor.
- Consignaciones reutiliza pagos de pedidos y bancos.

## Hallazgos y brechas

### Cobertura sólida
- Existe cobertura funcional para cuentas por cobrar, retenciones, conciliación bancaria, factoring, recibos de caja, caja menor, consignaciones y PYG operativo.
- El modelo de permisos está distribuido por responsabilidad.
- Se observan validaciones importantes de negocio en creación y transición de estados.

### Riesgos o mejoras sugeridas
- Estandarizar mensajes de error y respuestas entre endpoints (actualmente hay mezcla de español/inglés y formatos distintos).
- Formalizar máquina de estados de cada submódulo en un contrato compartido para frontend y backend.
- Revisar consistencia de permisos para consignaciones dentro del módulo contable, ya que usa permisos de pedidos/pagos.
- Evaluar idempotencia y concurrencia en generación de consecutivos (RC, FAC, CM), aunque ya hay mitigaciones parciales y restricciones de base de datos.
- Definir pruebas automáticas de regresión para cálculos críticos: aging, retenciones, saldo pendiente y márgenes del estado de resultados.

## Conclusión
El proyecto tiene una implementación contable amplia y operativa, con reglas de negocio relevantes ya codificadas en backend y consumo en UI del ERP. La base actual permite operación diaria de cartera, recaudo, retenciones y control operativo, con oportunidades de mejora en estandarización de contratos, pruebas y consistencia transversal de mensajes/estados.
