"use client";

import { useEffect } from "react";
import { Button } from "@heroui/button";

export default function ErpError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <p className="text-5xl font-black text-danger">!</p>
        <h2 className="text-xl font-bold">Error en el módulo ERP</h2>
        <p className="text-sm text-default-500">
          No se pudo cargar esta sección. Intenta de nuevo o contacta soporte si
          el problema persiste.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-default-400">
            Referencia: {error.digest}
          </p>
        ) : null}
      </div>
      <div className="flex gap-3">
        <Button color="primary" variant="flat" onPress={reset}>
          Intentar de nuevo
        </Button>
        <Button as="a" href="/erp/dashboard" variant="bordered">
          Ir al panel
        </Button>
      </div>
    </div>
  );
}
