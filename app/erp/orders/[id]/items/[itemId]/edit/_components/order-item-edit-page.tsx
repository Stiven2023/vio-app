"use client";

import React from "react";
import NextLink from "next/link";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Skeleton } from "@heroui/skeleton";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";

import { DesignSection } from "../../../_components/order-item-modal/design-section";
import { MaterialsSection } from "../../../_components/order-item-modal/materials-section";
import { OrderItemStructuresSection } from "../../../_components/order-item-modal/order-item-structures-section";
import { PackagingSection } from "../../../_components/order-item-modal/packaging-section";
import { SocksSection } from "../../../_components/order-item-modal/socks-section";
import {
  useOrderItemModalState,
  type OrderItemModalValue,
} from "../../../_components/order-item-modal/use-order-item-modal-state";
import type { DesignerOption } from "@/app/erp/orders/_lib/designer-options";

import { uploadToCloudinary } from "@/app/erp/orders/_lib/cloudinary";
import { getErrorMessage } from "@/app/erp/orders/_lib/api";
import {
  DISCIPLINE_OPTIONS,
  LOWER_GARMENT_OPTIONS,
} from "@/app/erp/orders/_lib/design-select-options";
import { stripPackagingRowIds } from "@/app/erp/orders/_lib/packaging-rows";
import type {
  MoldingTemplateDetail,
  MoldingTemplateRow,
} from "@/app/erp/molding/_lib/types";
import type {
  OrderConfigurationMode,
  OrderItemPositionInput,
  OrderItemSpecialRequirementInput,
  OrderItemTeamInput,
} from "@/app/erp/orders/_lib/order-item-types";

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

function getSocksTotal(rows: Array<{ quantity?: number }>) {
  return (rows ?? []).reduce((acc, row) => {
    const qty = Number(row?.quantity ?? 0);

    return acc + (Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0);
  }, 0);
}

function buildMoldingTechnicalSections(args: {
  sections: Array<{ title: string; detail: MoldingTemplateDetail | null }>;
}) {
  return args.sections
    .map(({ title, detail }) => {
      if (!detail) return null;

      const fields = [
        ["Subtipo de prenda", detail.garmentSubtype],
        ["Detalle de diseño", detail.designDetail],
        ["Sesgo", detail.sesgoType],
        ["Color sesgo", detail.sesgoColor],
        ["Hiladilla", detail.hiladillaColor],
        ["Material de puño", detail.cuffMaterial],
        ["Ubicación de cierre", detail.zipperLocation],
        ["Color de cierre", detail.zipperColor],
        ["Medida cierre (cm)", detail.zipperSizeCm],
        ["Forro", detail.liningType],
        ["Color forro", detail.liningColor],
        ["Capota", detail.hoodType],
        ["Cierre bolsillo", detail.pocketZipperColor],
        ["Color malla lateral", detail.lateralMeshColor],
        ["Botón", detail.buttonType],
        ["Tipo de ojal", detail.buttonholeType],
        ["Perilla", detail.perillaColor],
        ["Cuello estructural", detail.collarType],
        ["Notas de fusionado", detail.fusioningNotes],
        ["Cierre invisible", detail.invisibleZipperColor],
      ]
        .map(([label, value]) => ({ label, value: String(value ?? "").trim() }))
        .filter((field) => field.value);

      const booleanFields = [
        detail.hasInnerLining ? "Lleva forro interno" : null,
        detail.hasPocket ? "Lleva bolsillo" : null,
        detail.hasLateralMesh ? "Lleva malla lateral" : null,
        detail.hasFajon ? "Lleva fajón" : null,
        detail.hasTanca ? "Lleva tanca" : null,
        detail.hasProtection ? "Lleva protección" : null,
        detail.hasEntretela ? "Lleva entretela" : null,
      ]
        .filter(Boolean)
        .map((label) => ({ label: String(label), value: "Sí" }));

      const allFields = [...fields, ...booleanFields];

      if (allFields.length === 0) return null;

      return { title, fields: allFields };
    })
    .filter(
      (
        section,
      ): section is { title: string; fields: Array<{ label: string; value: string }> } =>
        Boolean(section),
    );
}

function getDefaultPositions(quantity: unknown, color: unknown): OrderItemPositionInput[] {
  return [
    {
      position: "JUGADOR",
      quantity: Math.max(0, Math.floor(asNumber(quantity))),
      color: String(color ?? ""),
      sortOrder: 1,
    },
  ];
}

function hasGoalkeeperPosition(rows: OrderItemPositionInput[]) {
  return rows.some(
    (row) => String(row.position ?? "").trim().toUpperCase() === "ARQUERO",
  );
}

