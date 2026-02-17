# 📊 Diseño de Schema ERP - Viomar NEXT

## 📝 Documento de Especificación de Base de Datos
**Fecha**: 17 de Febrero 2026  
**Estado**: PENDIENTE APROBACIÓN  
**Responsable**: Sistema ERP Fase 1

---

## 🎯 Resumen Ejecutivo

Este documento define **EXACTAMENTE** qué campos va a tener cada tabla nueva y modificada en el sistema ERP. 

**Nuevas Tablas**: 5  
**Tablas Existentes Modificadas**: 2  
**Nuevos Enums**: 2

---

## 1️⃣ ENUMS NUEVOS

### `clientTypeEnum`
```sql
CREATE TYPE client_type AS ENUM (
  'HABITUALES',
  'COLANTA',
  'MAYORISTA',
  'AUTORIZADO'
);
```

### `identificationTypeEnum` - Tipos de Identificación
```sql
CREATE TYPE identification_type AS ENUM (
  'CC',   -- Cédula de Ciudadanía
  'NIT',  -- Número de Identificación Tributaria
  'CE',   -- Cédula de Extranjería
  'PAS'   -- Pasaporte
);
```

### `taxRegimeEnum` - Régimen Tributario
```sql
CREATE TYPE tax_regime AS ENUM (
  'REGIMEN_COMUN',
  'REGIMEN_SIMPLIFICADO',
  'NO_RESPONSABLE'
);
```

### `clientStatusEnum` - Estado del Cliente
```sql
CREATE TYPE client_status AS ENUM (
  'ACTIVO',
  'INACTIVO',
  'SUSPENDIDO'
);
```

### `salesChannelEnum`
```sql
CREATE TYPE sales_channel AS ENUM (
  'WEB',
  'TIENDA',
  'MAYORISTA'
);
```

### `designImageTypeEnum` - Tipos de Fotos de Diseño
```sql
CREATE TYPE design_image_type AS ENUM (
  'REFERENCIA_CONJUNTO',      -- Foto del conjunto completo
  'PARTE_SUPERIOR',           -- Parte superior (pecho, etc)
  'PARTE_INFERIOR',           -- Parte inferior (cintura, etc)
  'DETALLE_TELA',            -- Muestra de tela
  'ESPECIFICACION_TECNICA',  -- Diagrama técnico
  'OTRO'
);
```

### `confectionistStatusEnum` - Estados Reportados por Confeccionista
```sql
CREATE TYPE confectionist_status AS ENUM (
  'RECIBIDO_COMPLETO',        -- Diseño recibido sin problemas
  'RECIBIDO_FALTA_ITEMS',     -- Recibió pero faltan cosas
  'PROBLEMA_CALIDAD',         -- Problema en especificaciones
  'EN_PRODUCCION',            -- Actualmente en producción
  'LISTO_ENVIO',              -- Listo para enviar a Viomar
  'ENVIADO_A_VIOMAR'          -- Ya fue enviado
);
```

### `shipmentStatusEnum` - Estados de Envío/Trayecto
```sql
CREATE TYPE shipment_status AS ENUM (
  'PENDIENTE',                -- Aún no parte
  'EN_TRAYECTO',              -- En el camino
  'ENTREGADO',                -- Entregado en destino
  'DEVUELTO',                 -- Problemas, se devuelve
  'PERDIDO',                  -- Problemas, se perdió
  'CANCELADO'
);
```

### `packagingStatusEnum` - Estados de Empaque/Despacho
```sql
CREATE TYPE packaging_status AS ENUM (
  'PENDIENTE_RECEPCION',      -- Esperando recibir de confeccionista
  'RECIBIDO_CONFORME',        -- Recibió tal como lo reportó confeccionista
  'RECIBIDO_CON_DISCREPANCIA', -- No coincide con reporte
  'VERIFICADO',               -- Ya revisaron y está OK
  'LISTO_DESPACHO',           -- Listo para enviar al cliente
  'DESPACHADO'                -- Ya salió a cliente
);
```

---

## 2️⃣ TABLAS NUEVAS

### A. `client_types` - Tipos de Cliente
**Propósito**: Definir categorías de cliente con descuentos asociados  
**Relaciones**: ← `clients` (1:many), → `pricing_tiers` (1:many)

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | Identificador único |
| name | varchar(100) | UNIQUE, NOT NULL | Nombre del tipo (HABITUALES, COLANTA, MAYORISTA, AUTORIZADO) |
| description | text | NULLABLE | Descripción del tipo de cliente |
| discount_percentage | numeric(5,2) | DEFAULT 0 | Descuento adicional (ej: 10.50%) |
| is_active | boolean | DEFAULT true | Activo/Inactivo |
| created_at | timestamp | DEFAULT now() | Fecha creación |

**Seed Data Ejemplo**:
```json
[
  { "name": "HABITUALES", "description": "Clientes regulares sin descuento", "discount_percentage": 0 },
  { "name": "COLANTA", "description": "Cliente especial Colanta", "discount_percentage": 5 },
  { "name": "MAYORISTA", "description": "Cliente mayorista", "discount_percentage": 15 },
  { "name": "AUTORIZADO", "description": "Distribuidor autorizado", "discount_percentage": 20 }
]
```

---

### A.1 `clients` - ESTRUCTURA COMPLETA PARA PREFACTURA ⭐
**Propósito**: Clientes con TODOS los campos obligatorios según especificación real del negocio  
**Relaciones**: ← `client_types` (many:1), → `orders` (1:many)

**📋 TABLA COMPLETA - 25 CAMPOS**:

| # | Campo BD | Tipo | Constraints | Descripción | Ejemplo Real |
|---|----------|------|-------------|-------------|--------------|
| 1 | **id** | uuid | PRIMARY KEY | Código cliente (generado automático) | uuid |
| 2 | **name** | varchar(255) | NOT NULL | Nombre tercero | "STIVEN ALEXIS AGUIRRE CARDONA" |
| 3 | **identification_type** | varchar(10) | NOT NULL, DEFAULT 'CC' | Tipo identificación (CC/NIT) | "CC" |
| 4 | **identification** | varchar(20) | UNIQUE, NOT NULL | Número cédula o NIT | "1011392373" |
| 5 | **verification_digit** | varchar(1) | NULLABLE | Dígito verificación (solo NIT) | "5" |
| 6 | **branch** | varchar(10) | NOT NULL | Sucursal | "01" |
| 7 | **tax_regime** | varchar(50) | NOT NULL | Tipo régimen IVA | "REGIMEN_COMUN" |
| 8 | **address** | varchar(255) | NOT NULL | Dirección física completa | "CR 33A CL 107A 19" |
| 9 | **postal_code** | varchar(10) | NOT NULL | Código postal | "5001" |
| 10 | **country** | varchar(100) | NOT NULL, DEFAULT 'COLOMBIA' | País | "COLOMBIA" |
| 11 | **department** | varchar(100) | NOT NULL | Departamento | "ANTIOQUIA" |
| 12 | **city** | varchar(100) | NOT NULL | Ciudad | "Medellín" |
| 13 | **international_code** | varchar(5) | NOT NULL, DEFAULT '57' | Código marcación internacional | "57" |
| 14 | **mobile** | varchar(10) | NOT NULL | **Móvil (CRÍTICO)** | "3001234567" |
| 15 | **full_mobile** | varchar(20) | GENERATED/CALCULATED | Código + móvil (57 + móvil) | "573001234567" |
| 16 | **local_code** | varchar(5) | NULLABLE, DEFAULT '604' | Código marcación local | "604" |
| 17 | **phone** | varchar(15) | NULLABLE | Teléfono fijo | "0" |
| 18 | **extension** | varchar(10) | NULLABLE | Extensión telefónica | "" |
| 19 | **full_phone** | varchar(30) | GENERATED/CALCULATED | Código + fijo + ext | "0" |
| 20 | **email** | varchar(255) | NOT NULL | **Email (CRÍTICO)** | "stiven@email.com" |
| 21 | **contact_name** | varchar(255) | NOT NULL | Nombre de contacto | "STIVEN ALEXIS AGUIRRE CARDONA" |
| 22 | **status** | varchar(20) | NOT NULL, DEFAULT 'ACTIVO' | Estado (ACTIVO/INACTIVO) | "ACTIVO" |
| 23 | **has_credit** | boolean | NOT NULL, DEFAULT false | ¿Tiene crédito? | true/false |
| 24 | **promissory_note_number** | varchar(50) | NULLABLE | Número pagaré | "PAG-2026-001" |
| 25 | **promissory_note_date** | date | NULLABLE | Fecha firma pagaré | "2026-02-17" |
| - | **client_type_id** | uuid | FOREIGN KEY | Tipo cliente ERP | uuid-HABITUALES |
| - | **is_active** | boolean | DEFAULT true | Control sistema (deprecar status) | true |
| - | **created_at** | timestamp | DEFAULT now() | Fecha creación | 2026-02-17 |

