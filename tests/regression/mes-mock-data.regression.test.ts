import assert from "node:assert/strict";
import test from "node:test";

import { MOCK_DATA } from "@/app/mes/_components/mes-mock-data";

test("mes mock data: expone 5 pedidos demo para vista visual", () => {
  assert.equal(MOCK_DATA.length, 5);
});

test("mes mock data: cubre estados variados para niveles visuales", () => {
  const estados = new Set(MOCK_DATA.map((item) => item.estado));

  assert.equal(estados.has("SIN TRAMITAR"), true);
  assert.equal(estados.has("EN PROCESO"), true);
  assert.equal(estados.has("TARDE"), true);
  assert.equal(estados.has("COMPLETADO"), true);
});

test("mes mock data: incluye al menos un pedido con reposición simulada", () => {
  const hasRepo = MOCK_DATA.some((pedido) =>
    pedido.disenos.some((diseno) =>
      diseno.tallas.some((talla) => talla.estado === "reponer"),
    ),
  );

  assert.equal(hasRepo, true);
});