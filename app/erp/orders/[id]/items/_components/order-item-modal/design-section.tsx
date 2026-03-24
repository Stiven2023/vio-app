"use client";

import type { OrderItemInput } from "@/app/erp/orders/_lib/order-item-types";

import React from "react";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";

const NECK_OPTIONS: Array<{ id: string; label: string; src: string }> = [
  {
    id: "NATIONAL",
    label: "National",
    src: "/assets/cuellos/NATIONAL_ssfzxh.svg",
  },
  {
    id: "OLYMPUS_BARUDA_KNOB",
    label: "Olympus Baruda (Knob)",
    src: "/assets/cuellos/OLYPUSBARUDAKNOB_mzb7vd.svg",
  },
  {
    id: "OLYMPUS_BARUDA",
    label: "Olympus Baruda",
    src: "/assets/cuellos/OLYPUSBARUDA_seqne0.svg",
  },
  {
    id: "POLO",
    label: "Polo",
    src: "/assets/cuellos/POLO_zarbng.svg",
  },
  {
    id: "ROUND",
    label: "Round",
    src: "/assets/cuellos/ROUND_mfljm4.svg",
  },
  {
    id: "VEE",
    label: "Vee",
    src: "/assets/cuellos/VEE_xmweiu.svg",
  },
];

function getPastedImageFile(ev: React.ClipboardEvent) {
  const items = Array.from(ev.clipboardData?.items ?? []);
  const img = items.find(
    (it) => it.kind === "file" && it.type.startsWith("image/"),
  );

  return (img?.getAsFile() as File | null) ?? null;
}

