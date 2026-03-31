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

const FALDA_OBSERVATION_NOTE =
  "TENER EN CUENTA PARA SEPARAR LICRA INTERNA DE LA FALDA, SIEMPRE Y CUANDO LA TELA SEA DIFERENTE Y ES NECESARIO PARA LA PARTE DE PRODUCCION. POR QUE CADA DISENO SE SEPARA DE ACUERDO A EL TIPO DE TELA";

const LICRA_CORTA_FAJON_NOTE =
  "CAUCHO PARA FAJON: 3 CM, 4 CM O 10 CM. ELASTICO EN LA PARTE TRASERA.";
const CAMISILLA_NOTE =
  "CAMISILLA CON CORTE LATERAL: CUELLO NORMAL 4.5 CM O ESPECIAL 6.0 CM. SESGO SOBREPUESTO 4.5 CM (MISMA TELA) O SESGO ESPECIAL 6.0 CM / NORMAL 3.5 CM. SIEMPRE VA EN SPRING (ESPECIFICAR COLOR). SESGO BASICO CUANDO REQUIERA: BLANCO O NEGRO. HILADILLA BASICA CUANDO REQUIERA: BLANCO, NEGRO, GRIS, AZUL OSCURO, AZUL REY, ROJO, AMARILLO. LATERALES EN MALLA (DEFINIR COLOR).";

const TOP_SUBTYPE_OPTIONS = ["SENCILLA", "CON FAJON"] as const;
const TOP_SESGO_OPTIONS = [
  "SESGO SOBREPUESTO 4.5 CM (MISMA TELA)",
  "SESGO NORMAL 3.5 CM",
] as const;
const TOP_NOTE =
  "TOP: SIEMPRE VA EN SPRING, ESPECIFICAR COLOR. FORRO INTERNO SOLO EN FRENTE EN LICRA JABON. SESGO EN COLORES BASICOS. HILADILLA EN COLORES BASICOS CUANDO REQUIERA.";

const CHAQUETA_SUBTYPE_OPTIONS = [
  "TIPO 1: CON CIERRE FRONTAL SENCILLA",
  "TIPO 2: CON CIERRE FRONTAL CON PUNO Y FAJON",
] as const;
const CORTAVIENTO_SUBTYPE_OPTIONS = [
  "TIPO 1: CON CIERRE FRONTAL SENCILLA",
  "TIPO 2: CON CIERRE FRONTAL CON PUNO Y FAJON",
] as const;
const CHALECO_SUBTYPE_OPTIONS = [
  "CHALECO ENGUATADO",
  "CHALECO CON FORRO",
  "CHALECO SIN FORRO",
  "CHALECO CIERRE EN BOLSILLOS",
] as const;
const TRUSAS_SUBTYPE_OPTIONS = [
  "TRUSA CICLISMO",
  "TRUSA PATINAJE",
  "CAMISETA CICLISMO",
  "LICRA DE CICLISMO",
  "TRUSAS GIMNASIA-NATACION",
  "TRUSA BODY + SHORT",
  "TRUSA CONJUNTO PORRISMO",
] as const;
const BEISBOLERA_SUBTYPE_OPTIONS = [
  "FULL BOTONES",
  "DOS BOTONES",
  "BUSO RUNING",
  "BUSO CON CIERRE",
  "BUSO TIPO BOLSILLO CANGURO, PARTIDO Y COMPLETO",
] as const;
const BUSO_SUBTYPE_OPTIONS = [
  "BUSO SENCILLO",
  "BUSO HODDIE",
  "HODDIE(CHOMPA) CON CAPUCHA",
  "BUSO RUNING",
  "BUSO CON CIERRE",
  "BUSO TIPO BOLSILLO CANGURO, PARTIDO Y COMPLETO",
] as const;
const CHAQUETA_NOTE =
  "CHAQUETA ENGUATADA TIPO MICHEL. MATERIAL: IMPERMEABLE O ANTIFLUIDOS. BOLSILLOS: DOS LATERALES Y UN BOLSILLO INTERNO. CIERRE CENTRAL HASTA CUELLO TIPO TORTUGA. FORRO: FLEECE, MALLA O PERCHADO. PERSONALIZACION: BORDADO EN BOLSILLO Y/O ESPALDA. OPCIONALES: MANGAS EXTRAIBLES, REFLECTIVOS, BOLSILLOS ADICIONALES, BORDADOS, ESTAMPADOS, CAPOTA, PUNOS.";
const CORTAVIENTO_NOTE =
  "CORTAVIENTO CON CAPUCHA FIJA. ESPECIFICAR TIPO DE MANGA. SI EL PUNO ES SOBREPUESTO, DEFINIR SI VA EN LA MISMA TELA O EN RIB. HILADILLA SOLO EN COLORES BASICOS (BLANCO, NEGRO, GRIS, AZUL OSCURO, AZUL REY, ROJO, AMARILLO). ESPECIFICAR COLOR DE FORROS Y CIERRES (FRONTAL, BOLSILLOS Y CAPUCHA). TENER EN CUENTA TANCA EN RUEDO Y PINOS, ELASTICO EN PUNO Y CORDON.";
const CHALECO_NOTE =
  "TIPOS DE CHALECO: ENGUATADO, CON FORRO, SIN FORRO, Y CON CIERRE EN BOLSILLOS. PRENDA SIN MANGA, SIN CAPUCHA Y SIN PUNO. SI LLEVA CIERRE EN BOLSILLOS, ESPECIFICAR COLOR.";
const TRUSAS_NOTE =
  "TIPOS DE TRUSAS: TRUSA CICLISMO, TRUSA PATINAJE, CAMISETA CICLISMO, LICRA DE CICLISMO, TRUSAS GIMNASIA-NATACION, TRUSA BODY + SHORT, TRUSA CONJUNTO PORRISMO. TENER EN CUENTA AL ESPECIFICAR INSUMOS: CIERRE INVISIBLE (ESPECIFICAR COLOR RESORTE) Y VERIFICAR SI LLEVA FORRO INTERNO.";
const BEISBOLERA_NOTE =
  "TIPOS DE BEISBOLERA: FULL BOTONES, DOS BOTONES, BUSO RUNING, BUSO CON CIERRE, BUSO TIPO BOLSILLO CANGURO (PARTIDO Y COMPLETO). INSUMOS: ENTRETELA PARA FUSIONAR, TIPO DE BOTON (VIOMAR O GENERICO), HILADILLA BASICA CUANDO REQUIERA (BLANCO, NEGRO, GRIS, AZUL OSCURO, AZUL REY, ROJO, AMARILLO).";
const BEISBOLERA_FULL_BOTONES_FUSION_NOTE =
  "PARA LA BEISBOLERA FULL BOTONES: LOS FALSOS Y COCOTERAS VAN FUSIONADAS COMPLETAS.";
const BEISBOLERA_DOS_BOTONES_FUSION_NOTE =
  "PARA LA BEISBOLERA DOS BOTONES: SOLO VAN FUSIONADAS 2 PERILLAS Y LA COCOTERA.";
const BUSO_NOTE =
  "TIPOS DE BUSOS: BUSO SENCILLO, BUSO HODDIE, HODDIE(CHOMPA) CON CAPUCHA, BUSO RUNING, BUSO CON CIERRE, BUSO TIPO BOLSILLO CANGURO (PARTIDO Y COMPLETO). INSUMOS: CIERRE DE 75 CM (ESPECIFICAR COLOR) Y CORDONES DE PRESENTACION (ESPECIFICAR COLOR: BLANCO, NEGRO O AZUL OSCURO).";

