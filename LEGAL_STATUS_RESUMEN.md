# MÓDULO JURÍDICO - RESUMEN EJECUTIVO
## Control de Estado Legal de Terceros

---

## 🎯 ¿Qué es?

Un módulo dentro del ERP que permite al **Departamento Jurídico** clasificar el estado legal de todos los terceros del negocio (Empleados, Clientes, Confeccionistas, Proveedores y Empaque).

Basado en cambios jurídicos (antecedentes, demandas, investigaciones), el sistema **habilita o inhabilita automáticamente** el acceso operativo del tercero.

---

## 4️⃣ Estados Disponibles

```
┌─────────────────────────────────────────┐
│  ✅ VIGENTE - Sin problemas             │
│     → Puede operar normalmente          │
│                                         │
│  ⏳ EN REVISIÓN - Bajo análisis         │
│     → Acceso limitado/pendiente         │
│                                         │
│  ⚠️  RESTRICCIÓN - Con limitaciones     │
│     → Operación restringida             │
│                                         │
│  🚫 BLOQUEADO - Prohibido               │
│     → Sin acceso al sistema             │
└─────────────────────────────────────────┘
```

---

## 💾 Información Registrada

| Dato | Descripción |
|------|-------------|
| **Estado** | Vigente / En Revisión / Restricción / Bloqueado |
| **Notas** | Explicación del estado (motivo, caso #, etc.) |
| **Revisor** | Quién realizó el cambio de estado |
| **Fecha** | Cuándo se revisó la información |

---

## 🔗 Vinculado a

- 👤 **Empleados**
- 🛒 **Clientes**  
- 👗 **Confeccionistas**
- 📦 **Proveedores**
- 📮 **Empaque**

---

## 📊 Ejemplo de Uso

### Caso 1: Nuevo Cliente
```
1. Cliente se registra → Estado "VIGENTE" automáticamente
2. Puede hacer pedidos inmediatamente
```

### Caso 2: Revisión de Antecedentes
```
1. Jurídica detecta antecedentes pendientes
2. Cambia estado a "EN REVISIÓN"
3. Sistema bloquea operaciones hasta aprobación
4. Jurídica completa revisión → Vuelve a "VIGENTE"
```

### Caso 3: Demanda Activa
```
1. Llega demanda contra un cliente
2. Jurídica cambia a "RESTRICCIÓN"
3. Cliente puede operar pero con limitaciones
4. Se registra nota con # de caso
```

### Caso 4: Fraude Comprobado
```
1. Se comprueba fraude de un proveedor
2. Jurídica cambia a "BLOQUEADO"
3. Sistema inhabilita al proveedor completamente
4. No aparece en listados de selección
```

---

## ✅ Beneficios

| Beneficio | Impacto |
|-----------|---------|
| 🔒 **Protección Legal** | Evita operar con terceros problemáticos |
| ⚡ **Automático** | Habilita/inhabilita sin intervención manual |
| 📋 **Trazabilidad** | Registro auditable de cada cambio |
| 🎯 **Control** | Un único lugar para gestionar estado jurídico |
| 📊 **Visibilidad** | Dashboard con resumen de estados |

---

## 📈 Dashboard Jurídico

```
┌─────────────────────────────────────────┐
│   ESTADO JURÍDICO - HOY                 │
├─────────────────────────────────────────┤
│  ✅ VIGENTES:         23                │
│  ⏳ EN REVISIÓN:      3                 │
│  ⚠️  RESTRICCIÓN:      2                 │
│  🚫 BLOQUEADOS:       1                 │
├─────────────────────────────────────────┤
│  Total de Terceros: 29                  │
│                                         │
│  📌 ACCIONES PENDIENTES:                │
│     • 3 terceros esperan revisión       │
│     • 1 restricción vence el viernes    │
└─────────────────────────────────────────┘
```

---

## 📱 Acciones Disponibles

### Para Jurídica
- ✏️ Cambiar estado de un tercero
- 📝 Agregar/editar notas
- 👁️ Ver historial de cambios
- 📊 Generar reportes por estado

### Sistema Automático
- 🔐 Bloquea operaciones según estado
- ⚠️ Alerta cuando hay restricciones
- 📧 Notifica cambios importantes
- 📋 Registra auditoría completa

---

## 🚀 Implementación

✅ **Tabla Base de Datos**: Creada  
⏳ **API Endpoints**: Por crear  
⏳ **Interfaz de Usuario**: Por crear  
⏳ **Validaciones de Negocio**: Por crear  

---

## ❓ Preguntas Frecuentes

**P: Si un cliente está en "EN REVISIÓN", ¿puede hacer pedidos?**  
R: No. El sistema bloquea operaciones automáticamente.

**P: ¿Se puede volver de "BLOQUEADO" a "VIGENTE"?**  
R: Sí, si Jurídica resuelve la situación.

**P: ¿Aparece el estado en reportes?**  
R: Sí, puede filtrar por estado en reportes.

**P: ¿Todos los módulos respetan el estado jurídico?**  
R: Sí, está integrado a Empleados, Clientes, Confeccionistas, Proveedores y Empaque.

---

**Próximos Pasos**:  
1. Aprobación del Departamento Jurídico
2. Desarrollo del API
3. Creación de interfaz de usuario
4. Pruebas en ambiente de desarrollo
5. Capacitación a usuarios Jurídicos y Gerencia

---

*Documento: Módulo Jurídico - Resumen Ejecutivo*  
*Fecha: 18 de Febrero de 2026*
