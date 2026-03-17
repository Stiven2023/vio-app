# English Naming Migration Plan (Routes and API)

## Goal
Rename Spanish route/API folder names to English in controlled phases without breaking navigation, permissions, or business flows.

## Scope Confirmed in Current Repo

### ERP routes with Spanish names (current)
- `app/erp/abonos`
- `app/erp/aprobacion-inicial`
- `app/erp/comercial`
- `app/erp/compras`
- `app/erp/contabilidad`
- `app/erp/contabilidad-modulo`
- `app/erp/costos`
- `app/erp/depositos`
- `app/erp/en-construccion`
- `app/erp/envios`
- `app/erp/juridica`
- `app/erp/maestros`
- `app/erp/molderia`
- `app/erp/pagos`
- `app/erp/prefacturas`
- `app/erp/produccion`
- `app/erp/programacion`
- `app/erp/rh`

### API roots with Spanish names (current)
- `app/api/contabilidad`
- `app/api/pagos`
- `app/api/prefacturas`
- `app/api/programacion`

## Proposed Naming Map

### ERP routes
- `abonos` -> `installments`
- `aprobacion-inicial` -> `initial-approval`
- `comercial` -> `sales`
- `compras` -> `purchases`
- `contabilidad` -> `accounting`
- `contabilidad-modulo` -> `accounting-module`
- `costos` -> `costs`
- `depositos` -> `deposits`
- `en-construccion` -> `under-construction`
- `envios` -> `shipments`
- `juridica` -> `legal`
- `maestros` -> `master-data`
- `molderia` -> `patterns`
- `pagos` -> `payments`
- `prefacturas` -> `pre-invoices`
- `produccion` -> `production`
- `programacion` -> `scheduling`
- `rh` -> `hr`

### API roots
- `contabilidad` -> `accounting`
- `pagos` -> `payments` (already also exists)
- `prefacturas` -> `pre-invoices`
- `programacion` -> `scheduling`

## Migration Strategy (Phased)

### Phase 1 - Low-risk route names first
Target:
- `en-construccion`, `costos`, `rh`, `molderia`, `juridica`

Actions:
1. Rename route folders.
2. Update all `href` and `redirect` references.
3. Keep temporary redirects from old path to new path in middleware/pages.

Validation:
- Manual nav test from navbar and direct URL access.
- Ensure no 404 for old bookmarked routes.

### Phase 2 - Accounting namespace cleanup
Target:
- `contabilidad`, `contabilidad-modulo`, `depositos`
- `app/api/contabilidad`

Actions:
1. Decide canonical route (`/erp/accounting` recommended).
2. Move/merge module routes as needed.
3. Add API alias or route handlers from old to new namespace during transition.

Validation:
- End-to-end accounting flows (consignaciones/receipts/deposits).

### Phase 3 - Critical business flows
Target:
- `prefacturas`, `pagos`, `abonos`, `programacion`, `produccion`, `comercial`
- `app/api/prefacturas`, `app/api/pagos`, `app/api/programacion`

Actions:
1. Rename folders and API namespaces.
2. Update all fetch URLs and server actions.
3. Preserve backward compatibility aliases for at least one release.

Validation:
- Full quote -> pre-invoice -> payment -> scheduling -> production flow.

### Phase 4 - Purchases and shipping tree
Target:
- `compras`, `envios`

Actions:
1. Rename top-level routes and nested route segments.
2. Update references in navbar and deep links.

Validation:
- Warehouse/inventory/dispatch/shipping journeys.

## Technical Execution Checklist (per phase)
1. Create dedicated branch: `feat/rename-routes-phase-X`.
2. Rename folders.
3. Update imports with language-server rename or project-wide replace.
4. Update route strings in:
- navbar config
- redirects
- client-side links
- API fetch paths
5. Add temporary compatibility redirects/aliases.
6. Run checks:
- `pnpm exec eslint .`
- `pnpm build`
7. Smoke test affected modules.

## Hotspots to update first
- `components/navbar.data.ts` (main route href matrix)
- `middleware.ts` (public paths and canonical redirects)
- `app/erp/*/page.tsx` files with `redirect(...)`
- `app/erp/prefacturas/_components/prefacturas-tab.tsx` and related pre-invoice components

## Rollback and Safety
- Keep each phase in separate PR.
- Do not combine route renames and business logic changes in the same PR.
- Maintain old-path redirects for 1-2 sprints.
- Track 404s in logs after deployment.

## Suggested PR sequence
1. PR-1: low-risk routes (phase 1)
2. PR-2: accounting namespace (phase 2)
3. PR-3: pre-invoice/payments/scheduling/production/sales (phase 3)
4. PR-4: purchases/shipments (phase 4)
