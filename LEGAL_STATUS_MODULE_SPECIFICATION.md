# MÓDULO DE ESTADO JURÍDICO
## Especificación de Requisitos Funcionales

---

## 📋 Resumen Ejecutivo

Se implementa un módulo de **Gestión del Estado Jurídico** integrado a los módulos de terceros (Empleados, Clientes, Confeccionistas, Proveedores y Empaque) que permite el departamento jurídico clasificar y controlar el estado legal de cada tercero en el sistema.

Este módulo habilita o inhabilita automáticamente el acceso operativo de un tercero según su estado jurídico, garantizando que solo terceros vigentes puedan participar en operaciones del negocio.

---

## 🎯 Objetivo

Permitir que el área jurídica registre y controle cambios en la situación legal de terceros debidos a:
- Revisión de antecedentes
- Demandas o casos legales
- Investigaciones
- Advertencias legales
- Problemas de cumplimiento normativo

---

## 📊 Módulos Involucrados

El módulo jurídico está enlazado a los siguientes módulos de terceros:

| Módulo | Descripción |
|--------|-------------|
| 👤 **Empleados** | Personal interno de la organización |
| 🛒 **Clientes** | Compradores de productos |
| 👗 **Confeccionistas** | Proveedores de servicios de confección |
| 📦 **Proveedores** | Suministradores de materiales |
| 📮 **Empaque** | Proveedores de servicios de empaque |

---

## 🔑 Estados Jurídicos Disponibles

### 1. **VIGENTE** ✅
- **Descripción**: Tercero sin problemas legales, puede operar sin restricciones
- **Acción**: El tercero tiene acceso completo al sistema
- **Flujo Normal**: Estado por defecto

### 2. **EN REVISIÓN** ⏳
- **Descripción**: Tercero bajo revisión jurídica, operación pendiente de aprobación
- **Acción**: El tercero puede tener acceso limitado o nulo hasta desaprobación
- **Caso de Uso**: Antecedentes pendientes de verificación, investigaciones en curso

### 3. **RESTRICCIÓN** ⚠️
- **Descripción**: Tercero con restricciones legales o limitaciones 
- **Acción**: El tercero opera bajo ciertos límites o prohibiciones específicas
- **Caso de Uso**: Demandas, advertencias legales, incumplimientos

### 4. **BLOQUEADO** 🚫
- **Descripción**: Tercero prohibido de operar inmediatamente
- **Acción**: El tercero pierde acceso total al sistema
- **Caso de Uso**: Sentencias judiciales, fraudes comprobados, lista negra

---

## 📝 Información Registrada

### Campos Principales

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| **ID** | UUID | ✅ | Identificador único del registro |
| **Tipo de Tercero** | Enum | ✅ | Categoría del tercero (Empleado, Cliente, etc.) |
| **ID del Tercero** | UUID | ✅ | Referencia al tercero específico |
| **Nombre del Tercero** | Texto | ✅ | Nombre denormalizado para búsqueda rápida |
| **Estado Jurídico** | Enum | ✅ | VIGENTE / EN_REVISIÓN / RESTRICCIÓN / BLOQUEADO |
| **Notas/Observaciones** | Texto | ❌ | Detalle de la situación (motivo, descripción, etc.) |
| **Revisado Por** | Usuario | ❌ | Quién realizó la última revisión |
| **Fecha Revisión** | Fecha | ❌ | Cuándo se realizó la última revisión |

---

## 🔄 Flujos de Operación

### Flujo 1: Registrar Tercero Vigente
```
1. Empleado/Cliente/etc. se registra en el sistema
2. Sistema crea automáticamente registroEstadoJurídico con estado "VIGENTE"
3. Tercero puede operar inmediatamente
```

### Flujo 2: Cambiar Estado a "EN REVISIÓN"
```
1. Departamento Jurídico inicia revisión de antecedentes
2. Cambia estado a "EN REVISIÓN"
3. Sistema restringe acceso automáticamente
4. Se registra nota descriptiva
5. Al completar: Cambiar a "VIGENTE" o "RESTRICCIÓN"
```

### Flujo 3: Cambiar Estado a "RESTRICCIÓN"
```
1. Se detecta demanda o problema legal contra el tercero
2. Cambia estado a "RESTRICCIÓN"
3. Sistema aplica limitaciones operacionales
4. Se registra nota con detalle de restricción
5. Tercero continúa en el sistema pero con limitaciones
```

### Flujo 4: Cambiar Estado a "BLOQUEADO"
```
1. Sentencia judicial o fraude comprobado
2. Cambia estado a "BLOQUEADO"
3. Sistema inhabilita completamente al tercero
4. Se registra nota explicativa
5. Tercero no puede operar
```

