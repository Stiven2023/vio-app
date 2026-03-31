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

import { DesignSection } from "./design-section";
import { MaterialsSection } from "./materials-section";
import { PackagingSection } from "./packaging-section";
import { SocksSection } from "./socks-section";
import {
  useOrderItemModalState,
  type OrderItemModalValue,
} from "./use-order-item-modal-state";

import { uploadToCloudinary } from "@/app/erp/orders/_lib/cloudinary";
import { getErrorMessage } from "@/app/erp/orders/_lib/api";

export type { OrderItemModalValue } from "./use-order-item-modal-state";

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));

  return Number.isFinite(n) ? n : 0;
}

function getPackagingTotals(rows: Array<{ mode?: string; quantity?: number }>) {
  let groupedTotal = 0;
  let individualTotal = 0;

  for (const row of rows ?? []) {
    const qty = Number(row?.quantity ?? 0);
    const safeQty = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;
    const mode = String(row?.mode ?? "").trim().toUpperCase();

    if (mode === "AGRUPADO") groupedTotal += safeQty;
    else individualTotal += safeQty;
  }

  return { groupedTotal, individualTotal };
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
  const [priceClientType, setPriceClientType] =
    React.useState<string>("VIOMAR");
  const [imageOneFile, setImageOneFile] = React.useState<File | null>(null);
  const [imageTwoFile, setImageTwoFile] = React.useState<File | null>(null);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);

  const {
    inventoryItems,
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
    setImageOneFile(null);
    setImageTwoFile(null);
    setLogoFile(null);
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;

    (async () => {
      try {
        const data = await fetch(`/api/orders/${orderId}/prefactura`);

        if (!data.ok) return;
        const json = (await data.json()) as {
          order?: { clientPriceType?: string | null };
        };

        setPriceClientType(String(json.order?.clientPriceType ?? "VIOMAR"));
      } catch {
        setPriceClientType("VIOMAR");
      }
    })();
  }, [isOpen, orderId]);

  const canEditUnitPrice = priceClientType === "AUTORIZADO";

  const title = mode === "create" ? "Nuevo diseño" : "Editar diseño";
  const uiDisabled = isSaving;

  const computedTotal = React.useMemo(() => {
    const q = Math.max(0, Math.floor(asNumber(item.quantity)));
    const up = Math.max(0, asNumber(item.unitPrice));

    return (q * up).toFixed(2);
  }, [item.quantity, item.unitPrice]);

  const quantity = React.useMemo(
    () => Math.max(1, Math.floor(asNumber(item.quantity))),
    [item.quantity],
  );

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

    const unitPrice = Math.max(0, asNumber(item.unitPrice));
    const { groupedTotal, individualTotal } = getPackagingTotals(packaging);

    if (groupedTotal !== individualTotal) {
      setError(
        `La lista de empaque debe sumar exactamente la curva (${groupedTotal}). Actualmente: ${individualTotal}.`,
      );

      return;
    }

    setIsSaving(true);
    try {
      let imageUrl = item.imageUrl ?? null;
      let clothingImageOneUrl = item.clothingImageOneUrl ?? null;
      let clothingImageTwoUrl = item.clothingImageTwoUrl ?? null;
      let logoImageUrl = item.logoImageUrl ?? null;

      if (orderKind !== "COMPLETACION") {
        if (imageOneFile) {
          clothingImageOneUrl = await uploadToCloudinary({
            file: imageOneFile,
            folder: `order-items/${orderId}`,
          });
        }

        if (imageTwoFile) {
          clothingImageTwoUrl = await uploadToCloudinary({
            file: imageTwoFile,
            folder: `order-items/${orderId}`,
          });
        }

        if (logoFile) {
          logoImageUrl = await uploadToCloudinary({
            file: logoFile,
            folder: `order-items/${orderId}/logos`,
          });
        }
      }

      imageUrl = clothingImageOneUrl;

      if (!String(item.garmentType ?? "").trim()) {
        throw new Error("Selecciona el tipo de prenda/posición");
      }

      const base: any = {
        orderId,
        productId: item.productId ?? null,
        productPriceId: (item as any).productPriceId ?? null,
        name,
        garmentType: item.garmentType ?? null,
        quantity,
        unitPrice: String(unitPrice),
        totalPrice: String(unitPrice * quantity),
        hasAdditions: Boolean(item.hasAdditions),
        additionEvidence: item.hasAdditions
          ? String(item.additionEvidence ?? "").trim() || null
          : null,
        observations: item.observations ?? null,
        fabric: item.fabric ?? null,
        imageUrl,
        clothingImageOneUrl,
        clothingImageTwoUrl,
        logoImageUrl,
        gender: item.gender ?? null,
        process: item.process ?? null,
        neckType: item.neckType ?? null,
        sleeve: item.sleeve ?? null,
        color: item.color ?? null,
        screenPrint: Boolean(item.screenPrint),
        screenPrintType: item.screenPrint
          ? ((item.screenPrintType ?? "DTF") as "DTF" | "VINILO")
          : null,
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

      const url =
        mode === "create" ? `/api/orders/items` : `/api/orders/items/${id}`;
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
    <Modal disableAnimation isOpen={isOpen} size="3xl" onOpenChange={onOpenChange}>
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

              {error ? (
                <div className="text-sm text-danger">{error}</div>
              ) : null}

              <DesignSection
                canEditUnitPrice={canEditUnitPrice}
                computedTotal={computedTotal}
                imageOneFile={imageOneFile}
                imageTwoFile={imageTwoFile}
                isCreateBlocked={isCreateBlocked}
                logoFile={logoFile}
                orderKind={orderKind}
                value={item}
                onChange={setItem}
                onSelectImageOneFile={setImageOneFile}
                onSelectImageTwoFile={setImageTwoFile}
                onSelectLogoFile={setLogoFile}
              />

              <PackagingSection
                disabled={uiDisabled}
                garmentType={String(item.garmentType ?? "JUGADOR")}
                maxCurveQuantity={quantity}
                mode={packagingMode}
                packaging={packaging}
                onError={(m) => setError(m)}
                onModeChange={setPackagingMode}
                onPackagingChange={setPackaging}
              />

              {orderKind !== "COMPLETACION" && Boolean(item.requiresSocks) ? (
                <SocksSection
                  disabled={uiDisabled}
                  garmentType={String(item.garmentType ?? "JUGADOR")}
                  orderId={orderId}
                  totalQuantity={quantity}
                  packaging={packaging}
                  requiresSocks={Boolean(item.requiresSocks)}
                  value={socks}
                  onChange={setSocks}
                  onError={(m) => setError(m)}
                  onUploadingChange={setIsUploadingAssets}
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
                isDisabled={isUploadingAssets || isSaving}
                onPress={onSubmit}
              >
                {isSaving ? "Guardando..." : "Guardar"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