**Definición SQL Completa**:
```sql
CREATE TABLE clients (
  -- 1. ID
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 2-5. IDENTIFICACIÓN
  name varchar(255) NOT NULL,
  identification_type varchar(10) NOT NULL DEFAULT 'CC',
  identification varchar(20) UNIQUE NOT NULL,
  verification_digit varchar(1),
  
  -- 6-7. FISCAL
  branch varchar(10) NOT NULL,
  tax_regime varchar(50) NOT NULL,
  
  -- 8-12. UBICACIÓN
  address varchar(255) NOT NULL,
  postal_code varchar(10) NOT NULL,
  country varchar(100) NOT NULL DEFAULT 'COLOMBIA',
  department varchar(100) NOT NULL,
  city varchar(100) NOT NULL,
  
  -- 13-19. TELÉFONOS
  international_code varchar(5) NOT NULL DEFAULT '57',
  mobile varchar(10) NOT NULL,
  full_mobile varchar(20) GENERATED ALWAYS AS (international_code || mobile) STORED,
  local_code varchar(5) DEFAULT '604',
  phone varchar(15),
  extension varchar(10),
  full_phone varchar(30) GENERATED ALWAYS AS (
    CASE 
      WHEN phone IS NOT NULL AND phone != '0' 
      THEN CONCAT(local_code, phone, COALESCE(extension, ''))
      ELSE '0'
    END
  ) STORED,
  
  -- 20-21. CONTACTO
  email varchar(255) NOT NULL,
  contact_name varchar(255) NOT NULL,
  
  -- 22-25. CRÉDITO Y ESTADO
  status varchar(20) NOT NULL DEFAULT 'ACTIVO',
  has_credit boolean NOT NULL DEFAULT false,
  promissory_note_number varchar(50),
  promissory_note_date date,
  
  -- ERP FIELDS
  client_type_id uuid REFERENCES client_types(id),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_clients_identification ON clients(identification);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_client_type ON clients(client_type_id);
```

**Migración desde tabla actual**:
```sql
-- PASO 1: Agregar columnas nuevas con defaults temporales
ALTER TABLE clients 
-- Identificación
ADD COLUMN identification_type varchar(10) NOT NULL DEFAULT 'CC',
ADD COLUMN verification_digit varchar(1),

-- Fiscal
ADD COLUMN branch varchar(10) NOT NULL DEFAULT '01',
ADD COLUMN tax_regime varchar(50) NOT NULL DEFAULT 'REGIMEN_COMUN',

-- Ubicación (address ya existe en versión anterior)
ADD COLUMN postal_code varchar(10) NOT NULL DEFAULT '5001',
ADD COLUMN country varchar(100) NOT NULL DEFAULT 'COLOMBIA',
ADD COLUMN department varchar(100) NOT NULL DEFAULT 'ANTIOQUIA',

-- Teléfonos
ADD COLUMN international_code varchar(5) NOT NULL DEFAULT '57',
ADD COLUMN mobile varchar(10) NOT NULL DEFAULT '0000000000', -- Temporal
ADD COLUMN full_mobile varchar(20) GENERATED ALWAYS AS (international_code || mobile) STORED,
ADD COLUMN local_code varchar(5) DEFAULT '604',
ADD COLUMN extension varchar(10),
ADD COLUMN full_phone varchar(30) GENERATED ALWAYS AS (
  CASE 
    WHEN phone IS NOT NULL AND phone != '0' 
    THEN CONCAT(local_code, phone, COALESCE(extension, ''))
    ELSE '0'
  END
) STORED,

-- Contacto (contact_name ya existe en versión anterior si se agregó)
ADD COLUMN contact_name varchar(255) NOT NULL DEFAULT name,

-- Crédito y Estado
ADD COLUMN status varchar(20) NOT NULL DEFAULT 'ACTIVO',
ADD COLUMN has_credit boolean NOT NULL DEFAULT false,
ADD COLUMN promissory_note_number varchar(50),
ADD COLUMN promissory_note_date date,

-- ERP
ADD COLUMN client_type_id uuid REFERENCES client_types(id);

-- PASO 2: Modificar columnas existentes
ALTER TABLE clients ALTER COLUMN city SET NOT NULL;
ALTER TABLE clients ALTER COLUMN email SET NOT NULL; -- Ahora es CRÍTICO

-- PASO 3: Crear índices
CREATE INDEX idx_clients_identification ON clients(identification);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_client_type ON clients(client_type_id);
```

**Validaciones en API (POST /api/clients)**:
```typescript
// CAMPOS CRÍTICOS (no pueden faltar):
{
  name: "STIVEN ALEXIS AGUIRRE CARDONA", // REQUERIDO
  identification_type: "CC", // REQUERIDO (CC o NIT)
  identification: "1011392373", // REQUERIDO, ÚNICO
  verification_digit: null, // Solo si es NIT
  branch: "01", // REQUERIDO
  tax_regime: "REGIMEN_COMUN", // REQUERIDO
  address: "CR 33A CL 107A 19", // REQUERIDO
  postal_code: "5001", // REQUERIDO
  country: "COLOMBIA", // REQUERIDO
  department: "ANTIOQUIA", // REQUERIDO
  city: "Medellín", // REQUERIDO
  international_code: "57", // REQUERIDO
  mobile: "3001234567", // CRÍTICO - REQUERIDO
  local_code: "604", // Opcional
  phone: "0", // Opcional
  extension: null, // Opcional
  email: "stiven@email.com", // CRÍTICO - REQUERIDO
  contact_name: "STIVEN ALEXIS AGUIRRE CARDONA", // REQUERIDO
  status: "ACTIVO", // REQUERIDO
  has_credit: false, // REQUERIDO
  promissory_note_number: null, // Opcional
  promissory_note_date: null, // Opcional
  client_type_id: uuid // Opcional (default: HABITUALES)
}
```

**Enums Sugeridos**:
```typescript
// identification_type
export const identificationTypeEnum = pgEnum("identification_type", [
  "CC",   // Cédula de Ciudadanía
  "NIT",  // Número de Identificación Tributaria
  "CE",   // Cédula de Extranjería
  "PAS"   // Pasaporte
]);

// tax_regime
export const taxRegimeEnum = pgEnum("tax_regime", [
  "REGIMEN_COMUN",
  "REGIMEN_SIMPLIFICADO",
  "NO_RESPONSABLE"
]);

// status
export const clientStatusEnum = pgEnum("client_status", [
  "ACTIVO",
  "INACTIVO",
  "SUSPENDIDO"
]);
```

---

### B. `pricing_tiers` - Capas de Precio (Producto + Tipo de Cliente)
**Propósito**: Define el precio BASE para una combinación producto + tipo cliente  
**Relaciones**: ← `product_prices` (many:1), ← `client_types` (many:1), → `pricing_ranges` (1:many)

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | Identificador único |
| product_price_id | uuid | FOREIGN KEY, NOT NULL | Referencia a `product_prices.id` |
| client_type_id | uuid | FOREIGN KEY, NOT NULL | Referencia a `client_types.id` |
| base_price | numeric(12,2) | NOT NULL | Precio base ANTES de aplicar rangos |
| is_fixed | boolean | DEFAULT false | Si es true: precio NO se puede editar |
| created_at | timestamp | DEFAULT now() | Fecha creación |

**Índices**:
- UNIQUE (product_price_id, client_type_id)

**Seed Data Ejemplo**:
```json
[
  {
    "product_price_id": "uuid-del-producto-X",
    "client_type_id": "uuid-HABITUALES",
    "base_price": 50000,
    "is_fixed": true
  },
  {
    "product_price_id": "uuid-del-producto-X",
    "client_type_id": "uuid-MAYORISTA",
    "base_price": 40000,
    "is_fixed": true
  }
]
```

---

### C. `pricing_ranges` - Rangos de Cantidad por Tier
**Propósito**: Define escala de precio según cantidad (0-500 = $X, 501-1000 = $Y, 1001+ = $Z)  
**Relaciones**: ← `pricing_tiers` (many:1)

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | Identificador único |
| pricing_tier_id | uuid | FOREIGN KEY, NOT NULL | Referencia a `pricing_tiers.id` |
| min_quantity | integer | NOT NULL, ≥ 0 | Cantidad mínima |
| max_quantity | integer | NULLABLE | Cantidad máxima (NULL = infinito) |
| price | numeric(12,2) | NOT NULL | Precio para este rango |
| currency | varchar(3) | DEFAULT 'COP' | **NUEVO**: Moneda del precio (COP o USD) |
| created_at | timestamp | DEFAULT now() | Fecha creación |

