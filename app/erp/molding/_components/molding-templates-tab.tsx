"use client";

import type {
  MoldingTemplateDetail,
  MoldingTemplateRow,
  MoldingTemplateInsumo,
} from "../_lib/types";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Input, Textarea } from "@heroui/input";
import { Checkbox } from "@heroui/checkbox";
import { Select, SelectItem } from "@heroui/select";
import { Tab, Tabs } from "@heroui/tabs";
import { Tooltip } from "@heroui/tooltip";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import {
  FiPlus,
  FiSearch,
  FiHelpCircle,
  FiTrash2,
  FiEdit2,
  FiEye,
} from "react-icons/fi";

import { apiJson, getErrorMessage } from "../_lib/api";

import { usePaginatedApi } from "@/app/erp/catalog/_hooks/use-paginated-api";
import { Pager } from "@/app/erp/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";
import { FileUpload } from "@/components/file-upload";

type Props = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

type FormState = {
  // Identification
  moldingCode: string;
  version: string;
  // Basic info
  garmentType: string;
  garmentSubtype: string;
  fabric: string;
  color: string;
  gender: string;
  process: string;
  estimatedLeadDays: string;
  // Images
  clothingImageOneUrl: string;
  // Boolean features
  screenPrint: boolean;
  embroidery: boolean;
  buttonhole: boolean;
  tag: boolean;
  printTechnique: string;
  embroideryTechnique: string;
  marquillaType: string;
  pocketConfig: string;
  hasElastic: boolean;
  hasInnerLining: boolean;
  hasPocket: boolean;
  hasLateralMesh: boolean;
  hasFajon: boolean;
  hasTanca: boolean;
  hasProtection: boolean;
  hasEntretela: boolean;
  // Neck
  neckType: string;
  // Sesgo & thread
  sesgoType: string;
  sesgoColor: string;
  hiladillaColor: string;
  cordColor: string;
  // Sleeve & cuff
  sleeveType: string;
  cuffType: string;
  // Zipper
  zipperLocation: string;
  zipperColor: string;
  zipperSizeCm: string;
  invisibleZipperColor: string;
  pocketZipperColor: string;
  // Lining & hood
  liningType: string;
  liningColor: string;
  hoodType: string;
  lateralMeshColor: string;
  // Buttons
  buttonType: string;
  buttonholeType: string;
  perillaColor: string;
  // Notes
  designDetail: string;
  fusioningNotes: string;
  observations: string;
  // Fabrics checklist
  fabricChecklist: string[];
};

const emptyForm: FormState = {
  moldingCode: "",
  version: "1",
  garmentType: "",
  garmentSubtype: "",
  fabric: "",
  color: "",
  gender: "",
  process: "",
  estimatedLeadDays: "28",
  clothingImageOneUrl: "",
  screenPrint: false,
  embroidery: false,
  buttonhole: false,
  tag: false,
  printTechnique: "NO",
  embroideryTechnique: "NO",
  marquillaType: "NO",
  pocketConfig: "SIN BOLSILLOS",
  hasElastic: false,
  hasInnerLining: false,
  hasPocket: false,
  hasLateralMesh: false,
  hasFajon: false,
  hasTanca: false,
  hasProtection: false,
  hasEntretela: false,
  neckType: "",
  sesgoType: "",
  sesgoColor: "",
  hiladillaColor: "",
  cordColor: "",
  sleeveType: "",
  cuffType: "NO APLICA",
  zipperLocation: "",
  zipperColor: "",
  zipperSizeCm: "",
  invisibleZipperColor: "",
  pocketZipperColor: "",
  liningType: "",
  liningColor: "",
  hoodType: "",
  lateralMeshColor: "",
  buttonType: "",
  buttonholeType: "",
  perillaColor: "",
  designDetail: "",
  fusioningNotes: "",
  observations: "",
  fabricChecklist: [],
};

function mapDetailToForm(detail: MoldingTemplateDetail): FormState {
  return {
    moldingCode: detail.moldingCode ?? "",
    version: String(detail.version ?? 1),
    garmentType: detail.garmentType ?? "",
    garmentSubtype: detail.garmentSubtype ?? "",
    fabric: detail.fabric ?? "",
    color: detail.color ?? "",
    gender: detail.gender ?? "",
    process: detail.process ?? "",
    estimatedLeadDays: "28",
    clothingImageOneUrl: detail.clothingImageOneUrl ?? "",
    screenPrint: Boolean(detail.screenPrint),
    embroidery: Boolean(detail.embroidery),
    buttonhole: Boolean(detail.buttonhole),
    tag: Boolean(detail.tag),
    printTechnique: detail.screenPrint ? "DTF" : "NO",
    embroideryTechnique: detail.embroidery ? "HILO" : "NO",
    marquillaType: detail.tag ? "VIOMAR" : "NO",
    pocketConfig: detail.hasPocket ? "EN EL PECHO" : "SIN BOLSILLOS",
    hasElastic: Boolean(detail.hasElastic),
    hasInnerLining: Boolean(detail.hasInnerLining),
    hasPocket: Boolean(detail.hasPocket),
    hasLateralMesh: Boolean(detail.hasLateralMesh),
    hasFajon: Boolean(detail.hasFajon),
    hasTanca: Boolean(detail.hasTanca),
    hasProtection: Boolean(detail.hasProtection),
    hasEntretela: Boolean(detail.hasEntretela),
    neckType: detail.neckType ?? "",
    sesgoType: detail.sesgoType ?? "",
    sesgoColor: detail.sesgoColor ?? "",
    hiladillaColor: detail.hiladillaColor ?? "",
    cordColor: detail.cordColor ?? "",
    sleeveType: detail.sleeveType ?? "",
    cuffType: detail.cuffType ?? "",
    zipperLocation: detail.zipperLocation ?? "",
    zipperColor: detail.zipperColor ?? "",
    zipperSizeCm: detail.zipperSizeCm ?? "",
    invisibleZipperColor: detail.invisibleZipperColor ?? "",
    pocketZipperColor: detail.pocketZipperColor ?? "",
    liningType: detail.liningType ?? "",
    liningColor: detail.liningColor ?? "",
    hoodType: detail.hoodType ?? "",
    lateralMeshColor: detail.lateralMeshColor ?? "",
    buttonType: detail.buttonType ?? "",
    buttonholeType: detail.buttonholeType ?? "",
    perillaColor: detail.perillaColor ?? "",
    designDetail: detail.designDetail ?? "",
    fusioningNotes: detail.fusioningNotes ?? "",
    observations: detail.observations ?? "",
    fabricChecklist: (() => {
      try {
        const parsed = JSON.parse(detail.compatibleFabrics ?? "[]");

        if (Array.isArray(parsed)) {
          return parsed.map((item) => normalizeUpper(item));
        }
      } catch {
        // Ignore parse errors and fall back to fabric field.
      }

      return String(detail.fabric ?? "")
        .split(",")
        .map((item) => normalizeUpper(item))
        .filter(Boolean);
    })(),
  };
}

type InsumoFormState = {
  inventoryItemId: string;
  variantId: string;
  qtyPerUnit: string;
  unit: string;
  variesBySize: boolean;
  notes: string;
};

type InventoryItemOption = {
  id: string;
  itemCode: string | null;
  name: string;
  unit: string | null;
};

const emptyInsumoForm: InsumoFormState = {
  inventoryItemId: "",
  variantId: "",
  qtyPerUnit: "",
  unit: "",
  variesBySize: false,
  notes: "",
};

const FABRIC_OPTIONS = [
  "VIOPLUS",
  "SUDAPLUS",
  "MONTEPLUS",
  "SANPLUS",
  "SPRING",
  "ZANETTY",
  "MONTESIMONE",
  "POLUX",
  "LICRA JABON",
  "LICRA NEWFLEX",
  "LICRA BAHIA",
] as const;

const GARMENT_TYPE_OPTIONS = [
  "CAMISILLA",
  "CAMISETA",
  "PANTALONETA",
  "SHORT",
  "LICRA CORTA",
  "BERMUDA",
  "POLO",
  "SUDADERA",
  "TOP",
  "CHAQUETA",
  "CORTAVIENTO",
  "BUSO",
  "BEISBOLERA",
  "TRUSAS",
  "FALDA",
  "CHALECOS",
  "PANTALON",
  "ESTETICA",
] as const;

const CAMISETA_SLEEVE_OPTIONS = ["MANGA CORTA", "MANGA LARGA"] as const;

