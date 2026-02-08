"use client";

import type {
  OrderItemInput,
  OrderItemMaterialInput,
  OrderItemPackagingInput,
  OrderItemSockInput,
  PackagingMode,
} from "@/app/orders/_lib/order-item-types";

import React from "react";

export type OrderItemModalValue = {
  item: OrderItemInput;
  packaging: OrderItemPackagingInput[];
  socks: OrderItemSockInput[];
  materials: OrderItemMaterialInput[];
};

type InventoryItem = {
  id: string;
  name: string;
  unit: string | null;
};

function defaultPackaging(mode: PackagingMode): OrderItemPackagingInput[] {
  if (mode === "INDIVIDUAL") return [];

  return [{ mode: "AGRUPADO", size: "" }];
}

export function useOrderItemModalState(options: {
  isOpen: boolean;
  orderId: string;
  initialValue?: Partial<OrderItemModalValue>;
}) {
  const { isOpen, orderId, initialValue } = options;

  const [inventoryItems, setInventoryItems] = React.useState<InventoryItem[]>([]);
  const [imageFile, setImageFile] = React.useState<File | null>(null);

  const [packagingMode, setPackagingMode] = React.useState<PackagingMode>(
    (initialValue?.packaging?.[0]?.mode as PackagingMode) ?? "AGRUPADO",
  );

  const [item, setItem] = React.useState<OrderItemInput>(() => ({
    orderId,
    id: (initialValue?.item as any)?.id,
    productId: (initialValue?.item as any)?.productId ?? null,
    productPriceId: (initialValue?.item as any)?.productPriceId ?? null,
    name: initialValue?.item?.name ?? "",
    quantity: initialValue?.item?.quantity ?? 1,
    unitPrice: initialValue?.item?.unitPrice ?? "0",
    totalPrice: initialValue?.item?.totalPrice ?? "0",
    observations: initialValue?.item?.observations ?? "",
    fabric: initialValue?.item?.fabric ?? "",
    imageUrl: initialValue?.item?.imageUrl ?? null,
    gender: initialValue?.item?.gender ?? null,
    process: initialValue?.item?.process ?? null,
    neckType: initialValue?.item?.neckType ?? null,
    sleeve: initialValue?.item?.sleeve ?? null,
    color: initialValue?.item?.color ?? null,
    screenPrint: Boolean(initialValue?.item?.screenPrint ?? false),
    embroidery: Boolean(initialValue?.item?.embroidery ?? false),
    buttonhole: Boolean(initialValue?.item?.buttonhole ?? false),
    snap: Boolean(initialValue?.item?.snap ?? false),
    tag: Boolean(initialValue?.item?.tag ?? false),
    flag: Boolean(initialValue?.item?.flag ?? false),
    requiresSocks: Boolean(initialValue?.item?.requiresSocks ?? false),
  }));

  const [packaging, setPackaging] = React.useState<OrderItemPackagingInput[]>(
    () => {
      const p = initialValue?.packaging;

      return Array.isArray(p) && p.length > 0 ? p : defaultPackaging(packagingMode);
    },
  );

  const [socks, setSocks] = React.useState<OrderItemSockInput[]>(
    () => initialValue?.socks ?? [],
  );

  const [materials, setMaterials] = React.useState<OrderItemMaterialInput[]>(
    () => initialValue?.materials ?? [],
  );

  React.useEffect(() => {
    if (!isOpen) return;

    (async () => {
      try {
        const res = await fetch(`/api/inventory-items?pageSize=200`);

        if (!res.ok) return;

        const data = (await res.json()) as { items: InventoryItem[] };

        setInventoryItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        // silencioso
      }
    })();
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;

    const nextMode =
      (initialValue?.packaging?.[0]?.mode as PackagingMode) ??
      packagingMode ??
      "AGRUPADO";

    setPackagingMode(nextMode);

    setItem({
      orderId,
      id: (initialValue?.item as any)?.id,
      productId: (initialValue?.item as any)?.productId ?? null,
      productPriceId: (initialValue?.item as any)?.productPriceId ?? null,
      name: initialValue?.item?.name ?? "",
      quantity: initialValue?.item?.quantity ?? 1,
      unitPrice: initialValue?.item?.unitPrice ?? "0",
      totalPrice: initialValue?.item?.totalPrice ?? "0",
      observations: initialValue?.item?.observations ?? "",
      fabric: initialValue?.item?.fabric ?? "",
      imageUrl: initialValue?.item?.imageUrl ?? null,
      gender: initialValue?.item?.gender ?? null,
      process: initialValue?.item?.process ?? null,
      neckType: initialValue?.item?.neckType ?? null,
      sleeve: initialValue?.item?.sleeve ?? null,
      color: initialValue?.item?.color ?? null,
      screenPrint: Boolean(initialValue?.item?.screenPrint ?? false),
      embroidery: Boolean(initialValue?.item?.embroidery ?? false),
      buttonhole: Boolean(initialValue?.item?.buttonhole ?? false),
      snap: Boolean(initialValue?.item?.snap ?? false),
      tag: Boolean(initialValue?.item?.tag ?? false),
      flag: Boolean(initialValue?.item?.flag ?? false),
      requiresSocks: Boolean(initialValue?.item?.requiresSocks ?? false),
    });

    {
      const p = initialValue?.packaging;

      setPackaging(Array.isArray(p) && p.length > 0 ? p : defaultPackaging(nextMode));
    }
    setSocks(initialValue?.socks ?? []);
    setMaterials(initialValue?.materials ?? []);
    setImageFile(null);
  }, [isOpen, initialValue, orderId]);

  return {
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
  };
}
