"use client";

import React from "react";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";

import { getErrorMessage } from "@/app/orders/_lib/api";
import { uploadToCloudinary } from "@/app/orders/_lib/cloudinary";

import { DesignSection } from "./design-section";
import { MaterialsSection } from "./materials-section";
import { PackagingSection } from "./packaging-section";
import { SocksSection } from "./socks-section";
import {
  useOrderItemModalState,
  type OrderItemModalValue,
} from "./use-order-item-modal-state";

export type { OrderItemModalValue } from "./use-order-item-modal-state";

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));

  return Number.isFinite(n) ? n : 0;
}

export function OrderItemModal(props: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderKind: "NUEVO" | "COMPLETACION" | "REFERENTE";
  mode: "create" | "edit";
  initialValue?: Partial<OrderItemModalValue>;
  onSaved: () => void;
}) {
  const { isOpen, onOpenChange, orderId, orderKind, mode } = props;

  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isUploadingAssets, setIsUploadingAssets] = React.useState(false);

  const {
    inventoryItems,
    imageFile,
    setImageFile,
    packagingMode,
    setPackagingMode,
    item,
    setItem,
    packaging,
    setPackaging,
    socks,
    setSocks,
    materials,
    setMaterials,
  } = useOrderItemModalState({
    isOpen,
    orderId,
    initialValue: props.initialValue,
  });

  React.useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setIsUploadingAssets(false);
  }, [isOpen]);

  const title = mode === "create" ? "Nuevo diseño" : "Editar diseño";
  const uiDisabled = isSaving;

  const computedTotal = React.useMemo(() => {
    const q = Math.max(0, Math.floor(asNumber(item.quantity)));
    const up = Math.max(0, asNumber(item.unitPrice));

    return (q * up).toFixed(2);
  }, [item.quantity, item.unitPrice]);

  const isCreateBlocked = mode === "create" && orderKind !== "NUEVO";


  async function onSubmit() {
    setError(null);

    if (isCreateBlocked) {
      setError("En COMPLETACIÓN/REFERENTE no se pueden crear diseños nuevos.");

      return;
    }

    if (isUploadingAssets) {
      setError("Espera a que termine la subida de imágenes.");

      return;
    }

    const name = String(item.name ?? "").trim();

    if (!name) {
      setError("El nombre del diseño es obligatorio.");

      return;
    }

    const quantity = Math.max(1, Math.floor(asNumber(item.quantity)));
    const unitPrice = Math.max(0, asNumber(item.unitPrice));

    setIsSaving(true);
    try {
      let imageUrl = item.imageUrl ?? null;

      if (imageFile && orderKind !== "COMPLETACION") {
        imageUrl = await uploadToCloudinary({
          file: imageFile,
          folder: `order-items/${orderId}`,
        });
      }

      const base: any = {
        orderId,
        productId: item.productId ?? null,
        productPriceId: (item as any).productPriceId ?? null,
        name,
        quantity,
        unitPrice: String(unitPrice),
        totalPrice: String(unitPrice * quantity),
        observations: item.observations ?? null,
        fabric: item.fabric ?? null,
        imageUrl,
        gender: item.gender ?? null,
        process: item.process ?? null,
        neckType: item.neckType ?? null,
        sleeve: item.sleeve ?? null,
        color: item.color ?? null,
        screenPrint: Boolean(item.screenPrint),
        embroidery: Boolean(item.embroidery),
        buttonhole: Boolean(item.buttonhole),
        snap: Boolean(item.snap),
        tag: Boolean(item.tag),
        flag: Boolean(item.flag),
        requiresSocks: Boolean(item.requiresSocks),
      };

      const payload: any =
        orderKind === "COMPLETACION"
          ? { orderId, quantity, packaging }
          : { ...base, packaging, socks, materials };

      const id = (props.initialValue?.item as any)?.id ?? item.id;

      const url = mode === "create" ? `/api/orders/items` : `/api/orders/items/${id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      props.onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} size="3xl" onOpenChange={onOpenChange}>
      <ModalContent>
        {(onClose: () => void) => (
          <>
            <ModalHeader className="flex flex-col gap-1">{title}</ModalHeader>
            <ModalBody>
              {isCreateBlocked ? (
                <div className="text-sm text-danger">
                  Este pedido es COMPLETACIÓN/REFERENTE. Solo puedes ajustar
                  cantidades/empaque.
                </div>
              ) : null}

              {error ? <div className="text-sm text-danger">{error}</div> : null}

              <DesignSection
                computedTotal={computedTotal}
                imageFile={imageFile}
                isCreateBlocked={isCreateBlocked}
                orderKind={orderKind}
                value={item}
                onChange={setItem}
                onSelectImageFile={setImageFile}
              />

              <PackagingSection
                disabled={uiDisabled}
                mode={packagingMode}
                packaging={packaging}
                onModeChange={setPackagingMode}
                onPackagingChange={setPackaging}
                onError={(m) => setError(m)}
              />

              {orderKind !== "COMPLETACION" ? (
                <SocksSection
                  disabled={uiDisabled}
                  orderId={orderId}
                  value={socks}
                  onChange={setSocks}
                  onUploadingChange={setIsUploadingAssets}
                  onError={(m) => setError(m)}
                />
              ) : null}

              {orderKind !== "COMPLETACION" ? (
                <MaterialsSection
                  disabled={uiDisabled}
                  inventoryItems={inventoryItems}
                  value={materials}
                  onChange={setMaterials}
                />
              ) : null}
            </ModalBody>
            <ModalFooter>
              <Button isDisabled={isSaving} variant="flat" onPress={onClose}>
                Cancelar
              </Button>
              <Button
                color="primary"
                isDisabled={isUploadingAssets}
                isLoading={isSaving}
                onPress={onSubmit}
              >
                Guardar
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
