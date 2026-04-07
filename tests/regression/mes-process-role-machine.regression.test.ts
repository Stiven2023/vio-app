import assert from "node:assert/strict";
import test from "node:test";

import {
  getMesAccessProcessOption,
  getMesAccessProcessOptionsForRole,
  resolveMesSelectionFromRole,
} from "@/app/mes/_components/mes-config";

test("mes process — producción por fases exige máquina en plotter, sublimación y corte", () => {
  const plotter = getMesAccessProcessOption("plotter");
  const sublimacion = getMesAccessProcessOption("sublimacion");
  const corteLaser = getMesAccessProcessOption("corte_laser");

  assert.ok(plotter);
  assert.ok(sublimacion);
  assert.ok(corteLaser);

  assert.equal(plotter?.requiresMachine, true);
  assert.equal(sublimacion?.requiresMachine, true);
  assert.equal(corteLaser?.requiresMachine, true);

  assert.ok((plotter?.machines.length ?? 0) > 0);
  assert.ok((sublimacion?.machines.length ?? 0) > 0);
  assert.ok((corteLaser?.machines.length ?? 0) > 0);
});

test("mes process — integración se registra con rol y usuario distintos sin máquina", () => {
  const selection = resolveMesSelectionFromRole({
    email: "integracion@viomar.com",
    employeeId: "emp-integracion-01",
    employeeName: "Laura Integracion",
    employeeRole: "OPERARIO_INTEGRACION_CALIDAD",
    employeeEmail: "integracion@viomar.com",
  });

  assert.ok(selection);
  assert.equal(selection?.processKey, "integracion");
  assert.equal(selection?.mesProcess, "integracion");
  assert.equal(selection?.operationType, "INTEGRACION");
  assert.equal(selection?.machineId, null);
  assert.equal(selection?.employeeId, "emp-integracion-01");
  assert.equal(selection?.employeeName, "Laura Integracion");
});

test("mes process — confección se registra con confeccionista distinto y sin máquina", () => {
  const selection = resolveMesSelectionFromRole({
    email: "confeccion@viomar.com",
    employeeId: "emp-confeccion-77",
    employeeName: "Marta Confeccion",
    employeeRole: "CONFECCIONISTA",
    employeeEmail: "confeccion@viomar.com",
  });

  assert.ok(selection);
  assert.equal(selection?.processKey, "confeccion");
  assert.equal(selection?.mesProcess, "confeccion");
  assert.equal(selection?.operationType, "CONFECCION");
  assert.equal(selection?.machineId, null);
  assert.equal(selection?.employeeId, "emp-confeccion-77");
  assert.equal(selection?.employeeName, "Marta Confeccion");
});

test("mes process — cada fase productiva puede quedar asociada a un usuario distinto", () => {
  const plotterSelection = {
    ...resolveMesSelectionFromRole({
      email: "plotter@viomar.com",
      employeeId: "emp-plotter-01",
      employeeName: "Andres Plotter",
      employeeRole: "OPERARIO_FLOTER",
      employeeEmail: "plotter@viomar.com",
    }),
    machineId: "plotter-all",
  };

  const integracionSelection = resolveMesSelectionFromRole({
    email: "integracion@viomar.com",
    employeeId: "emp-integracion-02",
    employeeName: "Sara Integracion",
    employeeRole: "OPERARIO_INTEGRACION_CALIDAD",
    employeeEmail: "integracion@viomar.com",
  });

  const confeccionSelection = resolveMesSelectionFromRole({
    email: "confeccion@viomar.com",
    employeeId: "emp-confeccion-02",
    employeeName: "Nora Confeccion",
    employeeRole: "CONFECCIONISTA",
    employeeEmail: "confeccion@viomar.com",
  });

  assert.ok(plotterSelection);
  assert.ok(integracionSelection);
  assert.ok(confeccionSelection);

  assert.notEqual(plotterSelection.employeeId, integracionSelection?.employeeId);
  assert.notEqual(integracionSelection?.employeeId, confeccionSelection?.employeeId);
  assert.equal(plotterSelection.machineId, "plotter-all");
  assert.equal(integracionSelection?.machineId, null);
  assert.equal(confeccionSelection?.machineId, null);
});

test("mes process — rol OPERARIO genérico solo ve fases productivas de planta y no integración/confección", () => {
  const options = getMesAccessProcessOptionsForRole("OPERARIO");
  const keys = options.map((option) => option.key);

  assert.ok(keys.includes("montaje"));
  assert.ok(keys.includes("plotter"));
  assert.ok(keys.includes("calandra"));
  assert.ok(keys.includes("sublimacion"));
  assert.ok(keys.includes("corte_laser"));
  assert.ok(keys.includes("corte_manual"));
  assert.equal(keys.includes("integracion"), false);
  assert.equal(keys.includes("confeccion"), false);
});

test("mes process — rol de integración no puede entrar a confección ni a fases de máquina ajenas", () => {
  const options = getMesAccessProcessOptionsForRole("OPERARIO_INTEGRACION_CALIDAD");

  assert.equal(options.length, 1);
  assert.equal(options[0]?.key, "integracion");
  assert.equal(options[0]?.requiresMachine, false);
});