**Validación**: `min_quantity < max_quantity` (si max_quantity no es NULL)

**Seed Data Ejemplo** (para un producto con cliente HABITUALES - EN COP):
```json
[
  { "pricing_tier_id": "uuid-tier-1", "min_quantity": 1, "max_quantity": 500, "price": 50000, "currency": "COP" },
  { "pricing_tier_id": "uuid-tier-1", "min_quantity": 501, "max_quantity": 1000, "price": 48000, "currency": "COP" },
  { "pricing_tier_id": "uuid-tier-1", "min_quantity": 1001, "max_quantity": null, "price": 45000, "currency": "COP" }
]
```

**Seed Data Ejemplo 2** (para otro producto - EN USD - se convierte automáticamente):
```json
[
  { "pricing_tier_id": "uuid-tier-2", "min_quantity": 1, "max_quantity": 500, "price": 15, "currency": "USD" },
  { "pricing_tier_id": "uuid-tier-2", "min_quantity": 501, "max_quantity": 1000, "price": 14.5, "currency": "USD" },
  { "pricing_tier_id": "uuid-tier-2", "min_quantity": 1001, "max_quantity": null, "price": 13.5, "currency": "USD" }
]
```

---

### D. `suppliers` - Proveedores (para Purchase Orders)
**Propósito**: Registro de proveedores para compras  
**Relaciones**: → `purchase_orders` (1:many)

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | Identificador único |
| name | varchar(255) | UNIQUE, NOT NULL | Nombre del proveedor |
| identification | varchar(20) | UNIQUE, NOT NULL | NIT o Cédula |
| email | varchar(255) | NULLABLE | Email |
| phone | varchar(50) | NULLABLE | Teléfono |
| city | varchar(100) | DEFAULT 'Medellín' | Ciudad |
| siigo_supplier_code | varchar(50) | NULLABLE | Código del proveedor en SIIGO |
| contact_person | varchar(255) | NULLABLE | Persona de contacto |
| payment_terms | varchar(100) | NULLABLE | Términos (ej: "30 días neto") |
| is_active | boolean | DEFAULT true | Activo/Inactivo |
| created_at | timestamp | DEFAULT now() | Fecha creación |

---

### E. `purchase_orders` - Órdenes de Compra
**Propósito**: Registro de compras a proveedores con seguimiento SIIGO  
**Relaciones**: ← `suppliers` (many:1), ← `employees` (many:1), → `purchase_order_items` (1:many), → `siigo_mappings` (1:many)

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | Identificador único |
| code | varchar(20) | UNIQUE, NOT NULL | Código PO (ej: PO-2026-001) |
| supplier_id | uuid | FOREIGN KEY, NOT NULL | Proveedor |
| created_by | uuid | FOREIGN KEY, NOT NULL | Empleado que crea la PO |
| status | purchase_order_status | DEFAULT 'PENDIENTE' | PENDIENTE, APROBADA, RECHAZADA, EN_PROCESO, FINALIZADA, CANCELADA |
| total | numeric(14,2) | DEFAULT 0 | Total de la orden |
| currency | varchar(5) | DEFAULT 'COP' | Moneda |
| expected_delivery_date | timestamp | NULLABLE | Fecha entrega esperada |
| notes | text | NULLABLE | Notas internas |
| is_synced_to_siigo | boolean | DEFAULT false | ¿Se sincronizó a SIIGO? |
| siigo_document_id | varchar(50) | NULLABLE | ID del documento en SIIGO |
| created_at | timestamp | DEFAULT now() | Fecha creación |

---

### F. `purchase_order_items` - Líneas de Compra
**Propósito**: Detalle de productos en cada orden de compra  
**Relaciones**: ← `purchase_orders` (many:1), ← `inventory_items` (many:1)

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | Identificador único |
| purchase_order_id | uuid | FOREIGN KEY, NOT NULL | Referencia a PO |
| inventory_item_id | uuid | FOREIGN KEY, NOT NULL | Material/Insumo comprado |
| quantity | integer | NOT NULL, > 0 | Cantidad ordenada |
| unit_price | numeric(12,2) | NOT NULL | Precio unitario |
| total_price | numeric(14,2) | NOT NULL | quantity × unit_price |
| status | varchar(50) | DEFAULT 'PENDIENTE' | PENDIENTE, PARCIAL, RECIBIDO |
| received_quantity | integer | DEFAULT 0 | Cantidad recibida hasta ahora |
| created_at | timestamp | DEFAULT now() | Fecha creación |

---

### G. `siigo_mappings` - Registro de Sincronización SIIGO
**Propósito**: Auditoría de qué se envió/sincronizó con SIIGO  
**Relaciones**: ← `purchase_orders` (many:1)

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | Identificador único |
| purchase_order_id | uuid | FOREIGN KEY, NOT NULL | PO que se sincroniza |
| siigo_document_type | varchar(50) | NOT NULL | Tipo documento SIIGO (ej: 'PURCHASE_INVOICE') |
| siigo_status | varchar(50) | NULLABLE | Estado en SIIGO |
| siigo_response | json | NULLABLE | Response completo de SIIGO (para debug) |
| error_message | text | NULLABLE | Si hubo error, guardar mensaje |
| is_success | boolean | DEFAULT false | ¿Fue exitosa la sincronización? |
| synced_at | timestamp | DEFAULT now() | Fecha sincronización |

---

## 2B. TABLAS PARA GESTIÓN DE DISEÑOS Y TRANSPORTE

### H. `design_images` - Fotos de Diseño Separadas por Sección
**Propósito**: Almacenar múltiples fotos de un diseño (conjunto, superior, inferior, telas, etc)  
**Relaciones**: ← `order_items` (many:1)

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | Identificador único |
| order_item_id | uuid | FOREIGN KEY, NOT NULL | Referencia al diseño (order item) |
| image_type | design_image_type | NOT NULL | Tipo: CONJUNTO, SUPERIOR, INFERIOR, TELA, etc |
| image_url | text | NOT NULL | URL de la imagen |
| description | text | NULLABLE | Descripción adicional |
| fabric_info | varchar(255) | NULLABLE | Tipo de tela específico (si aplica) |
| color_info | varchar(100) | NULLABLE | Color específico |
| placement | varchar(100) | NULLABLE | Ubicación en la prenda (pecho, espalda, manga, etc) |
| size_notes | varchar(100) | NULLABLE | Tamaño/dimensiones de este elemento |
| created_at | timestamp | DEFAULT now() | Fecha creación |

**Relación con order_items actual**:
```sql
-- La tabla order_items.imageUrl sigue existiendo como foto principal
-- Pero design_images permite múltiples fotos organizadas
```

---

### I. `confectionist_reports` - Reportes de Estado del Confeccionista
**Propósito**: Confeccionista reporta estado de los diseños/prendas después de recibirlas  
**Relaciones**: ← `order_items` (many:1), ← `employees` (many:1)

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | Identificador único |
| order_item_id | uuid | FOREIGN KEY, NOT NULL | Diseño reportado |
| confectionist_id | uuid | FOREIGN KEY, NOT NULL | Confeccionista que envía |
| status | confectionist_status | NOT NULL | Estado: RECIBIDO_COMPLETO, FALTA_ITEMS, etc |
| received_quantity | integer | NOT NULL | Cantidad recibida en Viomar |
| missing_items | integer | DEFAULT 0 | Cantidad que falta |
| quality_notes | text | NULLABLE | Observaciones sobre calidad/problemas |
| missing_details | text | NULLABLE | Detalles de qué falta (si aplica) |
| sent_date | timestamp | NOT NULL | Cuándo confeccionista envió a Viomar |
| received_date | timestamp | NULLABLE | Cuándo llegó a Viomar |
| created_at | timestamp | DEFAULT now() | Fecha creación del reporte |

**Índices**:
- INDEX (order_item_id) para filtros rápidos
- INDEX (confectionist_id, sent_date)

---

### J. `messengers` - Registros de Mensajeros/Transportistas
**Propósito**: Personas o empresas que transportan diseños (confeccionista → Viomar y Viomar → cliente)  
**Relaciones**: → `shipment_trackings` (1:many)

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | Identificador único |
| name | varchar(255) | NOT NULL | Nombre del mensajero/empresa |
| phone | varchar(50) | NULLABLE | Teléfono |
| email | varchar(255) | NULLABLE | Email |
| type | varchar(50) | NOT NULL | "PERSONAL" (confeccionista), "EMPRESA" (DHL, etc), "VIOMAR_STAFF" |
| is_active | boolean | DEFAULT true | Activo/Inactivo |
| created_at | timestamp | DEFAULT now() | Fecha creación |

