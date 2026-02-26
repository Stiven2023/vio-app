"use client";

import type { Product } from "../../_lib/types";

import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";

function formatCurrency(value: string | null | undefined, currency: "COP" | "USD") {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || value === null || value === undefined || value === "") {
    return "-";
  }

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ProductDetailsModal({
  product,
  categoryName,
  isOpen,
  onOpenChange,
}: {
  product: Product | null;
  categoryName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside">
      <ModalContent className="max-w-5xl">
        <ModalHeader>Detalle del producto</ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-large border border-default-200 p-3 space-y-3 h-fit">
              <h4 className="text-sm font-semibold text-default-700">Datos generales</h4>
              <Input isReadOnly label="Código" value={product?.productCode ?? "-"} />
              <Input isReadOnly label="Nombre" value={product?.name ?? "-"} />
              <Input
                isReadOnly
                label="Descripción"
                value={product?.description ?? "-"}
              />
              <Input isReadOnly label="Categoría" value={categoryName || "-"} />
              <Input
                isReadOnly
                label="Estado"
                value={product?.isActive ? "Activo" : "Inactivo"}
              />
            </section>

            <section className="rounded-large border border-default-200 p-3 space-y-3">
              <h4 className="text-sm font-semibold text-default-700">Precios y vigencia</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input isReadOnly label="Base (1-499)" value={formatCurrency(product?.priceCopR1, "COP")} />
                <Input
                  isReadOnly
                  label="+499 (500-1000)"
                  value={formatCurrency(product?.priceCopR2, "COP")}
                />
                <Input isReadOnly label="+1000 (1001+)" value={formatCurrency(product?.priceCopR3, "COP")} />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  isReadOnly
                  label="Fijo Mayorista"
                  value={formatCurrency(product?.priceMayorista, "COP")}
                />
                <Input
                  isReadOnly
                  label="Fijo Colanta"
                  value={formatCurrency(product?.priceColanta, "COP")}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  isReadOnly
                  label="COP internacional"
                  value={formatCurrency(product?.priceCopInternational, "COP")}
                />
                <Input isReadOnly label="USD" value={formatCurrency(product?.priceUSD, "USD")} />
              </div>
            </section>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
