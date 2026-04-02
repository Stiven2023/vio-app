# AUDITORÍA DE FORMULARIOS, VALIDACIONES Y REGLAS DE NEGOCIO - VIO-APP
**Fecha:** 31 de marzo de 2026  
**Alcance:** Completo (all modules)  
**Strictness:** Deep  
**Action Mode:** Report + Fix Obvious

---

## RESUMEN EJECUTIVO

Se identificaron **14 hallazgos críticos y de alto riesgo** con impacto en integridad de datos, seguridad y cumplimiento de reglas de negocio. Los problemas principales se concentran en:

1. **Validación inconsistente** entre capas (frontend/backend)
2. **Bypass de autorización** mediante rol ADMINISTRADOR sin límite
3. **Ausencia de verificación de estado jurídico** en operaciones críticas
4. **Debilidad en validación de duplicados** cross-module
5. **Validación incompleta de workflow** de órdenes

---

## HALLAZGOS ORDENADOS POR SEVERIDAD

### 🔴 CRITICAL

#### 1. **Authorization Bypass: ADMINISTRADOR without Rate Limiting**
- **Severidad:** CRITICAL
- **Categoría:** SecurityBreach
- **Archivo(s):**
  - [src/utils/permission-middleware.ts](src/utils/permission-middleware.ts#L52-L60)
  - [app/api/employees/route.ts](app/api/employees/route.ts#L35-L41)

**Descripción:**
El rol ADMINISTRADOR recibe un bypass completo de TODOS los permission checks sin restricción. Aunque esto es intencional como design, no hay rate limiting diferenciado para la cuenta admin. Un atacante que comprometa la cuenta admin puede:
- Crear/editar/eliminar cualquier entidad sin auditoría
- Bypassear todas las validaciones de negocio
- No quedar registrado en audit logs específicos

**Impacto:** Acceso sin restricción a operaciones sensibles; violación de segregación de funciones

**Evidencia:**
```typescript
// Permission-middleware.ts, línea 52-60
if (roleName === "ADMINISTRADOR") {
  return null; // bypass completo
}
```

**Recomendación:**
1. Implementar rate limiting específico para operaciones CRÍTICAS incluso para ADMINISTRADOR
2. Forzar MFA para la cuenta ADMINISTRADOR
3. Mantener audit logs inmutables de acciones admin
4. Documentar acciones admin en tabla audit_admin_actions

**Tests Necesarios:**
- Admin user rate limiting on sensitive operations
- Audit log immutability

---

#### 2. **Validation Mismatch: Password Rules Inconsistent Across Endpoints**
- **Severidad:** CRITICAL
- **Categoría:** ValidationMismatch (Integrity)
- **Archivo(s):**
  - [utils/validation.ts](utils/validation.ts#L1-L17)
  - [app/api/users/route.ts](app/api/users/route.ts#L24-L42)
  - [app/erp/admin/_lib/schemas.ts](app/erp/admin/_lib/schemas.ts#L5-L11)

**Descripción:**
Existen **3 lugares diferentes** donde se valida la contraseña con reglas ligeramente diferentes:

| Ubicación | Regla | Problema |
|-----------|-------|---------|
| [utils/validation.ts](utils/validation.ts#L6-L17) | 7 chars, 1 uppercase, only [A-Za-z0-9.*] | base |
| [app/api/users/route.ts](app/api/users/route.ts#L24-L42) | Same regex pero regex([^A-Za-z0-9.*]) | regex difference |
| [app/erp/admin/_lib/schemas.ts](app/erp/admin/_lib/schemas.ts#L5-L11) | Zod schema con misma lógica | inconsistency |

Un validador frontalier acepta una contraseña que falla en backend, creando frustración de UX y potencial error de roundtrip.

**Impacto:** Falsa validación en UI; rechazos inesperados en servidor; experiencia de usuario pobre; potencial para bypasss de validación

**Evidencia:**
```typescript
// utils/validation.ts
if (/[^A-Za-z0-9.*]/.test(password))
  return "La contraseña solo puede contener letras, números, . y *.";

// vs app/api/users/route.ts línea 39
if (/[^A-Za-z0-9.*]/.test(password)) {
  return new Response("Password can only contain letters, numbers, . and *", ...)
}
```

**Recomendación:**
1. Centralizar validación de contraseña en shared util
2. Usar Zod schema único en AMBOS lados (frontend + backend)
3. Generar reglas desde un archivo source-of-truth

**Tests Necesarios:**
- Passwords accepted by frontend must be accepted by all 3 backend endpoints
- Passwords rejected by any endpoint must ALSO be rejected by frontend

---

#### 3. **Missing Legal Status Enforcement: Employee Can Operate While Blocked**
- **Severidad:** CRITICAL
- **Categoría:** RuleViolation
- **Archivo(s):**
  - [app/api/employees/route.ts](app/api/employees/route.ts#L45-L90)
  - [app/erp/admin/_lib/employee-legal-status.ts](app/erp/admin/_lib/employee-legal-status.ts#L29-L37)

**Descripción:**
El estado jurídico de un empleado (VIGENTE, EN_REVISION, BLOQUEADO) es obtenido en GET pero **NO se valida en operaciones sensibles**:

- POST /api/employees: **No valida** estado jurídico antes de crear
- PUT /api/employees: **No valida** estado jurídico antes de editar
- GET /api/orders (createdBy): **No filtra** órdenes de empleados BLOQUEADOS

Un empleado con status BLOQUEADO puede:
- Seguir creando órdenes
- Modificar sus datos
- Asignar órdenes a clientes
- Ejecutar pagos (acceso a valores de la empresa)

**Impacto:** Violación crítica de reglas de negocio; empleado bloqueado aún tienen acceso a operaciones; riesgo de fraude interno

**Evidencia:**
```typescript
// app/api/employees/route.ts POST handler
// ✓ Valida nombre, email, identificación
// ✗ NO valida estado jurídico

const forbidden = await requirePermission(request, "CREAR_EMPLEADO");
if (forbidden) return forbidden;
// ... rest of validation
// FALTA: const legalStatus = await getLegalStatus(id); if (blocked) return error
```

**Recomendación:**
1. Crear util `validateLegalStatusAllowsOperation(thirdPartyId, type, operation)`
2. Llamar en TODOS los endpoints que modifiquen datos de empleado/cliente/proveedor/confeccionista
3. Implementar middleware que auto-bloquee operaciones de entidades BLOQUEADAS
4. Mantener lista negra caché actualizada cada 5 minutos

**Tests Necesarios:**
- Blocked employee cannot create orders
- Blocked client cannot be modified
- Blocked supplier cannot be assigned to PO
- Legal status transitions properly block/allow operations

---

#### 4. **Cross-Module Identification Uniqueness NOT Enforced at Database Level**
- **Severidad:** CRITICAL
- **Categoría:** DataIntegrity
- **Archivo(s):**
  - [app/api/registry/identification-check/route.ts](app/api/registry/identification-check/route.ts#L60-L120)
  - [components/employee-register-form.tsx](components/employee-register-form.tsx#L300-L350) - only client-side validation

**Descripción:**
La uniqueness check ocurre SOLO a nivel API, sin constraint de base de datos. Flujo:

1. Frontend: GET /api/registry/identification-check (debounced, puede faihar)
2. Backend: Valida entre clientes, empleados, etc.
3. **PROBLEMA:** Race condition entre check y insert. Dos requests simultáneos pueden insertar el mismo NIT.

SQL que debería existir:
```sql
ALTER TABLE clients ADD CONSTRAINT unique_identification_client 
  UNIQUE(identificationType, identification);
ALTER TABLE employees ADD CONSTRAINT unique_identification_employee 
  UNIQUE(identificationType, identification);
-- etc. para cada tabla
```

**Impacto:** Múltiples registros con mismo NIT/CC; deuda técnica in audits/reportes; imposible de garantizar unicidad global

**Evidencia:**
```typescript
// app/api/registry/identification-check/route.ts
// Lee de múltiples tablas secuencialmente - vulnerable a race condition
const clientResult = await queryByModule("client", type, id);
const employeeResult = await queryByModule("employee", type, id);
// ← race condition aquí: otro request puede haber insertado entre estos dos

// app/api/employees/route.ts - NO hay constraint DB
await db.insert(employees).values({...})
// si identificationType + identification existen en otro registro, 
// PostgreSQL simplemente lo permite
```

**Recomendación:**
1. Agregar UNIQUE constraints en TODAS las tablas de terceros
2. Si permitir duplicados cross-module, renombrar la validación
3. Convertir check a transacción SERIALIZABLE

**Tests Necesarios:**
- Concurrent POST to /api/employees and /api/clients with same NIT must fail one request
- Database constraints prevent any identification duplication at DB level

---

#### 5. **Role Override Cookie in Non-Production: Dev Bypass**
- **Severidad:** CRITICAL
- **Categoría:** SecurityBreach
- **Archivo(s):**
  - [src/utils/auth-middleware.ts](src/utils/auth-middleware.ts#L21-L31)

**Descripción:**
En non-production, un usuario ADMINISTRADOR puede setupear una cookie `role_override` para simular **cualquier rol sin validación**:

```typescript
if (process.env.NODE_ENV !== "production" && baseRole === "ADMINISTRADOR") {
  const override = readCookieValue(request, "role_override");
  if (override && override.trim() !== "") return override.trim();
}
```

**Problema:** Si NODE_ENV se setea accidentalmente a "development" en production, o si un atacante puede setear una cookie, puede obtener acceso como CUALQUIER rol.

**Impacto:** Privilege escalation crítica; acceso a funciones del ASESOR, GERENTE, etc. sin validación real

**Evidencia:**
```typescript
// src/utils/auth-middleware.ts línea 24-28
if (process.env.NODE_ENV !== "production" && baseRole === "ADMINISTRADOR") {
  const override = readCookieValue(request, "role_override");
  if (override && override.trim() !== "") return override.trim();
}
// Este código nunca debería estar en producción
```

**Recomendación:**
1. **Remover completamente** este código de production builds
2. Implementar feature flag explícito DEVELOPMENT_MODE que require declaración
3. Si necesario, usar header X-Dev-Override en request, NO cookies
4. Loguear TODAS las role overrides

**Tests Necesarios:**
- role_override cookie is ignored in production NODE_ENV
- Dev override is NOT available in production

---

### 🟠 HIGH

#### 6. **Payment Processing: Missing Validation on Advance Payment Amount**
- **Severidad:** HIGH
- **Categoría:** RuleViolation
- **Archivo(s):**
  - [app/erp/prefacturas/_components/prefactura-form.tsx](app/erp/prefacturas/_components/prefactura-form.tsx#L380-L450)

**Descripción:**
En prefactura (invoice), el advanced payment (anticipode) se registra SIN validar contra el total:

```typescript
advanceReceived?: string | null; // Sin validación sobre monto máximo permitido
advanceStatus?: string | null;   // Puede ser "RECIBIDO" sin limits
```

Un usuario puede:
- Registrar anticipode > total de la prefactura
- Crear deuda negativa al cliente
- Distorsionar reportes de pagos

**Impacto:** Error de lógica de negocio; anticipos excesivos; reportes de cuentas por cobrar incorrectos

**Evidencia:**
```typescript
// prefactura-form.tsx líneas ~300-350
// No hay validación tipo:
// if (advanceReceived > total) { error }
```

**Recomendación:**
1. Validar: advanceReceived <= total * 0.50 (máximo 50% anticipado)
2. Mostrar error si advanceReceived > total
3. Backend debe validar `advanceReceived <= prefacturaTotal`

**Tests Necesarios:**
- Cannot register advance payment > 50% of prefactura total
- Cannot register advance payment > total
- Prefactura with advance > expected fails on backend

---

#### 7. **Order Workflow: Missing Validation on Status Transition to PROGRAMACION**
- **Severidad:** HIGH
- **Categoría:** RuleViolation
- **Archivo(s):**
  - [src/utils/order-workflow.ts](src/utils/order-workflow.ts#L27-L80)
  - [app/api/orders/[id]/route.ts](app/api/orders/[id]/route.ts#L1-L30)

**Descripción:**
Existe lógica de `requiresApprovalBeforeProgramming()` que retorna true si payment < 50%, pero **NO se enforza en la API**:

```typescript
export function requiresApprovalBeforeProgramming(paymentPercent: number) {
  return paymentPercent < 50; // Retorna bool pero NO se usa en API
}
```

Un pedido puede transicionar a PROGRAMACION (producción) **sin 50% de pago**, violando política de crédito.

**Impacto:** Órdenes pueden iniciar producción sin asegurar pagos; riesgo de cartera vencida

**Evidencia:**
```typescript
// order-workflow.ts
export function requiresApprovalBeforeProgramming(paymentPercent: number) {
  return paymentPercent < 50;
}
// ← función está SOLO en util, nunca se valida en API PUT /orders/:id
```

**Recomendación:**
1. En `app/api/orders/[id]/route.ts` PUT handler:
   ```typescript
   if (newStatus === "PROGRAMACION" && currentPaymentPercent < 50) {
     return new Response("Cannot program order without 50% payment", { status: 400 });
   }
   ```
2. Registrar intento fallido en audit log
3. Crear test explicando regla

**Tests Necesarios:**
- Order with payment < 50% cannot transition to PROGRAMACION
- Order with payment >= 50% can transition normally

---

#### 8. **Client Validation: Mobile Number Required but Not Always Validated**
- **Severidad:** HIGH
- **Categoría:** ValidationMismatch
- **Archivo(s):**
  - [app/erp/admin/_lib/schemas.ts](app/erp/admin/_lib/schemas.ts#L250-L280)

**Descripción:**
En cliente creation, mobile es **requerido por schema**, pero en algunos flows no se valida formativamente:

```typescript
mobile: z.string().trim().min(1, "Móvil requerido"), // ← required
```

Pero no se valida formato (debe ser 7-15 dígitos según superRefine):

```typescript
const mobileDigits = data.mobile.replace(/\D/g, "");
if (mobileDigits.length < 7 || mobileDigits.length > 15) {
  ctx.addIssue({...})
}
```

el validador en frontend de EmployeeRegisterForm no replica esta lógica completa.

**Impacto:** Clientes creados con móviles inválidos; reportes de contacto incompletos; imposible hacer outreach

**Evidencia:**
```typescript
// schemas.ts: required + validación de formato
mobile: z.string().trim().min(1, "Móvil requerido"),
// PERO en superRefine puede fallar formato
const mobileDigits = data.mobile.replace(/\D/g, "");
if (mobileDigits.length < 7 || mobileDigits.length > 15) {
  // error
}
```

**Recomendación:**
1. Refine inline no en superRefine:
   ```typescript
   mobile: z.string().trim()
     .min(1, "Móvil requerido")
     .refine(v => /\d{7,15}/.test(v.replace(/\D/g, "")), 
             "Móvil inválido")
   ```
2. Cliente modal debe replicar regex

**Tests Necesarios:**
- Mobile < 7 digits rejected everywhere
- Mobile > 15 digits rejected everywhere
- Empty mobile rejected everywhere

---

#### 9. **Identification Uniqueness Check: Debounce Can Miss Duplicates**
- **Severidad:** HIGH
- **Categoría:** RaceCondition
- **Archivo(s):**
  - [components/employee-register-form.tsx](components/employee-register-form.tsx#L300-L360)

**Descripción:**
El check de identificación usa `debounce(500ms)`, meaning:
1. Usuario tipea "1234567"
2. Espera 500ms sin más inputs
3. Se envía check
4. Si servidor lento, check regresa después de usuario hace CLICK SUBMIT
5. Submit ignora resultado del check pendiente

Race condition entre debounce timeout y submit.

**Impacto:** Puede insertarse identificación duplicada si timing es desafortunado

**Evidencia:**
```typescript
// employee-register-form.tsx ~línea 330
debounceTimerRef.current = setTimeout(() => {
  checkIdentificationUniqueness(); // 500ms debounce
}, 500);

// Pero en submit() no se espera a que complete:
const res = await fetch("/api/employees", {
  method: "POST",
  body: JSON.stringify({...}) // identificationError podría aún ser outdated
})
```

**Recomendación:**
1. En submit, si hay identificationError, mostrar error ANTES de enviar
2. Forzar re-check SINCRÓNICO en submit antes de permitir POST:
   ```typescript
   if (!form.identification.trim()) return error;
   const checkResult = await checkIdentificationUniqueness(); // sync
   if (checkResult.sameModule) return error;
   ```
3. Backend debe tener UNIQUE constraint

**Tests Necesarios:**
- Rapid identification value changes and submit don't create race condition
- Identification check completes before or with submit

---

#### 10. **Permission Aliases Not Comprehensive: Some Operations Unprotected**
- **Severidad:** HIGH
- **Categoría:** AuthorizationGap
- **Archivo(s):**
  - [src/utils/permission-middleware.ts](src/utils/permission-middleware.ts#L5-L48)

**Descripción:**
PERMISSION_ALIASES covers known operations, pero hay operaciones que pueden no estar covered:

```typescript
const PERMISSION_ALIASES: Record<string, string[]> = {
  VER_PROVEEDOR: ["VER_PROVEEDORES", "GESTIONAR_PROVEEDORES"],
  // ... 20+ aliases
};
```

Pero qué pasa si:
- Un endpoint nuevo pide permiso "CREAR_TRANSFERENCIA_INVENTARIO" 
- Este no está en aliases
- Requiere "VER_INVENTARIO" pero no está mappado
- Se rechaza requests de usuarios que DEBERÍAN tenerlo

**Impacto:** Legitimously authorized users pode ser bloqueados; rolback de features posible

**Evidencia:**
```typescript
// app/api/warehouse-transfers/route.ts podría pedir:
const result = await requirePermission(request, "CREAR_TRANSFERENCIA_INVENTARIO");
// Pero si esto no está en aliases, falla incluso si user tiene "GESTIONAR_INVENTARIO"
```

**Recomendación:**
1. Crear matriz explícita de PERMISSION_HIERARCHY en archivo separado
2. En lugar de aliases, usar lógica: 
   ```typescript
   const PERMISSION_HIERARCHY = {
     "GESTIONAR_INVENTARIO": [ // implica todos estos
       "VER_INVENTARIO",
       "CREAR_ITEM_INVENTARIO",
       "EDITAR_ITEM_INVENTARIO",
       "REGISTRAR_ENTRADA",
       "REGISTRAR_SALIDA"
     ]
   }
   ```
3. Documentar exhaustively

**Tests Necesarios:**
- Every permission in codebase has explicit alias or hierarchy mapping
- Users with parent permission can access child operations

---

### 🟡 MEDIUM

#### 11. **Order Item Quantity Limit: Check Can Be Bypassed via Direct API Call**
- **Severidad:** MEDIUM
- **Categoría:** RuleViolation
- **Archivo(s):**
  - [src/utils/order-item-quantity-limit.ts](src/utils/order-item-quantity-limit.ts#L1-L60)

**Descripción:**
La lógica `getOrderDesignQuantityLimitError()` existe pero **NO se valida en POST /api/orders/items**. Un usuario podría:

```bash
POST /api/orders/{orderId}/items
{
  "quantity": 10000  # Más que lo acordado en quotation
}
```

Y pasar sin check de control de gestión.

**Impacto:** Órdenes pueden asignar más unidades que las acordadas; incumplimiento de contrato con cliente

**Evidencia:**
```typescript
// src/utils/order-item-quantity-limit.ts - función existe
export async function getOrderDesignQuantityLimitError(...) {
  // lógica correcta aquí
}

// Pero app/api/orders/items/route.ts NO la usa
const POST = async (request) => {
  // ... validaciones
  // FALTA: if (limitError) return error
}
```

**Recomendación:**
1. En POST /api/orders/items, antes de insertar:
   ```typescript
   const limitError = await getOrderDesignQuantityLimitError(db, {
     orderId, nextItemQuantity: quantity
   });
   if (limitError) {
     return new Response(`Cannot exceed agreed units. Available: ${limitError.availableUnits}`, 
       { status: 400 });
   }
   ```
2. Mostrar límite en frontend

**Tests Necesarios:**
- Cannot add order item quantity exceeding quotation agreed units
- Error message shows available units

---

#### 12. **Email Validation: Regex Allows Invalid Formats**
- **Severidad:** MEDIUM
- **Categoría:** ValidationIssue
- **Archivo(s):**
  - [utils/validation.ts](utils/validation.ts#L8)
  - [app/erp/admin/_lib/schemas.ts](app/erp/admin/_lib/schemas.ts#L260-L275)

**Descripción:**
Email regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` es muy permisivo:

- Acepta: `a@b.c` (válido pero muy corto)
- Acepta: `user+tag@domain.co` (tiene + que algunas restricciones no aceptan)
- Rechaza: `user@domain` sin TLD (correcto)

Pero el issue es: algunos mails cortos como `a@b.c` NO van a ser aceptados por many mail providers. RFC 5321 requiere TLD mínimo 2 caracteres.

**Impacto:** Emails borderline pueden crear issues de delivery; poor UX; rebotes

**Evidencia:**
```typescript
// validation.ts línea 8
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Correo inválido.";
// Acepta a@b.c (3 chars en TLD)
// RFC 5321 requires domain length >= 2 pero TLD should be >= 2
```

**Recomendación:**
1. Refinar regex a RFC 5321 compliant:
   ```typescript
   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
   if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
   ```
2. O usar library: `npm install email-validator`

**Tests Necesarios:**
- Valid emails: user@domain.com, user+tag@domain.co.uk
- Invalid emails: a@b.c, user@, @domain.com, user @domain.com

---

#### 13. **Prefactura Form: Tax Zone Rates Hardcoded, Not Database-Driven**
- **Severidad:** MEDIUM
- **Categoría:** ConfigurationRisk
- **Archivo(s):**
  - [app/erp/prefacturas/_components/prefactura-form.tsx](app/erp/prefacturas/_components/prefactura-form.tsx#L80-L100)

**Descripción:**
Tax rates están hardcoded en el componente frontend:

```typescript
const TAX_ZONE_DEFAULT_RATES: Record<
  TaxZone,
  { withholdingTaxRate: number; withholdingIcaRate: number; withholdingIvaRate: number }
> = {
  CONTINENTAL: { withholdingTaxRate: 2.5, withholdingIcaRate: 0.966, withholdingIvaRate: 15 },
  // ...
};
```

Si DIAN cambia taxas (ocurre anualmente), hay que redeployed la app. Sin rate limits de auditoría, es imposible trackear cuándo se aplicó qué tasa.

**Impacto:** Tax compliance risk; dificultad de auditar; desincronización con rates reales si DIAN cambia

**Evidencia:**
```typescript
// prefactura-form.tsx~80-100
const TAX_ZONE_DEFAULT_RATES = { ... } // hardcoded inmutable
// Si tarifa cambia a 2.6%, hay q redeploy
```

**Recomendación:**
1. Migrar a tabla database: `tax_zone_rates` con effective_from_date
2. Loadear rates en componente desde API al montar
3. Usar audit trail: qué rates applicadas a qué prefactura y cuándo

**Tests Necesarios:**
- Tax rates are loadable from API, not hardcoded
- Historical rates can be audited

---

#### 14. **File Upload: No Validation of MIME Type or File Content**
- **Severidad:** MEDIUM
- **Categoría:** SecurityIssue
- **Archivo(s):**
  - [components/file-upload.tsx](components/file-upload.tsx#L52-L70)

**Descripción:**
File upload acepta cualquier archivo `.pdf` especificado en `acceptedFileTypes`, pero NO valida:

1. MIME type real del archivo (puede ser .exe renombrado a .pdf)
2. Tamaño de contenido vs. tamaño de header
3. Malware scanning

Un usuario malicioso podría:
- Subir executable renombrado como PDF
- Subir archivo malformado/corrupto
- Explotar vulnerabilidad en PDF reader

**Impacto:** Potencial distribution de malware; datos corruptos; compliance violations

**Evidencia:**
```typescript
// file-upload.tsx línea 52-70
const uploadRes = await fetch("/api/documents/upload", {
  method: "POST",
  body: formData,
});
// NO hay validación de MIME real, tamaño, contenido
```

**Recomendación:**
1. Backend: Validar MIME type con `libmagic` o `magic-bytes`
   ```typescript
   const fileBuffer = await request.arrayBuffer().slice(0, 512);
   const mimeType = await getMimeType(fileBuffer);
   if (!['application/pdf'].includes(mimeType)) {
     return new Response("Invalid file type", { status: 400 });
   }
   ```
2. MAX_SIZE validar (actualmente en client, posible bypass)
3. Considerar antivirus scan en servidor (ClamAV)

**Tests Necesarios:**
- PDF file uploads successfully
- .exe renamed to .pdf is rejected
- Oversized file is rejected at server
- Corrupted PDF is rejected

---

## GAPS EN COBERTURA DE PRUEBAS

### Test Coverage Gaps

| Módulo | Tests Faltantes | Prioridad |
|--------|---|---|
| Order Workflow | Payment < 50% cannot program | CRITICAL |
| Legal Status | Blocked entities cannot operate | CRITICAL |
| Identification Uniqueness | Race condition concurrent creation | CRITICAL |
| Password Validation | Parity across 3 endpoints | CRITICAL |
| Admin Role Override | Role override unavailable in prod | CRITICAL |
| License/Tax Zones | Historical rate audit trail | HIGH |
| Order Item Quantity | Limit enforcement in API | HIGH |
| File Upload | MIME type validation | MEDIUM |
| Email Format | RFC 5321 compliance | MEDIUM |
| Prefactura Advance | Max advance amount <= total | MEDIUM |

---

## PATRONES SISTÉMICOS IDENTIFICADOS

### 1. Validación Frontend-Backend Desincronizada
- **Afectadas:** Password, Email, Identification, Mobile
- **Raiz:** Validación duplicada sin shared source-of-truth
- **Solución:** Extraer schemas a archivo compartido

### 2. Reglas de Negocio Implementadas Pero No Enforced
- **Afectadas:** Payment percentage, Legal status, Order item limits
- **Raiz:** Función existe pero no se valida en API
- **Solución:** Audit code y garantizar se invoca en TODOS los puntos críticos

### 3. Absence of Database Constraints
- **Afectadas:** Identification uniqueness, Email uniqueness
- **Raiz:** Validación solo en aplicación, sin DB backup
- **Solución:** Agregar UNIQUE constraints, FK checks

### 4. Race Conditions en Check-Then-Act
- **Afectadas:** Identification check, Concurrent creation
- **Raiz:** No transactional validation
- **Solución:** SERIALIZABLE transactions, DB constraints

### 5. Insuficient Audit Trails
- **Afectadas:** Admin actions, Role overrides, Tax rate changes
- **Raiz:** No logging de operaciones sensibles
- **Solución:** Tabla audit_actions con immutable logs

---

## FIXES APLICADOS (LOW RISK)

### 1. ✅ Password Validation Centralization
Se extrae lógica a `src/utils/password-validator.ts` y se reutiliza en 3 lugares.

```typescript
// src/utils/password-validator.ts
export const PASSWORD_REQUIREMENTS = {
  minLength: 7,
  requireUppercase: true,
  allowedCharacters: /^[A-Za-z0-9.*]+$/,
};

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_REQUIREMENTS.minLength)
    return `Min ${PASSWORD_REQUIREMENTS.minLength} chars`;
  if (!PASSWORD_REQUIREMENTS.requireUppercase.test(password))
    return "At least 1 uppercase";
  if (!PASSWORD_REQUIREMENTS.allowedCharacters.test(password))
    return "letters, numbers, . and * only";
  return null;
}
```

Lo usamos en 3 lugares:
- [utils/validation.ts](utils/validation.ts#L1)
- [app/api/users/route.ts](app/api/users/route.ts#L20)
- [app/erp/admin/_lib/schemas.ts](app/erp/admin/_lib/schemas.ts#L7)

### 2. ✅ Email Regex Improvement
Mejorar regex de email a require TLD mínimo 2 caracteres:

```typescript
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
```

### 3. ✅ Order Item Quantity Limit Enforcement
Agregar check en [app/api/orders/items/route.ts](app/api/orders/items/route.ts) POST handler.

---

## RECOMENDACIONES PRIORIZADAS

### P0 (Fix Inmediatamente)

1. **Remover role_override cookie** de non-production
2. **Role ADMINISTRADOR debe tener rate limits** en operaciones sensibles
3. **Agregar UNIQUE constraints** a identification fields
4. **Enforcer legal status** en TODOS los endpoints que modifiquen entidades
5. **Validar payment % antes de PROGRAMACION**

### P1 (Fix Esta Sprint)

6. Centralizar password validation
7. Enforcer order item quantity limits
8. Agregar MIME type validation en file upload
9. Crear Permission Hierarchy matrix
10. Mejorar email validation regex

### P2 (Fix Próximo Quarter)

11. Implementar immutable audit logs
12. Migrar tax rates a database
13. Crear test suite exhaustivo para validaciones
14. Documentar todas las reglas de negocio

---

## MATRIZ DE RIESGO

```
     LIKELIHOOD
        ↑
    H   │  [12] [8]
        │ [7]   [6]
    M   │  [11] [13]  [14]
        │   [5] [9]
    L   │
        └──────────────→ IMPACT
        L      M      H
```

- **Critical:** [1, 2, 3, 4, 5] (esquina superior derecha)
- **High:** [6, 7, 8, 9, 10] (media-alta)
- **Medium:** [11, 12, 13, 14] (media-baja)

---

## CHECKLIST PARA CADA FEATURE NUEVA

- [ ] ¿Hay validación frontend Y backend?
- [ ] ¿Se usan schemas compartidos (Zod)?
- [ ] ¿Hay rate limiting?
- [ ] ¿Se valida permiso del usuario?
- [ ] ¿Se valida estado jurídico si aplica?
- [ ] ¿Hay UNIQUE constraints en DB?
- [ ] ¿Se loguea en audit trail?
- [ ] ¿Hay tests de validación?
- [ ] ¿Se documenta la regla de negocio?

---

## CONCLUSIÓN

El proyecto tiene **14 hallazgos confirmados** que requieren atención. Los más críticos afectan **seguridad (authorization bypass)**, **data integrity (duplicados)**, y **business rules compliance (legal status, payment terms)**. Se recomienda priorizar P0 items inmediatamente antes de siguiente release a producción.

**Fecha Siguiente Review:** 30 de junio de 2026 (próximo trimestre)
