# RH/HCM Batch Checklist Template

Usa esta plantilla con el prompt "RH HCM Batch Builder".

## 1) RH Checklist

Ruta objetivo RH: `<ruta>`

- [ ] Componente: `<nombre-componente-rh>`
  - Proposito: `<que resuelve>`
  - Props/entrada: `<resumen>`
- [ ] Hook: `<use-hook-rh>`
  - Proposito: `<que resuelve>`
  - Dependencias: `<api/store/otros>`
- [ ] Servicio: `<servicio-rh>`
  - Operaciones: `<fetch/create/update/delete>`
  - Endpoint o fuente: `<url o modulo>`

## 2) HCM Checklist

Ruta objetivo HCM: `<ruta>`

- [ ] Componente: `<nombre-componente-hcm>`
  - Proposito: `<que resuelve>`
  - Props/entrada: `<resumen>`
- [ ] Hook: `<use-hook-hcm>`
  - Proposito: `<que resuelve>`
  - Dependencias: `<api/store/otros>`
- [ ] Servicio: `<servicio-hcm>`
  - Operaciones: `<fetch/create/update/delete>`
  - Endpoint o fuente: `<url o modulo>`

## 3) Reglas de dominio

- RH y HCM no se mezclan en los mismos archivos.
- Si hay compartido, debe ser neutral y justificado.
- Convencion de nombres: seguir `rh-hcm-naming.instructions.md`.

## 4) Criterios de aceptacion

- [ ] Cumple separacion por carpetas RH/HCM.
- [ ] Typecheck pasa sin errores.
- [ ] Imports cruzados RH<->HCM inexistentes o justificados por adaptador neutral.
- [ ] Componentes, hooks y servicios documentados en el resumen final.