---

### K. `shipment_trackings` - Seguimiento de Envíos (Trayectos)
**Propósito**: Rastrear movimiento de diseños: Confeccionista → Viomar → Cliente  
**Relaciones**: ← `confectionist_reports` (many:1), ← `messengers` (many:1)

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | Identificador único |
| confectionist_report_id | uuid | FOREIGN KEY, NOT NULL | Lote de diseños siendo enviados |
| messenger_id | uuid | FOREIGN KEY, NULLABLE | Quién transporta |
| shipment_type | varchar(50) | NOT NULL | "CONFECTIONIST_TO_VIOMAR" o "VIOMAR_TO_CLIENT" |
| status | shipment_status | DEFAULT 'PENDIENTE' | Estado actual del envío |
| departure_date | timestamp | NULLABLE | Cuándo salió |
| expected_arrival | timestamp | NULLABLE | Fecha esperada |
| actual_arrival | timestamp | NULLABLE | Cuándo llegó realmente |
| tracking_number | varchar(100) | NULLABLE | Número de tracking (si DHL, etc) |
| location_notes | text | NULLABLE | Observaciones de ubicación |
| created_at | timestamp | DEFAULT now() | Fecha creación |

**Índices**:
- INDEX (confectionist_report_id) para seguimiento de lote
- INDEX (status, created_at)

---

### L. `packaging_confirmations` - Confirmación Equipo de Empaque/Despacho
**Propósito**: Equipo de empaque recibe los diseños y confirma estado  
**Relaciones**: ← `confectionist_reports` (many:1), ← `employees` (many:1)

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | Identificador único |
| confectionist_report_id | uuid | FOREIGN KEY, NOT NULL | Lote recibido |
| packaging_staff_id | uuid | FOREIGN KEY, NOT NULL | Empleado de empaque que recibe |
| status | packaging_status | DEFAULT 'PENDIENTE_RECEPCION' | Estado actual |
| quantity_received | integer | NOT NULL | Cantidad que realmente recibió |
| quantity_expected | integer | NOT NULL | Cantidad que debería haber llegado |
| discrepancy_notes | text | NULLABLE | Si hay diferencias, qué pasó |
| quality_check | boolean | DEFAULT false | ¿Pasó inspección de calidad? |
| quality_issues | text | NULLABLE | Problemas encontrados (si hay) |
| ready_for_shipment | boolean | DEFAULT false | ¿Listo para enviar al cliente? |
| client_shipment_id | uuid | NULLABLE | Referencia al envío al cliente |
| received_at | timestamp | NOT NULL | Cuándo llegó al empaque |
| dispatched_at | timestamp | NULLABLE | Cuándo se envió al cliente |
| created_at | timestamp | DEFAULT now() | Fecha creación |

**Índices**:
- INDEX (confectionist_report_id) para vincular con reporte
- INDEX (status, packaging_staff_id)

---

### A. Tabla `order_items` - AGREGAR CAMPOS PARA DISEÑO DETALLADO
**Cambio**: Nuevas columnas para especificaciones detalladas

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| **upper_fabric** | varchar(100) | NULLABLE | **NUEVO**: Tipo de tela PARTE SUPERIOR |
| **lower_fabric** | varchar(100) | NULLABLE | **NUEVO**: Tipo de tela PARTE INFERIOR |
| **upper_color** | varchar(100) | NULLABLE | **NUEVO**: Color PARTE SUPERIOR |
| **lower_color** | varchar(100) | NULLABLE | **NUEVO**: Color PARTE INFERIOR |
| **design_status** | varchar(50) | DEFAULT 'PENDIENTE_DISEÑO' | **NUEVO**: Estado de conf (PENDIENTE_DISEÑO, APROBADO, EN_CONFECCION, LISTO, REPORTE_PENDIENTE) |
| **confectionist_report_id** | uuid | FOREIGN KEY NULLABLE | **NUEVO**: Vinculación con reporte del confeccionista |
| **packaging_confirmation_id** | uuid | FOREIGN KEY NULLABLE | **NUEVO**: Vinculación con confirmación de empaque |

**Migración SQL**:
```sql
ALTER TABLE order_items 
ADD COLUMN upper_fabric varchar(100),
ADD COLUMN lower_fabric varchar(100),
ADD COLUMN upper_color varchar(100),
ADD COLUMN lower_color varchar(100),
ADD COLUMN design_status varchar(50) DEFAULT 'PENDIENTE_DISEÑO',
ADD COLUMN confectionist_report_id uuid REFERENCES confectionist_reports(id),
ADD COLUMN packaging_confirmation_id uuid REFERENCES packaging_confirmations(id);
```

---

### B. Tabla `clients` - AGREGAR MÚLTIPLES CAMPOS PARA PREFACTURA ⭐
**Cambio**: Nuevas columnas obligatorias según layout prefactura

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| **contact_name** | varchar(255) | NOT NULL | **NUEVO**: Nombre de contacto |
| **identification_type** | varchar(10) | NOT NULL, DEFAULT 'CC' | **NUEVO**: Tipo documento (CC/NIT) |
| **address** | varchar(255) | NOT NULL | **NUEVO**: Dirección física completa |
| **location** | varchar(150) | NULLABLE | **NUEVO**: Localización específica |
| **mobile_phone** | varchar(50) | NOT NULL | **NUEVO**: Teléfono móvil (OBLIGATORIO en prefactura) |
| **client_type_id** | uuid | FOREIGN KEY → client_types.id | **NUEVO**: Tipo de cliente ERP |

**Modificar existentes**:
| Campo | Cambio |
|-------|--------|
| **city** | Cambiar a NOT NULL (actualmente DEFAULT 'Medellín') |
| **phone** | Sigue opcional (ahora es distinto de mobile_phone) |
| **email** | Sigue opcional |

**Migración SQL**:
```sql
-- AGREGAR nuevos campos obligatorios para prefactura
ALTER TABLE clients 
ADD COLUMN contact_name varchar(255) NOT NULL DEFAULT name, -- Temporal, usar name como default
ADD COLUMN identification_type varchar(10) NOT NULL DEFAULT 'CC',
ADD COLUMN address varchar(255) NOT NULL DEFAULT 'Sin dirección', -- Temporal
ADD COLUMN location varchar(150),
ADD COLUMN mobile_phone varchar(50) NOT NULL DEFAULT COALESCE(phone, 'Sin teléfono'); -- Temporal

-- MODIFICAR city a NOT NULL
ALTER TABLE clients ALTER COLUMN city SET NOT NULL;

-- AGREGAR client_type_id
ALTER TABLE clients 
ADD COLUMN client_type_id uuid REFERENCES client_types(id);

-- DESPUÉS DE MIGRACIÓN: Actualizar datos reales
-- Luego quitar los defaults temporales y hacer que sean verdaderamente requeridos en la app
```

**Seed Default**: Todos los clientes existentes → tipo "HABITUALES"

---

### C. Tabla `orders` - AGREGAR CAMPO
**Cambio**: Nueva columna

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| **sales_channel** | sales_channel | DEFAULT 'TIENDA' | **NUEVO**: De dónde vino la orden (WEB, TIENDA, MAYORISTA) |

**Migración SQL**:
```sql
ALTER TABLE orders 
ADD COLUMN sales_channel sales_channel DEFAULT 'TIENDA';
```

---

### D. Tabla `employees` - Validar Tipos de Rol para Confeccionistas
**Sin cambios de schema**: Solo asegurar que existan roles:
- OPERARIO_CORTE_LASER
- OPERARIO_CORTE_MANUAL  
- OPERARIO_IMPRESION
- OPERARIO_ESTAMPACION
- OPERARIO_MONTAJE
- OPERARIO_SUBLIMACION

✅ Ya existen en el schema actual

---

## 4️⃣ LÓGICA DE PRECIOS (REGLAS CRÍTICAS)

### 💱 Gestión de Dos Monedas: COP vs USD

#### **COP (Pesos Colombianos)**
- **Regla**: Son FIJOS, no cambian
- **Storage**: Se guardan en `pricing_ranges.price` (numeric, COP)
- **Actualización**: Solo si gerente cambia el precio manualmente