const CAMISILLA_NECK_OPTIONS = ["CUELLO NORMAL 4.5 CM", "CUELLO ESPECIAL 6.0 CM"] as const;

const CAMISILLA_SESGO_OPTIONS = [
  "SESGO O SOBREPUESTO 4.5 CM",
  "SESGO ESPECIAL 6.0 CM",
  "SESGO NORMAL 3.5 CM",
] as const;

const SHORT_SUBTYPE_OPTIONS = [
  "VOLEY",
  "PETO",
  "BALONCESTO",
  "PROMESAS",
  "DOBLE FAZ",
] as const;

const SUDADERA_SUBTYPE_OPTIONS = [
  "CON CIERRE EN BOTA",
  "CON CIERRE EN BOTA Y LATERAL",
  "CON CIERRE EN BOTA Y FRANJA",
  "CON CIERRE EN BOTA Y VENA",
  "DOS BOLSILLOS SENCILLA",
  "CON CIERRES LATERALES",
  "CON SESGO LATERAL",
  "CON SESGO LATERAL Y CIERRE",
  "RECTA CON CIERRE LATERAL",
  "RECTA CON CIERRES LATERALES Y VENA",
  "JOGGER BOTA RECTA",
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
  "CUELLO EN V",
  "CUELLO REDONDO",
  "CUELLO BARUDA O CON BABERO",
  "CUELLO MILITAR",
  "CUELLO TIPO POLO",
] as const;

