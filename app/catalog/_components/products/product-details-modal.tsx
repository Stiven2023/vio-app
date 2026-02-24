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

export function ProductDetailsModal({
  product,
  categoryName,
  catalogType,
  isOpen,
  onOpenChange,
}: {
  product: Product | null;
  categoryName: string;
  catalogType: "NACIONAL" | "INTERNACIONAL";
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const viewCatalogType = catalogType ?? "NACIONAL";

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
              {viewCatalogType === "INTERNACIONAL" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    isReadOnly
                    label="COP internacional"
                    value={product?.priceCopInternational ?? "-"}
                  />
                  <Input isReadOnly label="USD" value={product?.priceUSD ?? "-"} />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Input isReadOnly label="Base (1-499)" value={product?.priceCopR1 ?? "-"} />
                    <Input
                      isReadOnly
                      label="+499 (500-1000)"
                      value={product?.priceCopR2 ?? "-"}
                    />
                    <Input isReadOnly label="+1000 (1001+)" value={product?.priceCopR3 ?? "-"} />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      isReadOnly
                      label="Fijo Mayorista"
                      value={product?.priceMayorista ?? "-"}
                    />
                    <Input
                      isReadOnly
                      label="Fijo Colanta"
                      value={product?.priceColanta ?? "-"}
                    />
                  </div>
                </>
              )}
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