#### **USD (Dólares US)**
- **Regla Especial**: Conversión dinámica
- **Piso Mínimo**: 1 USD = 3.600 COP
- **Lógica**:
  - Si TRM del día < 3.600 → se fuerza a 3.600
  - Si TRM del día ≥ 3.600 → se usa el TRM actual
  - Una vez que sube (ej: 3.700, 3.800), NO vuelve a bajar
  - Se mantiene el máximo histórico del mes

**Fórmula de Conversión**:
```
effective_trm = MAX(3600, current_trm_of_day)
price_in_cop = price_in_usd * effective_trm
```

### ✅ Cálculo del Precio de una Línea de Orden

```javascript
// Cuando se crea un order_item:
1. Validar: producto existe + cliente existe
2. Obtener: client_type_id del cliente
3. Buscar: pricing_tier para (product_price_id, client_type_id)
4. Obtener: base_price del tier (puede ser en USD o COP)
5. Buscar: pricing_range donde quantity ∈ [min_qty, max_qty]
6. Obtener: price del rango + currency (USD o COP)

// Si currency = USD:
   - Obtener: TRM efectiva del día (MAX(3600, trm_actual))
   - Convertir: price_cop = price_usd * trm_efectiva
   - Aplicar: descuento del client_type
   - final_price = (price_cop * (1 - client_type.discount_percentage/100))

// Si currency = COP:
   - Aplicar: descuento del client_type
   - final_price = (price * (1 - client_type.discount_percentage/100))

7. Guardar: unit_price = final_price, currency_used = COP (siempre en COP en la orden)
8. Guardar: original_currency_price = price_usd o price_cop para auditoría

// RESTRICCIÓN: is_fixed = true → NO se puede cambiar el precio en UI
```

### 🚫 Validaciones

```javascript
// Antes de crear pricing_range:
- min_quantity ≥ 0
- Si max_quantity no es NULL: min_quantity < max_quantity
- Solo 1 rango con max_quantity = NULL por tier (infinito)
- Si currency = USD: price debe ser positivo y lógico para USD
- Si currency = COP: price debe ser positivo y lógico para COP

// Antes de crear order_item:
- Debe existir pricing_tier para ese cliente + producto
- Debe existir al menos 1 pricing_range en ese tier
- Validar que la cantidad entra en algún rango
- Si currency = USD: consultar TRM del día automáticamente
```

### 📊 Nueva Tabla: `exchange_rates` - Histórico TRM

**Propósito**: Guardar consultashistóricas del tipo de cambio USD/COP  
**Relaciones**: Referencia para cálculos históricos

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY | Identificador único |
| rate_date | date | UNIQUE, NOT NULL | Fecha del TRM |
| usd_to_cop | numeric(8,4) | NOT NULL | Tipo de cambio del día |
| effective_rate | numeric(8,4) | NOT NULL | TRM efectiva (MAX(3600, actual)) |
| is_holiday | boolean | DEFAULT false | ¿Fue día festivo? (sin cambio) |
| source | varchar(100) | DEFAULT 'banco_republica' | Fuente de consulta |
| fetched_at | timestamp | DEFAULT now() | Cuándo se consultó |

**Índices**:
- INDEX (rate_date DESC) para consultas rápidas

---

## 5️⃣ CONSULTA DE TRM (Tipo de Cambio USD/COP) - APIs Disponibles

### 🌍 Opciones de APIs para Obtener TRM Diario

| API | Costo | Velocidad | Confiabilidad | Ventajas | Desventajas |
|-----|-------|-----------|---------------|----------|-------------|
| **Banco de la República** | ✅ Gratis | Lento | ⭐⭐⭐⭐⭐ | Oficial Colombia | Sin datos festivos ni horarios |
| **Open Exchange Rates** | Freemium | Rápido | ⭐⭐⭐⭐ | API moderna | Requiere API key |
| **exchangerate-api.com** | Freemium | Rápido | ⭐⭐⭐⭐ | 1500 req/mes gratis | Freemium |
| **Fixer.io** | Pago | Rápido | ⭐⭐⭐⭐ | Datos históricos | Requiere suscripción |
| **Alpha Vantage** | Freemium | Rápido | ⭐⭐⭐ | Soporta forex | Rate limit strict |

### ✅ RECOMENDACIÓN: Usar **exchangerate-api.com**

**Por qué**:
- ✅ 1.500 requests/mes gratis (suficiente para consulta diaria)
- ✅ Sin límite de rate (rápido)
- ✅ JSON limpio y fácil de parsear
- ✅ Incluye histórico

**URL Endpoint**:
```
GET https://api.exchangerate-api.com/v4/latest/USD?base=USD&symbols=COP
```

**Response**:
```json
{
  "rates": {
    "COP": 3756.45
  },
  "date": "2026-02-17",
  "base": "USD"
}
```

---

### 🤖 Arquitectura Propuesta: Consulta Diaria Automática

**Opción 1: Cron Job (Recomendado)**
```javascript
// Cada día a las 08:00 AM (después de inicio de trading)
// via: node-cron o similar
const fetchDailyExchangeRate = async () => {
  const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
  const { rates } = await response.json();
  const rate = rates.COP;
  const effective_rate = Math.max(3600, rate);
  
  // Guardar en exchange_rates tabla
  await db.insert(exchangeRates).values({
    rate_date: new Date().toISOString().split('T')[0],
    usd_to_cop: rate,
    effective_rate: effective_rate,
    source: 'exchangerate_api'
  });
};
```

**Opción 2: API Endpoint HTTP (Alternativa)**
```
POST /api/admin/exchange-rates/fetch-today
// Admin puede ejecutar manualmente
```

**Opción 3: Vercel Cron (Si desplegamos en Vercel)**
```
// vercel.json
{
  "crons": [{
    "path": "/api/admin/exchange-rates/fetch-today",
    "schedule": "0 8 * * *"  // Diario a las 8 AM UTC
  }]
}
```

---

### 📋 Servicio de Consulta TRM: `src/utils/exchange-rate.ts`

```typescript
// Pseudo-código de lo que vamos a crear
export const getEffectiveExchangeRate = async (date: Date): Promise<number> => {
  const dateString = date.toISOString().split('T')[0];
  
  // 1. Buscar en BD si ya existe para hoy
  const existing = await db.query.exchangeRates.findFirst({
    where: eq(exchangeRates.rate_date, dateString)
  });
  
  if (existing) return existing.effective_rate;
  
  // 2. Si no existe, consultar API
  const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
  const { rates } = await response.json();
  const rate = rates.COP;
  const effective = Math.max(3600, rate);
  
  // 3. Guardar en BD para próximas consultas
  await db.insert(exchangeRates).values({
    rate_date: dateString,
    usd_to_cop: rate,
    effective_rate: effective,
    source: 'exchangerate_api'
  });
  
  return effective;
};
```

---

### 🔗 Integración en Cálculo de Precios

```typescript
// Cuando se crea order_item con currency USD:
const exchangeRate = await getEffectiveExchangeRate(new Date());
const priceCOP = priceUSD * exchangeRate;

// Guardar en order_item:
{
  unitPrice: priceCOP,
  originalCurrency: 'USD',
  originalPrice: priceUSD,
  exchangeRateUsed: exchangeRate,
  currency: 'COP'
}
```

---

## 5️⃣ RESUMEN ACCIÓN REQUERIDA

### ✏️ Cambios en `src/db/schema.ts`

