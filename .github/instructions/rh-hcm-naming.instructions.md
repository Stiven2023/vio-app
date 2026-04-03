---
name: "RH HCM Naming Convention"
description: "Use when: definir o aplicar convenciones de nombres para componentes, hooks y servicios en modulos RH y HCM."
applyTo:
  - "app/hr/**"
  - "app/hcm/**"
  - "src/**/hr/**"
  - "src/**/hcm/**"
---

Convencion de nombres para RH/HCM:

1. Carpetas por dominio
- RH: `hr`.
- HCM: `hcm`.
- Mantener nombres de area en kebab-case: `social-security-pila`, `payroll-provisions`.

2. Componentes React
- Archivo en kebab-case: `employee-card.tsx`, `pila-summary-table.tsx`.
- Componente en PascalCase: `EmployeeCard`, `PilaSummaryTable`.
- Componentes internos de pagina en `_components/`.

3. Hooks
- Archivo: `use-<objetivo>.ts` en kebab-case (`use-payroll-preview.ts`).
- Export principal inicia con `use` en camel/Pascal correcto: `usePayrollPreview`.
- Hooks RH y HCM deben vivir en sus respectivas carpetas de dominio.

4. Servicios
- Archivo: `<area>.service.ts` o `<accion>-<area>.service.ts`.
- Exportar funciones con verbos de negocio (`fetchPayrollDraft`, `createLeaveRequest`).
- No usar servicios RH dentro de HCM ni viceversa; interoperabilidad via adaptadores neutrales.

5. Tipos y utilidades
- Tipos de dominio en `types.ts` o `<area>.types.ts` por modulo.
- Utilidades compartidas solo si son neutrales al dominio y sin reglas RH/HCM.

6. Paginas y rutas
- `page.tsx` por ruta, con responsabilidad de composicion.
- Logica de negocio fuera de `page.tsx`; mover a hooks/servicios del mismo dominio.

7. Reporte de cambios
- Siempre reportar secciones separadas: RH, HCM y Shared-neutral (si aplica).