function ImageDropZone({
  title,
  subtitle,
  required = false,
  previewSrc,
  disabled,
  minHeightClass = "min-h-[260px]",
  imageFitClass = "object-cover",
  compact = false,
  onSelectFile,
}: {
  title: string;
  subtitle?: string;
  required?: boolean;
  previewSrc: string;
  disabled: boolean;
  minHeightClass?: string;
  imageFitClass?: string;
  compact?: boolean;
  onSelectFile: (file: File | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const accentStyle = React.useMemo<React.CSSProperties>(() => {
    if (disabled) return {};
    if (dragging) {
      return {
        borderColor: "var(--viomar-primary)",
        backgroundColor:
          "color-mix(in srgb, var(--viomar-primary) 10%, transparent)",
      };
    }

    return {
      borderColor:
        "color-mix(in srgb, var(--viomar-primary) 45%, var(--viomar-fg) 55%)",
    };
  }, [disabled, dragging]);

  const processFile = React.useCallback(
    (file: File | null) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) return;
      onSelectFile(file);
    },
    [onSelectFile],
  );

  return (
    <div
      className={
        "group relative border border-dashed p-3 transition-colors " +
        (disabled ? "border-default-200 opacity-60" : "border-default-300")
      }
      role="button"
      style={accentStyle}
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (disabled) return;
        inputRef.current?.click();
      }}
      onDragLeave={() => setDragging(false)}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragging(false);
        processFile(e.dataTransfer.files?.[0] ?? null);
      }}
      onPaste={(e) => {
        if (disabled) return;
        const file = getPastedImageFile(e);

        if (file) {
          e.preventDefault();
          processFile(file);
        }
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm text-default-200">
          {title}
          {required ? <span className="ml-1 text-danger">*</span> : null}
        </div>
        {previewSrc ? (
          <button
            className="text-xs text-danger hover:underline"
            disabled={disabled}
            type="button"
            onClick={() => onSelectFile(null)}
          >
            Quitar
          </button>
        ) : null}
      </div>

      <div className="text-xs text-default-500">
        Click, arrastra o pega imagen (Ctrl+V)
      </div>

      {subtitle ? (
        <div className="text-[11px] text-default-500 mt-1">{subtitle}</div>
      ) : null}

      <div className="mt-2">
        <input
          ref={inputRef}
          accept="image/*"
          className="hidden"
          disabled={disabled}
          type="file"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            processFile(e.target.files?.[0] ?? null);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        <button
          className="rounded-full border border-default-300 px-3 py-1 text-xs hover:bg-default-100"
          disabled={disabled}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Seleccionar imagen
        </button>
      </div>

      {previewSrc ? (
        <div
          className={
            "mt-3 rounded-medium border border-default-200 bg-content2 p-2 " +
            (compact ? "h-[96px]" : "h-[120px]")
          }
        >
          <img
            alt={title}
            className={`h-full w-full rounded-medium ${compact ? imageFitClass : "object-contain"}`}
            src={previewSrc}
          />
        </div>
      ) : (
        <div
          className={
            `mt-3 rounded-medium border border-default-200/60 bg-default-100/20 ${minHeightClass} flex items-center justify-center` +
            (compact ? " min-h-[90px]" : "")
          }
        >
          <div className="text-center text-default-500 text-xs">
            <div className="uppercase tracking-[0.15em]">{title}</div>
            {subtitle ? (
              <div className="mt-1 text-[10px]">{subtitle}</div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export function DesignSection({
  value,
  imageOneFile,
  imageTwoFile,
  logoFile,
  computedTotal,
  orderKind,
  isCreateBlocked,
  canEditUnitPrice,
  onChange,
  onSelectImageOneFile,
  onSelectImageTwoFile,
  onSelectLogoFile,
}: {
  value: OrderItemInput;
  imageOneFile: File | null;
  imageTwoFile: File | null;
  logoFile: File | null;
  computedTotal: string;
  orderKind: "NUEVO" | "COMPLETACION" | "REFERENTE";
  isCreateBlocked: boolean;
  canEditUnitPrice: boolean;
  onChange: (next: OrderItemInput) => void;
  onSelectImageOneFile: (file: File | null) => void;
  onSelectImageTwoFile: (file: File | null) => void;
  onSelectLogoFile: (file: File | null) => void;
}) {
  const locked = orderKind === "COMPLETACION";
  const dropDisabled = locked || isCreateBlocked;

  const imageOnePreview = React.useMemo(() => {
    if (!imageOneFile) return null;

    return URL.createObjectURL(imageOneFile);
  }, [imageOneFile]);

  const imageTwoPreview = React.useMemo(() => {
    if (!imageTwoFile) return null;

    return URL.createObjectURL(imageTwoFile);
  }, [imageTwoFile]);

  const logoPreview = React.useMemo(() => {
    if (!logoFile) return null;

    return URL.createObjectURL(logoFile);
  }, [logoFile]);

  React.useEffect(() => {
    return () => {
      if (imageOnePreview) URL.revokeObjectURL(imageOnePreview);
      if (imageTwoPreview) URL.revokeObjectURL(imageTwoPreview);
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [imageOnePreview, imageTwoPreview, logoPreview]);

  const resolvedImageOne =
    imageOnePreview ??
    (value.clothingImageOneUrl ? String(value.clothingImageOneUrl) : "");
  const resolvedImageTwo =
    imageTwoPreview ??
    (value.clothingImageTwoUrl ? String(value.clothingImageTwoUrl) : "");
  const resolvedLogo =
    logoPreview ?? (value.logoImageUrl ? String(value.logoImageUrl) : "");

  function setNeck(id: string) {
    onChange({ ...value, neckType: value.neckType === id ? null : id });
  }

  return (
    <div className="space-y-3">
      <Input
        isRequired
        isDisabled={isCreateBlocked}
        label="Nombre del diseño"
        value={String(value.name ?? "")}
        onValueChange={(v: string) => onChange({ ...value, name: v })}
      />

      <Select
        isDisabled={locked}
        label="Tipo de prenda / posición"
        selectedKeys={
          value.garmentType ? [String(value.garmentType)] : ["JUGADOR"]
        }
        onSelectionChange={(keys: any) => {
          const k = Array.from(keys as any)[0];

          onChange({
            ...value,
            garmentType: k ? (String(k) as any) : "JUGADOR",
          });
        }}
      >
        <SelectItem key="JUGADOR">Jugador</SelectItem>
        <SelectItem key="ARQUERO">Arquero</SelectItem>
        <SelectItem key="CAPITAN">Capitán</SelectItem>
        <SelectItem key="JUEZ">Juez</SelectItem>
        <SelectItem key="ENTRENADOR">Entrenador</SelectItem>
        <SelectItem key="LIBERO">Líbero</SelectItem>
        <SelectItem key="OBJETO">Objeto</SelectItem>
      </Select>

      <div className="grid grid-cols-1 gap-3">
        <Input
          isDisabled
          label="Cantidad"
          type="number"
          value={String(value.quantity ?? 1)}
          description="La cantidad se ajusta fuera de esta seccion"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Switch
          isDisabled={locked}
          isSelected={Boolean(value.hasAdditions)}
          onValueChange={(v: boolean) =>
            onChange({
              ...value,
              hasAdditions: v,
              additionEvidence: v ? String(value.additionEvidence ?? "") : "",
            })
          }
        >
          Tiene adiciones
        </Switch>
      </div>

      <Textarea
        isDisabled={locked || !Boolean(value.hasAdditions)}
        label="Evidencia de adición"
        minRows={2}
        placeholder="Describe la adición aplicada a este diseño"
        value={String(value.additionEvidence ?? "")}
        onValueChange={(v: string) =>
          onChange({ ...value, additionEvidence: v })
        }
      />

      <Textarea
        isDisabled={locked}
        label="Observaciones"
        minRows={2}
        value={String(value.observations ?? "")}
        onValueChange={(v: string) => onChange({ ...value, observations: v })}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input
          isDisabled={locked}
          label="Tela"
          value={String(value.fabric ?? "")}
          onValueChange={(v: string) => onChange({ ...value, fabric: v })}
        />

        <Input
          isDisabled={locked}
          label="Color"
          value={String(value.color ?? "")}
          onValueChange={(v: string) => onChange({ ...value, color: v })}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Select
          isDisabled={locked}
          label="Género"
          selectedKeys={value.gender ? [String(value.gender)] : []}
          onSelectionChange={(keys: any) => {
            const k = Array.from(keys as any)[0];

            onChange({ ...value, gender: k ? String(k) : null });
          }}
        >
          <SelectItem key="HOMBRE">Hombre</SelectItem>
          <SelectItem key="MUJER">Mujer</SelectItem>
          <SelectItem key="UNISEX">Unisex</SelectItem>
        </Select>

        <Select
          isDisabled={locked}
          label="Proceso creación"
          selectedKeys={value.process ? [String(value.process)] : []}
          onSelectionChange={(keys: any) => {
            const k = Array.from(keys as any)[0];

            onChange({ ...value, process: k ? String(k) : null });
          }}
        >
          <SelectItem key="PRODUCCION">Producción</SelectItem>
          <SelectItem key="BODEGA">Bodega</SelectItem>
          <SelectItem key="COMPRAS">Compras</SelectItem>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className={locked ? "opacity-60" : ""}>
          <div className="text-sm text-default-600 mb-2">Tipo de cuello</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {NECK_OPTIONS.map((opt) => {
              const selected = String(value.neckType ?? "") === opt.id;

              return (
                <button
                  key={opt.id}
                  className={
                    "flex flex-col items-center gap-2 rounded-medium border p-2 text-left " +
                    (selected
                      ? "border-primary bg-default-50"
                      : "border-default-200 bg-content1") +
                    (locked ? " cursor-not-allowed" : " hover:bg-default-50")
                  }
                  disabled={locked}
                  type="button"
                  onClick={() => setNeck(opt.id)}
                >
                  <img alt={opt.label} className="h-14 w-auto" src={opt.src} />
                  <div className="text-xs text-default-600">{opt.label}</div>
                </button>
              );
            })}
          </div>
          <div className="text-xs text-default-500 mt-1">Selección única.</div>
        </div>

        <Select
          isDisabled={locked}
          label="Manga"
          selectedKeys={value.sleeve ? [String(value.sleeve)] : []}
          onSelectionChange={(keys: any) => {
            const k = Array.from(keys as any)[0];

            onChange({ ...value, sleeve: k ? String(k) : null });
          }}
        >
          <SelectItem key="CORTA">Corta</SelectItem>
          <SelectItem key="LARGA">Larga</SelectItem>
          <SelectItem key="SISA">Sisa</SelectItem>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Switch
          isDisabled={locked}
          isSelected={Boolean(value.screenPrint)}
          onValueChange={(v: boolean) => onChange({ ...value, screenPrint: v })}
        >
          Estampado
        </Switch>
        <Switch
          isDisabled={locked}
          isSelected={Boolean(value.embroidery)}
          onValueChange={(v: boolean) => onChange({ ...value, embroidery: v })}
        >
          Bordado
        </Switch>
        <Switch
          isDisabled={locked}
          isSelected={Boolean(value.requiresSocks)}
          onValueChange={(v: boolean) =>
            onChange({ ...value, requiresSocks: v })
          }
        >
          Requiere medias
        </Switch>
      </div>

      <div className="rounded-medium border border-default-200 bg-content1 p-2 md:p-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch border border-default-200">
          <div className="border-r border-default-200">
            <div
              className="border-b border-default-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--viomar-primary)" }}
            >
              Diseño: Prenda 1
            </div>
            <ImageDropZone
              disabled={dropDisabled}
              minHeightClass="min-h-[280px]"
              previewSrc={resolvedImageOne}
              subtitle="Tipo de prenda 1"
              title="Prenda 1"
              onSelectFile={onSelectImageOneFile}
            />
          </div>

          <div className="relative w-[1px] bg-default-200">
            <div className="absolute -bottom-1 left-1/2 z-10 w-[170px] -translate-x-1/2">
              <div
                className="border border-default-200 border-b-0 bg-content1 px-3 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: "var(--viomar-primary)" }}
              >
                Logo
              </div>
              <div className="border border-default-200 bg-content1 p-0">
                <ImageDropZone
                  compact
                  disabled={dropDisabled}
                  imageFitClass="object-contain"
                  minHeightClass="min-h-[96px]"
                  previewSrc={resolvedLogo}
                  subtitle="Opcional"
                  title="Logo"
                  onSelectFile={onSelectLogoFile}
                />
              </div>
            </div>
          </div>

          <div className="border-l border-default-200">
            <div
              className="border-b border-default-200 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--viomar-primary)" }}
            >
              Diseño: Prenda 2
            </div>
            <ImageDropZone
              disabled={dropDisabled}
              minHeightClass="min-h-[280px]"
              previewSrc={resolvedImageTwo}
              subtitle="Tipo de prenda 2"
              title="Prenda 2"
              onSelectFile={onSelectImageTwoFile}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