| # | Acción | Elemento | Estado |
|---|--------|----------|--------|
| 1 | AGREGAR | Enum `clientTypeEnum` (HABITUALES, COLANTA, MAYORISTA, AUTORIZADO) | ⏳ |
| 2 | AGREGAR | Enum `identificationTypeEnum` (CC, NIT, CE, PAS) | ⏳ |
| 3 | AGREGAR | Enum `taxRegimeEnum` (REGIMEN_COMUN, REGIMEN_SIMPLIFICADO, NO_RESPONSABLE) | ⏳ |
| 4 | AGREGAR | Enum `clientStatusEnum` (ACTIVO, INACTIVO, SUSPENDIDO) | ⏳ |
| 5 | AGREGAR | Enum `salesChannelEnum` (WEB, TIENDA, MAYORISTA) | ⏳ |
| 6 | AGREGAR | Enum `designImageTypeEnum` (CONJUNTO, SUPERIOR, INFERIOR, TELA, etc) | ⏳ |
| 7 | AGREGAR | Enum `confectionistStatusEnum` (RECIBIDO, EN_PRODUCCION, LISTO_ENVIO, etc) | ⏳ |
| 8 | AGREGAR | Enum `shipmentStatusEnum` (PENDIENTE, EN_TRAYECTO, ENTREGADO, etc) | ⏳ |
| 9 | AGREGAR | Enum `packagingStatusEnum` (PENDIENTE_RECEPCION, VERIFICADO, LISTO_DESPACHO, etc) | ⏳ |
| 10 | AGREGAR | Tabla `clientTypes` | ⏳ |
| 11 | AGREGAR | Tabla `pricingTiers` | ⏳ |
| 12 | AGREGAR | Tabla `pricingRanges` (+ campo currency USD/COP) | ⏳ |
| 13 | AGREGAR | Tabla `exchangeRates` (histórico TRM) | ⏳ |
| 14 | AGREGAR | Tabla `design_images` (fotos separadas por sección) | ⏳ |
| 15 | AGREGAR | Tabla `confectionist_reports` (reportes confeccionista) | ⏳ |
| 16 | AGREGAR | Tabla `messengers` (transportistas/mensajeros) | ⏳ |
| 17 | AGREGAR | Tabla `shipment_trackings` (seguimiento de envíos) | ⏳ |
| 18 | AGREGAR | Tabla `packaging_confirmations` (empaque/despacho) | ⏳ |
| 19 | AGREGAR | Tabla `suppliers` | ⏳ |
| 20 | AGREGAR | Tabla `purchaseOrders` | ⏳ |
| 21 | AGREGAR | Tabla `purchaseOrderItems` | ⏳ |
| 22 | AGREGAR | Tabla `siigo_mappings` | ⏳ |
| 23 | MODIFICAR | Tabla `order_items` + campos diseño detallado (upper/lower fabric, colors, status, FKs) | ⏳ |
| 24 | MODIFICAR | Tabla `clients` + **25 CAMPOS COMPLETOS** (ver sección A.1 para detalle) | ⏳ |
| 25 | MODIFICAR | Tabla `orders` + campo `sales_channel` | ⏳ |

### 🌱 Cambios en `seed.ts`

| # | Acción | Elemento | Estado |
|---|--------|----------|--------|
| 1 | CREAR | Seed `clientTypes` (4 registros) | ⏳ |
| 2 | CREAR | Seed `exchangeRates` (últimos 30 días mock) | ⏳ |
| 3 | CREAR | Seed `suppliers` (2-3 ejemplos) | ⏳ |
| 4 | ACTUALIZAR | Seed `clients` → agregar campos prefactura (contact_name, address, mobile_phone, etc) + asignar `client_type_id` | ⏳ |
| 5 | CREAR | Seed `pricingTiers` (ejemplos COP y USD) | ⏳ |
| 6 | CREAR | Seed `pricingRanges` (rangos 0-500, 501-1000, 1001+) | ⏳ |
| 7 | CREAR | Seed `messengers` (2-3 transportistas ejemplo) | ⏳ |
| 8 | ACTUALIZAR | Seed `employees` → asegurar confeccionistas | ⏳ |
| 9 | CREAR | Seed `design_images` (ejemplos de fotos) | ⏳ |
| 10 | CREAR | Seed `confectionist_reports` (reportes ejemplo) | ⏳ |
| 11 | CREAR | Seed `shipment_trackings` (seguimientos ejemplo) | ⏳ |
| 12 | CREAR | Seed `packaging_confirmations` (confirmaciones ejemplo) | ⏳ |

### 📁 Nuevos Servicios Utilidad

| # | Archivo | Propósito |
|---|---------|----------|
| 1 | `src/utils/exchange-rate.ts` | Obtener TRM efectivo del día |
| 2 | `src/utils/pricing-calculator.ts` | Calcular precio final con conversión USD/COP |

### 📁 Nuevas Rutas API

| # | Ruta | Método | Propósito |
|---|------|--------|----------|
| **Precios y Clientes** | | | |
| 1 | `/api/client-types` | GET | Listar tipos de cliente |
| 2 | `/api/client-types` | POST | Crear tipo de cliente |
| 3 | `/api/pricing-tiers` | GET | Listar tiers |
| 4 | `/api/pricing-tiers` | POST | Crear tier |
| 5 | `/api/pricing-ranges` | GET | Listar rangos |
| 6 | `/api/pricing-ranges` | POST | Crear rango |
| 7 | `/api/exchange-rates` | GET | Histórico TRM |
| 8 | `/api/admin/exchange-rates/fetch-today` | POST | Consultar TRM actual (admin) |
| **Diseños Detallados** | | | |
| 9 | `/api/design-images` | GET | Listar fotos de diseño |
| 10 | `/api/design-images` | POST | Subir foto de diseño |
| 11 | `/api/order-items/[id]/design-specs` | GET | Obtener detalles de diseño (telas, colores, etc) |
| 12 | `/api/order-items/[id]/design-specs` | PUT | Actualizar detalles |
| **Confeccionistas - Reportes** | | | |
| 13 | `/api/confectionist-reports` | GET | Listar reportes |
| 14 | `/api/confectionist-reports` | POST | Crear reporte (confeccionista reporta estado) |
| 15 | `/api/confectionist-reports/[id]` | GET | Obtener detalles |
| 16 | `/api/confectionist-reports/[id]` | PUT | Actualizar reporte |
| **Mensajeros y Shipments** | | | |
| 17 | `/api/messengers` | GET | Listar transportistas |
| 18 | `/api/messengers` | POST | Crear transportista |
| 19 | `/api/shipment-trackings` | GET | Listar envíos |
| 20 | `/api/shipment-trackings` | POST | Crear seguimiento |
| 21 | `/api/shipment-trackings/[id]` | GET | Obtener detalles |
| 22 | `/api/shipment-trackings/[id]` | PUT | Actualizar estado |
| **Empaque y Despacho** | | | |
| 23 | `/api/packaging-confirmations` | GET | Listar confirmaciones |
| 24 | `/api/packaging-confirmations` | POST | Crear confirmación (equipo empaque recibe) |
| 25 | `/api/packaging-confirmations/[id]` | PUT | Confirmar y marcar listo |
| **Compras y Proveedores** | | | |
| 26 | `/api/suppliers` | GET/POST/PUT/DELETE | CRUD proveedores |
| 27 | `/api/purchase-orders` | GET/POST/PUT/DELETE | CRUD compras |

---

## 7️⃣ EJEMPLO PRÁCTICO: Cómo Funciona USD/COP en 5 Días

**Escenario**: Product "Tshirt Premium" tiene precio en USD

**Configuración en Seed**:
```json
{
  "pricingRange": {
    "price": 15,        // $15 USD
    "currency": "USD",
    "min_quantity": 1,
    "max_quantity": 500
  }
}
```

**Histórico de TRM en Banco**:
```
Feb 13: 3.580 COP/USD  → Efectivo: 3.600 (se fuerza al piso)
Feb 14: 3.620 COP/USD  → Efectivo: 3.620 (sube, se acepta)
Feb 15: 3.610 COP/USD  → Efectivo: 3.620 (mantiene máximo)
Feb 16: 3.650 COP/USD  → Efectivo: 3.650 (sube más, se acepta)
Feb 17: 3.640 COP/USD  → Efectivo: 3.650 (mantiene máximo)
```

**Precio en COP que se aplica en órdenes**:
```
Feb 13: $15 USD × 3.600 = $54.000 COP
Feb 14: $15 USD × 3.620 = $54.300 COP
Feb 15: $15 USD × 3.620 = $54.300 COP (NO BAJA aunque bajó TRM)
Feb 16: $15 USD × 3.650 = $54.750 COP
Feb 17: $15 USD × 3.650 = $54.750 COP (NO BAJA aunque bajó TRM)
```

**Si cliente MAYORISTA tiene 10% descuento**:
```
Feb 17 Precio Final: $54.750 × (1 - 0.10) = $49.275 COP
```

---

## DIAGRAMA: Flujo de Cálculo de Precio en Orden