const CAMISETA_SHORT_SLEEVE_SUBTYPE_OPTIONS = [
  "CUELLO OLIMPUS",
  "CUELLO COUGLAS",
  "CUELLO CON VENA",
  "CUELLO MILITAR",
  "CUELLO TIPO POLO",
  "CUELLO REDONDO",
  "CUELLO EN V",
] as const;

const CAMISETA_LONG_SLEEVE_SUBTYPE_OPTIONS = [
  "CUELLO EN V-REDONDO",
  "CUELLO BARUDA CON BABERO",
  "CUELLO MILITAR",
  "CUELLO TIPO POLO EN V O REDONDO",
] as const;

const CAMISETA_OBSERVATION_NOTE =
  "TENER EN CUENTA LA MANGA SIEMPRE IRA SENCILLA CON DOBLEZ EN PUÑO";

const CAMISILLA_NECK_OPTIONS = ["CUELLO NORMAL 4.5 CM", "CUELLO ESPECIAL 6.0 CM"] as const;

const CAMISILLA_SESGO_OPTIONS = ["SESGO O SOBREPUESTO 4.5 CM", "SESGO ESPECIAL 6.0 CM"] as const;

const SHORT_SUBTYPE_OPTIONS = [
  "VOLLEY",
  "PETO",
  "BALONCESTO",
  "PROMESAS",
  "DOBLE FAZ",
] as const;

const POLO_SUBTYPE_OPTIONS = [
  "CON CIERRE EN PERILLA",
  "2 BOTONES",
  "3 BOTONES",
  "CON BROCHE",
  "CON BOLSILLO (ARBITRO)",
  "CON CUELLO PREPARADO",
] as const;

const POLO_SHORT_SLEEVE_NECK_OPTIONS = ["CUELLO EN V", "CUELLO REDONDO"] as const;

const POLO_LONG_SLEEVE_NECK_OPTIONS = [
  "CUELLO BARUDA O CON BABERO",
  "CUELLO MILITAR",
  "CUELLO TIPO POLO",
] as const;

const GENDER_OPTIONS = ["MASCULINO", "FEMENINO"] as const;
const PROCESS_OPTIONS = ["SUBLIMACION", "CORTE"] as const;
const NECK_TYPE_OPTIONS = [
  "CUELLO REDONDO",
  "CUELLO EN V",
  "CUELLO MILITAR",
  "CUELLO TIPO POLO",
  "CUELLO TORTUGA",
  "OTRO",
] as const;
const SESGO_TYPE_OPTIONS = [
  ...CAMISILLA_SESGO_OPTIONS,
  "SESGO NORMAL",
  "SESGO INTERNO",
  "SIN SESGO",
  "OTRO",
] as const;
const SLEEVE_TYPE_OPTIONS = [
  ...CAMISETA_SLEEVE_OPTIONS,
  "SIN MANGA",
] as const;
const CUFF_TYPE_OPTIONS = [
  "NO APLICA",
  "RIB",
  "PUÑO TEJIDO",
  "PUÑO EN LA MISMA TELA",
] as const;
const LINING_TYPE_OPTIONS = [
  "SIN FORRO",
  "MALLA",
  "POLAR",
  "TAFETA",
  "OTRO",
] as const;
const HOOD_TYPE_OPTIONS = [
  "SIN CAPUCHA",
  "FIJA",
  "DESMONTABLE",
  "GUARDABLE",
] as const;
const BUTTON_TYPE_OPTIONS = [
  "SIN BOTONES",
  "2 BOTONES",
  "3 BOTONES",
  "BROCHE",
  "OTRO",
] as const;
const BUTTONHOLE_TYPE_OPTIONS = [
  "SIN OJAL",
  "SENCILLO",
  "REFORZADO",
  "OTRO",
] as const;
const PRINT_TECHNIQUE_OPTIONS = ["NO", "DTF", "VINILO"] as const;
const EMBROIDERY_TECHNIQUE_OPTIONS = ["NO", "HILO", "APLIQUE"] as const;
const MARQUILLA_OPTIONS = ["NO", "VIOMAR", "CLIENTE"] as const;
const POCKET_GENERIC_OPTIONS = [
  "SIN BOLSILLOS",
  "EN EL PECHO",
] as const;
const POCKET_PANTS_OPTIONS = [
  "SIN BOLSILLOS",
  "BOLSILLOS LATERALES",
  "BOLSILLOS LATERALES + BOLSILLO TRASERO",
] as const;
const YES_NO_OPTIONS = ["NO", "SI"] as const;
const PURCHASE_RULES_START = "[REGLAS_COMPRAS]";
const PURCHASE_RULES_END = "[/REGLAS_COMPRAS]";

