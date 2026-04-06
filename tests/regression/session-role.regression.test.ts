import assert from "node:assert/strict";
import test from "node:test";

import { getEffectiveSessionRole } from "@/src/utils/session-role";

test("session role: prioriza el role de mesAccess cuando existe", () => {
  const role = getEffectiveSessionRole({
    id: "1",
    name: "Operario",
    role: null,
    mesAccess: {
      role: "OPERARIO_PLOTTER",
      processKey: "plotter",
      mesProcess: "plotter",
      operationType: "PLOTTER",
      machineId: null,
      machineName: null,
    },
  });

  assert.equal(role, "OPERARIO_PLOTTER");
});

test("session role: usa user.role cuando no existe role MES", () => {
  const role = getEffectiveSessionRole({
    id: "1",
    name: "Admin",
    role: "ADMINISTRADOR",
    mesAccess: null,
  });

  assert.equal(role, "ADMINISTRADOR");
});