"use client";

import type { Product, ProductPrice } from "../../_lib/types";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";

import { apiJson } from "../../_lib/api";

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("es-CO");
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
  const [price, setPrice] = useState<ProductPrice | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  useEffect(() => {
    if (!isOpen || !product?.id) {
      setPrice(null);
      return;
    }

    let active = true;

    setLoadingPrice(true);
    apiJson<{ items: ProductPrice[] }>(
      `/api/product-prices?productId=${product.id}&page=1&pageSize=1`,
    )
      .then((response) => {
        if (!active) return;
        setPrice(response.items?.[0] ?? null);
      })
      .catch(() => {
        if (!active) return;
        setPrice(null);
      })
      .finally(() => {
        if (!active) return;
        setLoadingPrice(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, product?.id]);

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
              {loadingPrice ? (
                <p className="text-sm text-default-500">Cargando precios…</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Input isReadOnly label="Base (1-499)" value={price?.priceCopR1 ?? "-"} />
                    <Input
                      isReadOnly
                      label="+499 (500-1000)"
                      value={price?.priceCopR2 ?? "-"}
                    />
                    <Input isReadOnly label="+1000 (1001+)" value={price?.priceCopR3 ?? "-"} />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      isReadOnly
                      label="Fijo Mayorista"
                      value={price?.priceMayorista ?? "-"}
                    />
                    <Input
                      isReadOnly
                      label="Fijo Colanta"
                      value={price?.priceColanta ?? "-"}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Input isReadOnly label="USD" value={price?.priceUSD ?? "-"} />
                    <Input
                      isReadOnly
                      label="Inicio vigencia"
                      value={formatDate(price?.startDate)}
                    />
                    <Input
                      isReadOnly
                      label="Fin vigencia"
                      value={formatDate(price?.endDate)}
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