function normalizeUpper(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function hasValue(value: string | null | undefined) {
  return Boolean(String(value ?? "").trim());
}

function getCamisetaSubtypeOptions(sleeveType: string) {
  const sleeve = normalizeUpper(sleeveType);

  if (sleeve === "MANGA LARGA") {
    return [...CAMISETA_LONG_SLEEVE_SUBTYPE_OPTIONS];
  }

  return [...CAMISETA_SHORT_SLEEVE_SUBTYPE_OPTIONS];
}

function getPoloNeckOptions(sleeveType: string): string[] {
  const sleeve = normalizeUpper(sleeveType);

  if (sleeve === "MANGA LARGA") {
    return [...POLO_LONG_SLEEVE_NECK_OPTIONS];
  }

  return [...POLO_SHORT_SLEEVE_NECK_OPTIONS];
}

function getPocketOptions(garmentType: string): string[] {
  const normalized = normalizeUpper(garmentType);

  if (
    normalized.includes("PANTALON") ||
    normalized.includes("BERMUDA") ||
    normalized.includes("PANTALOETA")
  ) {
    return [...POCKET_PANTS_OPTIONS];
  }

  return [...POCKET_GENERIC_OPTIONS];
}

function stripPurchaseRules(notes: string | null | undefined) {
  const value = String(notes ?? "").trim();

  if (!value.includes(PURCHASE_RULES_START)) {
    return value;
  }

  const afterStart = value.split(PURCHASE_RULES_START)[1] ?? "";
  const afterEnd = afterStart.split(PURCHASE_RULES_END)[1] ?? "";

  return afterEnd.trim();
}

function composePurchaseRulesNotes(manualNotes: string, rulesSummary: string) {
  const manual = String(manualNotes ?? "").trim();
  const rules = String(rulesSummary ?? "").trim();

  if (!rules) {
    return manual || null;
  }

  return [
    PURCHASE_RULES_START,
    rules,
    PURCHASE_RULES_END,
    manual,
  ]
    .filter(Boolean)
    .join("\n");
}

const fieldHelps: Record<string, string> = {
  garmentType: "Tipo de prenda (ej: T-SHIRT, POLO, JERSEY)",
  fabric:
    "Composición y características de la tela (ej: LYCRA 90/10, ALGODÓN 100%)",
  color: "Color de la prenda (ej: WHITE, BLACK, NAVY)",
  estimatedLeadDays: "Días aproximados para confeccionar la prenda",
  neckType: "Configuración del cuello según el tipo de prenda",
  gender: "Género de la prenda (ej: UNISEX, HOMBRE, MUJER)",
  process: "Proceso de confección (ej: CORTE-CONFECCION)",
};

function HelpIcon({ text }: { text: string }) {
  return (
    <Tooltip className="max-w-xs" color="foreground" content={text}>
      <FiHelpCircle className="inline-block ml-2 text-sm opacity-60" />
    </Tooltip>
  );
}

export function MoldingTemplatesTab({ canCreate, canEdit, canDelete }: Props) {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [activeTab, setActiveTab] = useState("general");
  const [insumos, setInsumos] = useState<MoldingTemplateInsumo[]>([]);
  const [insumoModalOpen, setInsumoModalOpen] = useState(false);
  const [editingInsumoId, setEditingInsumoId] = useState<string | null>(null);
  const [insumoForm, setInsumoForm] =
    useState<InsumoFormState>(emptyInsumoForm);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemOption[]>(
    [],
  );
  const [loadingInventoryItems, setLoadingInventoryItems] = useState(false);
  const [insumoItemSearch, setInsumoItemSearch] = useState("");

  const endpoint = useMemo(
    () => `/api/molding/templates?search=${encodeURIComponent(search)}`,
    [search],
  );

  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<MoldingTemplateRow>(endpoint, 20);

  const inventoryItemById = useMemo(() => {
    const map = new Map<string, InventoryItemOption>();

    for (const item of inventoryItems) {
      map.set(item.id, item);
    }

    return map;
  }, [inventoryItems]);

  const filteredInventoryItems = useMemo(() => {
    const q = insumoItemSearch.trim().toLowerCase();

    if (!q) return inventoryItems;

    return inventoryItems.filter((item) => {
      const code = String(item.itemCode ?? "").toLowerCase();
      const name = String(item.name ?? "").toLowerCase();
      const unit = String(item.unit ?? "").toLowerCase();

      return code.includes(q) || name.includes(q) || unit.includes(q);
    });
  }, [inventoryItems, insumoItemSearch]);

  const selectedInventoryItem =
    insumoForm.inventoryItemId &&
    inventoryItemById.has(insumoForm.inventoryItemId)
      ? (inventoryItemById.get(insumoForm.inventoryItemId) ?? null)
      : null;

  const selectedInventoryLabel = selectedInventoryItem
    ? `${selectedInventoryItem.itemCode ?? "—"} ${selectedInventoryItem.name}`.trim()
    : "";

  const garmentTypeOptions = useMemo(() => {
    const current = String(form.garmentType ?? "").trim();

    if (!current || GARMENT_TYPE_OPTIONS.includes(current as any)) {
      return [...GARMENT_TYPE_OPTIONS];
    }

    return [current, ...GARMENT_TYPE_OPTIONS];
  }, [form.garmentType]);

  const isCamiseta = normalizeUpper(form.garmentType) === "CAMISETA";
  const isCamisilla = normalizeUpper(form.garmentType) === "CAMISILLA";
  const isLicraCorta = normalizeUpper(form.garmentType) === "LICRA CORTA";
  const isShort = normalizeUpper(form.garmentType) === "SHORT";
  const isPolo = normalizeUpper(form.garmentType) === "POLO";
  const isSublimacion = normalizeUpper(form.process) === "SUBLIMACION";
  const isCorte = normalizeUpper(form.process) === "CORTE";
  const camisetaNeckOptions = useMemo(
    () => getCamisetaSubtypeOptions(form.sleeveType),
    [form.sleeveType],
  );
  const poloNeckOptions = useMemo(
    () => getPoloNeckOptions(form.sleeveType),
    [form.sleeveType],
  );
  const pocketOptions = useMemo(
    () => getPocketOptions(form.garmentType),
    [form.garmentType],
  );
  const hasSesgo =
    hasValue(form.sesgoType) && normalizeUpper(form.sesgoType) !== "SIN SESGO";
  const hasZipper = [
    form.zipperLocation,
    form.zipperColor,
    form.zipperSizeCm,
    form.invisibleZipperColor,
    form.pocketZipperColor,
  ].some((value) => hasValue(value));
  const hasLining =
    form.hasInnerLining ||
    (hasValue(form.liningType) && normalizeUpper(form.liningType) !== "SIN FORRO") ||
    hasValue(form.liningColor);
  const hasButtons =
    (hasValue(form.buttonType) && normalizeUpper(form.buttonType) !== "SIN BOTONES") ||
    (hasValue(form.buttonholeType) &&
      normalizeUpper(form.buttonholeType) !== "SIN OJAL") ||
    hasValue(form.perillaColor) ||
    form.buttonhole;
  const hasPocketConfigured =
    hasValue(form.pocketConfig) &&
    normalizeUpper(form.pocketConfig) !== "SIN BOLSILLOS";
  const purchaseRulesSummary = useMemo(() => {
    const fabrics =
      form.fabricChecklist.length > 0
        ? form.fabricChecklist.join(", ")
        : normalizeUpper(form.fabric) || "SIN DEFINIR";
    const sleeve = normalizeUpper(form.sleeveType) || "NO LLEVA";
    const neck = normalizeUpper(form.neckType) || "NO LLEVA";
    const sesgo = hasSesgo
      ? [form.sesgoType, form.sesgoColor, form.hiladillaColor, form.cordColor]
          .map((item) => normalizeUpper(item))
          .filter(Boolean)
          .join(" / ")
      : "NO LLEVA";
    const zipper = hasZipper
      ? [
          form.zipperLocation,
          form.zipperColor,
          form.zipperSizeCm ? `${form.zipperSizeCm} CM` : "",
          form.invisibleZipperColor,
          form.pocketZipperColor,
        ]
          .map((item) => normalizeUpper(item))
          .filter(Boolean)
          .join(" / ")
      : "NO LLEVA";
    const lining = hasLining
      ? [form.liningType, form.liningColor].map((item) => normalizeUpper(item)).filter(Boolean).join(" / ")
      : "NO LLEVA";
    const buttons = hasButtons
      ? [form.buttonType, form.buttonholeType, form.perillaColor]
          .map((item) => normalizeUpper(item))
          .filter(Boolean)
          .join(" / ")
      : "NO LLEVA";

    return [
      `TELA: ${fabrics}`,
      `PROCESO: ${normalizeUpper(form.process) || "SIN DEFINIR"}`,
      `SERIGRAFIA: ${normalizeUpper(form.printTechnique) || "NO"}`,
      `BORDADO: ${normalizeUpper(form.embroideryTechnique) || "NO"}`,
      `MARQUILLA: ${normalizeUpper(form.marquillaType) || "NO"}`,
      `MANGA: ${sleeve}`,
      `CUELLO: ${neck}`,
      `TIPO DE PUÑO: ${normalizeUpper(form.cuffType) || "NO APLICA"}`,
      `BOLSILLOS: ${normalizeUpper(form.pocketConfig) || "SIN BOLSILLOS"}`,
      `SESGO: ${sesgo}`,
      `CREMALLERA: ${zipper}`,
      `FORRO: ${lining}`,
      `BOTONES: ${buttons}`,
    ].join("\n");
  }, [
    form.buttonType,
    form.buttonholeType,
    form.cuffType,
    form.cordColor,
    form.embroideryTechnique,
    form.fabric,
    form.fabricChecklist,
    form.hiladillaColor,
    form.liningColor,
    form.liningType,
    form.neckType,
    form.pocketConfig,
    form.perillaColor,
    form.printTechnique,
    form.process,
    form.marquillaType,
    form.sesgoColor,
    form.sesgoType,
    form.sleeveType,
    form.zipperColor,
    form.zipperLocation,
    form.zipperSizeCm,
    form.invisibleZipperColor,
    form.pocketZipperColor,
    hasButtons,
    hasLining,
    hasSesgo,
    hasZipper,
  ]);

  useEffect(() => {
    if (!isCamiseta) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};
      const normalizedSleeve = normalizeUpper(prev.sleeveType);
      const allowedNeckOptions = getCamisetaSubtypeOptions(prev.sleeveType);

      if (
        normalizedSleeve !== "MANGA CORTA" &&
        normalizedSleeve !== "MANGA LARGA"
      ) {
        patch.sleeveType = "MANGA CORTA";
      }

      if (prev.neckType && !allowedNeckOptions.includes(prev.neckType as any)) {
        patch.neckType = "";
      }

      if (!normalizeUpper(prev.observations).includes(CAMISETA_OBSERVATION_NOTE)) {
        patch.observations = prev.observations
          ? `${prev.observations}\n${CAMISETA_OBSERVATION_NOTE}`
          : CAMISETA_OBSERVATION_NOTE;
      }

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isCamiseta]);

  useEffect(() => {
    if (!isCamisilla) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};

      if (prev.sleeveType) patch.sleeveType = "";

      if (
        prev.neckType &&
        !CAMISILLA_NECK_OPTIONS.includes(prev.neckType as any)
      ) {
        patch.neckType = "";
      }

      if (
        prev.sesgoType &&
        !CAMISILLA_SESGO_OPTIONS.includes(prev.sesgoType as any)
      ) {
        patch.sesgoType = "";
      }

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isCamisilla]);

  useEffect(() => {
    if (!isLicraCorta) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};

      if (prev.sleeveType) patch.sleeveType = "";
      if (prev.neckType) patch.neckType = "";

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isLicraCorta]);

  useEffect(() => {
    if (!isShort) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};

      if (prev.sleeveType) patch.sleeveType = "";
      if (prev.neckType) patch.neckType = "";

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isShort]);

  useEffect(() => {
    if (!isPolo) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};
      const normalizedSleeve = normalizeUpper(prev.sleeveType);
      const allowedNecks = [...getPoloNeckOptions(prev.sleeveType)] as string[];

      if (
        normalizedSleeve !== "MANGA CORTA" &&
        normalizedSleeve !== "MANGA LARGA"
      ) {
        patch.sleeveType = "MANGA CORTA";
      }

      if (
        prev.neckType &&
        !allowedNecks.some((neck) => neck === String(prev.neckType))
      ) {
        patch.neckType = "";
      }

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isPolo]);

  useEffect(() => {
    setForm((prev) => {
      const allowedPockets = getPocketOptions(prev.garmentType);
      const normalizedPocket = normalizeUpper(prev.pocketConfig);

      if (!allowedPockets.some((option) => normalizeUpper(option) === normalizedPocket)) {
        const fallbackPocket = allowedPockets[0] ?? "SIN BOLSILLOS";

        return {
          ...prev,
          pocketConfig: fallbackPocket,
          hasPocket: normalizeUpper(fallbackPocket) !== "SIN BOLSILLOS",
        };
      }

      const shouldHavePocket = normalizedPocket !== "SIN BOLSILLOS";

      if (prev.hasPocket === shouldHavePocket) return prev;

      return {
        ...prev,
        hasPocket: shouldHavePocket,
      };
    });
  }, [form.garmentType, form.pocketConfig]);

  useEffect(() => {
    setForm((prev) => {
      const normalizedProcess = normalizeUpper(prev.process);

      if (normalizedProcess === "SUBLIMACION") {
        if (!prev.color) return prev;

        return { ...prev, color: "" };
      }

      if (!prev.color) return prev;

      return { ...prev, color: normalizeUpper(prev.color) };
    });
  }, [form.process]);

  useEffect(() => {
    void (async () => {
      setLoadingInventoryItems(true);
      try {
        const response = (await apiJson(
          "/api/inventory-items?page=1&pageSize=600",
        )) as { items?: InventoryItemOption[] };

        setInventoryItems(Array.isArray(response.items) ? response.items : []);
      } catch {
        setInventoryItems([]);
      } finally {
        setLoadingInventoryItems(false);
      }
    })();
  }, []);

  function openCreate() {
    setEditingId(null);
    setViewOnly(false);
    setForm(emptyForm);
    setInsumos([]);
    setActiveTab("general");
    setModalOpen(true);
  }

  async function openEdit(id: string) {
    setSaving(true);
    try {
      const detail = (await apiJson(
        `/api/molding/templates/${id}`,
      )) as MoldingTemplateDetail;

      setEditingId(id);
      setViewOnly(false);
      setForm(mapDetailToForm(detail));
      setInsumos(detail.insumos ?? []);
      setActiveTab("general");
      setModalOpen(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function openView(id: string) {
    setSaving(true);
    try {
      const detail = (await apiJson(
        `/api/molding/templates/${id}`,
      )) as MoldingTemplateDetail;

      setEditingId(id);
      setViewOnly(true);
      setForm(mapDetailToForm(detail));
      setInsumos(detail.insumos ?? []);
      setActiveTab("general");
      setModalOpen(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function openCreateInsumo() {
    setEditingInsumoId(null);
    setInsumoForm({ ...emptyInsumoForm, notes: stripPurchaseRules(emptyInsumoForm.notes) });
    setInsumoItemSearch("");
    setInsumoModalOpen(true);
  }

  function openEditInsumo(insumo: MoldingTemplateInsumo) {
    setEditingInsumoId(insumo.id);
    setInsumoForm({
      inventoryItemId: insumo.inventoryItemId,
      variantId: insumo.variantId ?? "",
      qtyPerUnit: insumo.qtyPerUnit,
      unit: insumo.unit,
      variesBySize: insumo.variesBySize ?? false,
      notes: stripPurchaseRules(insumo.notes),
    });
    setInsumoItemSearch("");
    setInsumoModalOpen(true);
  }

  async function handleSaveInsumo() {
    if (!editingId) {
      toast.error("No template selected");

      return;
    }

    setSaving(true);
    try {
      if (editingInsumoId) {
        // Update existing
        const updated = (await apiJson(
          `/api/molding/templates/${editingId}/insumos/${editingInsumoId}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              inventoryItemId: insumoForm.inventoryItemId,
              variantId: insumoForm.variantId || null,
              qtyPerUnit: insumoForm.qtyPerUnit,
              unit: insumoForm.unit,
              variesBySize: insumoForm.variesBySize,
              notes: composePurchaseRulesNotes(
                insumoForm.notes,
                purchaseRulesSummary,
              ),
            }),
          },
        )) as MoldingTemplateInsumo;

        setInsumos((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
        toast.success("Insumo actualizado");
      } else {
        // Create new
        const result = await apiJson(
          `/api/molding/templates/${editingId}/insumos`,
          {
            method: "POST",
            body: JSON.stringify({
              inventoryItemId: insumoForm.inventoryItemId,
              variantId: insumoForm.variantId || null,
              qtyPerUnit: insumoForm.qtyPerUnit,
              unit: insumoForm.unit,
              variesBySize: insumoForm.variesBySize,
              notes: composePurchaseRulesNotes(
                insumoForm.notes,
                purchaseRulesSummary,
              ),
            }),
          },
        );

        setInsumos((prev) => [...prev, result as MoldingTemplateInsumo]);
        toast.success("Insumo agregado");
      }
      setInsumoModalOpen(false);
      setInsumoForm(emptyInsumoForm);
      setEditingInsumoId(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteInsumo(insumoId: string) {
    if (!editingId) return;

    setSaving(true);
    try {
      await apiJson(`/api/molding/templates/${editingId}/insumos/${insumoId}`, {
        method: "DELETE",
      });
      setInsumos(insumos.filter((i) => i.id !== insumoId));
      toast.success("Insumo eliminado");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setViewOnly(false);
    setForm(emptyForm);
    setInsumos([]);
    setActiveTab("general");
  }

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setSesgoEnabled(enabled: boolean) {
    setForm((prev) => {
      if (!enabled) {
        return {
          ...prev,
          sesgoType: "SIN SESGO",
          sesgoColor: "",
          hiladillaColor: "",
          cordColor: "",
        };
      }

      const defaultSesgo = isCamisilla
        ? CAMISILLA_SESGO_OPTIONS[0]
        : "SESGO NORMAL";

      return {
        ...prev,
        sesgoType:
          normalizeUpper(prev.sesgoType) === "SIN SESGO" || !prev.sesgoType
            ? defaultSesgo
            : prev.sesgoType,
      };
    });
  }

  function setZipperEnabled(enabled: boolean) {
    setForm((prev) => {
      if (enabled) return prev;

      return {
        ...prev,
        zipperLocation: "",
        zipperColor: "",
        zipperSizeCm: "",
        invisibleZipperColor: "",
        pocketZipperColor: "",
      };
    });
  }

  function setLiningEnabled(enabled: boolean) {
    setForm((prev) => {
      if (!enabled) {
        return {
          ...prev,
          hasInnerLining: false,
          liningType: "SIN FORRO",
          liningColor: "",
        };
      }

      return {
        ...prev,
        hasInnerLining: true,
        liningType:
          normalizeUpper(prev.liningType) === "SIN FORRO" || !prev.liningType
            ? "MALLA"
            : prev.liningType,
      };
    });
  }

  function setButtonsEnabled(enabled: boolean) {
    setForm((prev) => {
      if (!enabled) {
        return {
          ...prev,
          buttonhole: false,
          buttonType: "SIN BOTONES",
          buttonholeType: "SIN OJAL",
          perillaColor: "",
        };
      }

      return {
        ...prev,
        buttonhole: true,
        buttonType:
          normalizeUpper(prev.buttonType) === "SIN BOTONES" || !prev.buttonType
            ? "2 BOTONES"
            : prev.buttonType,
        buttonholeType:
          normalizeUpper(prev.buttonholeType) === "SIN OJAL" ||
          !prev.buttonholeType
            ? "SENCILLO"
            : prev.buttonholeType,
      };
    });
  }

  async function handleSave() {
    if (isCamiseta) {
      const normalizedSleeve = normalizeUpper(form.sleeveType);
      const allowedNeckOptions = getCamisetaSubtypeOptions(form.sleeveType);

      if (
        normalizedSleeve !== "MANGA CORTA" &&
        normalizedSleeve !== "MANGA LARGA"
      ) {
        toast.error("Para CAMISETA debes elegir MANGA CORTA o MANGA LARGA");

        return;
      }

      if (!form.neckType) {
        toast.error("Para CAMISETA debes seleccionar el cuello");

        return;
      }

      if (!allowedNeckOptions.includes(form.neckType as any)) {
        toast.error("El cuello no corresponde al tipo de manga seleccionado");

        return;
      }
    }

    if (isCamisilla) {
      if (!CAMISILLA_NECK_OPTIONS.includes(form.neckType as any)) {
        toast.error("Para CAMISILLA debes seleccionar el cuello");

        return;
      }

      if (!CAMISILLA_SESGO_OPTIONS.includes(form.sesgoType as any)) {
        toast.error("Para CAMISILLA debes seleccionar el sesgo");

        return;
      }
    }

    if (isLicraCorta && !form.hasFajon) {
      toast.error("Para LICRA CORTA debes marcar FAJON");

      return;
    }

    if (isPolo) {
      const normalizedSleeve = normalizeUpper(form.sleeveType);
      const allowedNecks = [...getPoloNeckOptions(form.sleeveType)] as string[];

      if (
        normalizedSleeve !== "MANGA CORTA" &&
        normalizedSleeve !== "MANGA LARGA"
      ) {
        toast.error("Para POLO debes elegir MANGA CORTA o MANGA LARGA");

        return;
      }

      if (!allowedNecks.some((neck) => neck === String(form.neckType))) {
        toast.error("El cuello no corresponde al tipo de manga seleccionado");

        return;
      }
    }

    if (hasSesgo && !form.sesgoType) {
      toast.error("Debes seleccionar la configuración del sesgo");

      return;
    }

    if (hasLining && !form.liningType) {
      toast.error("Debes seleccionar el tipo de revestimiento");

      return;
    }

    if (hasButtons && !form.buttonType) {
      toast.error("Debes seleccionar la configuración de botones");

      return;
    }

    setSaving(true);
    try {
      const payload = {
        moldingCode: form.moldingCode.trim() || undefined,
        version: form.version ? Number(form.version) : 1,
        garmentType: form.garmentType || undefined,
        garmentSubtype: form.neckType || undefined,
        fabric:
          form.fabricChecklist.length > 0
            ? form.fabricChecklist.join(", ")
            : form.fabric || undefined,
        color: isSublimacion ? undefined : form.color || undefined,
        gender: form.gender || undefined,
        process: form.process || undefined,
        estimatedLeadDays: 28,
        clothingImageOneUrl: form.clothingImageOneUrl || undefined,
        screenPrint: normalizeUpper(form.printTechnique) !== "NO",
        embroidery: normalizeUpper(form.embroideryTechnique) !== "NO",
        buttonhole: form.buttonhole,
        tag: normalizeUpper(form.marquillaType) !== "NO",
        hasElastic: form.hasElastic,
        hasInnerLining: form.hasInnerLining,
        hasPocket: hasPocketConfigured,
        hasLateralMesh: form.hasLateralMesh,
        hasFajon: form.hasFajon,
        hasTanca: form.hasTanca,
        hasProtection: form.hasProtection,
        hasEntretela: form.hasEntretela,
        neckType: form.neckType || undefined,
        sesgoType: form.sesgoType || undefined,
        sesgoColor: form.sesgoColor || undefined,
        hiladillaColor: form.hiladillaColor || undefined,
        cordColor: form.cordColor || undefined,
        sleeveType: form.sleeveType || undefined,
        cuffType: form.cuffType || undefined,
        zipperLocation: form.zipperLocation || undefined,
        zipperColor: form.zipperColor || undefined,
        zipperSizeCm: form.zipperSizeCm || undefined,
        invisibleZipperColor: form.invisibleZipperColor || undefined,
        pocketZipperColor: form.pocketZipperColor || undefined,
        liningType: form.liningType || undefined,
        liningColor: form.liningColor || undefined,
        hoodType: form.hoodType || undefined,
        lateralMeshColor: form.lateralMeshColor || undefined,
        buttonType: form.buttonType || undefined,
        buttonholeType: form.buttonholeType || undefined,
        perillaColor: form.perillaColor || undefined,
        designDetail: form.designDetail || undefined,
        fusioningNotes: form.fusioningNotes || undefined,
        observations: form.observations || undefined,
        compatibleFabrics:
          form.fabricChecklist.length > 0
            ? JSON.stringify(form.fabricChecklist)
            : undefined,
      };

      if (editingId) {
        await apiJson(`/api/molding/templates/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiJson("/api/molding/templates", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      toast.success(
        editingId ? "Molding template updated" : "Molding template created",
      );
      closeModal();
      setEditingId(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiJson(`/api/molding/templates/${id}`, { method: "DELETE" });
      toast.success("Molding template deactivated");
      setDeleteId(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const headers = [
    "Code",
    "Version",
    "Garment type",
    "Fabric",
    "Color",
    "Process",
    "Lead days",
    "Status",
    "Actions",
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search by code..."
          startContent={<FiSearch className="text-default-400" />}
          value={search}
          onValueChange={setSearch}
        />
        {canCreate && (
          <Button
            color="primary"
            startContent={<FiPlus />}
            onPress={openCreate}
          >
            New template
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton
          ariaLabel="Loading molding templates"
          headers={headers}
        />
      ) : (
        <>
          <Table removeWrapper aria-label="Molding templates">
            <TableHeader>
              {headers.map((h) => (
                <TableColumn key={h}>{h}</TableColumn>
              ))}
            </TableHeader>
            <TableBody emptyContent="No molding templates found">
              {(data?.items ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-sm">
                    {row.moldingCode}
                  </TableCell>
                  <TableCell>v{row.version}</TableCell>
                  <TableCell>{row.garmentType ?? "—"}</TableCell>
                  <TableCell>{row.fabric ?? "—"}</TableCell>
                  <TableCell>{row.color ?? "—"}</TableCell>
                  <TableCell>{row.process ?? "—"}</TableCell>
                  <TableCell>{row.estimatedLeadDays ?? "—"}</TableCell>
                  <TableCell>
                    <Chip
                      color={row.isActive ? "success" : "default"}
                      size="sm"
                      variant="flat"
                    >
                      {row.isActive ? "Active" : "Inactive"}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        startContent={<FiEye />}
                        variant="light"
                        onPress={() => openView(row.id)}
                      >
                        View
                      </Button>
                      {canEdit && row.isActive && (
                        <Button
                          size="sm"
                          variant="light"
                          onPress={() => openEdit(row.id)}
                        >
                          Edit
                        </Button>
                      )}
                      {canDelete && row.isActive && (
                        <Button
                          color="danger"
                          size="sm"
                          variant="light"
                          onPress={() => setDeleteId(row.id)}
                        >
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {data && data.total > data.pageSize && (
            <Pager data={data} page={page} onChange={setPage} />
          )}
        </>
      )}

      {/* Create Modal */}
      <Modal
        disableAnimation
        isOpen={modalOpen}
        scrollBehavior="inside"
        size="5xl"
        onClose={closeModal}
      >
        <ModalContent>
          <ModalHeader>
            {editingId
              ? viewOnly
                ? "View molding template"
                : "Edit molding template"
              : "New molding template"}
          </ModalHeader>
          <ModalBody className="pb-2">
            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(k) => setActiveTab(String(k))}
            >
              <Tab key="general" title="General">
                <div className="space-y-4 py-4">
                  {/* Identification */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      isDisabled={Boolean(editingId)}
                      isRequired={!editingId}
                      label="Molding code"
                      placeholder="Auto-generated if empty"
                      value={form.moldingCode}
                      onValueChange={(v) => setField("moldingCode", v)}
                    />
                    <Input
                      isDisabled={Boolean(editingId)}
                      label="Version"
                      placeholder="1"
                      type="number"
                      value={form.version}
                      onValueChange={(v) => setField("version", v)}
                    />
                  </div>

                  {/* Basic Info */}
                  <div>
                    <p className="text-sm font-semibold text-default-600 mb-3 flex items-center">
                      Basic Info
                      <HelpIcon text="Información básica de la prenda (tipo, tela, color)" />
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                      <Select
                        isRequired
                        label="Tipo de prenda"
                        placeholder="Seleccionar tipo de prenda"
                        selectedKeys={
                          form.garmentType
                            ? new Set([form.garmentType])
                            : new Set([])
                        }
                        selectionMode="single"
                        onSelectionChange={(keys) => {
                          const first = Array.from(keys)[0];

                          setField("garmentType", first ? String(first) : "");
                        }}
                      >
                        {garmentTypeOptions.map((option) => (
                          <SelectItem key={option}>{option}</SelectItem>
                        ))}
                      </Select>
                      {isCamiseta ? (
                        <Select
                          isRequired
                          label={
                            <div className="flex items-center">
                              Cuello
                              <HelpIcon text={fieldHelps.neckType} />
                            </div>
                          }
                          placeholder="Seleccionar cuello"
                          selectedKeys={
                            form.neckType ? new Set([form.neckType]) : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("neckType", first ? String(first) : "");
                          }}
                        >
                          {camisetaNeckOptions.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      ) : isCamisilla ? (
                        <Select
                          isRequired
                          label={
                            <div className="flex items-center">
                              Cuello
                              <HelpIcon text={fieldHelps.neckType} />
                            </div>
                          }
                          placeholder="Seleccionar cuello"
                          selectedKeys={
                            form.neckType ? new Set([form.neckType]) : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("neckType", first ? String(first) : "");
                          }}
                        >
                          {CAMISILLA_NECK_OPTIONS.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      ) : isPolo ? (
                        <Select
                          isRequired
                          label={
                            <div className="flex items-center">
                              Cuello
                              <HelpIcon text={fieldHelps.neckType} />
                            </div>
                          }
                          placeholder="Seleccionar cuello"
                          selectedKeys={
                            form.neckType ? new Set([form.neckType]) : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("neckType", first ? String(first) : "");
                          }}
                        >
                          {poloNeckOptions.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      ) : isLicraCorta || isShort ? (
                        <Input
                          isDisabled
                          label="Cuello"
                          placeholder="No aplica para este tipo de prenda"
                          value={form.neckType}
                          onValueChange={(v) => setField("neckType", v)}
                        />
                      ) : (
                        <Select
                          label={
                            <div className="flex items-center">
                              Cuello
                              <HelpIcon text={fieldHelps.neckType} />
                            </div>
                          }
                          placeholder="Seleccionar cuello"
                          selectedKeys={
                            form.neckType ? new Set([form.neckType]) : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("neckType", first ? String(first) : "");
                          }}
                        >
                          {NECK_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      )}
                      <Select
                        label={
                          <div className="flex items-center">
                            Tela
                            <HelpIcon text={fieldHelps.fabric} />
                          </div>
                        }
                        placeholder="Seleccionar telas compatibles"
                        selectedKeys={new Set(form.fabricChecklist)}
                        selectionMode="multiple"
                        onSelectionChange={(keys) => {
                          const next = Array.from(keys).map((item) =>
                            normalizeUpper(String(item)),
                          );

                          setForm((prev) => ({
                            ...prev,
                            fabricChecklist: next,
                            fabric: next.join(", "),
                          }));
                        }}
                      >
                        {FABRIC_OPTIONS.map((option) => (
                          <SelectItem key={option}>{option}</SelectItem>
                        ))}
                      </Select>
                      <Input
                        label={
                          <div className="flex items-center">
                            Color
                            <HelpIcon text={fieldHelps.color} />
                          </div>
                        }
                        isDisabled={!isCorte}
                        placeholder={
                          isCorte
                            ? "COLOR"
                            : "No aplica para SUBLIMACION"
                        }
                        value={form.color}
                        onValueChange={(v) => setField("color", normalizeUpper(v))}
                      />
                      <Select
                        label={
                          <div className="flex items-center">
                            Gender
                            <HelpIcon text={fieldHelps.gender} />
                          </div>
                        }
                        placeholder="Select gender"
                        selectedKeys={
                          form.gender ? new Set([form.gender]) : new Set([])
                        }
                        selectionMode="single"
                        onSelectionChange={(keys) => {
                          const first = Array.from(keys)[0];

                          if (!first) {
                            setField("gender", "");

                            return;
                          }

                          setField("gender", String(first));
                        }}
                      >
                        {GENDER_OPTIONS.map((option) => (
                          <SelectItem key={option}>{option}</SelectItem>
                        ))}
                      </Select>
                      <Select
                        label={
                          <div className="flex items-center">
                            Process
                            <HelpIcon text={fieldHelps.process} />
                          </div>
                        }
                        placeholder="Select process"
                        selectedKeys={
                          form.process ? new Set([form.process]) : new Set([])
                        }
                        selectionMode="single"
                        onSelectionChange={(keys) => {
                          const first = Array.from(keys)[0];

                          setField("process", first ? String(first) : "");
                        }}
                      >
                        {PROCESS_OPTIONS.map((option) => (
                          <SelectItem key={option}>{option}</SelectItem>
                        ))}
                      </Select>
                      <Input
                        isDisabled
                        label={
                          <div className="flex items-center">
                            Estimated lead days
                            <HelpIcon text={fieldHelps.estimatedLeadDays} />
                          </div>
                        }
                        placeholder="28"
                        type="number"
                        value="28"
                      />
                    </div>
                  </div>

                  {/* Imagen de referencia */}
                  <div>
                    <p className="text-sm font-semibold text-default-600 mb-3">
                      Imagen de referencia
                    </p>
                    <div className="flex flex-col gap-3">
                      <FileUpload
                        acceptedFileTypes="image/*"
                        label="Subir imagen de referencia"
                        uploadFolder="molding/templates"
                        value={form.clothingImageOneUrl}
                        onChange={(url) => setField("clothingImageOneUrl", url)}
                        onClear={() => setField("clothingImageOneUrl", "")}
                      />
                      {form.clothingImageOneUrl ? (
                        <img
                          alt="Vista previa de moldería"
                          className="h-48 w-full rounded-medium object-cover border border-default-200"
                          src={form.clothingImageOneUrl}
                        />
                      ) : null}
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <p className="text-sm font-semibold text-default-600 mb-3">
                      Features
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                      <Select
                        label="Serigrafía"
                        selectedKeys={new Set([form.printTechnique || "NO"])}
                        selectionMode="single"
                        onSelectionChange={(keys) => {
                          const first = String(Array.from(keys)[0] ?? "NO");

                          setForm((prev) => ({
                            ...prev,
                            printTechnique: first,
                            screenPrint: first !== "NO",
                          }));
                        }}
                      >
                        {PRINT_TECHNIQUE_OPTIONS.map((option) => (
                          <SelectItem key={option}>{option}</SelectItem>
                        ))}
                      </Select>
                      <Select
                        label="Bordado"
                        selectedKeys={new Set([form.embroideryTechnique || "NO"])}
                        selectionMode="single"
                        onSelectionChange={(keys) => {
                          const first = String(Array.from(keys)[0] ?? "NO");

                          setForm((prev) => ({
                            ...prev,
                            embroideryTechnique: first,
                            embroidery: first !== "NO",
                          }));
                        }}
                      >
                        {EMBROIDERY_TECHNIQUE_OPTIONS.map((option) => (
                          <SelectItem key={option}>{option}</SelectItem>
                        ))}
                      </Select>
                      <Select
                        label="Marquilla"
                        selectedKeys={new Set([form.marquillaType || "NO"])}
                        selectionMode="single"
                        onSelectionChange={(keys) => {
                          const first = String(Array.from(keys)[0] ?? "NO");

                          setForm((prev) => ({
                            ...prev,
                            marquillaType: first,
                            tag: first !== "NO",
                          }));
                        }}
                      >
                        {MARQUILLA_OPTIONS.map((option) => (
                          <SelectItem key={option}>{option}</SelectItem>
                        ))}
                      </Select>
                      <Select
                        label="Bolsillos"
                        selectedKeys={
                          new Set([
                            form.pocketConfig ||
                              (pocketOptions[0] ?? "SIN BOLSILLOS"),
                          ])
                        }
                        selectionMode="single"
                        onSelectionChange={(keys) => {
                          const first = String(
                            Array.from(keys)[0] ??
                              pocketOptions[0] ??
                              "SIN BOLSILLOS",
                          );

                          setForm((prev) => ({
                            ...prev,
                            pocketConfig: first,
                            hasPocket: normalizeUpper(first) !== "SIN BOLSILLOS",
                          }));
                        }}
                      >
                        {pocketOptions.map((option) => (
                          <SelectItem key={option}>{option}</SelectItem>
                        ))}
                      </Select>
                      <Checkbox
                        isSelected={form.hasElastic}
                        onValueChange={(v) => setField("hasElastic", v)}
                      >
                        Elastic
                      </Checkbox>
                      <Checkbox
                        isSelected={form.hasFajon}
                        onValueChange={(v) => setField("hasFajon", v)}
                      >
                        Fajón
                      </Checkbox>
                      <Checkbox
                        isSelected={form.hasTanca}
                        onValueChange={(v) => setField("hasTanca", v)}
                      >
                        Tanca
                      </Checkbox>
                      <Checkbox
                        isSelected={form.hasEntretela}
                        onValueChange={(v) => setField("hasEntretela", v)}
                      >
                        Entretela
                      </Checkbox>
                      <p className="text-xs text-default-500 sm:col-span-2 md:col-span-3">
                        Usar principalmente para beisboleras o cuellos reforzados.
                      </p>
                    </div>
                  </div>

                  {/* Sesgo & Thread */}
                  <div>
                    <p className="text-sm font-semibold text-default-600 mb-3">
                      Sesgo & Thread
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Select
                        label="Lleva sesgo"
                        selectedKeys={new Set([hasSesgo ? "SI" : "NO"])}
                        selectionMode="single"
                        onSelectionChange={(keys) => {
                          const first = Array.from(keys)[0];

                          setSesgoEnabled(String(first) === "SI");
                        }}
                      >
                        {YES_NO_OPTIONS.map((option) => (
                          <SelectItem key={option}>{option}</SelectItem>
                        ))}
                      </Select>
                      {isCamisilla ? (
                        <Select
                          isDisabled={!hasSesgo}
                          isRequired
                          label="Sesgo type"
                          placeholder="Select camisilla sesgo type"
                          selectedKeys={
                            form.sesgoType ? new Set([form.sesgoType]) : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("sesgoType", first ? String(first) : "");
                          }}
                        >
                          {CAMISILLA_SESGO_OPTIONS.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      ) : (
                        <Select
                          isDisabled={!hasSesgo}
                          label="Sesgo type"
                          placeholder="Select sesgo type"
                          selectedKeys={
                            form.sesgoType ? new Set([form.sesgoType]) : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("sesgoType", first ? String(first) : "");
                          }}
                        >
                          {SESGO_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      )}
                      <Input
                        isDisabled={!hasSesgo}
                        label="Sesgo color"
                        value={form.sesgoColor}
                        onValueChange={(v) => setField("sesgoColor", v)}
                      />
                      <Input
                        isDisabled={!hasSesgo}
                        label="Hiladilla color"
                        value={form.hiladillaColor}
                        onValueChange={(v) => setField("hiladillaColor", v)}
                      />
                      <Input
                        isDisabled={!hasSesgo}
                        label="Cord color"
                        value={form.cordColor}
                        onValueChange={(v) => setField("cordColor", v)}
                      />
                    </div>
                  </div>

                  {/* Sleeve & Cuff */}
                  <div>
                    <p className="text-sm font-semibold text-default-600 mb-3">
                      Sleeve & Cuff
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {isCamiseta || isPolo ? (
                        <Select
                          isRequired
                          label="Sleeve type"
                          selectedKeys={
                            form.sleeveType
                              ? new Set([form.sleeveType])
                              : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("sleeveType", first ? String(first) : "");
                          }}
                        >
                          {CAMISETA_SLEEVE_OPTIONS.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      ) : isCamisilla || isShort || isLicraCorta ? (
                        <Input
                          isDisabled
                          label="Sleeve type"
                          placeholder="No aplica para este tipo de prenda"
                          value={form.sleeveType}
                          onValueChange={(v) => setField("sleeveType", v)}
                        />
                      ) : (
                        <Select
                          label="Sleeve type"
                          placeholder="Select sleeve type"
                          selectedKeys={
                            form.sleeveType
                              ? new Set([form.sleeveType])
                              : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("sleeveType", first ? String(first) : "");
                          }}
                        >
                          {SLEEVE_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      )}
                      <Select
                        label="Tipo de puño"
                        selectedKeys={new Set([form.cuffType || "NO APLICA"])}
                        selectionMode="single"
                        onSelectionChange={(keys) => {
                          const first = Array.from(keys)[0];

                          setField("cuffType", first ? String(first) : "NO APLICA");
                        }}
                      >
                        {CUFF_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option}>{option}</SelectItem>
                        ))}
                      </Select>
                    </div>
                  </div>

                  {/* Zipper */}
                  <div>
                    <p className="text-sm font-semibold text-default-600 mb-3">
                      Zipper
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                      <Select
                        label="Lleva cremallera"
                        selectedKeys={new Set([hasZipper ? "SI" : "NO"])}
                        selectionMode="single"
                        onSelectionChange={(keys) => {
                          const first = Array.from(keys)[0];

                          setZipperEnabled(String(first) === "SI");
                        }}
                      >
                        {YES_NO_OPTIONS.map((option) => (
                          <SelectItem key={option}>{option}</SelectItem>
                        ))}
                      </Select>
                      <Input
                        isDisabled={!hasZipper}
                        label="Zipper location"
                        value={form.zipperLocation}
                        onValueChange={(v) => setField("zipperLocation", v)}
                      />
                      <Input
                        isDisabled={!hasZipper}
                        label="Zipper color"
                        value={form.zipperColor}
                        onValueChange={(v) => setField("zipperColor", v)}
                      />
                      <Input
                        isDisabled={!hasZipper}
                        label="Zipper size (cm)"
                        type="number"
                        value={form.zipperSizeCm}
                        onValueChange={(v) => setField("zipperSizeCm", v)}
                      />
                      <Input
                        isDisabled={!hasZipper}
                        label="Invisible zipper color"
                        value={form.invisibleZipperColor}
                        onValueChange={(v) =>
                          setField("invisibleZipperColor", v)
                        }
                      />
                      <Input
                        isDisabled={!hasZipper}
                        label="Pocket zipper color"
                        value={form.pocketZipperColor}
                        onValueChange={(v) => setField("pocketZipperColor", v)}
                      />
                    </div>
                  </div>

                  {/* Forro y capucha */}
                  <div>
                    <p className="text-sm font-semibold text-default-600 mb-3">
                      Forro y capucha
                    </p>
                    <div className="flex flex-col gap-4">
                      {/* Forro */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Select
                          label="Lleva revestimiento"
                          selectedKeys={new Set([hasLining ? "SI" : "NO"])}
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setLiningEnabled(String(first) === "SI");
                          }}
                        >
                          {YES_NO_OPTIONS.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                        <Select
                          isDisabled={!hasLining}
                          label="Tipo de revestimiento"
                          placeholder="Seleccione el tipo"
                          selectedKeys={
                            form.liningType
                              ? new Set([form.liningType])
                              : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("liningType", first ? String(first) : "");
                          }}
                        >
                          {LINING_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                        <Input
                          isDisabled={!hasLining}
                          label="Color del forro"
                          value={form.liningColor}
                          onValueChange={(v) => setField("liningColor", v)}
                        />
                      </div>
                      {/* Capucha y protección */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Select
                          label="Tipo de capucha"
                          placeholder="Seleccione el tipo de capucha"
                          selectedKeys={
                            form.hoodType
                              ? new Set([form.hoodType])
                              : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("hoodType", first ? String(first) : "");
                          }}
                        >
                          {HOOD_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                        <Checkbox
                          isSelected={form.hasProtection}
                          onValueChange={(v) => setField("hasProtection", v)}
                        >
                          Protección
                        </Checkbox>
                      </div>
                      {/* Malla lateral */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Checkbox
                          isSelected={form.hasLateralMesh}
                          onValueChange={(v) => setField("hasLateralMesh", v)}
                        >
                          Malla lateral
                        </Checkbox>
                        <Input
                          isDisabled={!form.hasLateralMesh}
                          label="Color de la malla lateral"
                          value={form.lateralMeshColor}
                          onValueChange={(v) => setField("lateralMeshColor", v)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div>
                    <p className="text-sm font-semibold text-default-600 mb-3">
                      Buttons
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Select
                        label="Lleva botones"
                        selectedKeys={new Set([hasButtons ? "SI" : "NO"])}
                        selectionMode="single"
                        onSelectionChange={(keys) => {
                          const first = Array.from(keys)[0];

                          setButtonsEnabled(String(first) === "SI");
                        }}
                      >
                        {YES_NO_OPTIONS.map((option) => (
                          <SelectItem key={option}>{option}</SelectItem>
                        ))}
                      </Select>
                      <Select
                        isDisabled={!hasButtons}
                        label="Button type"
                        placeholder="Select button type"
                        selectedKeys={
                          form.buttonType ? new Set([form.buttonType]) : new Set([])
                        }
                        selectionMode="single"
                        onSelectionChange={(keys) => {
                          const first = Array.from(keys)[0];

                          setField("buttonType", first ? String(first) : "");
                        }}
                      >
                        {BUTTON_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option}>{option}</SelectItem>
                        ))}
                      </Select>
                      <Select
                        isDisabled={!hasButtons}
                        label="Buttonhole type"
                        placeholder="Select buttonhole type"
                        selectedKeys={
                          form.buttonholeType
                            ? new Set([form.buttonholeType])
                            : new Set([])
                        }
                        selectionMode="single"
                        onSelectionChange={(keys) => {
                          const first = Array.from(keys)[0];

                          setField("buttonholeType", first ? String(first) : "");
                        }}
                      >
                        {BUTTONHOLE_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option}>{option}</SelectItem>
                        ))}
                      </Select>
                      <Input
                        isDisabled={!hasButtons}
                        label="Perilla color"
                        value={form.perillaColor}
                        onValueChange={(v) => setField("perillaColor", v)}
                      />
                    </div>
                  </div>

                  {/* Design & Notes */}
                  <div>
                    <p className="text-sm font-semibold text-default-600 mb-3">
                      Design & Notes
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      <Textarea
                        isReadOnly
                        label="Reglas automáticas para compras"
                        placeholder="Las reglas se construyen según la configuración elegida"
                        value={purchaseRulesSummary}
                      />
                      <Textarea
                        label="Design detail"
                        placeholder="Design notes..."
                        value={form.designDetail}
                        onValueChange={(v) => setField("designDetail", v)}
                      />
                      <Textarea
                        label="Fusioning notes"
                        placeholder="Fusioning instructions..."
                        value={form.fusioningNotes}
                        onValueChange={(v) => setField("fusioningNotes", v)}
                      />
                      <Textarea
                        label="Observations"
                        placeholder={
                          isCamiseta
                            ? CAMISETA_OBSERVATION_NOTE
                            : "Additional notes..."
                        }
                        value={form.observations}
                        onValueChange={(v) => setField("observations", v)}
                      />
                    </div>
                  </div>
                </div>
              </Tab>

              <Tab
                key="insumos"
                isDisabled={!editingId}
                title={`Insumos ${editingId ? `(${insumos.length})` : ""}`}
              >
                <div className="py-4 space-y-4">
                  {editingId ? (
                    <>
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-semibold">
                          Materias Primas por Unidad
                        </h3>
                        <Button
                          isDisabled={viewOnly}
                          color="primary"
                          size="sm"
                          startContent={<FiPlus />}
                          onPress={openCreateInsumo}
                        >
                          Add Insumo
                        </Button>
                      </div>

                      {insumos.length === 0 ? (
                        <p className="text-sm text-default-500 text-center py-8">
                          No insumos agregados
                        </p>
                      ) : (
                        <Table
                          removeWrapper
                          aria-label="Raw materials"
                          className="text-sm"
                        >
                          <TableHeader>
                            <TableColumn>Inventory Item</TableColumn>
                            <TableColumn>Qty per Unit</TableColumn>
                            <TableColumn>Unit</TableColumn>
                            <TableColumn>Varies by Size</TableColumn>
                            <TableColumn>Actions</TableColumn>
                          </TableHeader>
                          <TableBody>
                            {insumos.map((insumo) => (
                              <TableRow key={insumo.id}>
                                <TableCell className="text-xs">
                                  {inventoryItemById.get(insumo.inventoryItemId)
                                    ?.name ?? insumo.inventoryItemId}
                                </TableCell>
                                <TableCell>{insumo.qtyPerUnit}</TableCell>
                                <TableCell>{insumo.unit}</TableCell>
                                <TableCell>
                                  <Chip
                                    color={
                                      insumo.variesBySize
                                        ? "warning"
                                        : "default"
                                    }
                                    size="sm"
                                    variant="flat"
                                  >
                                    {insumo.variesBySize ? "Sí" : "No"}
                                  </Chip>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button
                                      isDisabled={viewOnly}
                                      isIconOnly
                                      size="sm"
                                      variant="light"
                                      onPress={() => openEditInsumo(insumo)}
                                    >
                                      <FiEdit2 />
                                    </Button>
                                    <Button
                                      isDisabled={viewOnly}
                                      isIconOnly
                                      color="danger"
                                      size="sm"
                                      variant="light"
                                      onPress={() =>
                                        handleDeleteInsumo(insumo.id)
                                      }
                                    >
                                      <FiTrash2 />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-default-500 text-center py-8">
                      Crear o editar template para agregar insumos
                    </p>
                  )}
                </div>
              </Tab>
            </Tabs>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={closeModal}>
              {viewOnly ? "Close" : "Cancel"}
            </Button>
            <Button
              color="primary"
              isDisabled={saving || viewOnly}
              onPress={handleSave}
            >
              {viewOnly
                ? "Read only"
                : saving
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Create template"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        disableAnimation
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
      >
        <ModalContent>
          <ModalHeader>Deactivate template</ModalHeader>
          <ModalBody>
            <p>Are you sure you want to deactivate this molding template?</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={() => deleteId && handleDelete(deleteId)}
            >
              Deactivate
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Insumo Create/Edit Modal */}
      <Modal
        disableAnimation
        isOpen={insumoModalOpen}
        onClose={() => setInsumoModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader>
            {editingInsumoId ? "Edit Insumo" : "Add Insumo"}
          </ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              label="Search inventory item"
              placeholder="Search by code, name or unit"
              value={insumoItemSearch}
              onValueChange={setInsumoItemSearch}
            />
            <Select
              isRequired
              isLoading={loadingInventoryItems}
              items={filteredInventoryItems}
              label="Inventory item"
              selectedKeys={
                insumoForm.inventoryItemId
                  ? new Set([insumoForm.inventoryItemId])
                  : new Set([])
              }
              selectionMode="single"
              onSelectionChange={(keys) => {
                const first = Array.from(keys)[0];

                setInsumoForm((prev) => ({
                  ...prev,
                  inventoryItemId: first ? String(first) : "",
                }));
              }}
            >
              {(item) => (
                <SelectItem
                  key={item.id}
                  textValue={`${item.itemCode ?? ""} ${item.name}`}
                >
                  <span className="font-mono text-xs text-default-500">
                    {item.itemCode ?? "—"}
                  </span>
                  <span className="ml-2">{item.name}</span>
                </SelectItem>
              )}
            </Select>
            {selectedInventoryLabel ? (
              <p className="text-xs text-default-500">
                Selected: {selectedInventoryLabel}
              </p>
            ) : null}
            <Input
              label="Variant ID"
              placeholder="Optional"
              value={insumoForm.variantId}
              onValueChange={(v) =>
                setInsumoForm({ ...insumoForm, variantId: v })
              }
            />
            <Input
              isRequired
              label="Qty per Unit"
              placeholder="e.g. 2.5"
              value={insumoForm.qtyPerUnit}
              onValueChange={(v) =>
                setInsumoForm({ ...insumoForm, qtyPerUnit: v })
              }
            />
            <Input
              isRequired
              label="Unit"
              placeholder="e.g. meters, kg, units"
              value={insumoForm.unit}
              onValueChange={(v) => setInsumoForm({ ...insumoForm, unit: v })}
            />
            <Checkbox
              isSelected={insumoForm.variesBySize}
              onValueChange={(v) =>
                setInsumoForm({ ...insumoForm, variesBySize: v })
              }
            >
              Varies by size
            </Checkbox>
            <Textarea
              isReadOnly
              label="Reglas visibles para compras"
              value={purchaseRulesSummary}
            />
            <Textarea
              label="Notas adicionales"
              placeholder="Observaciones manuales para compras..."
              value={insumoForm.notes}
              onValueChange={(v) => setInsumoForm({ ...insumoForm, notes: v })}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setInsumoModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={
                saving || !insumoForm.inventoryItemId || !insumoForm.qtyPerUnit
              }
              onPress={handleSaveInsumo}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
