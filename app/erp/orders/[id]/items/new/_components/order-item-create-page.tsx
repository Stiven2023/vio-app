"use client";

import React from "react";
import NextLink from "next/link";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";

import { DesignSection } from "../../_components/order-item-modal/design-section";
import { MaterialsSection } from "../../_components/order-item-modal/materials-section";
import { OrderItemStructuresSection } from "../../_components/order-item-modal/order-item-structures-section";
import { PackagingSection } from "../../_components/order-item-modal/packaging-section";
import { SocksSection } from "../../_components/order-item-modal/socks-section";
import { useOrderItemModalState } from "../../_components/order-item-modal/use-order-item-modal-state";
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

type ImageMoldingAssignment = {
  designName: string;
  garmentType:
    | "JUGADOR"
    | "ARQUERO"
    | "CAPITAN"
    | "JUEZ"
    | "ENTRENADOR"
    | "LIBERO"
    | "OBJETO";
  position:
    | "FRENTE"
    | "ESPALDA"
    | "LATERAL_IZQUIERDO"
    | "LATERAL_DERECHO"
    | "MANGA_IZQUIERDA"
    | "MANGA_DERECHA";
  moldingTemplateId: string | null;
};

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

function getSocksTotal(rows: Array<{ quantity?: number }>) {
  return (rows ?? []).reduce((acc, row) => {
    const qty = Number(row?.quantity ?? 0);

    return acc + (Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0);
  }, 0);
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

export function OrderItemCreatePage(props: {
  designerOptions: DesignerOption[];
  orderId: string;
  orderKind: "NUEVO" | "COMPLETACION" | "REFERENTE";
  orderCurrency: Currency;
}) {
  const { designerOptions, orderId, orderKind, orderCurrency } = props;

  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isUploadingAssets, setIsUploadingAssets] = React.useState(false);
  const [priceClientType, setPriceClientType] =
    React.useState<string>("VIOMAR");
  const [imageOneFile, setImageOneFile] = React.useState<File | null>(null);
  const [imageTwoFile, setImageTwoFile] = React.useState<File | null>(null);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [moldingTemplates, setMoldingTemplates] = React.useState<MoldingTemplateRow[]>([]);
  const [loadingMoldings, setLoadingMoldings] = React.useState(false);
  const [moldingLoadError, setMoldingLoadError] = React.useState<string | null>(null);
  const [isApplyingMolding, setIsApplyingMolding] = React.useState(false);
  const [selectedMoldingDetails, setSelectedMoldingDetails] = React.useState<Record<string, MoldingTemplateDetail>>({});
  const [assignmentOne, setAssignmentOne] = React.useState<ImageMoldingAssignment>({
    designName: "",
    garmentType: "JUGADOR",
    position: "FRENTE",
    moldingTemplateId: null,
  });
  const [assignmentTwo, setAssignmentTwo] = React.useState<ImageMoldingAssignment>({
    designName: "",
    garmentType: "JUGADOR",
    position: "ESPALDA",
    moldingTemplateId: null,
  });
  const [configurationMode, setConfigurationMode] =
    React.useState<OrderConfigurationMode>("PRENDA");
  const [positions, setPositions] = React.useState<OrderItemPositionInput[]>([]);
  const [teams, setTeams] = React.useState<OrderItemTeamInput[]>([]);
  const [specialRequirements, setSpecialRequirements] = React.useState<
    OrderItemSpecialRequirementInput[]
  >([]);

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
  });

  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = React.useState(false);
  const [prices, setPrices] = React.useState<ProductPriceRow[]>([]);
  const [loadingPrices, setLoadingPrices] = React.useState(false);
  const [designUnitsLimit, setDesignUnitsLimit] = React.useState<{
    agreedUnits: number | null;
    assignedUnits: number;
    availableUnits: number | null;
  } | null>(null);

  const isCreateBlocked = orderKind !== "NUEVO";

  React.useEffect(() => {
    let active = true;

    setLoadingMoldings(true);
    setMoldingLoadError(null);
    fetch(`/api/molding/templates?page=1&pageSize=500&activeOnly=true`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());

        return (await r.json()) as { items: MoldingTemplateRow[] };
      })
      .then(async (d) => {
        if (!active) return;

        const activeItems = Array.isArray(d.items) ? d.items : [];

        if (activeItems.length > 0) {
          setMoldingTemplates(activeItems);

          return;
        }

        // Fallback: mostrar también inactivas si no hay activas publicadas.
        const fallbackRes = await fetch(
          `/api/molding/templates?page=1&pageSize=500&activeOnly=false`,
        );

        if (!fallbackRes.ok) {
          throw new Error(await fallbackRes.text());
        }

        const fallback = (await fallbackRes.json()) as {
          items: MoldingTemplateRow[];
        };

        setMoldingTemplates(Array.isArray(fallback.items) ? fallback.items : []);
      })
      .catch((e) => {
        if (!active) return;
        setMoldingTemplates([]);
        setMoldingLoadError(getErrorMessage(e));
      })
      .finally(() => {
        if (!active) return;
        setLoadingMoldings(false);
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
    let active = true;

    setLoadingProducts(true);
    fetch(`/api/orders/${orderId}/prefactura`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());

        return (await res.json()) as {
          order?: { clientPriceType?: string | null };
          allowedProducts?: ProductRow[];
          designUnits?: {
            agreedUnits?: number | null;
            assignedUnits?: number | null;
            availableUnits?: number | null;
          };
        };
      })
      .then((payload) => {
        if (!active) return;
        setPriceClientType(String(payload.order?.clientPriceType ?? "VIOMAR"));
        setProducts(
          Array.isArray(payload.allowedProducts) ? payload.allowedProducts : [],
        );
        setDesignUnitsLimit({
          agreedUnits:
            payload.designUnits?.agreedUnits === undefined
              ? null
              : payload.designUnits?.agreedUnits ?? null,
          assignedUnits: Number(payload.designUnits?.assignedUnits ?? 0),
          availableUnits:
            payload.designUnits?.availableUnits === undefined
              ? null
              : payload.designUnits?.availableUnits ?? null,
        });
      })
      .catch((e) => {
        if (!active) return;
        setPriceClientType("VIOMAR");
        setProducts([]);
        setDesignUnitsLimit(null);
        toast.error(getErrorMessage(e));
      })
      .finally(() => {
        if (!active) return;
        setLoadingProducts(false);
      });

    return () => {
      active = false;
    };
  }, [orderId]);

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

        // Selección automática para no exponer selector de precio en UI.
        if (list.length > 0) {
          const preferredId = String(item.productPriceId ?? "").trim();
          const only =
            list.find((row) => row.id === preferredId) ??
            list[0];
          const p = resolveUnitPrice({
            currency: orderCurrency,
            clientPriceType: priceClientType,
            quantity: Math.max(1, Math.floor(asNumber(item.quantity))),
            row: only,
          });

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
  }, [item.productId, item.quantity, orderCurrency, priceClientType, setItem]);

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

  const uiDisabled = isSaving;
  const canEditUnitPrice = priceClientType === "AUTORIZADO";
  const agreedDesignUnits = designUnitsLimit?.agreedUnits ?? null;
  const assignedDesignUnits = designUnitsLimit?.assignedUnits ?? 0;
  const availableDesignUnits = designUnitsLimit?.availableUnits ?? null;
  const quantityHelpText =
    availableDesignUnits === null
      ? "Se valida contra el cupo total acordado del pedido"
      : `Cupo disponible para nuevos diseños: ${availableDesignUnits}`;
  const isConjunto = configurationMode !== "PRENDA";
  const requiresPositionConfiguration =
    configurationMode === "CONJUNTO_ARQUERO";
  const moldingOneId = String(assignmentOne.moldingTemplateId ?? "").trim();
  const moldingTwoId = String(assignmentTwo.moldingTemplateId ?? "").trim();
  const selectedMoldingOne = React.useMemo(
    () => moldingTemplates.find((t) => t.id === assignmentOne.moldingTemplateId) ?? null,
    [assignmentOne.moldingTemplateId, moldingTemplates],
  );
  const hasRequiredMolding = isConjunto
    ? Boolean(moldingOneId && moldingTwoId)
    : Boolean(moldingOneId);

    React.useEffect(() => {
      const ids = Array.from(
        new Set(
          [moldingOneId, moldingTwoId].filter(Boolean),
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
        .catch(() => {
          // non-critical
        });

      return () => {
        active = false;
      };
    }, [moldingOneId, moldingTwoId]);

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
      const fromSelected = Object.values(selectedMoldingDetails).flatMap((detail) => {
        const compat = parseCompatibleFabrics(detail);

        if (compat.length > 0) return compat;

        return parseFabricListFromText(detail.fabric);
      });
      const currentFabric = String(item.fabric ?? "").trim();

      return Array.from(
        new Set([
          ...fromTemplates,
          ...fromSelected,
          ...(currentFabric ? [currentFabric] : []),
        ]),
      ).sort((a, b) => a.localeCompare(b));
    }, [item.fabric, moldingTemplates, selectedMoldingDetails]);
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

  // Autocomplete: cuando se selecciona moldería, rellena campos en blanco del formulario
  React.useEffect(() => {
    if (!moldingOneId) {
      setIsApplyingMolding(false);

      return;
    }

    let active = true;

    setIsApplyingMolding(true);

    fetch(`/api/molding/templates/${moldingOneId}`)
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
          if (!String(prev.fabric ?? "").trim() && template.fabric) {
            updated.fabric = template.fabric;
            hasChanges = true;
          }
          if (!String(prev.imageUrl ?? "").trim() && template.clothingImageOneUrl) {
            updated.imageUrl = template.clothingImageOneUrl;
            hasChanges = true;
          }
          if (!String(prev.clothingImageOneUrl ?? "").trim() && template.clothingImageOneUrl) {
            updated.clothingImageOneUrl = template.clothingImageOneUrl;
            hasChanges = true;
          }
          if (!String(prev.clothingImageTwoUrl ?? "").trim() && template.clothingImageTwoUrl) {
            updated.clothingImageTwoUrl = template.clothingImageTwoUrl;
            hasChanges = true;
          }
          if (!String(prev.logoImageUrl ?? "").trim() && template.logoImageUrl) {
            updated.logoImageUrl = template.logoImageUrl;
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
          toast.success(`Datos cargados de moldería: ${template.moldingCode}`);
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
  }, [moldingOneId, setItem]);

  React.useEffect(() => {
    if (!isConjunto) {
      if (assignmentTwo.moldingTemplateId !== null) {
        setAssignmentTwo((s) => ({ ...s, moldingTemplateId: null }));
      }

      return;
    }

    const first = String(assignmentOne.moldingTemplateId ?? "").trim();
    const second = String(assignmentTwo.moldingTemplateId ?? "").trim();

    if (first && second !== first) {
      setAssignmentTwo((s) => ({ ...s, moldingTemplateId: first }));
    }
  }, [
    assignmentOne.moldingTemplateId,
    assignmentTwo.moldingTemplateId,
    isConjunto,
  ]);

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

    if (isCreateBlocked) {
      setFocusedError(
        "En COMPLETACIÓN/REFERENTE no se pueden crear diseños nuevos.",
        referenceSectionRef,
      );

      return;
    }

    if (isUploadingAssets) {
      setFocusedError(
        "Espera a que termine la subida de imágenes.",
        designSectionRef,
      );

      return;
    }

    const name = String(item.name ?? "").trim();

    if (!name) {
      setFocusedError("El nombre del diseño es obligatorio.", designSectionRef);

      return;
    }

    const productId = String(item.productId ?? "").trim();

    if (!productId) {
      setFocusedError("Selecciona un producto.", referenceSectionRef);

      return;
    }

    const quantity = Math.max(1, Math.floor(asNumber(item.quantity)));

    if (availableDesignUnits !== null && availableDesignUnits <= 0) {
      setFocusedError(
        "No hay cupo disponible en la prefactura para crear más diseños.",
        designSectionRef,
      );

      return;
    }

    if (availableDesignUnits !== null && quantity > availableDesignUnits) {
      setFocusedError(
        `La cantidad no puede superar el cupo disponible (${availableDesignUnits}) según prefactura y diseños ya usados.`,
        designSectionRef,
      );

      return;
    }

    const productPriceId = String(item.productPriceId ?? "").trim();
    const selectedPrice =
      prices.find((p) => p.id === productPriceId) ?? prices[0] ?? null;
    const picked = selectedPrice
      ? resolveUnitPrice({
          currency: orderCurrency,
          clientPriceType: priceClientType,
          quantity,
          row: selectedPrice,
          manualUnitPrice: canEditUnitPrice
            ? String(item.unitPrice ?? "")
            : null,
        })
      : null;

    if (!picked) {
      setFocusedError(
        `El precio seleccionado no tiene valor en ${orderCurrency}.`,
        referenceSectionRef,
      );

      return;
    }

    const unitPrice = Math.max(0, asNumber(picked));
    const { groupedTotal, individualTotal } = getPackagingTotals(packaging);

    if (groupedTotal !== individualTotal) {
      setFocusedError(
        `La lista de empaque debe sumar exactamente la curva (${groupedTotal}). Actualmente: ${individualTotal}.`,
        packagingSectionRef,
      );

      return;
    }

    if (!moldingOneId) {
      setFocusedError(
        "Selecciona la moldería principal (Prenda 1).",
        moldingSectionRef,
      );

      return;
    }

    if (isConjunto && !moldingTwoId) {
      setFocusedError(
        "Para conjunto debes seleccionar también la moldería de Prenda 2.",
        moldingSectionRef,
      );

      return;
    }

    if (item.requiresSocks) {
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

    if (requiresPositionConfiguration) {
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

      imageUrl = clothingImageOneUrl;

      const payload: any = {
        orderId,
        productId,
        productPriceId: selectedPrice?.id ?? null,
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
        designType: (item.designType ?? item.process ?? "PRODUCCION") as any,
        productionTechnique: (item.productionTechnique ?? "SUBLIMACION") as any,
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
        packaging: stripPackagingRowIds(packaging),
        socks,
        materials,
        positions: requiresPositionConfiguration ? positions : [],
        teams,
        specialRequirements,
      };

      const res = await fetch(`/api/orders/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      const created = (await res.json()) as { id?: string };

      if (created?.id) {
        const assignments = [
          {
            moldingTemplateId: assignmentOne.moldingTemplateId,
            combinationOrder: 1,
            imageSlot: 1,
            imageUrl: clothingImageOneUrl,
            garmentSubtype: "FRENTE",
          },
          {
            moldingTemplateId: assignmentTwo.moldingTemplateId,
            combinationOrder: 2,
            imageSlot: 2,
            imageUrl: clothingImageTwoUrl,
            garmentSubtype: "ESPALDA",
          },
        ].filter((entry) => String(entry.moldingTemplateId ?? "").trim());

        for (const entry of assignments) {
          const assignRes = await fetch(
            `/api/molding/order-items/${created.id}/moldings`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                moldingTemplateId: entry.moldingTemplateId,
                combinationOrder: entry.combinationOrder,
                imageSlot: entry.imageSlot,
                imageUrl: entry.imageUrl,
                garmentType: item.garmentType ?? "JUGADOR",
                garmentSubtype: entry.garmentSubtype,
                designDetail: String(item.name ?? "").trim() || null,
              }),
            },
          );

          if (!assignRes.ok) {
            throw new Error(await assignRes.text());
          }

          await assignRes.json();
        }
      }

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
            Selecciona un producto disponible en la prefactura del pedido.
          </p>
          <div className="mt-2 inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
            {availableDesignUnits === null || agreedDesignUnits === null
              ? "Cupo de prefactura: pendiente de cálculo"
              : `Cupo disponible: ${availableDesignUnits} de ${agreedDesignUnits} (usado: ${assignedDesignUnits})`}
          </div>
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
          </div>

          {!loadingPrices && item.productId && prices.length === 0 ? (
            <div className="text-sm text-danger">
              El producto seleccionado no tiene precio vigente para este pedido.
            </div>
          ) : null}

          {!loadingProducts && products.length === 0 ? (
            <div className="text-sm text-danger">
              Este pedido no tiene productos disponibles en su prefactura.
            </div>
          ) : null}

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
              <div ref={moldingSectionRef} key={`design-config-${configurationMode}`} className="space-y-3">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,220px)_1fr] md:items-start">
                  <Select
                    isDisabled={uiDisabled || isCreateBlocked || isApplyingMolding}
                    label="Configuración"
                    selectedKeys={[configurationMode]}
                    onSelectionChange={(keys: any) => {
                      const nextMode = String(
                        Array.from(keys as any)[0] ?? "PRENDA",
                      ) as OrderConfigurationMode;

                      setConfigurationMode(nextMode);
                      if (nextMode === "PRENDA") {
                        setAssignmentTwo((s) => ({
                          ...s,
                          moldingTemplateId: null,
                        }));
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
                    La moldería autocompleta campos equivalentes del diseño y además muestra la ficha técnica derivada que no existe como campo principal editable.
                    Las posiciones solo se editan en conjunto + arquero.
                  </div>
                </div>

                {moldingLoadError ? (
                  <div className="text-xs text-danger">
                    No se pudieron cargar molderías: {moldingLoadError}
                  </div>
                ) : null}

                {!loadingMoldings && moldingTemplates.length === 0 ? (
                  <div className="text-xs text-warning">
                    No hay molderías disponibles para seleccionar en este momento.
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-medium border border-default-200 p-3 space-y-3">
                    <div className="text-sm font-semibold">Prenda 1</div>
                    <Select
                      isDisabled={
                        uiDisabled || loadingMoldings || isCreateBlocked || isApplyingMolding
                      }
                      label="Moldería"
                      selectedKeys={
                        assignmentOne.moldingTemplateId
                          ? [assignmentOne.moldingTemplateId]
                          : []
                      }
                      onSelectionChange={(keys: any) => {
                        const k = Array.from(keys as any)[0];

                        setAssignmentOne((s) => ({
                          ...s,
                          moldingTemplateId: k ? String(k) : null,
                        }));
                      }}
                    >
                      {moldingTemplates.map((t) => (
                        <SelectItem key={t.id} textValue={t.moldingCode}>
                          <span className="notranslate" translate="no">
                            {t.moldingCode}
                            {t.garmentType ? ` — ${t.garmentType}` : ""}
                            {t.color ? ` / ${t.color}` : ""}
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
                    <div key="create-conjunto-prenda-2" className="rounded-medium border border-default-200 p-3 space-y-3">
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
                    Aplicando datos de molderia...
                  </div>
                ) : null}
              </div>
            }
            canEditUnitPrice={canEditUnitPrice}
            computedTotal={computedTotal}
            imageOneFile={imageOneFile}
            imageTwoFile={imageTwoFile}
            isCreateBlocked={isCreateBlocked}
            logoFile={logoFile}
            orderKind={orderKind}
            quantityDescription={quantityHelpText}
            showAdvancedFields={true}
            fabricOptions={
              availableFabricOptions.length > 0
                ? availableFabricOptions
                : allFabricOptions
            }
            moldingTechnicalSections={moldingTechnicalSections}
            value={item}
            onChange={(next) => {
              const rawQty = Math.max(1, Math.floor(asNumber(next.quantity)));
              const cappedQty =
                availableDesignUnits === null
                  ? rawQty
                  : Math.max(1, Math.min(rawQty, availableDesignUnits));

              setItem({
                ...next,
                quantity: cappedQty,
              });
            }}
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
        <CardBody>
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

      {Boolean(item.requiresSocks) ? (
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

      <Card>
        <CardHeader>
          <div className="font-semibold">Insumos</div>
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
          isDisabled={
            isUploadingAssets ||
            isCreateBlocked ||
            isSaving ||
            (availableDesignUnits !== null && availableDesignUnits <= 0)
          }
          onPress={onSubmit}
        >
          {isSaving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
