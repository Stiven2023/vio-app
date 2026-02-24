"use client";

import React from "react";
import NextLink from "next/link";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Select, SelectItem } from "@heroui/select";

import { getErrorMessage } from "@/app/orders/_lib/api";
import { uploadToCloudinary } from "@/app/orders/_lib/cloudinary";

import { DesignSection } from "../../../_components/order-item-modal/design-section";
import { MaterialsSection } from "../../../_components/order-item-modal/materials-section";
import { PackagingSection } from "../../../_components/order-item-modal/packaging-section";
import { SocksSection } from "../../../_components/order-item-modal/socks-section";
import {
  useOrderItemModalState,
  type OrderItemModalValue,
} from "../../../_components/order-item-modal/use-order-item-modal-state";

type Currency = "COP" | "USD";

type ProductRow = {
  id: string;
  name: string;
  isActive?: boolean | null;
};

type ProductPriceRow = {
  id: string;
  referenceCode: string;
  priceCopR1: string | null;
  priceCopR2: string | null;
  priceCopR3: string | null;
  priceViomar: string | null;
  priceColanta: string | null;
  priceMayorista: string | null;
  priceUSD: string | null;
  isEditable: boolean | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean | null;
};

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));

  return Number.isFinite(n) ? n : 0;
}

function pickCopScaleByQuantity(row: ProductPriceRow, quantity: number) {
  if (quantity <= 499) return row.priceCopR1;
  if (quantity <= 1000) return row.priceCopR2;

  return row.priceCopR3;
}

function resolveUnitPrice(args: {
  currency: Currency;
  clientPriceType: string;
  quantity: number;
  row: ProductPriceRow;
  manualUnitPrice?: string | null;
}) {
  const { currency, clientPriceType, quantity, row, manualUnitPrice } = args;

  if (currency === "USD") return row.priceUSD;
  if (clientPriceType === "VIOMAR") return row.priceViomar;
  if (clientPriceType === "COLANTA") return row.priceColanta;
  if (clientPriceType === "MAYORISTA") return row.priceMayorista;

  if (clientPriceType === "AUTORIZADO") {
    const manual = String(manualUnitPrice ?? "").trim();

    return manual || pickCopScaleByQuantity(row, quantity);
  }

  return pickCopScaleByQuantity(row, quantity);
}

