# Inventario / Bodega — Fixes pendientes

Análisis realizado el 11/03/2026. Ordenado por prioridad.

---

## 🔴 Críticos

### 1. Estado de traslados codificado en `notes`
**Archivo:** `app/api/warehouse-transfers/route.ts`, `src/db/schema.ts`

El estado actual de una solicitud de traslado se detecta leyendo prefijos de texto en el campo `notes`:
```
[SOLICITUD PENDIENTE] ...
[SOLICITUD APROBADA] ...
[SOLICITUD RECHAZADA] ...
```
Si alguien edita el campo de notas, el estado queda corrupto.

**Fix:** Agregar columna `status` enum a `stock_movements` (o a una tabla `warehouse_transfer_requests` dedicada).
```sql
-- Opción A: agregar columna status a stock_movements
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS transfer_status varchar(20)
  CHECK (transfer_status IN ('PENDIENTE', 'APROBADA', 'RECHAZADA'));
```
Drizzle: añadir campo `transferStatus: varchar("transfer_status", { length: 20 })` al schema.  
API: reemplazar los filtros de texto `notes LIKE '[SOLICITUD%'` por `WHERE transfer_status = 'PENDIENTE'`.

---

### 2. Sin constraint UNIQUE en `warehouse_stock`
**Archivo:** `src/db/schema.ts`, tabla `warehouseStock`

No existe `UNIQUE(warehouse_id, inventory_item_id, variant_id)`. Pueden generarse filas duplicadas que sumen stock inexistente.

**Fix:**
```sql
ALTER TABLE warehouse_stock
  ADD CONSTRAINT warehouse_stock_unique
  UNIQUE (warehouse_id, inventory_item_id, variant_id);
```
Drizzle: añadir el índice único en la tabla:
```ts
(t) => ({
  uniq: uniqueIndex("warehouse_stock_unique")
    .on(t.warehouseId, t.inventoryItemId, t.variantId),
})
```

---

### 3. `orderItemId` obligatorio en salidas
**Archivo:** `app/api/inventory-outputs/route.ts`

La API rechaza cualquier salida que no tenga un `orderItemId`. Esto imposibilita registrar:
- Bajas por daño o pérdida
- Salidas por muestra
- Consumo interno
- Devoluciones a proveedor

**Fix:** Hacer `orderItemId` opcional. Cuando no se proporciona, exigir `reason` distinto de `VENTA`.
```ts
// Validación actual (❌):
if (!orderItemId) return new Response("orderItemId required", { status: 400 });

// Validación corregida (✅):
if (!orderItemId && reason === "VENTA") {
  return new Response("orderItemId requerido para salidas por venta", { status: 400 });
}
```
UI: en `InventoryOutputModal`, mostrar el campo "Pedido asociado" solo cuando `reason === 'VENTA'`.

---

### 4. `reason` hardcodeado en entradas
**Archivo:** `app/api/inventory-entries/route.ts`

Todas las entradas se registran con `reason = "COMPRA_PROVEEDOR"` sin importar lo que envíe el cliente. No es posible distinguir:
- Devolución de cliente
- Ajuste positivo
- Donación / muestra recibida

**Fix:** Aceptar y validar `reason` desde el body; usarlo al insertar el movimiento.
```ts
const allowedReasons = ["COMPRA_PROVEEDOR", "DEVOLUCION_CLIENTE", "AJUSTE_INVENTARIO", "OTRO"];
const reason = allowedReasons.includes(body.reason) ? body.reason : "COMPRA_PROVEEDOR";
```
UI: añadir campo `reason` en `InventoryEntryModal` (Select con las opciones del enum).

---

## 🟡 Funcionalidad declarada pero no construida

### 5. Sin UI/endpoint para Ajustes y Devoluciones
**Enum `movement_type`:** `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO`, `DEVOLUCION` existen en BD pero no hay endpoint ni UI para crearlos.

**Fix:** Agregar pestaña "Ajustes" en `InventoryTabs` con su modal y endpoint `POST /api/inventory-adjustments`.  
Campos: item → variante → bodega → tipo (AJUSTE_POSITIVO / AJUSTE_NEGATIVO) → cantidad → motivo → notas.

---

### 6. `reservedQty` y `minStock` siempre en 0
**Tabla:** `warehouse_stock`

El campo `reservedQty` nunca se actualiza. El campo `minStock` existe pero nunca se configura ni se usa para alertas.

**Fix (mínimo):**
- Exponer `minStock` editable desde `WarehouseDetailsModal` o `InventoryItemModal`.
- Mostrar alerta visual (chip rojo) cuando `availableQty <= minStock` en la tabla de inventario.
- El sistema de reservas es más complejo y puede quedar para una iteración posterior.

---

## 🟢 Menores

### 7. Permiso incorrecto en CRUD de bodegas
**Archivo:** `app/api/warehouses/route.ts`

POST/PUT/DELETE usan el permiso `CREAR_ORDEN_COMPRA`, semánticamente incorrecto.

**Fix:** Crear permiso `GESTIONAR_BODEGAS` (o reutilizar `EDITAR_ITEM_INVENTARIO`) y aplicarlo a esas rutas. Requiere insertar el nuevo permiso en la tabla `permissions` y asignarlo a los roles Admin / Líder.

---

### 8. Ruta duplicada `/erp/inventory`
**Archivo:** `app/erp/inventory/page.tsx`

Solo hace redirect a `/erp/compras/bodega`. Confunde la navegación.

**Fix:** Unificar en una sola ruta (preferiblemente `/erp/inventory`) y actualizar todos los `href` del navbar y links internos.

---

### 9. `hasVariants` sin uso funcional
**Tabla:** `inventory_items`, campo `has_variants`

En el GET de items el valor siempre se sobrescribe a `true` vía SQL. El campo no tiene efecto en ninguna validación.

**Fix:** O bien eliminarlo del schema (y de las migraciones futuras) o bien usarlo para condicionar si se muestran/obligan variantes en los formularios de entrada/salida.

---

## Orden de implementación sugerido

1. **Fix 2** — UNIQUE constraint (migración no-destructiva, no rompe nada)
2. **Fix 1** — columna `transfer_status` (migración + ajuste API + UI)
3. **Fix 3 + 4** — liberar reason/orderItemId (solo cambios de API + UI, sin BD)
4. **Fix 5** — pestaña Ajustes (nuevo endpoint + modal)
5. **Fix 6** — exponer minStock + alertas visuales
6. **Fix 7** — permiso correcto (requiere seed de BD)
7. **Fix 8 + 9** — limpieza de rutas y campo hasVariants
