"use client";

import React from "react";
import NextLink from "next/link";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Select, SelectItem } from "@heroui/select";

import { getErrorMessage } from "@/app/orders/_lib/api";
import { uploadToCloudinary } from "@/app/orders/_lib/cloudinary";

import { DesignSection } from "../../_components/order-item-modal/design-section";
import { MaterialsSection } from "../../_components/order-item-modal/materials-section";
import { PackagingSection } from "../../_components/order-item-modal/packaging-section";
import { SocksSection } from "../../_components/order-item-modal/socks-section";
import { useOrderItemModalState } from "../../_components/order-item-modal/use-order-item-modal-state";

type Currency = "COP" | "USD";

type ProductRow = {
  id: string;
  name: string;
  isSet?: boolean | null;
  productionType?: string | null;
  isActive?: boolean | null;
};

type ProductPriceRow = {
  id: string;
  referenceCode: string;
  priceCOP: string | null;
  priceUSD: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean | null;
};

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));

  return Number.isFinite(n) ? n : 0;
}

function pickUnitPrice(currency: Currency, row: ProductPriceRow) {
  return currency === "USD" ? row.priceUSD : row.priceCOP;
}

export function OrderItemCreatePage(props: {
  orderId: string;
  orderKind: "NUEVO" | "COMPLETACION" | "REFERENTE";
  orderCurrency: Currency;
}) {
  const { orderId, orderKind, orderCurrency } = props;

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
    isOpen: true,
    orderId,
  });

  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = React.useState(false);

  const [prices, setPrices] = React.useState<ProductPriceRow[]>([]);
  const [loadingPrices, setLoadingPrices] = React.useState(false);

  const isCreateBlocked = orderKind !== "NUEVO";

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
    setItem((s) => ({ ...s, productPriceId: null }));

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

        // si solo hay 1, autoseleccionar
        if (list.length === 1) {
          const only = list[0];
          const p = pickUnitPrice(orderCurrency, only);

          setItem((s) => ({
            ...s,
            productPriceId: only.id,
            unitPrice: p ?? s.unitPrice,
          }));
        }
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
  }, [item.productId, orderCurrency]);

  const selectedProduct = React.useMemo(() => {
    const id = String(item.productId ?? "").trim();

    return products.find((p) => p.id === id) ?? null;
  }, [products, item.productId]);

  React.useEffect(() => {
    if (!selectedProduct) return;

    setItem((s) => ({
      ...s,
      name: String(s.name ?? "").trim() ? s.name : selectedProduct.name,
      requiresSocks: Boolean(selectedProduct.isSet ?? false),
      process:
        selectedProduct.productionType === "SUBLIMADO"
          ? "SUBLIMADO"
          : selectedProduct.productionType === "CORTE_MANUAL"
            ? "CORTE_MANUAL"
            : s.process,
    }));
  }, [selectedProduct, setItem]);

  const computedTotal = React.useMemo(() => {
    const q = Math.max(0, Math.floor(asNumber(item.quantity)));
    const up = Math.max(0, asNumber(item.unitPrice));

    return (q * up).toFixed(2);
  }, [item.quantity, item.unitPrice]);

  const uiDisabled = isSaving;

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

    const productId = String(item.productId ?? "").trim();

    if (!productId) {
      setError("Selecciona un producto.");

      return;
    }

    const productPriceId = String(item.productPriceId ?? "").trim();

    if (!productPriceId) {
      setError("Selecciona un precio vigente.");

      return;
    }

    const selectedPrice = prices.find((p) => p.id === productPriceId) ?? null;
    const picked = selectedPrice ? pickUnitPrice(orderCurrency, selectedPrice) : null;

    if (!picked) {
      setError(`El precio seleccionado no tiene valor en ${orderCurrency}.`);

      return;
    }

    const quantity = Math.max(1, Math.floor(asNumber(item.quantity)));
    const unitPrice = Math.max(0, asNumber(picked));

    setIsSaving(true);
    try {
      let imageUrl = item.imageUrl ?? null;

      if (imageFile) {
        imageUrl = await uploadToCloudinary({
          file: imageFile,
          folder: `order-items/${orderId}`,
        });
      }

      const payload: any = {
        orderId,
        productId,
        productPriceId,
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
        packaging,
        socks,
        materials,
      };

      const res = await fetch(`/api/orders/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      toast.success("Diseño creado");
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
          <h1 className="text-2xl font-semibold">Nuevo diseño</h1>
          <p className="text-sm text-default-500">
            Selecciona producto + precio vigente ({orderCurrency}).
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
          {isCreateBlocked ? (
            <div className="text-sm text-danger">
              Este pedido es COMPLETACIÓN/REFERENTE. No se pueden crear diseños
              nuevos.
            </div>
          ) : null}

          {error ? <div className="text-sm text-danger">{error}</div> : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select
              isDisabled={uiDisabled || loadingProducts || isCreateBlocked}
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
                isCreateBlocked ||
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
                const price = row ? pickUnitPrice(orderCurrency, row) : null;

                setItem((s) => ({
                  ...s,
                  productPriceId: id ? id : null,
                  unitPrice: price ?? s.unitPrice,
                }));
              }}
            >
              {prices.map((pp) => {
                const price = pickUnitPrice(orderCurrency, pp);
                const label = price
                  ? `${pp.referenceCode} — ${price}`
                  : `${pp.referenceCode} — (sin ${orderCurrency})`;

                return <SelectItem key={pp.id}>{label}</SelectItem>;
              })}
            </Select>
          </div>

          {selectedProduct ? (
            <div className="text-sm text-default-600">
              Características: {selectedProduct.isSet ? "Conjunto (lleva medias)" : "No conjunto"}
              {selectedProduct.productionType
                ? ` · Producción: ${selectedProduct.productionType}`
                : null}
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
            computedTotal={computedTotal}
            isCreateBlocked={isCreateBlocked}
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

      <div className="flex justify-end gap-2">
        <Button as={NextLink} href={`/orders/${orderId}/items`} variant="flat">
          Cancelar
        </Button>
        <Button
          color="primary"
          isDisabled={isUploadingAssets || isCreateBlocked}
          isLoading={isSaving}
          onPress={onSubmit}
        >
          Guardar
        </Button>
      </div>
    </div>
  );
}