function inferConfigurationMode(args: {
  hasSecondGarment: boolean;
  positions: OrderItemPositionInput[];
}): OrderConfigurationMode {
  if (hasGoalkeeperPosition(args.positions)) {
    return "CONJUNTO_ARQUERO";
  }

  if (!args.hasSecondGarment) {
    return "PRENDA";
  }

  return "CONJUNTO";
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

function parseCompatibleFabrics(detail: MoldingTemplateDetail | null) {
  if (!detail) return [] as string[];

  try {
    const parsed = JSON.parse(detail.compatibleFabrics ?? "[]");

    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
    }
  } catch {
    // Ignore parse errors and fall back to fabric.
  }

  return String(detail.fabric ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseFabricListFromText(value: unknown) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function OrderItemEditPage(props: {
  designerOptions: DesignerOption[];
  orderId: string;
  orderKind: "NUEVO" | "COMPLETACION" | "REFERENTE";
  orderCurrency: Currency;
  itemId: string;
}) {
  const { designerOptions, orderId, orderKind, orderCurrency, itemId } = props;

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
  const [moldingTemplateIdTwo, setMoldingTemplateIdTwo] = React.useState<string | null>(null);
  const [initialMoldingTemplateIdTwo, setInitialMoldingTemplateIdTwo] = React.useState<string | null>(null);
  const [existingMoldingTemplateIds, setExistingMoldingTemplateIds] = React.useState<string[]>([]);
  const [moldingTemplates, setMoldingTemplates] = React.useState<MoldingTemplateRow[]>([]);
  const [historicalMoldingOptions, setHistoricalMoldingOptions] = React.useState<MoldingTemplateRow[]>([]);
  const [selectedMoldingDetails, setSelectedMoldingDetails] = React.useState<Record<string, MoldingTemplateDetail>>({});
  const [loadingMoldings, setLoadingMoldings] = React.useState(false);
  const [isApplyingMolding, setIsApplyingMolding] = React.useState(false);
  const [configurationMode, setConfigurationMode] =
    React.useState<OrderConfigurationMode>("PRENDA");
  const [positions, setPositions] = React.useState<OrderItemPositionInput[]>([]);
  const [teams, setTeams] = React.useState<OrderItemTeamInput[]>([]);
  const [specialRequirements, setSpecialRequirements] = React.useState<
    OrderItemSpecialRequirementInput[]
  >([]);
  const [garmentProcessMode, setGarmentProcessMode] = React.useState<
    "SUBLIMACION" | "FONDO_ENTERO"
  >("SUBLIMACION");
  const [imageOneRole, setImageOneRole] = React.useState<"JUGADOR" | "ARQUERO">(
    "JUGADOR",
  );
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
        const nextPositions = Array.isArray((payload as any).positions)
          ? (payload as any).positions
          : [];

        setPositions(nextPositions);
        setTeams(Array.isArray((payload as any).teams) ? (payload as any).teams : []);
        setSpecialRequirements(
          Array.isArray((payload as any).specialRequirements)
            ? (payload as any).specialRequirements
            : [],
        );
        setConfigurationMode(
          inferConfigurationMode({
            hasSecondGarment: Boolean(
              String((payload as any).clothingImageTwoUrl ?? "").trim(),
            ),
            positions: nextPositions,
          }),
        );
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

        return (await r.json()) as {
          items: Array<{
            moldingTemplateId: string | null;
            moldingCode?: string | null;
            version?: number | null;
            garmentType?: string | null;
            garmentSubtype?: string | null;
            designDetail?: string | null;
            fabric?: string | null;
            color?: string | null;
            gender?: string | null;
            process?: string | null;
            estimatedLeadDays?: number | null;
            createdAt?: string | null;
          }>;
        };
      })
      .then((d) => {
        if (!active || !d) return;
        const historicalOptions = (d.items ?? [])
          .map((row) => {
            const id = String(row?.moldingTemplateId ?? "").trim();

            if (!id) return null;

            return {
              id,
              moldingCode: String(row?.moldingCode ?? "MOLDERIA ASIGNADA"),
              version: Number(row?.version ?? 1),
              garmentType: row?.garmentType ?? null,
              garmentSubtype: row?.garmentSubtype ?? null,
              designDetail: row?.designDetail ?? null,
              fabric: row?.fabric ?? null,
              color: row?.color ?? null,
              gender: row?.gender ?? null,
              process: row?.process ?? null,
              estimatedLeadDays: row?.estimatedLeadDays ?? null,
              isActive: false,
              createdAt: row?.createdAt ?? null,
              createdByName: null,
            } as MoldingTemplateRow;
          })
          .filter((row): row is MoldingTemplateRow => Boolean(row));
        const templateIds = (d.items ?? [])
          .map((row) => String(row?.moldingTemplateId ?? "").trim())
          .filter(Boolean);
        const firstTemplateId = templateIds[0] ?? null;
        const secondTemplateId = templateIds[1] ?? null;

        if (firstTemplateId) {
          skipNextMoldingAutofillRef.current = true;
        }
        setMoldingTemplateId(firstTemplateId);
        setInitialMoldingTemplateId(firstTemplateId);
        setMoldingTemplateIdTwo(secondTemplateId);
        setInitialMoldingTemplateIdTwo(secondTemplateId);
        setConfigurationMode((current) => {
          if (current === "CONJUNTO_ARQUERO") {
            return current;
          }

          return inferConfigurationMode({
            hasSecondGarment: Boolean(secondTemplateId),
            positions,
          });
        });
        setExistingMoldingTemplateIds(templateIds);
        setHistoricalMoldingOptions(historicalOptions);
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
    const technique = String(item.productionTechnique ?? "")
      .trim()
      .toUpperCase();

    if (technique === "SUBLIMACION") {
      setGarmentProcessMode("SUBLIMACION");

      return;
    }

    if (technique === "FONDO_ENTERO") {
      setGarmentProcessMode("FONDO_ENTERO");

      return;
    }

    if (!String(item.color ?? "").trim()) {
      setGarmentProcessMode("SUBLIMACION");

      return;
    }

    setGarmentProcessMode("FONDO_ENTERO");
  }, [item.productionTechnique, item.color]);

  React.useEffect(() => {
    const ids = Array.from(
      new Set(
        [moldingTemplateId, moldingTemplateIdTwo]
          .map((id) => String(id ?? "").trim())
          .filter(Boolean),
      ),
    );

    if (ids.length === 0) {
      setSelectedMoldingDetails({});

      return;
    }

    let active = true;

    Promise.all(
      ids.map(async (id) => {
        const res = await fetch(`/api/molding/templates/${id}`);

        if (!res.ok) throw new Error(await res.text());

        return (await res.json()) as MoldingTemplateDetail;
      }),
    )
      .then((details) => {
        if (!active) return;

        const next: Record<string, MoldingTemplateDetail> = {};

        for (const detail of details) {
          next[String(detail.id)] = detail;
        }
        setSelectedMoldingDetails(next);
      })
      .catch((e) => {
        if (!active) return;
        toast.error(getErrorMessage(e));
      });

    return () => {
      active = false;
    };
  }, [moldingTemplateId, moldingTemplateIdTwo]);

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
          if (!String(prev.cuffType ?? "").trim() && template.cuffType) {
            updated.cuffType = template.cuffType;
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
            updated.screenPrintType = prev.screenPrintType ?? "DTF";
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

  const handleTeamImageFileSelect = React.useCallback(
    async (args: {
      teamIndex: number;
      field: "playerImageUrl" | "goalkeeperImageUrl" | "fullSetImageUrl";
      file: File;
    }) => {
      const { teamIndex, field, file } = args;

      setIsUploadingAssets(true);
      try {
        const url = await uploadToCloudinary({
          file,
          folder: `order-items/${orderId}/teams`,
        });

        setTeams((prev) =>
          prev.map((team, idx) =>
            idx === teamIndex ? { ...team, [field]: url } : team,
          ),
        );
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setIsUploadingAssets(false);
      }
    },
    [orderId],
  );

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

  const referenceSectionRef = React.useRef<HTMLDivElement | null>(null);
  const designSectionRef = React.useRef<HTMLDivElement | null>(null);
  const structuresSectionRef = React.useRef<HTMLDivElement | null>(null);
  const packagingSectionRef = React.useRef<HTMLDivElement | null>(null);
  const moldingSectionRef = React.useRef<HTMLDivElement | null>(null);
  const socksSectionRef = React.useRef<HTMLDivElement | null>(null);

  const focusSection = React.useCallback(
    (ref: React.RefObject<HTMLDivElement | null>) => {
      const container = ref.current;

      if (!container) return;

      container.scrollIntoView({ behavior: "smooth", block: "center" });

      window.setTimeout(() => {
        const target = container.querySelector(
          "input, textarea, button, [role='button'], [tabindex]:not([tabindex='-1'])",
        ) as HTMLElement | null;

        target?.focus();
      }, 80);
    },
    [],
  );

  const setFocusedError = React.useCallback(
    (message: string, ref: React.RefObject<HTMLDivElement | null>) => {
      setError(message);
      focusSection(ref);
    },
    [focusSection],
  );

  const uiDisabled = isSaving || loadingItem;
  const isRestricted = orderKind === "COMPLETACION";
  const canEditUnitPrice = priceClientType === "AUTORIZADO";
  const isConjunto = configurationMode !== "PRENDA";
  const requiresPositionConfiguration =
    configurationMode === "CONJUNTO_ARQUERO";
  const moldingOneId = String(moldingTemplateId ?? "").trim();
  const moldingTwoId = String(moldingTemplateIdTwo ?? "").trim();
  const hasRequiredMolding = isConjunto
    ? Boolean(moldingOneId)
    : Boolean(moldingOneId);
  const availableFabricOptions = React.useMemo(() => {
    const ids = [moldingOneId, isConjunto ? moldingTwoId : ""].filter(Boolean);

    return Array.from(
      new Set(
        ids.flatMap((id) => parseCompatibleFabrics(selectedMoldingDetails[id] ?? null)),
      ),
    );
  }, [isConjunto, moldingOneId, moldingTwoId, selectedMoldingDetails]);
  const allFabricOptions = React.useMemo(() => {
    const fromTemplates = moldingTemplates.flatMap((row) => {
      const fromList = parseFabricListFromText(row.fabric);

      if (fromList.length > 0) return fromList;

      return [] as string[];
    });
    const fromHistorical = historicalMoldingOptions.flatMap((row) =>
      parseFabricListFromText(row.fabric),
    );
    const fromSelected = Object.values(selectedMoldingDetails).flatMap((detail) => {
      const compat = parseCompatibleFabrics(detail);

      if (compat.length > 0) return compat;

      return parseFabricListFromText(detail.fabric);
    });
    const currentFabric = String(item.fabric ?? "").trim();

    return Array.from(
      new Set([
        ...fromTemplates,
        ...fromHistorical,
        ...fromSelected,
        ...(currentFabric ? [currentFabric] : []),
      ]),
    ).sort((a, b) => a.localeCompare(b));
  }, [historicalMoldingOptions, item.fabric, moldingTemplates, selectedMoldingDetails]);
  const availableMoldingOptions = React.useMemo(() => {
    const map = new Map<string, MoldingTemplateRow>();

    for (const row of moldingTemplates) {
      map.set(String(row.id), row);
    }
    for (const row of historicalMoldingOptions) {
      const id = String(row.id ?? "").trim();

      if (!id || map.has(id)) continue;
      map.set(id, row);
    }

    for (const detail of Object.values(selectedMoldingDetails)) {
      const id = String(detail.id ?? "").trim();

      if (!id || map.has(id)) continue;
      map.set(id, {
        id,
        moldingCode: detail.moldingCode,
        version: detail.version,
        garmentType: detail.garmentType,
        garmentSubtype: detail.garmentSubtype,
        designDetail: detail.designDetail,
        fabric: detail.fabric,
        color: detail.color,
        gender: detail.gender,
        process: detail.process,
        estimatedLeadDays: detail.estimatedLeadDays,
        isActive: false,
        createdAt: detail.createdAt,
        createdByName: null,
      });
    }

    return Array.from(map.values());
  }, [historicalMoldingOptions, moldingTemplates, selectedMoldingDetails]);
  const moldingTechnicalSections = React.useMemo(
    () =>
      buildMoldingTechnicalSections({
        sections: [
          {
            title: "Prenda 1",
            detail: selectedMoldingDetails[moldingOneId] ?? null,
          },
          ...(isConjunto
            ? [
                {
                  title: "Prenda 2",
                  detail: selectedMoldingDetails[moldingTwoId] ?? null,
                },
              ]
            : []),
        ],
      }),
    [isConjunto, moldingOneId, moldingTwoId, selectedMoldingDetails],
  );
  const selectedMoldingOne = React.useMemo(
    () => availableMoldingOptions.find((t) => t.id === moldingTemplateId) ?? null,
    [availableMoldingOptions, moldingTemplateId],
  );

    React.useEffect(() => {
      if (!isConjunto) {
        if (moldingTemplateIdTwo !== null) {
          setMoldingTemplateIdTwo(null);
        }

        return;
      }

      const first = String(moldingTemplateId ?? "").trim();
      const second = String(moldingTemplateIdTwo ?? "").trim();

      if (first && second !== first) {
        setMoldingTemplateIdTwo(first);
      }
    }, [isConjunto, moldingTemplateId, moldingTemplateIdTwo]);
  const decorationFromMolding = React.useMemo(() => {
    const ids = [moldingOneId, isConjunto ? moldingTwoId : ""].filter(Boolean);

    if (ids.length === 0) return { screenPrint: false, embroidery: false };

    return {
      screenPrint: ids.some(
        (id) => Boolean(selectedMoldingDetails[id]?.screenPrint),
      ),
      embroidery: ids.some(
        (id) => Boolean(selectedMoldingDetails[id]?.embroidery),
      ),
    };
  }, [isConjunto, moldingOneId, moldingTwoId, selectedMoldingDetails]);

  React.useEffect(() => {
    if (!hasRequiredMolding) return;

    setItem((prev) => {
      if (
        Boolean(prev.screenPrint) === decorationFromMolding.screenPrint &&
        Boolean(prev.embroidery) === decorationFromMolding.embroidery
      ) {
        return prev;
      }

      return {
        ...prev,
        screenPrint: decorationFromMolding.screenPrint,
        screenPrintType: decorationFromMolding.screenPrint
          ? (prev.screenPrintType ?? "DTF")
          : null,
        embroidery: decorationFromMolding.embroidery,
      };
    });
  }, [decorationFromMolding, hasRequiredMolding, setItem]);

  React.useEffect(() => {
    if (!requiresPositionConfiguration) {
      return;
    }

    setPositions((prev) => {
      if (prev.length === 0) {
        return getDefaultPositions(item.quantity, item.color);
      }

      return prev.map((row, idx) =>
        idx === 0
          ? {
              ...row,
              quantity: Math.max(0, Math.floor(asNumber(item.quantity))),
              color: String(item.color ?? ""),
            }
          : row,
      );
    });
  }, [item.color, item.quantity, requiresPositionConfiguration]);

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
      setFocusedError(
        "Espera a que termine la subida de imágenes.",
        designSectionRef,
      );

      return;
    }

    const name = String(item.name ?? "").trim();

    if (!name && !isRestricted) {
      setFocusedError("El nombre del diseño es obligatorio.", designSectionRef);

      return;
    }

    const quantity = Math.max(1, Math.floor(asNumber(item.quantity)));
    const unitPrice = Math.max(0, asNumber(item.unitPrice));
    const { groupedTotal, individualTotal } = getPackagingTotals(packaging);

    if (groupedTotal !== individualTotal) {
      setFocusedError(
        `La lista de empaque debe sumar exactamente la curva (${groupedTotal}). Actualmente: ${individualTotal}.`,
        packagingSectionRef,
      );

      return;
    }

    if (!isRestricted && !moldingOneId) {
      setFocusedError(
        "Selecciona la moldería principal (Prenda 1).",
        moldingSectionRef,
      );

      return;
    }

    if (!isRestricted && isConjunto && garmentProcessMode !== "SUBLIMACION") {
      setFocusedError(
        "Cuando el conjunto no es sublimado debes crear otro diseño. El conjunto con una sola moldería aplica solo para proceso de prenda: Sublimación.",
        moldingSectionRef,
      );

      return;
    }

    if (!isRestricted && item.requiresSocks) {
      const socksTotal = getSocksTotal(socks);

      if (socksTotal !== quantity) {
        setFocusedError(
          `La cantidad total de medias debe ser ${quantity}. Actualmente: ${socksTotal}.`,
          socksSectionRef,
        );

        return;
      }

      const missingSockData = socks.find(
        (row) => !String(row.sockLength ?? "").trim() || !String(row.color ?? "").trim(),
      );

      if (missingSockData) {
        setFocusedError(
          "Cada media debe tener tipo de media y color.",
          socksSectionRef,
        );

        return;
      }

      const designedSockWithoutAssets = socks.find(
        (row) =>
          Boolean((row as any).isDesigned) &&
          (!String((row as any).description ?? "").trim() ||
            !String((row as any).logoImageUrl ?? "").trim()),
      );

      if (designedSockWithoutAssets) {
        setFocusedError(
          "Si una media es diseñada, debe incluir descripción y logo.",
          socksSectionRef,
        );

        return;
      }
    }

    if (!isRestricted && requiresPositionConfiguration) {
      const positionsTotal = positions.reduce(
        (acc, row) => acc + Math.max(0, Math.floor(asNumber(row.quantity))),
        0,
      );

      if (positions.length === 0) {
        setFocusedError(
          "En conjunto + arquero debes configurar posiciones y cantidades.",
          structuresSectionRef,
        );

        return;
      }

      if (positionsTotal !== quantity) {
        setFocusedError(
          `La suma de posiciones del conjunto + arquero debe ser ${quantity}. Actualmente: ${positionsTotal}.`,
          structuresSectionRef,
        );

        return;
      }
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
        designType: (item.designType ?? item.process ?? "PRODUCCION") as any,
        productionTechnique: (item.productionTechnique ?? "SUBLIMACION") as any,
        process: item.process ?? null,
        designerId: item.designerId ?? null,
        discipline: item.discipline ?? null,
        hasCordon: Boolean(item.hasCordon),
        cordonColor: item.cordonColor ?? null,
        category: item.category ?? null,
        labelBrand: item.labelBrand ?? null,
        neckType: item.neckType ?? null,
        cuffType: item.cuffType ?? null,
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
        orderConfigurationMode: configurationMode,
      };

      const payloadPackaging = stripPackagingRowIds(packaging);
      const payload: any =
        orderKind === "COMPLETACION"
          ? { orderId, quantity, packaging: payloadPackaging }
          : {
              ...base,
              packaging: payloadPackaging,
              socks,
              materials,
              positions: requiresPositionConfiguration ? positions : [],
              teams,
              specialRequirements,
            };

      const res = await fetch(`/api/orders/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      const sizeList = Array.from(
        new Set(
          (packaging ?? [])
            .map((row) => String(row?.size ?? "").trim().toUpperCase())
            .filter(Boolean),
        ),
      );
      const moldingAssignments = [
        {
          currentId: moldingTemplateId,
          combinationOrder: 1,
          imageSlot: 1,
          imageUrl: clothingImageOneUrl,
        },
        {
          currentId: isConjunto ? moldingTemplateId : null,
          combinationOrder: 2,
          imageSlot: 2,
          imageUrl: clothingImageTwoUrl,
        },
      ].filter((entry) => String(entry.currentId ?? "").trim());

      if (!isRestricted) {
        const clearRes = await fetch(`/api/molding/order-items/${itemId}/moldings`, {
          method: "DELETE",
        });

        if (!clearRes.ok) {
          throw new Error(await clearRes.text());
        }
      }

      for (const entry of moldingAssignments) {
        const assignRes = await fetch(`/api/molding/order-items/${itemId}/moldings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moldingTemplateId: entry.currentId,
            combinationOrder: entry.combinationOrder,
            imageSlot: entry.imageSlot,
            imageUrl: entry.imageUrl,
          }),
        });

        if (!assignRes.ok) {
          throw new Error(await assignRes.text());
        }

        const createdMolding = (await assignRes.json()) as { id?: string };

        // TODO: insumos auto-calculation disabled until rules are defined
        // if (createdMolding.id) {
        //   const calcRes = await fetch(
        //     `/api/molding/order-items/${itemId}/moldings/${createdMolding.id}/insumos`,
        //     {
        //       method: "POST",
        //       headers: { "Content-Type": "application/json" },
        //       body: JSON.stringify({ sizes: sizeList }),
        //     },
        //   );
        //   if (!calcRes.ok) {
        //     throw new Error(await calcRes.text());
        //   }
        // }
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
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-medium" />
          <Skeleton className="h-4 w-80 rounded-medium" />
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-28 rounded-medium" />
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Skeleton className="h-14 rounded-large" />
              <Skeleton className="h-14 rounded-large" />
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:items-start">
          <Card className="xl:col-span-2">
            <CardHeader>
              <Skeleton className="h-6 w-40 rounded-medium" />
            </CardHeader>
            <CardBody className="space-y-3">
              <Skeleton className="h-12 rounded-large" />
              <Skeleton className="h-12 rounded-large" />
              <Skeleton className="h-12 rounded-large" />
              <Skeleton className="h-64 rounded-large" />
            </CardBody>
          </Card>

          <Card className="xl:col-span-1">
            <CardHeader>
              <Skeleton className="h-6 w-32 rounded-medium" />
            </CardHeader>
            <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Skeleton className="h-12 rounded-large" />
              <Skeleton className="h-12 rounded-large" />
              <Skeleton className="h-12 rounded-large" />
              <Skeleton className="h-12 rounded-large" />
              <Skeleton className="h-12 rounded-large sm:col-span-2" />
            </CardBody>
          </Card>
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

      <div ref={referenceSectionRef}>
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
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:items-start">
      <div ref={designSectionRef} className="xl:col-span-2">
      <Card className="xl:col-span-2">
        <CardHeader>
          <div className="font-semibold">Diseño visual (Paso 1)</div>
        </CardHeader>
        <CardBody>
          <DesignSection
            afterGenderContent={
              <div key={`design-config-${configurationMode}`} className="space-y-3">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,220px)_1fr] md:items-start">
                  <Select
                    isDisabled={uiDisabled || isRestricted || isApplyingMolding}
                    label="Configuración"
                    selectedKeys={[configurationMode]}
                    onSelectionChange={(keys: any) => {
                      const nextMode = String(
                        Array.from(keys as any)[0] ?? "PRENDA",
                      ) as OrderConfigurationMode;

                      setConfigurationMode(nextMode);
                      if (nextMode === "PRENDA") {
                        setMoldingTemplateIdTwo(null);
                      } else {
                        setGarmentProcessMode("SUBLIMACION");
                      }
                      if (nextMode !== "CONJUNTO_ARQUERO") {
                        setPositions([]);
                      }
                    }}
                  >
                    <SelectItem key="PRENDA">Prenda</SelectItem>
                    <SelectItem key="CONJUNTO">Conjunto</SelectItem>
                    <SelectItem key="CONJUNTO_ARQUERO">Conjunto + arquero</SelectItem>
                  </Select>

                  <div className="text-xs text-default-500 rounded-medium border border-default-200 bg-default-50 px-3 py-2">
                    En conjunto y conjunto + arquero se usa la misma moldería para las 2 prendas; las posiciones solo se editan en conjunto + arquero.
                  </div>
                </div>

                {isConjunto ? (
                  <div key="conjunto-image-role" className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Select
                      isDisabled={uiDisabled || isRestricted || isApplyingMolding}
                      label="Imagen prenda 1 corresponde a"
                      selectedKeys={[imageOneRole]}
                      onSelectionChange={(keys: any) => {
                        const k = String(Array.from(keys as any)[0] ?? "JUGADOR");

                        setImageOneRole(k === "ARQUERO" ? "ARQUERO" : "JUGADOR");
                      }}
                    >
                      <SelectItem key="JUGADOR">Jugador</SelectItem>
                      <SelectItem key="ARQUERO">Arquero</SelectItem>
                    </Select>
                    <div className="rounded-medium border border-default-200 bg-default-50 px-3 py-2 text-xs text-default-600">
                      La imagen de prenda 2 quedará como {imageOneRole === "JUGADOR" ? "Arquero" : "Jugador"} automáticamente.
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-medium border border-default-200 p-3 space-y-3">
                    <div className="text-sm font-semibold">Prenda 1</div>
                    <Select
                      isDisabled={
                        uiDisabled || loadingMoldings || isRestricted || isApplyingMolding
                      }
                      label="Moldería"
                      selectedKeys={moldingTemplateId ? [moldingTemplateId] : []}
                      onSelectionChange={(keys: any) => {
                        const k = Array.from(keys as any)[0];

                        setMoldingTemplateId(k ? String(k) : null);
                        if (isConjunto) {
                          setMoldingTemplateIdTwo(k ? String(k) : null);
                        }
                      }}
                    >
                      {availableMoldingOptions.map((t) => (
                        <SelectItem key={t.id} textValue={t.moldingCode}>
                          <span className="notranslate" translate="no">
                            {t.moldingCode}
                            {t.garmentType ? ` — ${t.garmentType}` : ""}
                            {t.color ? ` / ${t.color}` : ""}
                            {t.isActive === false ? " / INACTIVA" : ""}
                          </span>
                        </SelectItem>
                      ))}
                    </Select>
                    {selectedMoldingOne ? (
                      <div className="rounded-small bg-default-100 px-2 py-1 text-xs text-default-600">
                        Código seleccionado: <span className="font-semibold notranslate" translate="no">{selectedMoldingOne.moldingCode}</span>
                      </div>
                    ) : null}
                  </div>

                  {isConjunto ? (
                    <div key="conjunto-prenda-2" className="rounded-medium border border-default-200 p-3 space-y-3">
                      <div className="text-sm font-semibold">Prenda 2</div>
                      <Input
                        isDisabled
                        label="Moldería"
                        value={
                          selectedMoldingOne?.moldingCode ??
                          "Se usará la misma moldería de Prenda 1"
                        }
                      />
                    </div>
                  ) : null}
                </div>

                {isApplyingMolding ? (
                  <div className="text-xs text-primary animate-pulse">
                    Aplicando datos de moldería...
                  </div>
                ) : null}
              </div>
            }
            canEditUnitPrice={canEditUnitPrice}
            computedTotal={computedTotal}
            fabricOptions={
              availableFabricOptions.length > 0
                ? availableFabricOptions
                : allFabricOptions
            }
            imageOneFile={imageOneFile}
            imageTwoFile={imageTwoFile}
            isCreateBlocked={false}
            imageRoleOne={imageOneRole}
            imageRoleTwo={imageOneRole === "JUGADOR" ? "ARQUERO" : "JUGADOR"}
            lockDecorationByMolding={hasRequiredMolding}
            logoFile={logoFile}
            moldingTechnicalSections={moldingTechnicalSections}
            orderKind={orderKind}
            onGarmentProcessModeChange={setGarmentProcessMode}
            showAdvancedFields={true}
            value={item}
            onChange={setItem}
            onSelectImageOneFile={setImageOneFile}
            onSelectImageTwoFile={setImageTwoFile}
            onSelectLogoFile={setLogoFile}
          />
        </CardBody>
      </Card>
      </div>

      <Card className="xl:col-span-1 xl:sticky xl:top-4">
        <CardHeader>
          <div className="font-semibold">Ficha técnica</div>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            isDisabled={uiDisabled}
            label="Tipo de diseño"
            selectedKeys={item.designType ? [String(item.designType)] : ["PRODUCCION"]}
            onSelectionChange={(keys: any) => {
              const k = String(Array.from(keys as any)[0] ?? "PRODUCCION");

              setItem((s) => ({ ...s, designType: k as any, process: k }));
            }}
          >
            <SelectItem key="PRODUCCION">PRODUCCION</SelectItem>
            <SelectItem key="COMPRA">COMPRA</SelectItem>
            <SelectItem key="BODEGA">BODEGA</SelectItem>
          </Select>

          <Select
            isDisabled={uiDisabled}
            label="Diseñador"
            selectedKeys={item.designerId ? [String(item.designerId)] : []}
            onSelectionChange={(keys: any) => {
              const k = Array.from(keys as any)[0];

              setItem((s) => ({ ...s, designerId: k ? String(k) : null }));
            }}
          >
            {designerOptions
              .filter((d) => d.isActive !== false)
              .map((designer) => (
                <SelectItem key={designer.id}>{designer.name}</SelectItem>
              ))}
          </Select>

          <Select
            isDisabled={uiDisabled}
            description="Selecciona la disciplina principal del diseño"
            label="Disciplina"
            selectedKeys={item.discipline ? [String(item.discipline)] : []}
            onSelectionChange={(keys: any) => {
              const key = Array.from(keys as any)[0];

              setItem((s) => ({
                ...s,
                discipline: key ? String(key) : null,
              }));
            }}
          >
            {DISCIPLINE_OPTIONS.map((option) => (
              <SelectItem key={option.value}>{option.label}</SelectItem>
            ))}
          </Select>

          <Select
            isDisabled={uiDisabled}
            description="Selecciona la prenda o base inferior del diseño"
            label="Parte inferior (especificar prenda)"
            selectedKeys={item.category ? [String(item.category)] : []}
            onSelectionChange={(keys: any) => {
              const key = Array.from(keys as any)[0];

              setItem((s) => ({
                ...s,
                category: key ? String(key) : null,
              }));
            }}
          >
            {LOWER_GARMENT_OPTIONS.map((option) => (
              <SelectItem key={option.value}>{option.label}</SelectItem>
            ))}
          </Select>

          <Switch
            className="sm:col-span-2"
            isDisabled={uiDisabled}
            isSelected={Boolean(item.hasCordon)}
            onValueChange={(v: boolean) =>
              setItem((s) => ({ ...s, hasCordon: v }))
            }
          >
            Tiene cordón (parte inferior)
          </Switch>

          <Input
            className="sm:col-span-2"
            isDisabled={uiDisabled || !Boolean(item.hasCordon)}
            label="Color del cordón (parte inferior)"
            value={String(item.cordonColor ?? "")}
            onValueChange={(v: string) =>
              setItem((s) => ({ ...s, cordonColor: v || null }))
            }
          />

          <Select
            isDisabled={uiDisabled}
            label="Marquilla"
            selectedKeys={item.labelBrand ? [String(item.labelBrand)] : []}
            onSelectionChange={(keys: any) => {
              const k = Array.from(keys as any)[0];

              setItem((s) => ({ ...s, labelBrand: k ? String(k) : null }));
            }}
          >
            <SelectItem key="VIOMAR">VIOMAR</SelectItem>
            <SelectItem key="CLIENTE">CLIENTE</SelectItem>
          </Select>

          <Select
            isDisabled={uiDisabled}
            label="Serigrafía"
            selectedKeys={[
              item.screenPrint
                ? item.screenPrintType === "VINILO"
                  ? "VINILO"
                  : "DTF"
                : "NO",
            ]}
            onSelectionChange={(keys: any) => {
              const k = String(Array.from(keys as any)[0] ?? "NO");

              setItem((s) => ({
                ...s,
                screenPrint: k !== "NO",
                screenPrintType:
                  k === "NO" ? null : ((k === "VINILO" ? "VINILO" : "DTF") as any),
              }));
            }}
          >
            <SelectItem key="NO">No lleva</SelectItem>
            <SelectItem key="DTF">DTF</SelectItem>
            <SelectItem key="VINILO">Vinilo</SelectItem>
          </Select>

          <Switch
            isDisabled={uiDisabled}
            isSelected={Boolean(item.embroidery)}
            onValueChange={(v: boolean) =>
              setItem((s) => ({ ...s, embroidery: v }))
            }
          >
            Bordado
          </Switch>

          <Switch
            isDisabled={uiDisabled}
            isSelected={Boolean(item.buttonhole)}
            onValueChange={(v: boolean) =>
              setItem((s) => ({ ...s, buttonhole: v }))
            }
          >
            Ojal y botón
          </Switch>

          <Switch
            isDisabled={uiDisabled}
            isSelected={Boolean(item.snap)}
            onValueChange={(v: boolean) =>
              setItem((s) => ({ ...s, snap: v }))
            }
          >
            Broche
          </Switch>

        </CardBody>
      </Card>

      <div ref={structuresSectionRef} className="xl:col-span-3">
      <Card className="xl:col-span-3">
        <CardHeader>
          <div>
            <div className="font-semibold">Configuración adicional del diseño</div>
            <div className="text-sm text-default-500">
              Aquí defines posiciones, equipos de referencia y detalles especiales de confección.
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <OrderItemStructuresSection
            disabled={uiDisabled}
            requiresPositions={requiresPositionConfiguration}
            positions={positions}
            specialRequirements={specialRequirements}
            totalQuantity={Math.max(1, Math.floor(asNumber(item.quantity)))}
            teams={teams}
            onTeamImageFileSelect={handleTeamImageFileSelect}
            onPositionsChange={setPositions}
            onSpecialRequirementsChange={setSpecialRequirements}
            onTeamsChange={setTeams}
          />
        </CardBody>
      </Card>
      </div>

      <div ref={packagingSectionRef} className="xl:col-span-3">
      <Card className="xl:col-span-3">
        <CardHeader>
          <div className="font-semibold">Curvas y lista de empaque</div>
        </CardHeader>
        <CardBody className="space-y-3">
          {isConjunto ? (
            <div className="rounded-medium border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-700">
              El empaque se sigue editando en una sola lista, pero ahora se conserva junto con las 2 molderías del conjunto.
            </div>
          ) : null}
          <PackagingSection
            disabled={uiDisabled}
            garmentType={String(item.garmentType ?? "JUGADOR")}
            maxCurveQuantity={Math.max(1, Math.floor(asNumber(item.quantity)))}
            mode={packagingMode}
            packaging={packaging}
            onError={(m) => setFocusedError(m, packagingSectionRef)}
            onModeChange={setPackagingMode}
            onPackagingChange={setPackaging}
          />
        </CardBody>
      </Card>
      </div>
      </div>

      {orderKind !== "COMPLETACION" && Boolean(item.requiresSocks) ? (
        <div ref={socksSectionRef}>
        <Card>
          <CardHeader>
            <div>
              <div className="font-semibold">Medias</div>
              <div className="text-sm text-default-500">
                Curva, importación y referencias visuales de las medias del diseño.
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <SocksSection
              disabled={uiDisabled}
              garmentType={String(item.garmentType ?? "JUGADOR")}
              orderId={orderId}
              totalQuantity={Math.max(1, Math.floor(asNumber(item.quantity)))}
              packaging={packaging}
              requiresSocks={Boolean(item.requiresSocks)}
              value={socks}
              onChange={setSocks}
              onError={(m) => setFocusedError(m, socksSectionRef)}
              onUploadingChange={setIsUploadingAssets}
            />
          </CardBody>
        </Card>
        </div>
      ) : null}

      {orderKind !== "COMPLETACION" ? (
        <Card>
          <CardHeader>
            <div className="font-semibold">Insumos</div>
          </CardHeader>
          <CardBody>
            <div className="mb-3 rounded-medium border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-700">
              Reglas informativas: tela {item.fabric ? `(${item.fabric})` : "(pendiente)"}, cantidad {Math.max(1, Math.floor(asNumber(item.quantity)))},
              medias {item.requiresSocks ? "sí" : "no"}, color {item.color ? item.color : "no aplica / pendiente"},
              estampado {item.screenPrint ? (item.screenPrintType === "VINILO" ? "vinilo" : "dtf") : "no"}, bordado {item.embroidery ? "sí" : "no"}.
              Verifica tallas en curvas y detalle de medias cuando aplique.
            </div>
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