export function OrderItemEditPage(props: {
  orderId: string;
  orderKind: "NUEVO" | "COMPLETACION" | "REFERENTE";
  orderCurrency: Currency;
  itemId: string;
}) {
  const { orderId, orderKind, orderCurrency, itemId } = props;

  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isUploadingAssets, setIsUploadingAssets] = React.useState(false);
  const [priceClientType, setPriceClientType] = React.useState<string>("VIOMAR");
  const [loadingItem, setLoadingItem] = React.useState(true);
  const [initialValue, setInitialValue] = React.useState<
    Partial<OrderItemModalValue> | undefined
  >(undefined);

  React.useEffect(() => {
    let active = true;

    setLoadingItem(true);
    fetch(`/api/orders/items/${itemId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return (await res.json()) as OrderItemModalValue;
      })
      .then((payload) => {
        if (!active) return;
        setInitialValue(payload);
      })
      .catch((e) => {
        if (!active) return;
        toast.error(getErrorMessage(e));
      })
      .finally(() => {
        if (active) setLoadingItem(false);
      });

    return () => {
      active = false;
    };
  }, [itemId]);

  React.useEffect(() => {
    let active = true;

    fetch(`/api/orders/${orderId}/prefactura`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return (await res.json()) as {
          order?: { clientPriceType?: string | null };
        };
      })
      .then((payload) => {
        if (!active) return;
        setPriceClientType(String(payload.order?.clientPriceType ?? "VIOMAR"));
      })
      .catch(() => {
        if (!active) return;
        setPriceClientType("VIOMAR");
      });

    return () => {
      active = false;
    };
  }, [orderId]);

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
    isOpen: true,
    orderId,
    initialValue,
  });

  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = React.useState(false);

  const [prices, setPrices] = React.useState<ProductPriceRow[]>([]);
  const [loadingPrices, setLoadingPrices] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    setLoadingProducts(true);
    fetch(`/api/products?page=1&pageSize=500`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());

        return (await r.json()) as { items: ProductRow[] };
      })
      .then((d) => {
        if (!active) return;
        setProducts(Array.isArray(d.items) ? d.items : []);
      })
      .catch((e) => {
        if (!active) return;
        toast.error(getErrorMessage(e));
        setProducts([]);
      })
      .finally(() => {
        if (!active) return;
        setLoadingProducts(false);
      });

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    const productId = String(item.productId ?? "").trim();

    setPrices([]);

    if (!productId) return;

    let active = true;

    setLoadingPrices(true);
    fetch(`/api/products/${productId}/valid-prices`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());

        return (await r.json()) as { items: ProductPriceRow[] };
      })
      .then((d) => {
        if (!active) return;
        const list = Array.isArray(d.items) ? d.items : [];

        setPrices(list);
      })
      .catch((e) => {
        if (!active) return;
        toast.error(getErrorMessage(e));
        setPrices([]);
      })
      .finally(() => {
        if (!active) return;
        setLoadingPrices(false);
      });

    return () => {
      active = false;
    };
  }, [item.productId]);

  const selectedPrice = React.useMemo(() => {
    const id = String(item.productPriceId ?? "").trim();

    return prices.find((p) => p.id === id) ?? null;
  }, [prices, item.productPriceId]);

  const selectedProduct = React.useMemo(() => {
    const id = String(item.productId ?? "").trim();

    return products.find((p) => p.id === id) ?? null;
  }, [products, item.productId]);

  React.useEffect(() => {
    if (!selectedProduct) return;

    setItem((s) => ({
      ...s,
      name: String(s.name ?? "").trim() ? s.name : selectedProduct.name,
    }));
  }, [selectedProduct, setItem]);

  const computedTotal = React.useMemo(() => {
    const q = Math.max(0, Math.floor(asNumber(item.quantity)));
    const up = Math.max(0, asNumber(item.unitPrice));

    return (q * up).toFixed(2);
  }, [item.quantity, item.unitPrice]);

  const uiDisabled = isSaving || loadingItem;
  const isRestricted = orderKind === "COMPLETACION";
  const canEditUnitPrice = priceClientType === "AUTORIZADO";

  React.useEffect(() => {
    if (!selectedPrice) return;
    if (canEditUnitPrice) return;

    const quantity = Math.max(1, Math.floor(asNumber(item.quantity)));
    const price = resolveUnitPrice({
      currency: orderCurrency,
      clientPriceType: priceClientType,
      quantity,
      row: selectedPrice,
    });

    if (!price) return;

    setItem((s) => ({
      ...s,
      unitPrice: price,
    }));
  }, [
    canEditUnitPrice,
    item.quantity,
    orderCurrency,
    priceClientType,
    selectedPrice,
    setItem,
  ]);

  async function onSubmit() {
    setError(null);

    if (isUploadingAssets) {
      setError("Espera a que termine la subida de imágenes.");

      return;
    }

    const name = String(item.name ?? "").trim();

    if (!name && !isRestricted) {
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

      const res = await fetch(`/api/orders/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      toast.success("Diseño actualizado");
      window.location.href = `/orders/${orderId}/items`;
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Editar diseño</h1>
          <p className="text-sm text-default-500">
            Actualiza la informacion del diseño ({orderCurrency}).
          </p>
        </div>
        <div className="flex gap-2">
          <Button as={NextLink} href={`/orders/${orderId}/items`} variant="flat">
            Volver
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="font-semibold">Referencia</div>
        </CardHeader>
        <CardBody className="space-y-3">
          {isRestricted ? (
            <div className="text-sm text-default-500">
              En COMPLETACION solo puedes ajustar cantidad y empaque.
            </div>
          ) : null}

          {error ? <div className="text-sm text-danger">{error}</div> : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select
              isDisabled={uiDisabled || loadingProducts || isRestricted}
              label="Producto"
              selectedKeys={item.productId ? [String(item.productId)] : []}
              onSelectionChange={(keys: any) => {
                const k = Array.from(keys as any)[0];

                setItem((s) => ({
                  ...s,
                  productId: k ? String(k) : null,
                }));
              }}
            >
              {products.map((p) => (
                <SelectItem key={p.id}>{p.name}</SelectItem>
              ))}
            </Select>

            <Select
              isDisabled={
                uiDisabled ||
                loadingPrices ||
                !item.productId ||
                isRestricted ||
                prices.length === 0
              }
              label="Precio vigente (referencia)"
              selectedKeys={
                item.productPriceId ? [String(item.productPriceId)] : []
              }
              onSelectionChange={(keys: any) => {
                const k = Array.from(keys as any)[0];
                const id = k ? String(k) : "";
                const row = prices.find((p) => p.id === id) ?? null;
                const price = row
                  ? resolveUnitPrice({
                      currency: orderCurrency,
                      clientPriceType: priceClientType,
                      quantity: Math.max(1, Math.floor(asNumber(item.quantity))),
                      row,
                    })
                  : null;

                setItem((s) => ({
                  ...s,
                  productPriceId: id ? id : null,
                  unitPrice: price ?? s.unitPrice,
                }));
              }}
            >
              {prices.map((pp) => {
                const price = resolveUnitPrice({
                  currency: orderCurrency,
                  clientPriceType: priceClientType,
                  quantity: Math.max(1, Math.floor(asNumber(item.quantity))),
                  row: pp,
                });
                const label = price
                  ? `${pp.referenceCode} — ${price}`
                  : `${pp.referenceCode} — (sin precio aplicable)`;

                return <SelectItem key={pp.id}>{label}</SelectItem>;
              })}
            </Select>
          </div>

          {selectedProduct ? (
            <div className="text-sm text-default-600">
              Producto seleccionado: {selectedProduct.name}
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-semibold">Detalles del diseño</div>
        </CardHeader>
        <CardBody>
          <DesignSection
            canEditUnitPrice={canEditUnitPrice}
            computedTotal={computedTotal}
            imageFile={imageFile}
            isCreateBlocked={false}
            orderKind={orderKind}
            value={item}
            onChange={setItem}
            onSelectImageFile={setImageFile}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-semibold">Empaque</div>
        </CardHeader>
        <CardBody>
          <PackagingSection
            disabled={uiDisabled}
            mode={packagingMode}
            packaging={packaging}
            onModeChange={setPackagingMode}
            onPackagingChange={setPackaging}
            onError={(m) => setError(m)}
          />
        </CardBody>
      </Card>

      {orderKind !== "COMPLETACION" ? (
        <Card>
          <CardHeader>
            <div className="font-semibold">Medias</div>
          </CardHeader>
          <CardBody>
            <SocksSection
              disabled={uiDisabled}
              orderId={orderId}
              value={socks}
              onChange={setSocks}
              onUploadingChange={setIsUploadingAssets}
              onError={(m) => setError(m)}
            />
          </CardBody>
        </Card>
      ) : null}

      {orderKind !== "COMPLETACION" ? (
        <Card>
          <CardHeader>
            <div className="font-semibold">Materiales</div>
          </CardHeader>
          <CardBody>
            <MaterialsSection
              disabled={uiDisabled}
              inventoryItems={inventoryItems}
              value={materials}
              onChange={setMaterials}
            />
          </CardBody>
        </Card>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button as={NextLink} href={`/orders/${orderId}/items`} variant="flat">
          Cancelar
        </Button>
        <Button
          color="primary"
          isDisabled={isUploadingAssets || loadingItem}
          isLoading={isSaving}
          onPress={onSubmit}
        >
          Guardar
        </Button>
      </div>
    </div>
  );
}
