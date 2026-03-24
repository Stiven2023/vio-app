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
} from "react-icons/fi";

import { apiJson, getErrorMessage } from "../_lib/api";

import { usePaginatedApi } from "@/app/erp/catalog/_hooks/use-paginated-api";
import { Pager } from "@/app/erp/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";

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
  manufacturingId: string;
  // Images
  clothingImageOneUrl: string;
  clothingImageTwoUrl: string;
  logoImageUrl: string;
  // Boolean features
  screenPrint: boolean;
  embroidery: boolean;
  buttonhole: boolean;
  snap: boolean;
  tag: boolean;
  flag: boolean;
  hasElastic: boolean;
  hasInnerLining: boolean;
  hasPocket: boolean;
  hasLateralMesh: boolean;
  hasFajon: boolean;
  hasTanca: boolean;
  hasProtection: boolean;
  hasEntretela: boolean;
  // Neck & collar
  neckType: string;
  collarType: string;
  // Sesgo & thread
  sesgoType: string;
  sesgoColor: string;
  hiladillaColor: string;
  cordColor: string;
  // Sleeve & cuff
  sleeveType: string;
  cuffType: string;
  cuffMaterial: string;
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
  estimatedLeadDays: "",
  manufacturingId: "",
  clothingImageOneUrl: "",
  clothingImageTwoUrl: "",
  logoImageUrl: "",
  screenPrint: false,
  embroidery: false,
  buttonhole: false,
  snap: false,
  tag: false,
  flag: false,
  hasElastic: false,
  hasInnerLining: false,
  hasPocket: false,
  hasLateralMesh: false,
  hasFajon: false,
  hasTanca: false,
  hasProtection: false,
  hasEntretela: false,
  neckType: "",
  collarType: "",
  sesgoType: "",
  sesgoColor: "",
  hiladillaColor: "",
  cordColor: "",
  sleeveType: "",
  cuffType: "",
  cuffMaterial: "",
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
    estimatedLeadDays: detail.estimatedLeadDays
      ? String(detail.estimatedLeadDays)
      : "",
    manufacturingId: detail.manufacturingId ?? "",
    clothingImageOneUrl: detail.clothingImageOneUrl ?? "",
    clothingImageTwoUrl: detail.clothingImageTwoUrl ?? "",
    logoImageUrl: detail.logoImageUrl ?? "",
    screenPrint: Boolean(detail.screenPrint),
    embroidery: Boolean(detail.embroidery),
    buttonhole: Boolean(detail.buttonhole),
    snap: Boolean(detail.snap),
    tag: Boolean(detail.tag),
    flag: Boolean(detail.flag),
    hasElastic: Boolean(detail.hasElastic),
    hasInnerLining: Boolean(detail.hasInnerLining),
    hasPocket: Boolean(detail.hasPocket),
    hasLateralMesh: Boolean(detail.hasLateralMesh),
    hasFajon: Boolean(detail.hasFajon),
    hasTanca: Boolean(detail.hasTanca),
    hasProtection: Boolean(detail.hasProtection),
    hasEntretela: Boolean(detail.hasEntretela),
    neckType: detail.neckType ?? "",
    collarType: detail.collarType ?? "",
    sesgoType: detail.sesgoType ?? "",
    sesgoColor: detail.sesgoColor ?? "",
    hiladillaColor: detail.hiladillaColor ?? "",
    cordColor: detail.cordColor ?? "",
    sleeveType: detail.sleeveType ?? "",
    cuffType: detail.cuffType ?? "",
    cuffMaterial: detail.cuffMaterial ?? "",
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