const POLO_SLEEVE_OPTIONS = ["DOBLEZ", "MANGA LARGA"] as const;

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
const POCKET_CHALECO_OPTIONS = [
  "SIN BOLSILLOS",
  "BOLSILLOS LATERALES",
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

  if (normalized.includes("CHALECO")) {
    return [...POCKET_CHALECO_OPTIONS];
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
  const isTop = normalizeUpper(form.garmentType) === "TOP";
  const isFalda = normalizeUpper(form.garmentType) === "FALDA";
  const isShort = normalizeUpper(form.garmentType) === "SHORT";
  const isBermuda = normalizeUpper(form.garmentType) === "BERMUDA";
  const isPantaloneta = normalizeUpper(form.garmentType) === "PANTALONETA";
  const isSudadera = normalizeUpper(form.garmentType) === "SUDADERA";
  const isChaqueta = normalizeUpper(form.garmentType) === "CHAQUETA";
  const isCortaviento = normalizeUpper(form.garmentType) === "CORTAVIENTO";
  const isChaleco = ["CHALECO", "CHALECOS"].includes(
    normalizeUpper(form.garmentType),
  );
  const isTrusas = normalizeUpper(form.garmentType) === "TRUSAS";
  const isBeisbolera = normalizeUpper(form.garmentType) === "BEISBOLERA";
  const isBuso = normalizeUpper(form.garmentType) === "BUSO";
  const isLowerGarment =
    isShort ||
    isBermuda ||
    isPantaloneta ||
    isLicraCorta ||
    isSudadera ||
    isFalda;
  const isShortLikeSubtype = isShort || isBermuda || isPantaloneta;
  const isBermudaOrSudadera = isBermuda || isSudadera;
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
  const shortSubtypeOptions = useMemo(() => {
    const current = String(form.garmentSubtype ?? "").trim();

    if (!current || SHORT_SUBTYPE_OPTIONS.includes(current as any)) {
      return [...SHORT_SUBTYPE_OPTIONS];
    }

    return [current, ...SHORT_SUBTYPE_OPTIONS];
  }, [form.garmentSubtype]);
  const topSubtypeOptions = useMemo(() => {
    const current = String(form.garmentSubtype ?? "").trim();

    if (!current || TOP_SUBTYPE_OPTIONS.includes(current as any)) {
      return [...TOP_SUBTYPE_OPTIONS];
    }

    return [current, ...TOP_SUBTYPE_OPTIONS];
  }, [form.garmentSubtype]);
  const sudaderaSubtypeOptions = useMemo(() => {
    const current = String(form.garmentSubtype ?? "").trim();

    if (!current || SUDADERA_SUBTYPE_OPTIONS.includes(current as any)) {
      return [...SUDADERA_SUBTYPE_OPTIONS];
    }

    return [current, ...SUDADERA_SUBTYPE_OPTIONS];
  }, [form.garmentSubtype]);
  const chaquetaSubtypeOptions = useMemo(() => {
    const current = String(form.garmentSubtype ?? "").trim();

    if (!current || CHAQUETA_SUBTYPE_OPTIONS.includes(current as any)) {
      return [...CHAQUETA_SUBTYPE_OPTIONS];
    }

    return [current, ...CHAQUETA_SUBTYPE_OPTIONS];
  }, [form.garmentSubtype]);
  const cortavientoSubtypeOptions = useMemo(() => {
    const current = String(form.garmentSubtype ?? "").trim();

    if (!current || CORTAVIENTO_SUBTYPE_OPTIONS.includes(current as any)) {
      return [...CORTAVIENTO_SUBTYPE_OPTIONS];
    }

    return [current, ...CORTAVIENTO_SUBTYPE_OPTIONS];
  }, [form.garmentSubtype]);
  const chalecoSubtypeOptions = useMemo(() => {
    const current = String(form.garmentSubtype ?? "").trim();

    if (!current || CHALECO_SUBTYPE_OPTIONS.includes(current as any)) {
      return [...CHALECO_SUBTYPE_OPTIONS];
    }

    return [current, ...CHALECO_SUBTYPE_OPTIONS];
  }, [form.garmentSubtype]);
  const trusasSubtypeOptions = useMemo(() => {
    const current = String(form.garmentSubtype ?? "").trim();

    if (!current || TRUSAS_SUBTYPE_OPTIONS.includes(current as any)) {
      return [...TRUSAS_SUBTYPE_OPTIONS];
    }

    return [current, ...TRUSAS_SUBTYPE_OPTIONS];
  }, [form.garmentSubtype]);
  const beisboleraSubtypeOptions = useMemo(() => {
    const current = String(form.garmentSubtype ?? "").trim();

    if (!current || BEISBOLERA_SUBTYPE_OPTIONS.includes(current as any)) {
      return [...BEISBOLERA_SUBTYPE_OPTIONS];
    }

    return [current, ...BEISBOLERA_SUBTYPE_OPTIONS];
  }, [form.garmentSubtype]);
  const busoSubtypeOptions = useMemo(() => {
    const current = String(form.garmentSubtype ?? "").trim();

    if (!current || BUSO_SUBTYPE_OPTIONS.includes(current as any)) {
      return [...BUSO_SUBTYPE_OPTIONS];
    }

    return [current, ...BUSO_SUBTYPE_OPTIONS];
  }, [form.garmentSubtype]);
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
  const hasDrawstring = form.hasTanca;
  const hasPocketZipper =
    hasValue(form.pocketZipperColor) ||
    normalizeUpper(form.zipperLocation).includes("BOLSILLO");
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

      if (normalizeUpper(prev.sleeveType) !== "SIN MANGA") patch.sleeveType = "SIN MANGA";
      if (normalizeUpper(prev.cuffType) !== "NO APLICA") patch.cuffType = "NO APLICA";
      if (normalizeUpper(prev.hoodType) !== "SIN CAPUCHA") patch.hoodType = "SIN CAPUCHA";

      if (!normalizeUpper(prev.fabric).includes("SPRING")) {
        patch.fabric = "SPRING";
        patch.fabricChecklist = ["SPRING"];
      }

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

      patch.hasLateralMesh = true;

      if (!normalizeUpper(prev.observations).includes("CAMISILLA CON CORTE LATERAL")) {
        patch.observations = prev.observations
          ? `${prev.observations}\n${CAMISILLA_NOTE}`
          : CAMISILLA_NOTE;
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
      if (!normalizeUpper(prev.observations).includes("CAUCHO PARA FAJON")) {
        patch.observations = prev.observations
          ? `${prev.observations}\n${LICRA_CORTA_FAJON_NOTE}`
          : LICRA_CORTA_FAJON_NOTE;
      }

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isLicraCorta]);

  useEffect(() => {
    if (!isFalda) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};

      if (prev.sleeveType) patch.sleeveType = "";
      if (prev.neckType) patch.neckType = "";
      if (prev.garmentSubtype) patch.garmentSubtype = "";

      if (!normalizeUpper(prev.observations).includes("SEPARAR LICRA INTERNA")) {
        patch.observations = prev.observations
          ? `${prev.observations}\n${FALDA_OBSERVATION_NOTE}`
          : FALDA_OBSERVATION_NOTE;
      }

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isFalda]);

  useEffect(() => {
    if (!isTop) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};
      const normalizedSubtype = normalizeUpper(prev.garmentSubtype);

      if (!TOP_SUBTYPE_OPTIONS.some((option) => normalizeUpper(option) === normalizedSubtype)) {
        patch.garmentSubtype = "";
      }

      if (!normalizeUpper(prev.fabric).includes("SPRING")) {
        patch.fabric = "SPRING";
        patch.fabricChecklist = ["SPRING"];
      }

      patch.hasInnerLining = true;

      if (!normalizeUpper(prev.observations).includes("FORRO INTERNO SOLO EN FRENTE EN LICRA JABON")) {
        patch.observations = prev.observations
          ? `${prev.observations}\n${TOP_NOTE}`
          : TOP_NOTE;
      }

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isTop]);

  useEffect(() => {
    if (!isShort) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};
      const normalizedSubtype = normalizeUpper(prev.garmentSubtype);
      const allowedSubtypes = SHORT_SUBTYPE_OPTIONS.map((option) =>
        normalizeUpper(option),
      );

      if (prev.sleeveType) patch.sleeveType = "";
      if (prev.neckType) patch.neckType = "";

      if (!allowedSubtypes.includes(normalizedSubtype)) {
        patch.garmentSubtype = "";
      }

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isShort]);

  useEffect(() => {
    if (!isPantaloneta) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};
      const normalizedSubtype = normalizeUpper(prev.garmentSubtype);
      const allowedSubtypes = SHORT_SUBTYPE_OPTIONS.map((option) =>
        normalizeUpper(option),
      );

      if (prev.sleeveType) patch.sleeveType = "";
      if (prev.neckType) patch.neckType = "";

      if (!allowedSubtypes.includes(normalizedSubtype)) {
        patch.garmentSubtype = "";
      }

      if (
        !prev.pocketConfig ||
        normalizeUpper(prev.pocketConfig) === "SIN BOLSILLOS"
      ) {
        patch.pocketConfig = "BOLSILLOS LATERALES";
        patch.hasPocket = true;
      }

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isPantaloneta]);

  useEffect(() => {
    if (!isBermuda) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};
      const normalizedSubtype = normalizeUpper(prev.garmentSubtype);
      const allowedSubtypes = SHORT_SUBTYPE_OPTIONS.map((option) =>
        normalizeUpper(option),
      );

      if (prev.sleeveType) patch.sleeveType = "";
      if (prev.neckType) patch.neckType = "";

      if (!allowedSubtypes.includes(normalizedSubtype)) {
        patch.garmentSubtype = "";
      }

      if (!prev.pocketConfig || normalizeUpper(prev.pocketConfig) === "SIN BOLSILLOS") {
        patch.pocketConfig = "BOLSILLOS LATERALES";
        patch.hasPocket = true;
      }

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isBermuda]);

  useEffect(() => {
    if (!isSudadera) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};
      const normalizedSubtype = normalizeUpper(prev.garmentSubtype);
      const enablesZipper =
        normalizedSubtype.includes("CIERRE") ||
        normalizedSubtype.includes("LATERAL");

      if (prev.neckType) patch.neckType = "";

      if (
        prev.garmentSubtype &&
        !SUDADERA_SUBTYPE_OPTIONS.some(
          (option) => normalizeUpper(option) === normalizedSubtype,
        )
      ) {
        patch.garmentSubtype = "";
      }

      if (enablesZipper && !prev.zipperSizeCm) {
        patch.zipperSizeCm = "20";
      }

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isSudadera]);

  useEffect(() => {
    if (!isPolo) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};
      const normalizedSleeve = normalizeUpper(prev.sleeveType);
      const allowedNecks = [...getPoloNeckOptions(prev.sleeveType)] as string[];

      if (normalizedSleeve !== "DOBLEZ" && normalizedSleeve !== "MANGA LARGA") {
        patch.sleeveType = "DOBLEZ";
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
    if (!isChaqueta) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};
      const normalizedSubtype = normalizeUpper(prev.garmentSubtype);
      const isTipo2 = normalizedSubtype.includes("TIPO 2");

      if (
        prev.garmentSubtype &&
        !CHAQUETA_SUBTYPE_OPTIONS.some(
          (option) => normalizeUpper(option) === normalizedSubtype,
        )
      ) {
        patch.garmentSubtype = "";
      }

      if (!prev.pocketConfig || normalizeUpper(prev.pocketConfig) === "SIN BOLSILLOS") {
        patch.pocketConfig = "BOLSILLOS LATERALES";
        patch.hasPocket = true;
      }

      if (!prev.zipperLocation) {
        patch.zipperLocation = "CENTRAL FRONTAL HASTA CUELLO TIPO TORTUGA";
      }

      patch.hasInnerLining = true;
      if (!prev.liningType) patch.liningType = "MALLA";

      if (isTipo2) {
        patch.hasFajon = true;
      }

      if (!normalizeUpper(prev.observations).includes("CHAQUETA ENGUATADA TIPO MICHEL")) {
        patch.observations = prev.observations
          ? `${prev.observations}\n${CHAQUETA_NOTE}`
          : CHAQUETA_NOTE;
      }

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isChaqueta]);

  useEffect(() => {
    if (!isCortaviento) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};
      const normalizedSubtype = normalizeUpper(prev.garmentSubtype);
      const isTipo2 = normalizedSubtype.includes("TIPO 2");

      if (
        prev.garmentSubtype &&
        !CORTAVIENTO_SUBTYPE_OPTIONS.some(
          (option) => normalizeUpper(option) === normalizedSubtype,
        )
      ) {
        patch.garmentSubtype = "";
      }

      if (!prev.pocketConfig || normalizeUpper(prev.pocketConfig) === "SIN BOLSILLOS") {
        patch.pocketConfig = "BOLSILLOS LATERALES";
        patch.hasPocket = true;
      }

      if (!prev.hoodType || normalizeUpper(prev.hoodType) !== "FIJA") {
        patch.hoodType = "FIJA";
      }

      if (!prev.zipperLocation) {
        patch.zipperLocation = "CIERRE FRONTAL";
      }

      if (isTipo2) {
        patch.hasFajon = true;
      }

      if (!normalizeUpper(prev.observations).includes("CORTAVIENTO CON CAPUCHA FIJA")) {
        patch.observations = prev.observations
          ? `${prev.observations}\n${CORTAVIENTO_NOTE}`
          : CORTAVIENTO_NOTE;
      }

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isCortaviento]);

  useEffect(() => {
    if (!isChaleco) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};
      const normalizedSubtype = normalizeUpper(prev.garmentSubtype);

      if (
        prev.garmentSubtype &&
        !CHALECO_SUBTYPE_OPTIONS.some(
          (option) => normalizeUpper(option) === normalizedSubtype,
        )
      ) {
        patch.garmentSubtype = "";
      }

      patch.sleeveType = "SIN MANGA";
      patch.cuffType = "NO APLICA";
      patch.hoodType = "SIN CAPUCHA";
      patch.neckType = "";

      const needsLining =
        normalizedSubtype === "CHALECO ENGUATADO" ||
        normalizedSubtype === "CHALECO CON FORRO";
      const noLining = normalizedSubtype === "CHALECO SIN FORRO";
      const pocketZipperSubtype =
        normalizedSubtype === "CHALECO CIERRE EN BOLSILLOS";

      if (needsLining) {
        patch.hasInnerLining = true;
        if (!prev.liningType || normalizeUpper(prev.liningType) === "SIN FORRO") {
          patch.liningType = "MALLA";
        }
      }

      if (noLining) {
        patch.hasInnerLining = false;
        patch.liningType = "";
        patch.liningColor = "";
      }

      if (pocketZipperSubtype) {
        patch.pocketConfig = "BOLSILLOS LATERALES";
        patch.hasPocket = true;
      }

      if (!normalizeUpper(prev.observations).includes("TIPOS DE CHALECO")) {
        patch.observations = prev.observations
          ? `${prev.observations}\n${CHALECO_NOTE}`
          : CHALECO_NOTE;
      }

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isChaleco]);

  useEffect(() => {
    if (!isTrusas) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};
      const normalizedSubtype = normalizeUpper(prev.garmentSubtype);

      if (
        prev.garmentSubtype &&
        !TRUSAS_SUBTYPE_OPTIONS.some(
          (option) => normalizeUpper(option) === normalizedSubtype,
        )
      ) {
        patch.garmentSubtype = "";
      }

      if (!prev.hoodType || normalizeUpper(prev.hoodType) !== "SIN CAPUCHA") {
        patch.hoodType = "SIN CAPUCHA";
      }

      if (!prev.cuffType || normalizeUpper(prev.cuffType) !== "NO APLICA") {
        patch.cuffType = "NO APLICA";
      }

      if (!normalizeUpper(prev.observations).includes("TIPOS DE TRUSAS")) {
        patch.observations = prev.observations
          ? `${prev.observations}\n${TRUSAS_NOTE}`
          : TRUSAS_NOTE;
      }

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isTrusas]);

  useEffect(() => {
    if (!isBeisbolera) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};
      const normalizedSubtype = normalizeUpper(prev.garmentSubtype);
      const isFullBotones = normalizedSubtype === "FULL BOTONES";
      const isDosBotones = normalizedSubtype === "DOS BOTONES";
      const isBusoConCierre = normalizedSubtype === "BUSO CON CIERRE";
      const isBusoCanguro = normalizedSubtype.includes("BOLSILLO CANGURO");

      if (
        prev.garmentSubtype &&
        !BEISBOLERA_SUBTYPE_OPTIONS.some(
          (option) => normalizeUpper(option) === normalizedSubtype,
        )
      ) {
        patch.garmentSubtype = "";
      }

      patch.hasEntretela = true;

      if (isFullBotones || isDosBotones) {
        patch.buttonhole = true;
        if (!prev.buttonType || normalizeUpper(prev.buttonType) === "SIN BOTONES") {
          patch.buttonType = isDosBotones ? "2 BOTONES" : "OTRO";
        }
        if (!prev.buttonholeType || normalizeUpper(prev.buttonholeType) === "SIN OJAL") {
          patch.buttonholeType = "SENCILLO";
        }
      }

      if (isBusoConCierre && !prev.zipperLocation) {
        patch.zipperLocation = "CIERRE FRONTAL";
      }

      if (isBusoCanguro) {
        patch.pocketConfig = "EN EL PECHO";
        patch.hasPocket = true;
      }

      const currentObs = normalizeUpper(prev.observations);
      const notes: string[] = [];
      if (!currentObs.includes("TIPOS DE BEISBOLERA")) {
        notes.push(BEISBOLERA_NOTE);
      }
      if (isFullBotones && !currentObs.includes("FALSOS Y COCOTERAS VAN FUSIONADAS COMPLETAS")) {
        notes.push(BEISBOLERA_FULL_BOTONES_FUSION_NOTE);
      }
      if (isDosBotones && !currentObs.includes("SOLO VAN FUSIONADAS 2 PERILLAS Y LA COCOTERA")) {
        notes.push(BEISBOLERA_DOS_BOTONES_FUSION_NOTE);
      }
      if (notes.length > 0) {
        patch.observations = prev.observations
          ? `${prev.observations}\n${notes.join("\n")}`
          : notes.join("\n");
      }

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isBeisbolera]);

  useEffect(() => {
    if (!isBuso) return;

    setForm((prev) => {
      const patch: Partial<FormState> = {};
      const normalizedSubtype = normalizeUpper(prev.garmentSubtype);
      const isHooded =
        normalizedSubtype === "BUSO HODDIE" ||
        normalizedSubtype === "HODDIE(CHOMPA) CON CAPUCHA";
      const isBusoConCierre = normalizedSubtype === "BUSO CON CIERRE";
      const isBusoCanguro = normalizedSubtype.includes("BOLSILLO CANGURO");

      if (
        prev.garmentSubtype &&
        !BUSO_SUBTYPE_OPTIONS.some(
          (option) => normalizeUpper(option) === normalizedSubtype,
        )
      ) {
        patch.garmentSubtype = "";
      }

      if (isHooded) {
        patch.hoodType = "FIJA";
        patch.hasTanca = true;
      } else if (!prev.hoodType || normalizeUpper(prev.hoodType) === "FIJA") {
        patch.hoodType = "SIN CAPUCHA";
      }

      if (isBusoConCierre) {
        if (!prev.zipperLocation) patch.zipperLocation = "CIERRE FRONTAL";
        if (!prev.zipperSizeCm) patch.zipperSizeCm = "75";
      }

      if (isBusoCanguro) {
        patch.pocketConfig = "EN EL PECHO";
        patch.hasPocket = true;
      }

      if (!normalizeUpper(prev.observations).includes("TIPOS DE BUSOS")) {
        patch.observations = prev.observations
          ? `${prev.observations}\n${BUSO_NOTE}`
          : BUSO_NOTE;
      }

      if (!Object.keys(patch).length) return prev;

      return { ...prev, ...patch };
    });
  }, [isBuso]);

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

      if (!normalizeUpper(form.fabric).includes("SPRING")) {
        toast.error("Para CAMISILLA la tela debe ser SPRING");

        return;
      }

      if (!hasValue(form.color)) {
        toast.error("Para CAMISILLA debes especificar color");

        return;
      }

      if (!hasValue(form.sesgoColor)) {
        toast.error("Para CAMISILLA debes especificar color de sesgo");

        return;
      }

      if (!form.hasLateralMesh) {
        toast.error("Para CAMISILLA con corte lateral debes marcar malla lateral");

        return;
      }

      if (!hasValue(form.lateralMeshColor)) {
        toast.error("Para CAMISILLA debes definir color de la malla lateral");

        return;
      }
    }

    if (isLicraCorta && !form.hasFajon) {
      toast.error("Para LICRA CORTA debes marcar FAJON");

      return;
    }

    if (isLicraCorta && !form.hasElastic) {
      toast.error("Para LICRA CORTA debes marcar ELASTICO (parte trasera)");

      return;
    }

    if (
      isLicraCorta &&
      !/(3\s*CM|4\s*CM|10\s*CM)/.test(normalizeUpper(form.observations))
    ) {
      toast.error("En LICRA CORTA debes especificar caucho de fajon: 3 cm, 4 cm o 10 cm");

      return;
    }

    if (isFalda && form.garmentSubtype) {
      toast.error("Para FALDA no debes usar subtipo");

      return;
    }

    if (isFalda && form.neckType) {
      toast.error("Para FALDA no aplica cuello");

      return;
    }

    if (isFalda && !form.hasFajon) {
      toast.error("Para FALDA debes marcar FAJON");

      return;
    }

    if (isFalda && !form.hasElastic) {
      toast.error("Para FALDA debes marcar RESORTE / ELASTICO");

      return;
    }

    if (isPolo) {
      const normalizedSleeve = normalizeUpper(form.sleeveType);
      const allowedNecks = [...getPoloNeckOptions(form.sleeveType)] as string[];

      if (normalizedSleeve !== "DOBLEZ" && normalizedSleeve !== "MANGA LARGA") {
        toast.error("Para POLO debes elegir DOBLEZ o MANGA LARGA");

        return;
      }

      if (!POLO_SUBTYPE_OPTIONS.includes(form.garmentSubtype as any)) {
        toast.error("Para POLO debes seleccionar subtipo de polo");

        return;
      }

      if (!allowedNecks.some((neck) => neck === String(form.neckType))) {
        toast.error("El cuello no corresponde al tipo de manga seleccionado");

        return;
      }

      const normalizedSubtype = normalizeUpper(form.garmentSubtype);
      const requiresButtonSet =
        normalizedSubtype === "CON CIERRE EN PERILLA" ||
        normalizedSubtype === "2 BOTONES" ||
        normalizedSubtype === "3 BOTONES" ||
        normalizedSubtype === "CON BROCHE";
      const isBrocheSubtype = normalizedSubtype === "CON BROCHE";

      if (requiresButtonSet && !form.buttonholeType) {
        toast.error("Para POLO debes especificar el tipo de ojal");

        return;
      }

      if (requiresButtonSet && !form.buttonType) {
        toast.error("Para POLO debes especificar boton VIOMAR o generico / broche");

        return;
      }

      if (isBrocheSubtype && normalizeUpper(form.buttonType) !== "BROCHE") {
        toast.error("Si el subtipo es CON BROCHE, el tipo de boton debe ser BROCHE");

        return;
      }

      if (requiresButtonSet && !form.perillaColor) {
        toast.error("Para POLO debes especificar el color de perilla");
        return;
      }

      if (hasSesgo && !hasValue(form.hiladillaColor)) {
        toast.error("Si POLO lleva sesgo debes especificar color de hiladilla");

        return;
      }
    }

    if (isTop) {
      if (!TOP_SUBTYPE_OPTIONS.includes(form.garmentSubtype as any)) {
        toast.error("Para TOP debes seleccionar subtipo: SENCILLA o CON FAJON");

        return;
      }

      if (!normalizeUpper(form.fabric).includes("SPRING")) {
        toast.error("Para TOP la tela debe ser SPRING");

        return;
      }

      if (!hasValue(form.color)) {
        toast.error("Para TOP debes especificar color");

        return;
      }

      if (!form.hasInnerLining) {
        toast.error("Para TOP siempre aplica forro interno (solo frente en LICRA JABON)");

        return;
      }

      if (hasSesgo) {
        if (!TOP_SESGO_OPTIONS.includes(form.sesgoType as any)) {
          toast.error("En TOP el sesgo debe ser SOBREPUESTO 4.5 o NORMAL 3.5");

          return;
        }

        if (!hasValue(form.sesgoColor)) {
          toast.error("En TOP debes especificar color del sesgo (colores basicos)");

          return;
        }

        if (
          normalizeUpper(form.sesgoType) ===
            "SESGO NORMAL 3.5 CM" &&
          !form.hasFajon
        ) {
          toast.error("En TOP con sesgo normal 3.5 debes marcar FAJON");

          return;
        }
      }
    }

    if (isChaqueta) {
      if (!CHAQUETA_SUBTYPE_OPTIONS.includes(form.garmentSubtype as any)) {
        toast.error("Para CHAQUETA debes seleccionar subtipo TIPO 1 o TIPO 2");

        return;
      }

      if (!hasPocketConfigured) {
        toast.error("Para CHAQUETA debes especificar bolsillos laterales");

        return;
      }

      if (!hasValue(form.zipperLocation)) {
        toast.error("Para CHAQUETA debes especificar cierre frontal");

        return;
      }

      if (!form.hasInnerLining || !hasValue(form.liningType)) {
        toast.error("Para CHAQUETA debes especificar forro interno (fleece, malla o perchado)");

        return;
      }

      if (normalizeUpper(form.garmentSubtype).includes("TIPO 2")) {
        if (!form.hasFajon) {
          toast.error("En CHAQUETA TIPO 2 debes marcar FAJON");

          return;
        }

        if (normalizeUpper(form.cuffType) === "NO APLICA" || !hasValue(form.cuffType)) {
          toast.error("En CHAQUETA TIPO 2 debes especificar tipo de puno");

          return;
        }
      }
    }

    if (isCortaviento) {
      if (!CORTAVIENTO_SUBTYPE_OPTIONS.includes(form.garmentSubtype as any)) {
        toast.error("Para CORTAVIENTO debes seleccionar subtipo TIPO 1 o TIPO 2");

        return;
      }

      if (normalizeUpper(form.hoodType) !== "FIJA") {
        toast.error("Para CORTAVIENTO la capucha debe ser FIJA");

        return;
      }

      if (!hasPocketConfigured) {
        toast.error("Para CORTAVIENTO debes especificar bolsillos");

        return;
      }

      if (!hasValue(form.zipperLocation)) {
        toast.error("Para CORTAVIENTO debes especificar cierre frontal");

        return;
      }

      if (!hasValue(form.zipperColor)) {
        toast.error("Para CORTAVIENTO debes especificar color del cierre frontal");

        return;
      }

      if (hasPocketConfigured && !hasValue(form.pocketZipperColor)) {
        toast.error("Para CORTAVIENTO debes especificar color del cierre de bolsillos");

        return;
      }

      if (form.hasInnerLining && !hasValue(form.liningColor)) {
        toast.error("Si CORTAVIENTO lleva forro debes especificar color");

        return;
      }

      if (normalizeUpper(form.garmentSubtype).includes("TIPO 2")) {
        if (!form.hasFajon) {
          toast.error("En CORTAVIENTO TIPO 2 debes marcar FAJON");

          return;
        }

        if (normalizeUpper(form.cuffType) === "NO APLICA" || !hasValue(form.cuffType)) {
          toast.error("En CORTAVIENTO TIPO 2 debes especificar tipo de puno");

          return;
        }
      }
    }

    if (isChaleco) {
      if (!CHALECO_SUBTYPE_OPTIONS.includes(form.garmentSubtype as any)) {
        toast.error(
          "Para CHALECO debes seleccionar subtipo: ENGUATADO, CON FORRO, SIN FORRO o CIERRE EN BOLSILLOS",
        );

        return;
      }

      if (normalizeUpper(form.hoodType) !== "SIN CAPUCHA") {
        toast.error("Para CHALECO la capucha no aplica");

        return;
      }

      const normalizedSubtype = normalizeUpper(form.garmentSubtype);
      const needsLining =
        normalizedSubtype === "CHALECO ENGUATADO" ||
        normalizedSubtype === "CHALECO CON FORRO";
      const noLining = normalizedSubtype === "CHALECO SIN FORRO";
      const pocketZipperSubtype =
        normalizedSubtype === "CHALECO CIERRE EN BOLSILLOS";

      if (needsLining && (!form.hasInnerLining || !hasValue(form.liningType))) {
        toast.error("En CHALECO con forro o enguadado debes especificar tipo de forro");

        return;
      }

      if (noLining && form.hasInnerLining) {
        toast.error("En CHALECO SIN FORRO no debe marcarse forro interno");

        return;
      }

      if (pocketZipperSubtype && !hasValue(form.pocketZipperColor)) {
        toast.error("En CHALECO CIERRE EN BOLSILLOS debes especificar color del cierre");

        return;
      }
    }

    if (isTrusas) {
      if (!TRUSAS_SUBTYPE_OPTIONS.includes(form.garmentSubtype as any)) {
        toast.error(
          "Para TRUSAS debes seleccionar un subtipo valido de la matriz tecnica",
        );

        return;
      }

      if (normalizeUpper(form.hoodType) !== "SIN CAPUCHA") {
        toast.error("Para TRUSAS la capucha no aplica");

        return;
      }

      if (hasZipper && !hasValue(form.invisibleZipperColor)) {
        toast.error("En TRUSAS, si lleva cierre debes especificar color de cierre invisible/resorte");

        return;
      }

      if (form.hasInnerLining && !hasValue(form.liningType)) {
        toast.error("Si TRUSAS lleva forro interno debes especificar tipo de forro");

        return;
      }
    }

    if (isBeisbolera) {
      if (!BEISBOLERA_SUBTYPE_OPTIONS.includes(form.garmentSubtype as any)) {
        toast.error("Para BEISBOLERA debes seleccionar un subtipo valido");

        return;
      }

      if (!form.hasEntretela) {
        toast.error("Para BEISBOLERA debes marcar ENTRETELA para fusionar");

        return;
      }

      const normalizedSubtype = normalizeUpper(form.garmentSubtype);
      const requiresButtons =
        normalizedSubtype === "FULL BOTONES" || normalizedSubtype === "DOS BOTONES";

      if (requiresButtons && (!hasButtons || !hasValue(form.buttonType))) {
        toast.error("En BEISBOLERA con botones debes especificar tipo de boton");

        return;
      }

      if (requiresButtons && !hasValue(form.buttonholeType)) {
        toast.error("En BEISBOLERA con botones debes especificar tipo de ojal");

        return;
      }

      if (normalizedSubtype === "BUSO CON CIERRE") {
        if (!hasValue(form.zipperLocation) || !hasValue(form.zipperColor)) {
          toast.error("En BEISBOLERA BUSO CON CIERRE debes especificar ubicacion y color del cierre");

          return;
        }
      }

      if (
        normalizedSubtype.includes("BOLSILLO CANGURO") &&
        !hasPocketConfigured
      ) {
        toast.error("En BEISBOLERA tipo canguro debes configurar bolsillo");

        return;
      }

      if (hasSesgo && !hasValue(form.hiladillaColor)) {
        toast.error("En BEISBOLERA, si lleva sesgo debes especificar color de hiladilla");

        return;
      }
    }

    if (isBuso) {
      if (!BUSO_SUBTYPE_OPTIONS.includes(form.garmentSubtype as any)) {
        toast.error("Para BUSO debes seleccionar un subtipo valido");

        return;
      }

      const normalizedSubtype = normalizeUpper(form.garmentSubtype);
      const isHooded =
        normalizedSubtype === "BUSO HODDIE" ||
        normalizedSubtype === "HODDIE(CHOMPA) CON CAPUCHA";

      if (normalizedSubtype === "BUSO CON CIERRE") {
        if (!hasValue(form.zipperLocation) || !hasValue(form.zipperColor)) {
          toast.error("En BUSO CON CIERRE debes especificar ubicacion y color del cierre");

          return;
        }

        if (String(form.zipperSizeCm || "") !== "75") {
          toast.error("En BUSO CON CIERRE el tamano de cierre debe ser 75 cm");

          return;
        }
      }

      if (isHooded && normalizeUpper(form.hoodType) !== "FIJA") {
        toast.error("En BUSO tipo hoodie la capucha debe ser FIJA");

        return;
      }

      if ((isHooded || form.hasTanca) && !hasValue(form.cordColor)) {
        toast.error("En BUSO debes especificar color del cordon de presentacion");

        return;
      }
    }

    if (isPantaloneta) {
      const normalizedSubtype = normalizeUpper(form.garmentSubtype);
      const allowedSubtypes = SHORT_SUBTYPE_OPTIONS.map((option) =>
        normalizeUpper(option),
      );

      if (!allowedSubtypes.includes(normalizedSubtype)) {
        toast.error(
          "Para PANTALONETA debes seleccionar un subtipo: VOLEY, PETO, BALONCESTO, PROMESAS o DOBLE FAZ",
        );

        return;
      }

      if (hasDrawstring && !hasValue(form.cordColor)) {
        toast.error("Debes indicar el color de la cuerda");

        return;
      }

      if (form.hasLateralMesh && !hasValue(form.lateralMeshColor)) {
        toast.error("Debes indicar el color de la malla lateral");

        return;
      }
    }

    if (isShort) {
      const normalizedSubtype = normalizeUpper(form.garmentSubtype);
      const allowedSubtypes = SHORT_SUBTYPE_OPTIONS.map((option) =>
        normalizeUpper(option),
      );

      if (!allowedSubtypes.includes(normalizedSubtype)) {
        toast.error(
          "Para SHORT debes seleccionar un subtipo: VOLEY, PETO, BALONCESTO, PROMESAS o DOBLE FAZ",
        );

        return;
      }
    }

    if (isBermuda) {
      const normalizedSubtype = normalizeUpper(form.garmentSubtype);
      const allowedSubtypes = SHORT_SUBTYPE_OPTIONS.map((option) =>
        normalizeUpper(option),
      );

      if (!allowedSubtypes.includes(normalizedSubtype)) {
        toast.error(
          "Para BERMUDA debes seleccionar un subtipo: VOLEY, PETO, BALONCESTO, PROMESAS o DOBLE FAZ",
        );

        return;
      }

      if (hasPocketZipper && !hasValue(form.pocketZipperColor)) {
        toast.error("Debes indicar el color del cierre del bolsillo");

        return;
      }

      if (hasDrawstring && !hasValue(form.cordColor)) {
        toast.error("Debes indicar el color del cordon redondo Viomar");

        return;
      }

      if (hasPocketZipper && String(form.zipperSizeCm || "") !== "20") {
        toast.error("Para BERMUDA el tamano del cierre debe ser 20 cm");

        return;
      }
    }

    if (isSudadera) {
      const normalizedSubtype = normalizeUpper(form.garmentSubtype);
      const allowedSubtypes = SUDADERA_SUBTYPE_OPTIONS.map((option) =>
        normalizeUpper(option),
      );

      if (!allowedSubtypes.includes(normalizedSubtype)) {
        toast.error("Para SUDADERA debes seleccionar un subtipo valido");

        return;
      }

      if (hasZipper && !hasValue(form.zipperColor)) {
        toast.error("Debes indicar el color del cierre");

        return;
      }

      if (hasDrawstring && !hasValue(form.cordColor)) {
        toast.error("Debes indicar el color del cordon redondo Viomar");

        return;
      }

      if (hasZipper && String(form.zipperSizeCm || "") !== "20") {
        toast.error("Para SUDADERA el tamano del cierre debe ser 20 cm");

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
        garmentSubtype: form.garmentSubtype || undefined,
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
                      {isShortLikeSubtype ? (
                        <Select
                          isRequired
                          label={
                            isBermuda
                              ? "Subtipo de bermuda"
                              : isShort
                                ? "Subtipo de short"
                                : "Subtipo de pantaloneta"
                          }
                          placeholder="Seleccionar subtipo"
                          selectedKeys={
                            form.garmentSubtype
                              ? new Set([form.garmentSubtype])
                              : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("garmentSubtype", first ? String(first) : "");
                          }}
                        >
                          {shortSubtypeOptions.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      ) : isPolo ? (
                        <Select
                          isRequired
                          label="Subtipo de polo"
                          placeholder="Seleccionar subtipo"
                          selectedKeys={
                            form.garmentSubtype
                              ? new Set([form.garmentSubtype])
                              : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("garmentSubtype", first ? String(first) : "");
                          }}
                        >
                          {POLO_SUBTYPE_OPTIONS.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      ) : isTop ? (
                        <Select
                          isRequired
                          label="Subtipo de top"
                          placeholder="Seleccionar subtipo"
                          selectedKeys={
                            form.garmentSubtype
                              ? new Set([form.garmentSubtype])
                              : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("garmentSubtype", first ? String(first) : "");
                          }}
                        >
                          {topSubtypeOptions.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      ) : isChaqueta ? (
                        <Select
                          isRequired
                          label="Subtipo de chaqueta"
                          placeholder="Seleccionar subtipo"
                          selectedKeys={
                            form.garmentSubtype
                              ? new Set([form.garmentSubtype])
                              : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("garmentSubtype", first ? String(first) : "");
                          }}
                        >
                          {chaquetaSubtypeOptions.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      ) : isCortaviento ? (
                        <Select
                          isRequired
                          label="Subtipo de cortaviento"
                          placeholder="Seleccionar subtipo"
                          selectedKeys={
                            form.garmentSubtype
                              ? new Set([form.garmentSubtype])
                              : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("garmentSubtype", first ? String(first) : "");
                          }}
                        >
                          {cortavientoSubtypeOptions.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      ) : isChaleco ? (
                        <Select
                          isRequired
                          label="Subtipo de chaleco"
                          placeholder="Seleccionar subtipo"
                          selectedKeys={
                            form.garmentSubtype
                              ? new Set([form.garmentSubtype])
                              : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("garmentSubtype", first ? String(first) : "");
                          }}
                        >
                          {chalecoSubtypeOptions.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      ) : isTrusas ? (
                        <Select
                          isRequired
                          label="Subtipo de trusas"
                          placeholder="Seleccionar subtipo"
                          selectedKeys={
                            form.garmentSubtype
                              ? new Set([form.garmentSubtype])
                              : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("garmentSubtype", first ? String(first) : "");
                          }}
                        >
                          {trusasSubtypeOptions.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      ) : isBeisbolera ? (
                        <Select
                          isRequired
                          label="Subtipo de beisbolera"
                          placeholder="Seleccionar subtipo"
                          selectedKeys={
                            form.garmentSubtype
                              ? new Set([form.garmentSubtype])
                              : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("garmentSubtype", first ? String(first) : "");
                          }}
                        >
                          {beisboleraSubtypeOptions.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      ) : isBuso ? (
                        <Select
                          isRequired
                          label="Subtipo de buso"
                          placeholder="Seleccionar subtipo"
                          selectedKeys={
                            form.garmentSubtype
                              ? new Set([form.garmentSubtype])
                              : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("garmentSubtype", first ? String(first) : "");
                          }}
                        >
                          {busoSubtypeOptions.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      ) : isSudadera ? (
                        <Select
                          isRequired
                          label="Subtipo de sudadera"
                          placeholder="Seleccionar subtipo"
                          selectedKeys={
                            form.garmentSubtype
                              ? new Set([form.garmentSubtype])
                              : new Set([])
                          }
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const first = Array.from(keys)[0];

                            setField("garmentSubtype", first ? String(first) : "");
                          }}
                        >
                          {sudaderaSubtypeOptions.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      ) : null}
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
                      ) : isLowerGarment ? (
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
                      {isPantaloneta ? (
                        <>
                          <Select
                            isRequired
                            label="Bolsillo trasero"
                            selectedKeys={
                              new Set([
                                normalizeUpper(form.pocketConfig).includes("TRASERO")
                                  ? "SI"
                                  : "NO",
                              ])
                            }
                            selectionMode="single"
                            onSelectionChange={(keys) => {
                              const first = String(Array.from(keys)[0] ?? "NO");
                              const hasBackPocket = first === "SI";

                              setForm((prev) => ({
                                ...prev,
                                hasPocket: true,
                                pocketConfig: hasBackPocket
                                  ? "BOLSILLOS LATERALES + BOLSILLO TRASERO"
                                  : "BOLSILLOS LATERALES",
                              }));
                            }}
                          >
                            {YES_NO_OPTIONS.map((option) => (
                              <SelectItem key={option}>{option}</SelectItem>
                            ))}
                          </Select>
                          <Select
                            isRequired
                            label="Lleva elástico"
                            selectedKeys={new Set([form.hasElastic ? "SI" : "NO"])}
                            selectionMode="single"
                            onSelectionChange={(keys) => {
                              const first = String(Array.from(keys)[0] ?? "NO");

                              setField("hasElastic", first === "SI");
                            }}
                          >
                            {YES_NO_OPTIONS.map((option) => (
                              <SelectItem key={option}>{option}</SelectItem>
                            ))}
                          </Select>
                          <Select
                            isRequired
                            label="Lleva cuerda"
                            selectedKeys={new Set([hasDrawstring ? "SI" : "NO"])}
                            selectionMode="single"
                            onSelectionChange={(keys) => {
                              const first = String(Array.from(keys)[0] ?? "NO");
                              const enabled = first === "SI";

                              setForm((prev) => ({
                                ...prev,
                                hasTanca: enabled,
                                cordColor: enabled ? prev.cordColor : "",
                              }));
                            }}
                          >
                            {YES_NO_OPTIONS.map((option) => (
                              <SelectItem key={option}>{option}</SelectItem>
                            ))}
                          </Select>
                          <Input
                            isDisabled={!hasDrawstring}
                            isRequired={hasDrawstring}
                            label="Color de la cuerda"
                            value={form.cordColor}
                            onValueChange={(v) => setField("cordColor", v)}
                          />
                        </>
                      ) : isBermudaOrSudadera ? (
                        <>
                          <Select
                            isRequired
                            label="Cierres en bolsillos"
                            selectedKeys={new Set([hasPocketZipper ? "SI" : "NO"])}
                            selectionMode="single"
                            onSelectionChange={(keys) => {
                              const first = String(Array.from(keys)[0] ?? "NO");
                              const hasClosing = first === "SI";

                              setForm((prev) => ({
                                ...prev,
                                hasPocket: true,
                                pocketConfig: "BOLSILLOS LATERALES",
                                zipperLocation: hasClosing ? "BOLSILLOS" : "",
                                pocketZipperColor: hasClosing ? prev.pocketZipperColor : "",
                                zipperColor: hasClosing ? prev.zipperColor : "",
                                zipperSizeCm: hasClosing ? "20" : "",
                              }));
                            }}
                          >
                            {YES_NO_OPTIONS.map((option) => (
                              <SelectItem key={option}>{option}</SelectItem>
                            ))}
                          </Select>
                          <Input
                            isDisabled={!hasPocketZipper}
                            isRequired={hasPocketZipper}
                            label="Color del cierre del bolsillo"
                            value={form.pocketZipperColor}
                            onValueChange={(v) => setField("pocketZipperColor", v)}
                          />
                          <Select
                            isRequired
                            label="Lleva elastico"
                            selectedKeys={new Set([form.hasElastic ? "SI" : "NO"])}
                            selectionMode="single"
                            onSelectionChange={(keys) => {
                              const first = String(Array.from(keys)[0] ?? "NO");

                              setField("hasElastic", first === "SI");
                            }}
                          >
                            {YES_NO_OPTIONS.map((option) => (
                              <SelectItem key={option}>{option}</SelectItem>
                            ))}
                          </Select>
                          <Select
                            isRequired
                            label="Lleva cordon redondo Viomar"
                            selectedKeys={new Set([hasDrawstring ? "SI" : "NO"])}
                            selectionMode="single"
                            onSelectionChange={(keys) => {
                              const first = String(Array.from(keys)[0] ?? "NO");
                              const enabled = first === "SI";

                              setForm((prev) => ({
                                ...prev,
                                hasTanca: enabled,
                                cordColor: enabled ? prev.cordColor : "",
                              }));
                            }}
                          >
                            {YES_NO_OPTIONS.map((option) => (
                              <SelectItem key={option}>{option}</SelectItem>
                            ))}
                          </Select>
                          <Input
                            isDisabled={!hasDrawstring}
                            isRequired={hasDrawstring}
                            label="Color del cordon Viomar"
                            value={form.cordColor}
                            onValueChange={(v) => setField("cordColor", v)}
                          />
                        </>
                      ) : (
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
                      )}
                      {!isPantaloneta && !isBermudaOrSudadera ? (
                        <Checkbox
                          isSelected={form.hasElastic}
                          onValueChange={(v) => setField("hasElastic", v)}
                        >
                          Elastic
                        </Checkbox>
                      ) : null}
                      <Checkbox
                        isSelected={form.hasFajon}
                        onValueChange={(v) => setField("hasFajon", v)}
                      >
                        Fajón
                      </Checkbox>
                      {isShort ? (
                        <p className="text-xs text-default-500 sm:col-span-2 md:col-span-3">
                          Caucho para fajon en short: 3 cm, 4 cm o 10 cm (especificar en observaciones).
                        </p>
                      ) : null}
                      {!isPantaloneta && !isBermudaOrSudadera ? (
                        <Checkbox
                          isSelected={form.hasTanca}
                          onValueChange={(v) => setField("hasTanca", v)}
                        >
                          Tanca
                        </Checkbox>
                      ) : null}
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
                    {!isPantaloneta ? (
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
                          ) : isTop ? (
                            <Select
                              isDisabled={!hasSesgo}
                              isRequired={hasSesgo}
                              label="Sesgo type"
                              placeholder="Select top sesgo type"
                              selectedKeys={
                                form.sesgoType ? new Set([form.sesgoType]) : new Set([])
                              }
                              selectionMode="single"
                              onSelectionChange={(keys) => {
                                const first = Array.from(keys)[0];

                                setField("sesgoType", first ? String(first) : "");
                              }}
                            >
                              {TOP_SESGO_OPTIONS.map((option) => (
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
                    ) : null}

                  {/* Sleeve & Cuff */}
                  <div>
                    <p className="text-sm font-semibold text-default-600 mb-3">
                      Sleeve & Cuff
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {isCamiseta ? (
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
                      ) : isPolo ? (
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
                          {POLO_SLEEVE_OPTIONS.map((option) => (
                            <SelectItem key={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      ) :
                        isCamisilla ||
                        isShort ||
                        isLicraCorta ||
                        isPantaloneta ||
                        isChaleco ? (
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
                      {!isLowerGarment && !isChaleco && !isTrusas && !isCamisilla ? (
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
                      ) : null}
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
                          const enabled = String(first) === "SI";

                          if (enabled && isBermudaOrSudadera) {
                            setForm((prev) => ({
                              ...prev,
                              zipperSizeCm: prev.zipperSizeCm || "20",
                            }));

                            return;
                          }

                          setZipperEnabled(enabled);
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
                        isDisabled={!hasZipper || isBermudaOrSudadera || (isBuso && normalizeUpper(form.garmentSubtype) === "BUSO CON CIERRE")}
                        label="Zipper size (cm)"
                        type="number"
                        value={
                          hasZipper && isBermudaOrSudadera
                            ? "20"
                            : isBuso && normalizeUpper(form.garmentSubtype) === "BUSO CON CIERRE"
                              ? "75"
                              : form.zipperSizeCm
                        }
                        onValueChange={(v) =>
                          setField(
                            "zipperSizeCm",
                            isBermudaOrSudadera
                              ? "20"
                              : isBuso && normalizeUpper(form.garmentSubtype) === "BUSO CON CIERRE"
                                ? "75"
                                : v,
                          )
                        }
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
                          isDisabled={isTop}
                          label="Lleva revestimiento"
                          selectedKeys={new Set([isTop || hasLining ? "SI" : "NO"])}
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
                          placeholder={
                            isChaqueta
                              ? "Seleccione: fleece, malla o perchado"
                              : "Seleccione el tipo"
                          }
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
                          {!isLowerGarment && isCortaviento ? (
                            <Input
                              isDisabled
                              label="Tipo de capucha"
                              value={form.hoodType || "FIJA"}
                            />
                          ) : !isLowerGarment && isChaleco ? (
                            <Input
                              isDisabled
                              label="Tipo de capucha"
                              value={form.hoodType || "SIN CAPUCHA"}
                            />
                          ) : !isLowerGarment && isTrusas ? (
                            <Input
                              isDisabled
                              label="Tipo de capucha"
                              value={form.hoodType || "SIN CAPUCHA"}
                            />
                          ) : !isLowerGarment && isCamisilla ? (
                            <Input
                              isDisabled
                              label="Tipo de capucha"
                              value={form.hoodType || "SIN CAPUCHA"}
                            />
                          ) : !isLowerGarment ? (
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
                          ) : null}
                        {isPantaloneta ? (
                          <Select
                            isRequired
                            label="Lleva protección"
                            selectedKeys={new Set([form.hasProtection ? "SI" : "NO"])}
                            selectionMode="single"
                            onSelectionChange={(keys) => {
                              const first = String(Array.from(keys)[0] ?? "NO");

                              setField("hasProtection", first === "SI");
                            }}
                          >
                            {YES_NO_OPTIONS.map((option) => (
                              <SelectItem key={option}>{option}</SelectItem>
                            ))}
                          </Select>
                        ) : (
                          <Checkbox
                            isSelected={form.hasProtection}
                            onValueChange={(v) => setField("hasProtection", v)}
                          >
                            Protección
                          </Checkbox>
                        )}
                      </div>
                      {/* Malla lateral */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {isPantaloneta ? (
                          <Select
                            isRequired
                            label="Lleva malla lateral"
                            selectedKeys={new Set([form.hasLateralMesh ? "SI" : "NO"])}
                            selectionMode="single"
                            onSelectionChange={(keys) => {
                              const first = String(Array.from(keys)[0] ?? "NO");
                              const enabled = first === "SI";

                              setForm((prev) => ({
                                ...prev,
                                hasLateralMesh: enabled,
                                lateralMeshColor: enabled ? prev.lateralMeshColor : "",
                              }));
                            }}
                          >
                            {YES_NO_OPTIONS.map((option) => (
                              <SelectItem key={option}>{option}</SelectItem>
                            ))}
                          </Select>
                        ) : (
                          <Checkbox
                            isSelected={form.hasLateralMesh}
                            onValueChange={(v) => setField("hasLateralMesh", v)}
                          >
                            Malla lateral
                          </Checkbox>
                        )}
                        <Input
                          isDisabled={!form.hasLateralMesh}
                          isRequired={form.hasLateralMesh}
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
