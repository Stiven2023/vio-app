# MATRIZ DE ESTADOS JURÍDICOS - GUÍA DE ACCIÓN

## Matriz de Estados y Comportamiento del Sistema

```
╔════════════════════════════════════════════════════════════════════════════════╗
║                         ESTADOS JURÍDICOS Y ACCIONES                          ║
╠════════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  ESTADO: ✅ VIGENTE                                                            ║
║  ─────────────────────────────────────────────────────────────────────────────║
║  ¿Cuándo se usa?                                                              ║
║    • Tercero sin problemas legales                                            ║
║    • Antecedentes limpios                                                     ║
║    • Estado por defecto al registrar                                          ║
║                                                                                ║
║  Acceso al sistema:                        ✅ COMPLETO                        ║
║  Puede crear pedidos:                      ✅ SÍ                              ║
║  Puede hacer pagos:                        ✅ SÍ                              ║
║  Aparece en selecciones:                   ✅ SÍ                              ║
║  Puede ser modificado:                     ✅ SÍ                              ║
║                                                                                ║
║  Acciones jurídicas disponibles:                                              ║
║    → Cambiar a "EN REVISIÓN" (si hay dudas)                                   ║
║    → Cambiar a "RESTRICCIÓN" (si hay problemas)                               ║
║    → Cambiar a "BLOQUEADO" (si hay sentencia)                                 ║
║                                                                                ║
╠════════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  ESTADO: ⏳ EN REVISIÓN                                                        ║
║  ─────────────────────────────────────────────────────────────────────────────║
║  ¿Cuándo se usa?                                                              ║
║    • Revisión de antecedentes en progreso                                     ║
║    • Investigación en curso                                                   ║
║    • Documentación pendiente de verificación                                  ║
║    • Cambios importantes en el tercero                                        ║
║                                                                                ║
║  Acceso al sistema:                        ⚠️  LIMITADO                       ║
║  Puede crear pedidos:                      ❌ NO                              ║
║  Puede hacer pagos:                        ❌ NO                              ║
║  Aparece en selecciones:                   ❌ NO                              ║
║  Puede ser modificado:                     ✅ SÍ (solo jurídica)              ║
║                                                                                ║
║  Acciones jurídicas disponibles:                                              ║
║    → Cambiar a "VIGENTE" (revisión OK)                                        ║
║    → Cambiar a "RESTRICCIÓN" (encontró problemas)                             ║
║    → Cambiar a "BLOQUEADO" (hallazgos graves)                                 ║
║                                                                                ║
║  Notas obligatorias:        ✅ Sí, debe especificar qué se revisa             ║
║                                                                                ║
╠════════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  ESTADO: ⚠️  RESTRICCIÓN                                                       ║
║  ─────────────────────────────────────────────────────────────────────────────║
║  ¿Cuándo se usa?                                                              ║
║    • Demanda civil o penal activa                                             ║
║    • Advertencia legal recibida                                               ║
║    • Incumplimiento normativo                                                 ║
║    • Problemas de pago o fraude menor                                         ║
║                                                                                ║
║  Acceso al sistema:                        ⚠️  RESTRINGIDO                    ║
║  Puede crear pedidos:                      ⚠️  CON APROBACIÓN               ║
║  Puede hacer pagos:                        ⚠️  CON SUPERVISIÓN              ║
║  Aparece en selecciones:                   ✅ SÍ (pero marcado)               ║
║  Puede ser modificado:                     ✅ SÍ (solo jurídica)              ║
║                                                                                ║
║  Acciones jurídicas disponibles:                                              ║
║    → Cambiar a "VIGENTE" (problema resuelto)                                  ║
║    → Cambiar a "BLOQUEADO" (empeora situación)                                ║
║                                                                                ║
║  Notas obligatorias:        ✅ Sí, debe incluir:                              ║
║                              - Tipo de problema (demanda, etc.)                ║
║                              - # de caso/juzgado                               ║
║                              - Restricción específica                          ║
║                                                                                ║
╠════════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  ESTADO: 🚫 BLOQUEADO                                                          ║
║  ─────────────────────────────────────────────────────────────────────────────║
║  ¿Cuándo se usa?                                                              ║
║    • Sentencia judicial ejecutada                                             ║
║    • Fraude comprobado                                                        ║
║    • Incumplimiento grave y reiterado                                         ║
║    • Incluido en lista negra                                                  ║
║                                                                                ║
║  Acceso al sistema:                        🚫 BLOQUEADO                       ║
║  Puede crear pedidos:                      ❌ NO                              ║
║  Puede hacer pagos:                        ❌ NO                              ║
║  Aparece en selecciones:                   ❌ NO                              ║
║  Puede ser modificado:                     ✅ SÍ (solo Admin + Jurídica)      ║
║                                                                                ║
║  Acciones jurídica disponibles:                                               ║
║    → Cambiar a "RESTRICCIÓN" (si situación mejora)                            ║
║    → Cambiar a "VIGENTE" (si se anula sentencia)                              ║
║                                                                                ║
║  Notas obligatorias:        ✅ Sí, CRÍTICO:                                   ║
║                              - Razón específica del bloqueo                    ║
║                              - # de sentencia/caso                             ║
║                              - Fecha de efectividad                            ║
║                              - Contacto responsable                            ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝
```