```
┌─────────────────────────────────┐
│  USUARIO CREA ORDER_ITEM        │
│  - Producto: Tshirt            │
│  - Cliente: Amazon (MAYORISTA)  │
│  - Cantidad: 200 unidades      │
└──────────────┬──────────────────┘
               │
               ▼
      ┌───────────────────┐
      │ BUSCAR CLIENT_TYPE│
      │ MAYORISTA         │
      │ Descuento: 15%    │
      └────────┬──────────┘
               │
               ▼
    ┌──────────────────────┐
    │ BUSCAR PRICING_TIER  │
    │ (Product + MAYORISTA)│
    │ Base Price: Base     │
    └─────────┬────────────┘
              │
              ▼
    ┌──────────────────────────┐
    │ BUSCAR PRICING_RANGE     │
    │ Qty 200 ∈ [1-500]       │
    │ ├─ En USD? → 15 USD     │
    │ └─ En COP? → 50.000 COP │
    └──────────┬───────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
   ┌─USD─┐       ┌─COP─┐
   │$15  │       │50K  │
   └──┬──┘       └──┬──┘
      │             │
      ▼             │
  ┌────────────┐    │
  │Obtener TRM │    │
  │ del día:   │    │
  │ 3.650      │    │
  └────┬───────┘    │
       │            │
       ▼            │
  ┌──────────────┐  │
  │Aplicar piso: │  │
  │MAX(3600,3650)│  │
  │ = 3650       │  │
  └────┬─────────┘  │
       │            │
       ▼            │
  ┌──────────────┐  │
  │Convertir:    │  │
  │15 × 3650 =   │  │
  │54.750 COP    │  │
  └────┬─────────┘  │
       │            │
       └──────┬─────┘
              │
              ▼
      ┌────────────────┐
      │ PRECIO COP:    │
      │ 54.750 COP     │
      └─────────┬──────┘
                │
                ▼
       ┌──────────────────┐
       │ APLICAR DESCUENTO│
       │ MAYORISTA 15%    │
       │ 54.750 × 0.85 =  │
       │ 46.538 COP       │
       └─────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ GUARDAR EN ORDEN│
        │ unitPrice: 46538│
        │ currency: COP   │
        │ trm_usado: 3650 │
        └─────────────────┘
```

---

## 5B️⃣ FLUJOS DE PROCESAMIENTO: DISEÑOS, CONFECCIONISTAS Y TRANSPORTES

### 📸 FLUJO 1: Creación de Diseño (Order Item)

```
┌──────────────────────────┐
│ CLIENTE CREA ORDER       │
│ - Selecciona producto    │
│ - Define cantidad        │
│ - Se genera ORDER_ITEM   │
└──────────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ SUBIR FOTOS DISEÑO   │
    │ ├─ Conjunto         │
    │ ├─ Parte superior   │
    │ ├─ Parte inferior   │
    │ └─ Tela (muestra)   │
    │                      │
    │ POST /api/design-    │
    │      images          │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ AGREGAR SPECS        │
    │ - Tela superior      │
    │ - Color superior     │
    │ - Tela inferior      │
    │ - Color inferior     │
    │ - Notas especiales   │
    │                      │
    │ PUT /api/order-items/│
    │     [id]/design-specs│
    └──────────┬───────────┘
               │
               ▼
       ┌──────────────┐
       │ ORDEN LISTA  │
       │ Status: LISTO│
       └──────────────┘
```

---

### 🏭 FLUJO 2: Confeccionista Recibe y Envía (Confectionist Report)

```
┌──────────────────────────────┐
│ CONFECCIONISTA RECIBE DISEÑO │
│ - Revisa fotos              │
│ - Revisa especificaciones   │
│ └─ ¿Está todo OK?           │
└──────────────┬───────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
    ┌─OK──┐    ┌─PROBLEMA─┐
    │     │    │          │
    ▼     ▼    ▼          ▼
  PROD  FALTA  CALIDAD  ESPECIF
        ITEMS  ISSUE     ERROR
    
  (Status: RECIBIDO_COMPLETO)
  (Status: RECIBIDO_FALTA_ITEMS)
  (Status: PROBLEMA_CALIDAD)
  (Status: PROBLEMA_ESPECIF)
  
       ↓ (Una vez resuelto)
       
┌──────────────────────────────┐
│ CONFECCIONISTA PREPARA ENVÍO │
│ - Agrega las prendas a caja  │
│ - Asigna mensajero           │
│ - Genera reporte final       │
│                              │
│ POST /api/confectionist-     │
│      reports                 │
└──────────────┬───────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ REPORTE CREADO       │
    │ Status: EN_PRODUCCION│
    │        → LISTO_ENVIO │
    │        → ENVIADO_    │
    │          A_VIOMAR    │
    └──────────┬───────────┘
               │
       (Mensajero recoger)
```

---

### 🚚 FLUJO 3: Envío Confeccionista → Viomar (Shipment Tracking)

```
┌──────────────────────────────┐
│ CONFECCIONISTA ENTREGA A     │
│ MENSAJERO                    │
│                              │
│ POST /api/shipment-trackings │
│ {                            │
│   confectionist_report_id,   │
│   messenger_id,              │
│   shipment_type:             │
│   'CONFECTIONIST_TO_VIOMAR'  │
│ }                            │
└──────────────┬───────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ SHIPMENT CREATED     │
    │ Status: PENDIENTE    │
    └──────────┬───────────┘
               │ (Mensajero sale con caja)
               ▼
    ┌──────────────────────┐
    │ EN TRAYECTO          │
    │ departure_date: now  │
    │ expected_arrival: +2d│
    │                      │
    │ PUT /api/shipment-   │
    │     trackings/[id]   │
    └──────────┬───────────┘
               │ (Llega a Viomar, descargan)
               ▼
    ┌──────────────────────┐
    │ ENTREGADO A VIOMAR   │
    │ Status: ENTREGADO    │
    │ actual_arrival: now  │
    │                      │
    │ PUT /api/shipment-   │
    │     trackings/[id]   │
    └──────────────────────┘
```

---

### 📦 FLUJO 4: Equipo de Empaque Recibe y Verifica (Packaging Confirmation)

```
┌──────────────────────────────┐
│ EMPAQUE RECIBE LOTE DE       │
│ CONFECCIONISTA               │
│                              │
│ POST /api/packaging-         │
│      confirmations           │
│ {                            │
│   confectionist_report_id,   │
│   packaging_staff_id,        │
│   quantity_received,         │
│   quantity_expected          │
│ }                            │
└──────────────┬───────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ VERIF. CANTIDAD      │
    │                      │
    │ ¿quantity_received == │
    │  quantity_expected?   │
    └──────────┬───────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
     SI  ✅      NO ❌
     
   Status:          DISCREPANCY
   RECIBIDO_        (Reportar
   CONFORME         problema)
   
       ↓
┌──────────────────────────────┐
│ VERIFICAR CALIDAD            │
│ - Revisar prendas           │
│ - Inspeccionar              │
│ - quality_check: true/false │
│                              │
│ PUT /api/packaging-          │
│     confirmations/[id]       │
└──────────────┬───────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ LISTO PARA ENVÍO AL  │
    │ CLIENTE              │
    │                      │
    │ Status:              │
    │ LISTO_DESPACHO       │
    │                      │
    │ ready_for_shipment:  │
    │ true                 │
    └──────────┬───────────┘
               │
    (Genera shipment al cliente)
```

---

### 📨 FLUJO 5: Envío Viomar → Cliente (Final Shipment)

```
┌──────────────────────────────┐
│ VIOMAR ASIGNA MENSAJERO      │
│ PARA DELIVERY AL CLIENTE     │
│                              │
│ POST /api/shipment-trackings │
│ {                            │
│   packaging_confirmation_id, │
│   messenger_id,              │
│   shipment_type:             │
│   'VIOMAR_TO_CLIENT'         │
│ }                            │
└──────────────┬───────────────┘
               │
               ▼
       ┌──────────────┐
       │ PENDIENTE    │
       │ (Preparar)   │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │ EN_TRAYECTO  │
       │ (En camino)  │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │ ENTREGADO    │
       │ (En cliente) │
       └──────────────┘
```

---

## 6️⃣ FLUJO DE VALIDACIÓN FINAL

**CLIENTES - Campos Obligatorios Prefactura** ⭐:
- [ ] **name**: Nombre completo del cliente (ej: "STIVEN ALEXIS AGUIRRE CARDONA") ✅
- [ ] **contact_name**: Nombre de contacto (puede ser igual a name) ✅
- [ ] **identification_type**: "CC" o "NIT" ✅
- [ ] **identification**: Número cédula o NIT (único) ✅
- [ ] **address**: Dirección física completa (ej: "CR 50A CR 102A 55") ✅
- [ ] **city**: Ciudad (ej: "COLOMBIA" o "Medellín") ✅
- [ ] **location**: Localización específica (opcional)
- [ ] **mobile_phone**: Teléfono móvil (OBLIGATORIO en prefactura) ✅
- [ ] **phone**: Teléfono fijo (opcional)
- [ ] **email**: Email (opcional)

**COMERCIAL - Tipos de Cliente y Precios**:
- [ ] Confirmar 4 tipos de cliente exactos
- [ ] Confirmar rango de cantidades (0-500, 501-1000, 1001+) o si ¿son personalizables?
- [ ] Confirmar descuentos por tipo de cliente (%, específicos)
- [ ] Confirmar si precios son read-only siempre (is_fixed = true)?