const fieldHelps: Record<string, string> = {
  garmentType: "Tipo de prenda (ej: T-SHIRT, POLO, JERSEY)",
  fabric:
    "Composición y características de la tela (ej: LYCRA 90/10, ALGODÓN 100%)",
  color: "Color de la prenda (ej: WHITE, BLACK, NAVY)",
  estimatedLeadDays: "Días aproximados para confeccionar la prenda",
  garmentSubtype: "Subtipo o variante de la prenda",
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
    setInsumoForm(emptyInsumoForm);
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
      notes: insumo.notes ?? "",
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
              notes: insumoForm.notes || null,
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
              notes: insumoForm.notes || null,
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
    setForm(emptyForm);
    setInsumos([]);
    setActiveTab("general");
  }

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        moldingCode: form.moldingCode.trim() || undefined,
        version: form.version ? Number(form.version) : 1,
        garmentType: form.garmentType || undefined,
        garmentSubtype: form.garmentSubtype || undefined,
        fabric: form.fabric || undefined,
        color: form.color || undefined,
        gender: form.gender || undefined,
        process: form.process || undefined,
        estimatedLeadDays: form.estimatedLeadDays
          ? Number(form.estimatedLeadDays)
          : undefined,
        manufacturingId: form.manufacturingId || undefined,
        clothingImageOneUrl: form.clothingImageOneUrl || undefined,
        clothingImageTwoUrl: form.clothingImageTwoUrl || undefined,
        logoImageUrl: form.logoImageUrl || undefined,
        screenPrint: form.screenPrint,
        embroidery: form.embroidery,
        buttonhole: form.buttonhole,
        snap: form.snap,
        tag: form.tag,
        flag: form.flag,
        hasElastic: form.hasElastic,
        hasInnerLining: form.hasInnerLining,
        hasPocket: form.hasPocket,
        hasLateralMesh: form.hasLateralMesh,
        hasFajon: form.hasFajon,
        hasTanca: form.hasTanca,
        hasProtection: form.hasProtection,
        hasEntretela: form.hasEntretela,
        neckType: form.neckType || undefined,
        collarType: form.collarType || undefined,
        sesgoType: form.sesgoType || undefined,
        sesgoColor: form.sesgoColor || undefined,
        hiladillaColor: form.hiladillaColor || undefined,
        cordColor: form.cordColor || undefined,
        sleeveType: form.sleeveType || undefined,
        cuffType: form.cuffType || undefined,
        cuffMaterial: form.cuffMaterial || undefined,
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
            {editingId ? "Edit molding template" : "New molding template"}
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
                      <Input
                        label={
                          <div className="flex items-center">
                            Garment type
                            <HelpIcon text={fieldHelps.garmentType} />
                          </div>
                        }
                        placeholder="e.g. T-SHIRT"
                        value={form.garmentType}
                        onValueChange={(v) => setField("garmentType", v)}
                      />
                      <Input
                        label="Garment subtype"
                        placeholder="e.g. POLO"
                        value={form.garmentSubtype}
                        onValueChange={(v) => setField("garmentSubtype", v)}
                      />
                      <Input
                        label={
                          <div className="flex items-center">
                            Fabric
                            <HelpIcon text={fieldHelps.fabric} />
                          </div>
                        }
                        placeholder="e.g. LYCRA 90/10"
                        value={form.fabric}
                        onValueChange={(v) => setField("fabric", v)}
                      />
                      <Input
                        label={
                          <div className="flex items-center">
                            Color
                            <HelpIcon text={fieldHelps.color} />
                          </div>
                        }
                        placeholder="e.g. WHITE"
                        value={form.color}
                        onValueChange={(v) => setField("color", v)}
                      />
                      <Input
                        label={
                          <div className="flex items-center">
                            Gender
                            <HelpIcon text={fieldHelps.gender} />
                          </div>
                        }
                        placeholder="e.g. UNISEX"
                        value={form.gender}
                        onValueChange={(v) => setField("gender", v)}
                      />
                      <Input
                        label={
                          <div className="flex items-center">
                            Process
                            <HelpIcon text={fieldHelps.process} />
                          </div>
                        }
                        placeholder="e.g. CORTE-CONFECCION"
                        value={form.process}
                        onValueChange={(v) => setField("process", v)}
                      />
                      <Input
                        label={
                          <div className="flex items-center">
                            Estimated lead days
                            <HelpIcon text={fieldHelps.estimatedLeadDays} />
                          </div>
                        }
                        placeholder="7"
                        type="number"
                        value={form.estimatedLeadDays}
                        onValueChange={(v) => setField("estimatedLeadDays", v)}
                      />
                      <Input
                        label="Manufacturing ID"
                        placeholder="e.g. MFG-001"
                        value={form.manufacturingId}
                        onValueChange={(v) => setField("manufacturingId", v)}
                      />
                    </div>
                  </div>

                  {/* Images */}
                  <div>
                    <p className="text-sm font-semibold text-default-600 mb-3">
                      Images (URLs)
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input
                        label="Clothing image 1 URL"
                        placeholder="https://..."
                        value={form.clothingImageOneUrl}
                        onValueChange={(v) =>
                          setField("clothingImageOneUrl", v)
                        }
                      />
                      <Input
                        label="Clothing image 2 URL"
                        placeholder="https://..."
                        value={form.clothingImageTwoUrl}
                        onValueChange={(v) =>
                          setField("clothingImageTwoUrl", v)
                        }
                      />
                      <Input
                        label="Logo image URL"
                        placeholder="https://..."
                        value={form.logoImageUrl}
                        onValueChange={(v) => setField("logoImageUrl", v)}
                      />
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <p className="text-sm font-semibold text-default-600 mb-3">
                      Features
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      <Checkbox
                        isSelected={form.screenPrint}
                        onValueChange={(v) => setField("screenPrint", v)}
                      >
                        Screen print
                      </Checkbox>
                      <Checkbox
                        isSelected={form.embroidery}
                        onValueChange={(v) => setField("embroidery", v)}
                      >
                        Embroidery
                      </Checkbox>
                      <Checkbox
                        isSelected={form.buttonhole}
                        onValueChange={(v) => setField("buttonhole", v)}
                      >
                        Buttonhole
                      </Checkbox>
                      <Checkbox
                        isSelected={form.snap}
                        onValueChange={(v) => setField("snap", v)}
                      >
                        Snap
                      </Checkbox>
                      <Checkbox
                        isSelected={form.tag}
                        onValueChange={(v) => setField("tag", v)}
                      >
                        Tag
                      </Checkbox>
                      <Checkbox
                        isSelected={form.flag}
                        onValueChange={(v) => setField("flag", v)}
                      >
                        Flag
                      </Checkbox>
                      <Checkbox
                        isSelected={form.hasElastic}
                        onValueChange={(v) => setField("hasElastic", v)}
                      >
                        Elastic
                      </Checkbox>
                      <Checkbox
                        isSelected={form.hasInnerLining}
                        onValueChange={(v) => setField("hasInnerLining", v)}
                      >
                        Inner lining
                      </Checkbox>
                      <Checkbox
                        isSelected={form.hasPocket}
                        onValueChange={(v) => setField("hasPocket", v)}
                      >
                        Pocket
                      </Checkbox>
                      <Checkbox
                        isSelected={form.hasLateralMesh}
                        onValueChange={(v) => setField("hasLateralMesh", v)}
                      >
                        Lateral mesh
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
                        isSelected={form.hasProtection}
                        onValueChange={(v) => setField("hasProtection", v)}
                      >
                        Protection
                      </Checkbox>
                      <Checkbox
                        isSelected={form.hasEntretela}
                        onValueChange={(v) => setField("hasEntretela", v)}
                      >
                        Entretela
                      </Checkbox>
                    </div>
                  </div>

                  {/* Neck & Collar */}
                  <div>
                    <p className="text-sm font-semibold text-default-600 mb-3">
                      Neck & Collar
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input
                        label="Neck type"
                        value={form.neckType}
                        onValueChange={(v) => setField("neckType", v)}
                      />
                      <Input
                        label="Collar type"
                        value={form.collarType}
                        onValueChange={(v) => setField("collarType", v)}
                      />
                    </div>
                  </div>

                  {/* Sesgo & Thread */}
                  <div>
                    <p className="text-sm font-semibold text-default-600 mb-3">
                      Sesgo & Thread
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input
                        label="Sesgo type"
                        value={form.sesgoType}
                        onValueChange={(v) => setField("sesgoType", v)}
                      />
                      <Input
                        label="Sesgo color"
                        value={form.sesgoColor}
                        onValueChange={(v) => setField("sesgoColor", v)}
                      />
                      <Input
                        label="Hiladilla color"
                        value={form.hiladillaColor}
                        onValueChange={(v) => setField("hiladillaColor", v)}
                      />
                      <Input
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
                      <Input
                        label="Sleeve type"
                        value={form.sleeveType}
                        onValueChange={(v) => setField("sleeveType", v)}
                      />
                      <Input
                        label="Cuff type"
                        value={form.cuffType}
                        onValueChange={(v) => setField("cuffType", v)}
                      />
                      <Input
                        label="Cuff material"
                        value={form.cuffMaterial}
                        onValueChange={(v) => setField("cuffMaterial", v)}
                      />
                    </div>
                  </div>

                  {/* Zipper */}
                  <div>
                    <p className="text-sm font-semibold text-default-600 mb-3">
                      Zipper
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                      <Input
                        label="Zipper location"
                        value={form.zipperLocation}
                        onValueChange={(v) => setField("zipperLocation", v)}
                      />
                      <Input
                        label="Zipper color"
                        value={form.zipperColor}
                        onValueChange={(v) => setField("zipperColor", v)}
                      />
                      <Input
                        label="Zipper size (cm)"
                        type="number"
                        value={form.zipperSizeCm}
                        onValueChange={(v) => setField("zipperSizeCm", v)}
                      />
                      <Input
                        label="Invisible zipper color"
                        value={form.invisibleZipperColor}
                        onValueChange={(v) =>
                          setField("invisibleZipperColor", v)
                        }
                      />
                      <Input
                        label="Pocket zipper color"
                        value={form.pocketZipperColor}
                        onValueChange={(v) => setField("pocketZipperColor", v)}
                      />
                    </div>
                  </div>

                  {/* Lining & Hood */}
                  <div>
                    <p className="text-sm font-semibold text-default-600 mb-3">
                      Lining & Hood
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input
                        label="Lining type"
                        value={form.liningType}
                        onValueChange={(v) => setField("liningType", v)}
                      />
                      <Input
                        label="Lining color"
                        value={form.liningColor}
                        onValueChange={(v) => setField("liningColor", v)}
                      />
                      <Input
                        label="Hood type"
                        value={form.hoodType}
                        onValueChange={(v) => setField("hoodType", v)}
                      />
                      <Input
                        label="Lateral mesh color"
                        value={form.lateralMeshColor}
                        onValueChange={(v) => setField("lateralMeshColor", v)}
                      />
                    </div>
                  </div>

                  {/* Buttons */}
                  <div>
                    <p className="text-sm font-semibold text-default-600 mb-3">
                      Buttons
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Input
                        label="Button type"
                        value={form.buttonType}
                        onValueChange={(v) => setField("buttonType", v)}
                      />
                      <Input
                        label="Buttonhole type"
                        value={form.buttonholeType}
                        onValueChange={(v) => setField("buttonholeType", v)}
                      />
                      <Input
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
                        placeholder="Additional notes..."
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
                                      isIconOnly
                                      size="sm"
                                      variant="light"
                                      onPress={() => openEditInsumo(insumo)}
                                    >
                                      <FiEdit2 />
                                    </Button>
                                    <Button
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
              Cancel
            </Button>
            <Button color="primary" isDisabled={saving} onPress={handleSave}>
              {saving
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
              label="Notes"
              placeholder="Additional notes..."
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
