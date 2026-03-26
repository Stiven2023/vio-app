"use client";

import React from "react";
import NextLink from "next/link";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";

import { DesignSection } from "../../../_components/order-item-modal/design-section";
import { MaterialsSection } from "../../../_components/order-item-modal/materials-section";
import { PackagingSection } from "../../../_components/order-item-modal/packaging-section";
import { SocksSection } from "../../../_components/order-item-modal/socks-section";
import {
  useOrderItemModalState,
  type OrderItemModalValue,
} from "../../../_components/order-item-modal/use-order-item-modal-state";

import { uploadToCloudinary } from "@/app/erp/orders/_lib/cloudinary";
import { getErrorMessage } from "@/app/erp/orders/_lib/api";
import type {
  MoldingTemplateDetail,
  MoldingTemplateRow,
} from "@/app/erp/molding/_lib/types";

type Currency = "COP" | "USD";

type ProductRow = {
  id: string;
  name: string;
  isActive?: boolean | null;
};

type ProductPriceRow = {
  id: string;
  catalogType: "NACIONAL" | "INTERNACIONAL" | null;
  referenceCode: string;
  priceCopBase: string | null;
  priceCopInternational: string | null;
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

function pickCopScaleByQuantity(row: ProductPriceRow, quantity: number) {
  if (quantity <= 499) return row.priceCopR1 || row.priceCopBase;
  if (quantity <= 1000)
    return row.priceCopR2 || row.priceCopR1 || row.priceCopBase;

  return row.priceCopR3 || row.priceCopR2 || row.priceCopR1 || row.priceCopBase;
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

  if (clientPriceType === "VIOMAR") {
    return (
      row.priceViomar ||
      row.priceCopBase ||
      row.priceCopR1 ||
      pickCopScaleByQuantity(row, quantity)
    );
  }

  if (clientPriceType === "COLANTA") {
    return (
      row.priceColanta ||
      row.priceCopBase ||
      row.priceCopR1 ||
      pickCopScaleByQuantity(row, quantity)
    );
  }

  if (clientPriceType === "MAYORISTA") {
    return (
      row.priceMayorista ||
      row.priceCopBase ||
      row.priceCopR1 ||
      pickCopScaleByQuantity(row, quantity)
    );
  }

  if (clientPriceType === "AUTORIZADO") {
    const manual = String(manualUnitPrice ?? "").trim();

    return manual || pickCopScaleByQuantity(row, quantity);
  }

  const byScale = pickCopScaleByQuantity(row, quantity);

  if (byScale) return byScale;

  return row.priceCopInternational;
}

function normalizeItemGarmentType(v: unknown) {
  const raw = String(v ?? "")
    .trim()
    .toUpperCase();

  if (
    raw === "JUGADOR" ||
    raw === "ARQUERO" ||
    raw === "CAPITAN" ||
    raw === "JUEZ" ||
    raw === "ENTRENADOR" ||
    raw === "LIBERO" ||
    raw === "OBJETO"
  ) {
    return raw as
      | "JUGADOR"
      | "ARQUERO"
      | "CAPITAN"
      | "JUEZ"
      | "ENTRENADOR"
      | "LIBERO"
      | "OBJETO";
  }

  return null;
}

function normalizeItemProcess(v: unknown) {
  const raw = String(v ?? "")
    .trim()
    .toUpperCase();

  if (raw === "PRODUCCION" || raw === "BODEGA" || raw === "COMPRAS") {
    return raw;
  }

  return null;
}

function normalizeItemSleeve(v: unknown) {
  const raw = String(v ?? "")
    .trim()
    .toUpperCase();

  if (raw === "CORTA" || raw === "LARGA" || raw === "SISA") {
    return raw;
  }

  return null;
}

async function buildAutoMaterialsFromTemplateIds(args: {
  templateIds: string[];
  quantity: number;
}) {
  const { templateIds, quantity } = args;
  const totals = new Map<
    string,
    { quantity: number; notes: Set<string> }
  >();

  for (const templateId of templateIds) {
    const res = await fetch(`/api/molding/templates/${templateId}`);

    if (!res.ok) throw new Error(await res.text());

    const template = (await res.json()) as MoldingTemplateDetail;
    const templateLabel = String(template.moldingCode ?? "MOLDERIA").trim();

    for (const insumo of template.insumos ?? []) {
      const inventoryItemId = String(insumo.inventoryItemId ?? "").trim();

      if (!inventoryItemId) continue;

      const perUnit = Number(insumo.qtyPerUnit ?? 0);

      if (!Number.isFinite(perUnit) || perUnit <= 0) continue;

      const required = perUnit * quantity;
      const current =
        totals.get(inventoryItemId) ??
        ({ quantity: 0, notes: new Set<string>() } as {
          quantity: number;
          notes: Set<string>;
        });

      current.quantity += required;
      current.notes.add(`AUTO ${templateLabel}`);
      if (String(insumo.notes ?? "").trim()) {
        current.notes.add(String(insumo.notes));
      }
      totals.set(inventoryItemId, current);
    }
  }

  return Array.from(totals.entries()).map(([inventoryItemId, value]) => ({
    inventoryItemId,
    quantity: Number(value.quantity.toFixed(4)),
    note: Array.from(value.notes).join(" | "),
  }));
}

function normalizeMaterialsForCompare(
  rows: Array<{ inventoryItemId: string; quantity?: number | string | null; note?: string | null }>,
) {
  return rows
    .map((row) => ({
      inventoryItemId: String(row.inventoryItemId ?? "").trim(),
      quantity: Number(row.quantity ?? 0).toFixed(4),
      note: String(row.note ?? "").trim(),
    }))
    .filter((row) => row.inventoryItemId)
    .sort((a, b) => a.inventoryItemId.localeCompare(b.inventoryItemId));
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
  const [priceClientType, setPriceClientType] =
    React.useState<string>("VIOMAR");
  const [loadingItem, setLoadingItem] = React.useState(true);
  const [imageOneFile, setImageOneFile] = React.useState<File | null>(null);
  const [imageTwoFile, setImageTwoFile] = React.useState<File | null>(null);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [initialValue, setInitialValue] = React.useState<
    Partial<OrderItemModalValue> | undefined
  >(undefined);
  const [moldingTemplateId, setMoldingTemplateId] = React.useState<string | null>(null);
  const [initialMoldingTemplateId, setInitialMoldingTemplateId] = React.useState<string | null>(null);
  const [existingMoldingTemplateIds, setExistingMoldingTemplateIds] = React.useState<string[]>([]);
  const [moldingTemplates, setMoldingTemplates] = React.useState<MoldingTemplateRow[]>([]);
  const [loadingMoldings, setLoadingMoldings] = React.useState(false);
  const [isApplyingMolding, setIsApplyingMolding] = React.useState(false);
  const skipNextMoldingAutofillRef = React.useRef(false);

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

    setLoadingMoldings(true);
    fetch(`/api/molding/templates?page=1&pageSize=500&activeOnly=true`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());

        return (await r.json()) as { items: MoldingTemplateRow[] };
      })
      .then((d) => {
        if (!active) return;
        setMoldingTemplates(Array.isArray(d.items) ? d.items : []);
      })
      .catch(() => {
        if (!active) return;
        setMoldingTemplates([]);
      })
      .finally(() => {
        if (!active) return;
        setLoadingMoldings(false);
      });

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    let active = true;

    fetch(`/api/molding/order-items/${itemId}/moldings`)
      .then(async (r) => {
        if (!r.ok) return null;

        return (await r.json()) as { items: Array<{ moldingTemplateId: string | null }> };
      })
      .then((d) => {
        if (!active || !d) return;
        const templateIds = (d.items ?? [])
          .map((row) => String(row?.moldingTemplateId ?? "").trim())
          .filter(Boolean);
        const firstTemplateId = templateIds[0] ?? null;

        if (firstTemplateId) {
          skipNextMoldingAutofillRef.current = true;
        }
        setMoldingTemplateId(firstTemplateId);
        setInitialMoldingTemplateId(firstTemplateId);
        setExistingMoldingTemplateIds(templateIds);
      })
      .catch(() => {
        // non-critical
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

  React.useEffect(() => {
    const selectedId = String(moldingTemplateId ?? "").trim();

    if (!selectedId) {
      setIsApplyingMolding(false);

      return;
    }
    if (skipNextMoldingAutofillRef.current) {
      skipNextMoldingAutofillRef.current = false;

      return;
    }

    let active = true;

    setIsApplyingMolding(true);

    fetch(`/api/molding/templates/${selectedId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());

        return (await res.json()) as MoldingTemplateDetail;
      })
      .then((template) => {
        if (!active) return;

        let hasChanges = false;

        setItem((prev) => {
          const updated = { ...prev };

          if (!String(prev.garmentType ?? "").trim() && template.garmentType) {
            updated.garmentType =
              normalizeItemGarmentType(template.garmentType) ?? prev.garmentType;
            if (updated.garmentType !== prev.garmentType) hasChanges = true;
          }
          if (!String(prev.observations ?? "").trim() && template.observations) {
            updated.observations = template.observations;
            hasChanges = true;
          }
          if (!String(prev.fabric ?? "").trim() && template.fabric) {
            updated.fabric = template.fabric;
            hasChanges = true;
          }
          if (!String(prev.imageUrl ?? "").trim() && template.clothingImageOneUrl) {
            updated.imageUrl = template.clothingImageOneUrl;
            hasChanges = true;
          }
          if (
            !String(prev.clothingImageOneUrl ?? "").trim() &&
            template.clothingImageOneUrl
          ) {
            updated.clothingImageOneUrl = template.clothingImageOneUrl;
            hasChanges = true;
          }
          if (
            !String(prev.clothingImageTwoUrl ?? "").trim() &&
            template.clothingImageTwoUrl
          ) {
            updated.clothingImageTwoUrl = template.clothingImageTwoUrl;
            hasChanges = true;
          }
          if (!String(prev.logoImageUrl ?? "").trim() && template.logoImageUrl) {
            updated.logoImageUrl = template.logoImageUrl;
            hasChanges = true;
          }
          if (!String(prev.gender ?? "").trim() && template.gender) {
            updated.gender = template.gender;
            hasChanges = true;
          }
          if (!String(prev.process ?? "").trim() && template.process) {
            updated.process = normalizeItemProcess(template.process) ?? prev.process;
            if (updated.process !== prev.process) hasChanges = true;
          }
          if (!String(prev.neckType ?? "").trim() && template.neckType) {
            updated.neckType = template.neckType;
            hasChanges = true;
          }
          if (!String(prev.sleeve ?? "").trim() && template.sleeveType) {
            updated.sleeve = normalizeItemSleeve(template.sleeveType) ?? prev.sleeve;
            if (updated.sleeve !== prev.sleeve) hasChanges = true;
          }
          if (!String(prev.color ?? "").trim() && template.color) {
            updated.color = template.color;
            hasChanges = true;
          }
          if (!prev.screenPrint && template.screenPrint) {
            updated.screenPrint = true;
            hasChanges = true;
          }
          if (!prev.embroidery && template.embroidery) {
            updated.embroidery = true;
            hasChanges = true;
          }
          if (!prev.buttonhole && template.buttonhole) {
            updated.buttonhole = true;
            hasChanges = true;
          }
          if (!prev.snap && template.snap) {
            updated.snap = true;
            hasChanges = true;
          }
          if (!prev.tag && template.tag) {
            updated.tag = true;
            hasChanges = true;
          }
          if (!prev.flag && template.flag) {
            updated.flag = true;
            hasChanges = true;
          }

          return updated;
        });

        if (hasChanges) {
          toast.success(`Datos cargados de molderia: ${template.moldingCode}`);
        }
      })
      .catch((e) => {
        toast.error(getErrorMessage(e));
      })
      .finally(() => {
        if (!active) return;
        setIsApplyingMolding(false);
      });

    return () => {
      active = false;
    };
  }, [moldingTemplateId, setItem]);

  React.useEffect(() => {
    const templateIds = Array.from(
      new Set(
        [...existingMoldingTemplateIds, String(moldingTemplateId ?? "").trim()]
          .filter(Boolean),
      ),
    );

    if (templateIds.length === 0) {
      setMaterials([]);

      return;
    }

    let active = true;
    const quantity = Math.max(1, Math.floor(asNumber(item.quantity)));

    buildAutoMaterialsFromTemplateIds({ templateIds, quantity })
      .then((autoMaterials) => {
        if (!active) return;

        const nextNorm = normalizeMaterialsForCompare(autoMaterials);
        const currentNorm = normalizeMaterialsForCompare(
          (materials ?? []) as Array<{
            inventoryItemId: string;
            quantity?: number | string | null;
            note?: string | null;
          }>,
        );

        if (JSON.stringify(nextNorm) !== JSON.stringify(currentNorm)) {
          setMaterials(autoMaterials);
        }
      })
      .catch((e) => {
        if (!active) return;
        toast.error(getErrorMessage(e));
      });

    return () => {
      active = false;
    };
  }, [
    existingMoldingTemplateIds,
    moldingTemplateId,
    item.quantity,
    materials,
    setMaterials,
  ]);

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

        if (list.length === 1) {
          const only = list[0];
          const price = resolveUnitPrice({
            currency: orderCurrency,
            clientPriceType: priceClientType,
            quantity: Math.max(1, Math.floor(asNumber(item.quantity))),
            row: only,
          });

          setItem((s) => ({
            ...s,
            productPriceId: only.id,
            unitPrice: price ?? s.unitPrice,
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

      const base: any = {
        orderId,
        productId: item.productId ?? null,
        productPriceId: (item as any).productPriceId ?? null,
        name,
        garmentType: item.garmentType ?? "JUGADOR",
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

      if (moldingTemplateId && moldingTemplateId !== initialMoldingTemplateId) {
        const assignRes = await fetch(`/api/molding/order-items/${itemId}/moldings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moldingTemplateId }),
        });

        if (!assignRes.ok) {
          throw new Error(await assignRes.text());
        }

        const createdMolding = (await assignRes.json()) as { id?: string };
        const sizeList = Array.from(
          new Set(
            (packaging ?? [])
              .map((row) => String(row?.size ?? "").trim().toUpperCase())
              .filter(Boolean),
          ),
        );

        if (createdMolding.id) {
          const calcRes = await fetch(
            `/api/molding/order-items/${itemId}/moldings/${createdMolding.id}/insumos`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sizes: sizeList }),
            },
          );

          if (!calcRes.ok) {
            throw new Error(await calcRes.text());
          }
        }
      }

      toast.success("Diseño actualizado");
      window.location.href = `/orders/${orderId}/items`;
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSaving(false);
    }
  }

  if (loadingItem && !initialValue) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-56 rounded-medium bg-default-200" />
        <div className="h-4 w-80 rounded-medium bg-default-100" />
        <div className="rounded-medium border border-default-200 p-4 space-y-3">
          <div className="h-12 w-full rounded-medium bg-default-100" />
          <div className="h-12 w-full rounded-medium bg-default-100" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="h-10 rounded-medium bg-default-100" />
            <div className="h-10 rounded-medium bg-default-100" />
            <div className="h-10 rounded-medium bg-default-100" />
          </div>
        </div>
      </div>
    );
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
          <Button
            as={NextLink}
            href={`/orders/${orderId}/items`}
            variant="flat"
          >
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
            <Input
              isReadOnly
              isDisabled
              label="Producto"
              value={selectedProduct?.name ?? ""}
            />
            <Input
              isReadOnly
              isDisabled
              label="Referencia"
              value={selectedPrice?.referenceCode ?? ""}
            />
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
          <div className="font-semibold">Molderia</div>
        </CardHeader>
        <CardBody className="space-y-2">
          <Select
            isDisabled={
              uiDisabled || loadingMoldings || isRestricted || isApplyingMolding
            }
            label="Plantilla de molderia (opcional)"
            selectedKeys={moldingTemplateId ? [moldingTemplateId] : []}
            onSelectionChange={(keys: any) => {
              const k = Array.from(keys as any)[0];

              setMoldingTemplateId(k ? String(k) : null);
            }}
          >
            {moldingTemplates.map((t) => (
              <SelectItem key={t.id}>
                {t.moldingCode}
                {t.garmentType ? ` — ${t.garmentType}` : ""}
                {t.color ? ` / ${t.color}` : ""}
              </SelectItem>
            ))}
          </Select>
          {isApplyingMolding ? (
            <div className="text-xs text-primary animate-pulse">
              Aplicando datos de molderia...
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
            imageOneFile={imageOneFile}
            imageTwoFile={imageTwoFile}
            isCreateBlocked={false}
            logoFile={logoFile}
            orderKind={orderKind}
            value={item}
            onChange={setItem}
            onSelectImageOneFile={setImageOneFile}
            onSelectImageTwoFile={setImageTwoFile}
            onSelectLogoFile={setLogoFile}
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
            garmentType={String(item.garmentType ?? "JUGADOR")}
            maxCurveQuantity={Math.max(1, Math.floor(asNumber(item.quantity)))}
            mode={packagingMode}
            packaging={packaging}
            onError={(m) => setError(m)}
            onModeChange={setPackagingMode}
            onPackagingChange={setPackaging}
          />
        </CardBody>
      </Card>

      {orderKind !== "COMPLETACION" && Boolean(item.requiresSocks) ? (
        <Card>
          <CardHeader>
            <div className="font-semibold">Medias</div>
          </CardHeader>
          <CardBody>
            <SocksSection
              disabled={uiDisabled}
              garmentType={String(item.garmentType ?? "JUGADOR")}
              orderId={orderId}
              packaging={packaging}
              requiresSocks={Boolean(item.requiresSocks)}
              value={socks}
              onChange={setSocks}
              onError={(m) => setError(m)}
              onUploadingChange={setIsUploadingAssets}
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
          isDisabled={isUploadingAssets || loadingItem || isSaving}
          onPress={onSubmit}
        >
          {isSaving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
