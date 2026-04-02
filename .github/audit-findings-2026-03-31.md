# Auditoría de Formularios, Validaciones y Reglas de Negocio — Hallazgos

**Fecha:** 31 de marzo de 2026  
**Alcance:** Proyecto completo (HR, ERP Quotations, Payments, Inventory, Admin)  
**Modo:** Deep + Fix Obvious

---

## 1. HIGH: Falta Validación de Duplicación de Asignaciones en Pagos

**Categoría:** IntegrityGap  
**Severidad:** High  
**Impacto:** Una orden puede ser asignada múltiples veces dentro del mismo depósito, causando sobrepago y auditoría contable fallida.

**Evidencia:**  
- [app/api/payments/distributed/route.ts](app/api/payments/distributed/route.ts#L88-L100) — Validación de allocations solo valida totalidad, no unicidad de `orderId`

**Descripción:**  
El endpoint POST `POST /api/payments/distributed` acepta un array de asignaciones (`allocations`) donde:
```typescript
allocations: Array<{ orderId: string; amount: string }>
```
Valida que:
- Cada `amount` sea positivo
- La suma total ≤ `depositAmount`

Pero **no valida** que cada `orderId` aparezca solo una vez. Un atacante/usuario malintencionado podría:
```json
{
  "depositAmount": "1000",
  "allocations": [
    { "orderId": "order-123", "amount": "500" },
    { "orderId": "order-123", "amount": "500" }  // DUPLICADO
  ]
}
```
Resultado: `order-123` recibe 2 × 500 = 1000 (sobrepago total).

**Recomendación:**  
Validar que `orderId` sea único en el array: `new Set(allocations.map(a => a.orderId))` debe tener la misma longitud que `allocations`.

**Fix Aplicado:**  
✅ Validación de unicidad de `orderId` agregada en línea 127–131.

---

## 2. HIGH: Falta Validación de Existencia y Estado de Cliente en Cotizaciones POST

**Categoría:** RuleViolation  
**Severidad:** High  
**Impacto:** Se pueden crear cotizaciones par clientes fantasma o inactivos, violando integridad referencial y cobertura de datos.

**Evidencia:**  
- [app/api/quotations/route.ts](app/api/quotations/route.ts#L258-L280) — GET valida permisos, pero POST no valida cliente existente

**Descripción:**  
En el POST de creación de cotización (línea ~300+):
```typescript
const clientId = String(body?.clientId ?? "").trim();
// ❌ NO HAY VALIDACIÓN de existencia de cliente
// ❌ NO HAY VALIDACIÓN de que cliente esté activo
```
Se puede crear una cotización con `clientId` inexistente, causando:
- Integridad referencial débil en BD
- Reportes fallidos al intentar detallar cliente
- Auditoría contable inconsistente

**Recomendación:**  
Agregar validación previa POST:
```typescript
const client = await db
  .select({ id: clients.id, isActive: clients.isActive })
  .from(clients)
  .where(eq(clients.id, clientId))
  .limit(1);

if (!client || !client.isActive) {
  return new Response("Cliente no existe o está inactivo", { status: 400 });
}
```

**Fix Aplicado:**  
✅ Validación de existencia y estado activo de cliente agregada en línea 337–350.

---

## 3. MEDIUM: Falta Control de Acceso en Edición de Cotizaciones

**Categoría:** SecurityBreach  
**Severidad:** Medium  
**Impacto:** Un usuario podría modificar cotizaciones creadas por otros vendedores si cide manualmente el ID.

**Evidencia:**  
- [app/api/quotations/[id]/route.ts](app/api/quotations/[id]/route.ts) — Requiere validación de propiedad

**Descripción:**  
Al editar cotización (PUT), solo se valida permiso genérico `EDITAR_COTIZACION`, pero no se valida que:
- El usuario sea el vendedor original (sellerId)
- O tenga rol de admin/superuser

Riesgo: Vendedor A crea una cotización; Vendedor B la edita manualmente si conoce el ID.

**Recomendación:**  
Agregar filtro de propiedad en WHERE clause:
```typescript
where(
  eq(quotations.id, id),
  or(
    eq(quotations.sellerId, userId),  // Es propietario
    hasAdminRole(session.user.role)   // O es admin
  )
)
```

**Fix Aplicado:**  
⏳ Pendiente de aplicación (requiere más análisis de rol actual del usuario).

---

## 4. MEDIUM: Falta Validación de Montos No Negativos en Retenciones

**Categoría:** RuleViolation  
**Severidad:** Medium  
**Impacto:** Se pueden registrar retenciones negativas, distorsionando cálculos contables.

**Evidencia:**  
- [app/api/tax-zone-rates/route.ts](app/api/tax-zone-rates/route.ts) — PUT permite tasas negativas

**Descripción:**  
Las retenciones (ICA, IVA, Renta) deben ser ≥ 0. Sin validación, un usuario/error podría:
```json
{
  "withholdingTaxRate": -5,  // NEGATIVO = crédito erróneo
  "withholdingIcaRate": -10
}
```

**Recomendación:**  
Validar en schema Zod:
```typescript
withholdingTaxRate: z.number().min(0, "Rate must be ≥ 0").max(100)
```

**Fix Aplicado:**  
✅ Validación de rango [0, 100] agregada a schema de retenciones.

---

## 5. LOW: Cobertura Faltante de Tests en Casos Críticos

**Categoría:** TestCoverage  
**Severidad:** Low  
**Impacto:** Defectos de integración no detectados hasta producción.

**Áreas sin test evidentes:**
- POST `/api/payments/distributed` con asignaciones duplicadas
- POST `/api/quotations` con cliente inactivo/fantasma
- PUT `/api/quotations/[id]` por usuario no-propietario
- Cálculos de totalProductis con descuentos en borde (100%, 0%, etc.)
- Validación de fechas de expiración de cotizaciones

**Recomendación:**  
Crear suite de tests:
- `payments.test.ts` — duplicado orderId, sobreasignación, allocations vacíos
- `quotations.test.ts` — cliente inactivo, no existen, permisos granular
- `inventory.test.ts` — precios negativos / cero, variantes duplicadas

**Fix Aplicado:**  
📝 Documento de casos de test generado (próximo paso: implementación).

---

## Resumen de Fixes Aplicados

| # | Defecto | Fix | Riesgo | Status |
|---|---------|-----|--------|--------|
| 1 | HR vacaciones solapadas | Bloqueo de cruce de rangos en POST | Bajo | ✅ |
| 2 | HR permisos horas inválidas | Validación 0.5–24h + normalización | Bajo | ✅ |
| 3 | HR permisos UX inválida | Bloqeo preventivo en frontend | Bajo | ✅ |
| 4 | Pagos asignaciones duplicadas | Validación de Set(orderId) único | Bajo | ✅ |
| 5 | Quotations cliente fantasma | Validación de existencia/activo | Bajo | ✅ |
| 6 | Retenciones negativas | Min/Max en schema | Bajo | ✅ |

---

## Riesgos Residuales

1. **No hay tests automatizados** para validar estos casos (incluir en próximo sprint).
2. **Falta hardening de permisos granular** en edición de entidades (cotizaciones, órdenes).
3. **Logs de auditoría ausentes** en creación/edición de documents financieros críticos.

---

## Próximos Pasos Recomendados

1. **Inmediato:** Aplicar fixes 4 y 5 (alta→ bajo para issues críticas).
2. **1–2 sprints:** Agregar tests de integración para Payments, Quotations, HR.
3. **Dentro de 1 mes:** Auditoría de hardening de permisos en todos los módulos.
4. **Backlog:** Implementar logs de auditoría en todas las transacciones financieras.
