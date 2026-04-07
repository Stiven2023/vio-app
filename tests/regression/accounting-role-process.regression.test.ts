import assert from "node:assert/strict";
import test from "node:test";

import { ROLE_PERMISSIONS } from "@/src/db/role-permissions-map";
import {
  buildAccountingQaTemplateCsv,
  buildAccountingQaTemplateFilename,
} from "@/src/utils/accounting-test-format";
import {
  getDispatchBlockingRule,
  hasAccountingApproval,
} from "@/src/utils/mes-workflow";
import { canTransitionOrderStatus } from "@/src/utils/order-workflow";
import {
  authenticateWithSiigo,
  clearSiigoTokenCache,
  getSiigoCredentialDebugInfo,
  getSiigoTokenStatus,
} from "@/src/utils/siigo";

function roleHasPermission(roleName: string, permissionName: string) {
  const permissions = ROLE_PERMISSIONS[roleName];

  if (permissions === "ALL") {
    return true;
  }

  return Array.isArray(permissions) && permissions.includes(permissionName);
}

async function withTempEnv<T>(
  entries: Record<string, string | undefined>,
  run: () => Promise<T> | T,
) {
  const original = new Map<string, string | undefined>();

  for (const key of Object.keys(entries)) {
    original.set(key, process.env[key]);

    const value = entries[key];

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  clearSiigoTokenCache();

  try {
    return await run();
  } finally {
    for (const [key, value] of original.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    clearSiigoTokenCache();
  }
}

test("contabilidad rol: lider financiera cubre cartera, pagos y aprobacion", () => {
  assert.equal(roleHasPermission("LIDER_FINANCIERA", "CREAR_PAGO"), true);
  assert.equal(roleHasPermission("LIDER_FINANCIERA", "EDITAR_PAGO"), true);
  assert.equal(roleHasPermission("LIDER_FINANCIERA", "APROBAR_PAGO"), true);
  assert.equal(roleHasPermission("LIDER_FINANCIERA", "VER_CARTERA"), true);
  assert.equal(roleHasPermission("LIDER_FINANCIERA", "EXPORTAR_CARTERA"), true);
});

test("contabilidad rol: tesoreria y cartera exporta cartera pero no aprueba pagos", () => {
  assert.equal(roleHasPermission("TESORERIA_Y_CARTERA", "CREAR_PAGO"), true);
  assert.equal(roleHasPermission("TESORERIA_Y_CARTERA", "VER_CARTERA"), true);
  assert.equal(roleHasPermission("TESORERIA_Y_CARTERA", "EXPORTAR_CARTERA"), true);
  assert.equal(roleHasPermission("TESORERIA_Y_CARTERA", "APROBAR_PAGO"), false);
});

test("contabilidad rol: auxiliar contable opera pagos pero no exporta cartera", () => {
  assert.equal(roleHasPermission("AUXILIAR_CONTABLE", "CREAR_PAGO"), true);
  assert.equal(roleHasPermission("AUXILIAR_CONTABLE", "GESTIONAR_RETENCIONES"), true);
  assert.equal(roleHasPermission("AUXILIAR_CONTABLE", "VER_CARTERA"), false);
  assert.equal(roleHasPermission("AUXILIAR_CONTABLE", "EXPORTAR_CARTERA"), false);
});

test("contabilidad proceso: el pedido pasa por aprobacion contable antes de programacion", () => {
  assert.equal(
    canTransitionOrderStatus("PENDIENTE_CONTABILIDAD", "APROBADO_CONTABILIDAD"),
    true,
  );
  assert.equal(
    canTransitionOrderStatus("APROBADO_CONTABILIDAD", "PROGRAMACION"),
    true,
  );
  assert.equal(
    canTransitionOrderStatus("PENDIENTE_CONTABILIDAD", "PROGRAMACION"),
    false,
  );
});

test("contabilidad despacho: sin OK contable el bloqueo correcto aparece antes de continuar", () => {
  const rule = getDispatchBlockingRule({
    legalEnabled: true,
    sellerApproved: true,
    carteraApproved: true,
    accountingApproved: false,
    isPartialDispatch: false,
    partialDispatchApproved: false,
  });

  assert.equal(rule?.code, "ACCOUNTING_APPROVAL_REQUIRED");
  assert.equal(
    rule?.fieldErrors.accountingStatus?.includes(
      "Contabilidad debe aprobar antes de despachar.",
    ),
    true,
  );
});

test("contabilidad despacho: anticipo o aprobacion formal habilitan el OK contable", () => {
  assert.equal(
    hasAccountingApproval({
      accountingStatus: "PENDIENTE_CONTABILIDAD",
      advanceReceived: "250000",
    }),
    true,
  );

  assert.equal(
    hasAccountingApproval({
      accountingStatus: "APROBADO_CONTABILIDAD",
      advanceReceived: null,
    }),
    true,
  );

  assert.equal(
    hasAccountingApproval({
      accountingStatus: "PENDIENTE_CONTABILIDAD",
      advanceReceived: null,
      advanceStatus: null,
    }),
    false,
  );
});

test("contabilidad reportes: el formato QA incluye flujos base de SIIGO y archivo fechado", () => {
  const csv = buildAccountingQaTemplateCsv();
  const filename = buildAccountingQaTemplateFilename(
    new Date("2026-04-06T00:00:00.000Z"),
  );

  assert.equal(csv.includes("SIIGO-F-01"), true);
  assert.equal(csv.includes("SIIGO-POLL-01"), true);
  assert.equal(csv.includes("SIIGO-ADM-01"), true);
  assert.equal(filename, "contabilidad-qa-template-2026-04-06.csv");
});

test("contabilidad siigo: debug detecta fallback legacy y falta de partner id", async () => {
  await withTempEnv(
    {
      SIIGO_USER_KEY: "usuario-demo",
      SIIGO_ACCESS_KEY: undefined,
      SIIGO_API_SECRET: "legacy-secret-demo",
      SIIGO_PARTNER_ID: undefined,
      SIIGO_TOKEN: undefined,
      SIIGO_API_TOKEN: undefined,
    },
    () => {
      const info = getSiigoCredentialDebugInfo();

      assert.equal(info.usernameConfigured, true);
      assert.equal(info.accessKeyConfigured, true);
      assert.equal(info.accessKeySource, "SIIGO_API_SECRET");
      assert.equal(
        info.warning,
        "La integración está usando SIIGO_API_SECRET como fallback legacy. Define SIIGO_ACCESS_KEY con la credencial vigente de Siigo y reinicia el servidor.",
      );
      assert.equal(info.partnerIdConfigured, false);
    },
  );
});

test("contabilidad siigo: token estatico evita auth remota y conserva modo live", async () => {
  const originalFetch = globalThis.fetch;

  await withTempEnv(
    {
      SIIGO_TOKEN: "static-token-123",
      SIIGO_API_TOKEN: undefined,
      SIIGO_ALLOW_LIVE_SUBMISSION: "true",
      SIIGO_API_BASE_URL: "https://api.siigo.test",
      SIIGO_USER_KEY: undefined,
      SIIGO_ACCESS_KEY: undefined,
      SIIGO_API_SECRET: undefined,
    },
    async () => {
      globalThis.fetch = (async () => {
        throw new Error("No debe llamar auth remota cuando existe SIIGO_TOKEN");
      }) as typeof fetch;

      const auth = await authenticateWithSiigo();
      const status = getSiigoTokenStatus();

      assert.equal(auth.source, "env");
      assert.equal(auth.token, "static-token-123");
      assert.equal(status.hasToken, false);
      assert.equal(status.liveSubmissionEnabled, true);
      assert.equal(status.baseUrl, "https://api.siigo.test");
    },
  );

  globalThis.fetch = originalFetch;
});