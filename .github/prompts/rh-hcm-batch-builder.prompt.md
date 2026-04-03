---
name: "RH HCM Batch Builder"
description: "Crear un lote de componentes, hooks y servicios RH/HCM desde un checklist, manteniendo separacion por carpetas y dominio."
argument-hint: "Pega checklist por modulo (RH/HCM), rutas objetivo, dependencias y criterios de aceptacion."
agent: "RH HCM Component Builder"
---
Construye un lote de artefactos para RH y HCM a partir de un checklist de trabajo.

Plantilla sugerida:
- `docs/RH_HCM_BATCH_CHECKLIST_TEMPLATE.md`

Entradas esperadas:
- Checklist RH (componentes/hooks/servicios).
- Checklist HCM (componentes/hooks/servicios).
- Rutas objetivo por modulo.
- Criterios de aceptacion y reglas de negocio clave.

Objetivo:
1. Implementar todos los items del checklist por modulo, sin mezclar dominios.
2. Separar salidas en carpetas RH y HCM.
3. Reutilizar solo utilidades neutrales cuando sea necesario.
4. Validar integridad tecnica al final (typecheck o verificacion equivalente).

Formato de salida obligatorio:
1. Cambios RH (archivos y resumen funcional).
2. Cambios HCM (archivos y resumen funcional).
3. Elementos compartidos creados (si aplica) y justificacion.
4. Resultado de validacion tecnica.
5. Pendientes o bloqueos para completar el checklist.
