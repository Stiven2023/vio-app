---
name: "RH HCM Separation Rules"
description: "Use when: crear, refactorizar o revisar componentes/hooks/servicios de RH y HCM; aplicar separacion estricta por dominio y carpetas."
applyTo:
  - "app/hr/**"
  - "app/hcm/**"
  - "src/**/hr/**"
  - "src/**/hcm/**"
  - "components/**hr**"
  - "components/**hcm**"
---

Reglas obligatorias para trabajo en RH/HCM:

1. Separacion por dominio
- RH y HCM deben vivir en carpetas separadas.
- No mezclar logica RH y HCM en el mismo componente, hook o servicio.

2. Reutilizacion segura
- Si hay codigo comun, extraer utilidades pequenas y neutrales al dominio.
- Evitar artefactos "shared" con reglas de negocio RH/HCM mezcladas.

3. Dependencias y contratos
- RH no debe importar servicios internos de HCM, ni HCM de RH.
- Si se requiere interoperabilidad, usar interfaces claras y adaptadores explicitos.

4. Entregables
- Reportar cambios en dos bloques: RH y HCM.
- Incluir validacion tecnica minima (por ejemplo typecheck) y riesgos detectados.