**USD/COP - Gestión de Divisas**:
- [ ] Confirmar piso mínimo USD = 3.600 COP ✅
- [ ] Confirmar lógica: Si TRM < 3.600 → se fuerza a 3.600 ✅
- [ ] Confirmar: Una vez que sube, mantener máximo histórico ✅
- [ ] Confirmar: Usar **exchangerate-api.com** para TRM diario ✅
- [ ] Consulta automática diaria a las 8 AM ✅
- [ ] Si es Vercel, habilitar cron en `vercel.json` ✅

**DISEÑOS - Fotos y Especificaciones**:
- [ ] Confirmar que diseños se separan en CONJUNTO, SUPERIOR, INFERIOR
- [ ] Confirmar si hay más tipos de foto (DETALLE_TELA, ESPECIFICACION_TECNICA, etc)
- [ ] Validar que order_items guarde tela SUPERIOR + tela INFERIOR separately
- [ ] Validar que guarde color SUPERIOR + color INFERIOR separately

**CONFECCIONISTAS - Reportes de Estado**:
- [ ] Confeccionista reporta 4 posibles estados: RECIBIDO_OK, FALTA_ITEMS, PROBLEMA_CALIDAD, otros
- [ ] En cada reporte se registra: cantidad recibida, cantidad esperada, notas
- [ ] Si hay problemas, se documenta en campo `quality_notes` o `missing_details`

**TRANSPORTES Y MENSAJEROS**:
- [ ] Confeccionista → Viomar siempre va por SHIPMENT_TYPE='CONFECTIONIST_TO_VIOMAR'
- [ ] Viomar → Cliente va por SHIPMENT_TYPE='VIOMAR_TO_CLIENT'
- [ ] Estados de envío: PENDIENTE, EN_TRAYECTO, ENTREGADO, DEVUELTO, PERDIDO
- [ ] Cada shipment registra: departure_date, expected_arrival, actual_arrival

**EMPAQUE/DESPACHO - Confirmación Final**:
- [ ] Equipo de empaque recibe reporte de confeccionista
- [ ] Valida que cantidad recibida = cantidad esperada
- [ ] Si hay discrepancia, registra en `discrepancy_notes`
- [ ] Revisa calidad física: quality_check true/false
- [ ] Una vez OK, marca `ready_for_shipment = true`
- [ ] Después se genera automáticamente envío Viomar → Cliente

**ORDEN DE EJECUCIÓN**:
- [ ] ¿Empezamos FASE 1 completa HOY? (incluye diseños, confeccionistas y reportes básicos)
- [ ] ¿PHASE 2 (Purchase Orders) para cuándo? (semana próxima)
- [ ] ¿SIIGO integration es urgent? o espera FASE 3

---

## 7️⃣ RESUMEN VISUAL: NUEVAS TABLAS Y RELACIONES

```
CORE PRICING & CLIENTS:
├── client_types ────────────────┐
├── clients ──────┼──────────────┤
│     ↓           │              │
│   ├─ name (completo) ⭐        │
│   ├─ contact_name ⭐ NUEVO      │
│   ├─ identification_type ⭐ NUEVO (CC/NIT)
│   ├─ identification (único) ⭐
│   ├─ address ⭐ NUEVO
│   ├─ city ⭐
│   ├─ location ⭐ NUEVO
│   ├─ mobile_phone ⭐ NUEVO (obligatorio)
│   ├─ phone (fijo, opcional)
│   ├─ email (opcional)
│   └─ client_type_id ──→ client_types
│
├── products
│   └─ productPrices
│       └─ pricingTiers ◄─────────┤
│           └─ pricingRanges
│               ├─ price
│               ├─ currency (COP/USD)
│               ├─ min_qty
│               └─ max_qty
│
└── exchangeRates (histórico TRM)

ORDERS & DESIGN DETAILS:
├── orders
│   ├─ sales_channel (WEB/TIENDA/MAYORISTA)
│   ├─ clientId ──→ clients
│   └─ orderItems ─┐
│       ├─ productPriceId
│       ├─ unitPrice (luego de conversión USD→COP)
│       ├─ upper_fabric, lower_fabric ✨ NUEVO
│       ├─ upper_color, lower_color ✨ NUEVO
│       ├─ design_status ✨ NUEVO
│       ├─ designImages ◄────┐
│       │   ├─ image_url      │
│       │   ├─ image_type     │
│       │   ├─ fabric_info    │
│       │   └─ placement      │
│       ├─ confectionistReports ◄──┐
│       │   ├─ confectionist_id    │
│       │   ├─ status              │
│       │   ├─ quantity_expected   │
│       │   ├─ quantity_received   │
│       │   ├─ quality_notes       │
│       │   └─ shipmentTrackings ◄─┼──┐
│       │       ├─ messenger_id     │  │
│       │       ├─ shipment_type    │  │
│       │       │  ('CONFECTIONIST  │  │
│       │       │   _TO_VIOMAR')    │  │
│       │       ├─ status           │  │
│       │       ├─ departure_date   │  │
│       │       └─ actual_arrival   │  │
│       │                           │  │
│       └─ packagingConfirmations ◄──┘
│           ├─ packaging_staff_id
│           ├─ quantity_received
│           ├─ quality_check
│           ├─ discrepancy_notes
│           └─ shipmentTrackings (a cliente)
│               └─ shipment_type
│                  ('VIOMAR_TO_CLIENT')

SUPPLIERS & PURCHASES:
├── suppliers
│   ├─ name
│   ├─ identification
│   └─ siigo_supplier_code
│
├── purchaseOrders ◄────────── suppliers
│   ├─ code
│   ├─ status
│   ├─ siigo_document_id
│   └─ purchaseOrderItems
│       └─ inventoryItems
│
└── siigo_mappings
    └─ purchaseOrderId
```

---

## 8️⃣ TOTALES: NUEVAS ENTIDADES

**Nuevos Enums**: 6
- clientTypeEnum, salesChannelEnum, designImageTypeEnum
- confectionistStatusEnum, shipmentStatusEnum, packagingStatusEnum

**Nuevas Tablas**: 13
- clientTypes, pricingTiers, pricingRanges, exchangeRates
- design_images, confectionist_reports, messengers, shipment_trackings, packaging_confirmations
- suppliers, purchaseOrders, purchaseOrderItems, siigo_mappings

**Tablas Existentes Modificadas**: 3
- **order_items** (7 nuevos campos: upper_fabric, lower_fabric, upper_color, lower_color, design_status, confectionist_report_id, packaging_confirmation_id)
- **clients** (6 nuevos campos obligatorios prefactura: contact_name, identification_type, address, location, mobile_phone, client_type_id)
- **orders** (1 nuevo campo: sales_channel)

**Nuevas Rutas API**: 27
- 8 para precios y TRM
- 4 para diseños
- 4 para confeccionistas
- 7 para envíos y mensajeros
- 3 para empaque
- 2 para compras

---

## 📌 NOTAS IMPORTANTES

1. **Clientes Prefactura**: Ahora se capturan 6 campos obligatorios adicionales según layout real (contact_name, identification_type, address, location, mobile_phone)
2. **Retrocompatibilidad**: Todos los clientes existentes recibirán valores default temporales; luego actualizar con datos reales
3. **Precios**: Una vez definidos los `pricing_ranges`, son NO EDITABLES a menos que se creen nuevos
4. **Diseños Separados**: upper_fabric ≠ lower_fabric (pueden ser diferentes telas)
5. **Estados de Confeccionista**: Son 6 estados posibles desde RECIBIDO hasta ENVIADO_A_VIOMAR
6. **Shipments Bidireccionales**: shipment_trackings maneja CONFECTIONIST_TO_VIOMAR y VIOMAR_TO_CLIENT separadamente
7. **Empaque Confirma Cantidad**: packaging_confirmations valida cantidad esperada vs recibida
8. **SIIGO**: Los campos `siigo_*` en `purchase_orders` son placeholder; integración real en FASE 3
9. **Soft Delete**: Por ahora NO usamos soft delete (`deleted_at`), pero se puede agregar después

---

## ✅ DOCUMENTO FINAL LISTA PARA REVISAR

**Estado**: BLUEPRINT COMPLETO CON:
- ✅ **Clientes Prefactura**: Todos los campos obligatorios según layout real ⭐
- ✅ Gestión de precios COP/USD con TRM
- ✅ Tipos de cliente con descuentos
- ✅ Diseños detallados con fotos separadas
- ✅ Reportes de confeccionistas
- ✅ Seguimiento de envíos bidireccionales
- ✅ Confirmación de empaque/despacho
- ✅ Proveedores y compras (SIIGO placeholder)

**🔄 Siguiente Paso**: Confirma los 5 puntos de validación y ejecutamos el código 🚀