---

## 📊 Flujo de Cambios de Estado

```
                           ┌─────────────┐
                           │   VIGENTE   │ ← Estado Inicial
                           └─────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ↓            ↓            ↓
            ┌───────────┐  ┌───────────┐  ┌─────────┐
            │EN REVISIÓN│  │RESTRICCION│  │BLOQUEADO│
            └───────────┘  └───────────┘  └─────────┘
                │ │         │  │  ↓      ↓  │
                │ │         │  │  └──────┘  │
                └─┼─────┬───┘  │            │
                  │     │      └────────────┘
                  ↓     ↓           ↑
            ┌─────────────────┐    │
            │    VIGENTE      │────┘
            └─────────────────┘

LEYENDA:
→ Cambios posibles (flecha sólida)
⊙ Estado inicial
✓ Cambio requiere aprobación
⚠ Cambio genera notificación
```

---

## 🔄 Transiciones Permitidas

| De ↓ A → | VIGENTE | EN_REVISIÓN | RESTRICCIÓN | BLOQUEADO |
|----------|---------|-------------|-------------|-----------|
| **VIGENTE** | - | ✅ | ✅ | ✅ |
| **EN_REVISIÓN** | ✅ | - | ✅ | ✅ |
| **RESTRICCIÓN** | ✅ | ✅ | - | ✅ |
| **BLOQUEADO** | ✅ (raro) | ✅ | ✅ | - |

**Notas:**
- ✅ = Transición permitida
- Todas las transiciones requieren nota explicativa
- Solo Jurídica + Admin pueden hacer cambios
- Cambios se registran en auditoría

---

## 📋 Checklist de Campos por Estado

### Cambiar a EN_REVISIÓN
- [ ] Campo "Notas" obligatorio
- [ ] Especificar: "Revisión de antecedentes", "Investigación por...", etc.
- [ ] Indicar revisor (persona responsable)
- [ ] Establecer fecha aproximada de resolución

### Cambiar a RESTRICCIÓN
- [ ] Campo "Notas" obligatorio
- [ ] Tipo de restricción (demanda, advertencia, etc.)
- [ ] Número de caso/juzgado (si aplica)
- [ ] Detallar las operaciones afectadas
- [ ] Incluir contacto del caso (abogado, juzgado)

### Cambiar a BLOQUEADO
- [ ] Campo "Notas" CRÍTICO - Muy detallado
- [ ] Razón específica (fraude, sentencia, etc.)
- [ ] Referencia legal/case number
- [ ] Fecha de efectividad
- [ ] Contacto responsable de supervisar

### Cambiar a VIGENTE (desde cualquier estado)
- [ ] Campo "Notas" recomendado
- [ ] Documentar cómo se resolvió
- [ ] Evidencia de resolución
- [ ] Aprobación de jurídica

---

## 📧 Notificaciones Automáticas

El sistema notifica automáticamente a:

| Evento | Notificación a | Tipo |
|--------|----------------|------|
| Cambio a EN_REVISIÓN | Gerencia | ⚠️ Advertencia |
| Cambio a RESTRICCIÓN | Gerencia + Operaciones | 🚨 Alerta |
| Cambio a BLOQUEADO | Gerencia + CEO + Jurídica | 🚨 Crítica |
| Cambio a VIGENTE | Jurídica + Operaciones | ✅ Información |

---

## 📊 Dashboard - Indicadores Clave

```
INDICADORES POR ESTADO:
├─ VIGENTES: Número de terceros sin problemas
├─ EN_REVISIÓN: Tiempo promedio de revisión
├─ RESTRICCIÓN: Valor total en riesgo
├─ BLOQUEADOS: Número de casos cerrados

ALERTAS AUTOMÁTICAS:
├─ Terceros en EN_REVISIÓN > 30 días
├─ Restricciones por vencer
├─ Cambios recientes (últimas 24h)
└─ Pendientes de aprobación
```

---

**Documento**: Matriz de Estados Jurídicos  
**Versión**: 1.0  
**Fecha**: 18 de Febrero de 2026  
**Clasificación**: Uso interno Departamento Jurídico
