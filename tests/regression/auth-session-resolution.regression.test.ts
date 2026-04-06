import assert from "node:assert/strict";
import test from "node:test";

async function loadSessionHelpers() {
  process.env.JWT_SECRET = "test-secret";

  const auth = await import("@/src/utils/auth");
  const middleware = await import("@/src/utils/auth-middleware");

  return {
    ...auth,
    ...middleware,
  };
}

function buildRequest(pathname: string, cookie: string) {
  return new Request(`http://localhost${pathname}`, {
    headers: { cookie },
  });
}

test("session resolution: auth/me prioriza role y contexto MES cuando existe mes_access_token", async () => {
  const {
    signAuthToken,
    signMesAccessToken,
    getEmailFromRequest,
    getEmployeeIdFromRequest,
    getRoleFromRequest,
    getUserIdFromRequest,
    resolveSessionFromRequest,
  } = await loadSessionHelpers();

  const authToken = signAuthToken({
    userId: "user-auth",
    employeeId: "employee-auth",
    role: "ADMINISTRADOR",
    email: "admin@viomar.test",
  });
  const mesToken = signMesAccessToken({
    typ: "mes_access",
    email: "operario@viomar.test",
    role: "OPERARIO_PLOTTER",
    employeeId: "employee-mes",
    employeeName: "Operario Plotter",
    employeeEmail: "operario@viomar.test",
    userId: "user-mes",
    processKey: "plotter",
    mesProcess: "plotter",
    operationType: "PLOTTER",
    machineId: "machine-1",
    machineName: "Plotter 1",
  });

  const request = buildRequest(
    "/api/auth/me",
    `auth_token=${authToken}; mes_access_token=${mesToken}`,
  );

  const session = resolveSessionFromRequest(request, { preferMesSession: true });

  assert.equal(session.sessionType, "mes");
  assert.equal(session.role, "OPERARIO_PLOTTER");
  assert.equal(getRoleFromRequest(request), "OPERARIO_PLOTTER");
  assert.equal(getUserIdFromRequest(request), "user-mes");
  assert.equal(getEmployeeIdFromRequest(request), "employee-mes");
  assert.equal(getEmailFromRequest(request), "operario@viomar.test");
});

test("session resolution: rutas no MES mantienen prioridad auth por compatibilidad", async () => {
  const {
    signAuthToken,
    signMesAccessToken,
    getEmailFromRequest,
    getEmployeeIdFromRequest,
    getRoleFromRequest,
    getUserIdFromRequest,
    resolveSessionFromRequest,
  } = await loadSessionHelpers();

  const authToken = signAuthToken({
    userId: "user-auth",
    employeeId: "employee-auth",
    role: "ADMINISTRADOR",
    email: "admin@viomar.test",
  });
  const mesToken = signMesAccessToken({
    typ: "mes_access",
    email: "operario@viomar.test",
    role: "OPERARIO_MONTAJE",
    employeeId: "employee-mes",
    employeeName: "Operario Montaje",
    employeeEmail: "operario@viomar.test",
    userId: "user-mes",
    processKey: "montaje",
    mesProcess: "montaje",
    operationType: "MONTAJE",
    machineId: null,
    machineName: null,
  });

  const request = buildRequest(
    "/api/notifications",
    `auth_token=${authToken}; mes_access_token=${mesToken}`,
  );

  const session = resolveSessionFromRequest(request);

  assert.equal(session.sessionType, "mes");
  assert.equal(session.role, "ADMINISTRADOR");
  assert.equal(getRoleFromRequest(request), "ADMINISTRADOR");
  assert.equal(getUserIdFromRequest(request), "user-auth");
  assert.equal(getEmployeeIdFromRequest(request), "employee-auth");
  assert.equal(getEmailFromRequest(request), "admin@viomar.test");
});