---

## ⚙️ Integración con Módulos

### Validaciones Automáticas

Cada módulo verificará el estado jurídico antes de permitir operaciones:

| Operación | VIGENTE | EN_REVISIÓN | RESTRICCIÓN | BLOQUEADO |
|-----------|---------|-------------|-------------|-----------|
| Ver/Consultar | ✅ | ✅ | ✅ | ✅ |
| Crear Orden | ✅ | ❌ | ⚠️* | ❌ |
| Editar Datos | ✅ | ⚠️* | ⚠️* | ❌ |
| Efectuar Pagos | ✅ | ❌ | ⚠️* | ❌ |
| Reportes | ✅ | ✅ | ✅ | ✅ |

*⚠️ Requiere aprobación especial o validación adicional

---

## 📱 Vistas y Funcionalidades

### Tabla de Estado Jurídico
- Listar todos los terceros con su estado jurídico
- Filtrar por: Tipo de Tercero, Estado, Fecha de Cambio
- Columnas: Código, Nombre, Tipo, Estado, Última Revisión, Acciones

### Card/Modal de Detalle
- Información completa del tercero
- Estado actual
- Notas/Observaciones
- Historial de cambios (opcional)
- Botón: Cambiar Estado

### Formulario de Cambio de Estado
- Seleccionar nuevo estado
- Campo de notas (obligatorio si es cambio importante)
- Seleccionar revisor (usuario)
- Guardar cambios

---

## 📊 Dashboard Jurídico

Información recomendada a mostrar:

```
┌──────────────────────────────────────┐
│  ESTADO JURÍDICO - RESUMEN           │
├──────────────────────────────────────┤
│  VIGENTES:           23  ✅          │
│  EN REVISIÓN:        3   ⏳          │
│  RESTRICCIÓN:        2   ⚠️          │
│  BLOQUEADOS:         1   🚫          │
│                      ────            │
│  TOTAL:              29              │
├──────────────────────────────────────┤
│  ÚLTIMA REVISIÓN:   Hoy a las 10:30  │
│  PRÓXIMA REVISIÓN:  Viernes          │
└──────────────────────────────────────┘
```

---

## 🔐 Permisos de Acceso

Se recomienda crear los siguientes permisos en el sistema:

| Permiso | Descripción |
|---------|-------------|
| `VER_ESTADO_JURIDICO` | Ver list de estados jurídicos |
| `EDITAR_ESTADO_JURIDICO` | Cambiar estado de un tercero |
| `CREAR_ESTADO_JURIDICO` | Crear nuevo registro jurídico |

**Roles Asignados**: Jurídico, Administrador, (opcional) Gerencia

---

## 📈 Reportes

Reportes recomendados:

1. **Reporte de Estados Jurídicos** - Listado completo de terceros y sus estados
2. **Reporte de Cambios** - Terceros cuyo estado cambió en un período
3. **Reporte de Revisiones Pendientes** - Terceros en "EN_REVISIÓN" por más de X días
4. **Reporte de Restricciones Activas** - Terceros en estado de restricción

---

## 📋 Información Técnica

### Tabla Base de Datos
```
Tabla: legal_status_records

Campos principales:
- id (UUID, PK)
- third_party_id (UUID, FK)
- third_party_type (ENUM: EMPLEADO, CLIENTE, CONFECCIONISTA, PROVEEDOR, EMPAQUE)
- third_party_name (VARCHAR)
- status (ENUM: VIGENTE, EN_REVISIÓN, RESTRICCIÓN, BLOQUEADO)
- notes (TEXT)
- reviewed_by (UUID, FK → users)
- last_review_date (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### API Endpoints

```
GET    /api/legal-status              → Listar todos
GET    /api/legal-status?type=EMPLEADO → Filtrar por tipo
GET    /api/legal-status/:id          → Obtener uno
POST   /api/legal-status              → Crear
PUT    /api/legal-status/:id          → Actualizar estado
DELETE /api/legal-status/:id          → Eliminar (opcional)
```

---

## ✅ Beneficios Esperados

- ✅ **Control Centralizado**: Un solo lugar para gestionar estado jurídico de todos los terceros
- ✅ **Automatización**: Habilita/inhabilita acceso automáticamente
- ✅ **Auditoría**: Registro completo de cambios y decisiones
- ✅ **Riesgo Reducido**: Evita operaciones con terceros problemáticos
- ✅ **Cumplimiento**: Facilita cumplimiento normativo y legal
- ✅ **Trazabilidad**: Quién y cuándo se hizo cada cambio

---

**Última Actualización**: 18 de Febrero de 2026  
**Responsable**: Área de Desarrollo / Departamento Jurídico
