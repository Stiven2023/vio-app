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
  const img = items.find((it) => it.kind === "file" && it.type.startsWith("image/"));

  return (img?.getAsFile() as File | null) ?? null;
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

  const resolvedImageOne = imageOnePreview ?? (value.clothingImageOneUrl ? String(value.clothingImageOneUrl) : "");
  const resolvedImageTwo = imageTwoPreview ?? (value.clothingImageTwoUrl ? String(value.clothingImageTwoUrl) : "");
  const resolvedLogo = logoPreview ?? (value.logoImageUrl ? String(value.logoImageUrl) : "");

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
        selectedKeys={value.garmentType ? [String(value.garmentType)] : ["JUGADOR"]}
        onSelectionChange={(keys: any) => {
          const k = Array.from(keys as any)[0];
          onChange({ ...value, garmentType: k ? String(k) as any : "JUGADOR" });
        }}
      >
        <SelectItem key="JUGADOR">Jugador</SelectItem>
        <SelectItem key="ARQUERO">Arquero</SelectItem>
        <SelectItem key="CAPITAN">Capitán</SelectItem>
        <SelectItem key="JUEZ">Juez</SelectItem>
        <SelectItem key="ENTRENADOR">Entrenador</SelectItem>
        <SelectItem key="LIBERO">Líbero</SelectItem>
      </Select>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Input
          label="Cantidad"
          type="number"
          value={String(value.quantity ?? 1)}
          onValueChange={(v: string) =>
            onChange({
              ...value,
              quantity: Math.max(1, Math.floor(Number(v || 1))),
            })
          }
        />

        <Input
          description={
            canEditUnitPrice
              ? "Editable para cliente AUTORIZADO"
              : "Bloqueado: solo cliente AUTORIZADO puede modificar precio"
          }
          isDisabled={locked || !canEditUnitPrice}
          label="Precio unitario"
          type="number"
          value={String(value.unitPrice ?? "0")}
          onValueChange={(v: string) => onChange({ ...value, unitPrice: v })}
        />

        <Input isReadOnly label="Total" value={computedTotal} />
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
        onValueChange={(v: string) => onChange({ ...value, additionEvidence: v })}
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
          <div className="text-xs text-default-500 mt-1">
            Selección única.
          </div>
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
          onValueChange={(v: boolean) => onChange({ ...value, requiresSocks: v })}
        >
          Requiere medias
        </Switch>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div
          className={
            "rounded-medium border border-dashed border-default-300 p-3 " +
            (dropDisabled ? "opacity-60" : "")
          }
          onDragOver={(e) => {
            if (dropDisabled) return;
            e.preventDefault();
          }}
          onDrop={(e) => {
            if (dropDisabled) return;
            e.preventDefault();
            const f = e.dataTransfer.files?.[0] ?? null;
            if (f) onSelectImageOneFile(f);
          }}
          onPaste={(e) => {
            if (dropDisabled) return;
            const f = getPastedImageFile(e);
            if (f) {
              e.preventDefault();
              onSelectImageOneFile(f);
            }
          }}
          tabIndex={dropDisabled ? -1 : 0}
        >
          <div className="text-sm text-default-600 mb-2">Imagen prenda 1</div>
          <div className="text-xs text-default-500">
            Arrastra y suelta aquí, o pega desde el portapapeles (Ctrl+V).
          </div>
          <div className="mt-2">
            <input
              accept="image/*"
              disabled={dropDisabled}
              type="file"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onSelectImageOneFile(e.target.files?.[0] ?? null)
              }
            />
          </div>
        </div>

        <div className={"rounded-medium border border-dashed border-default-300 p-3 " + (dropDisabled ? "opacity-60" : "")}>
          <div className="text-sm text-default-600 mb-2">Imagen prenda 2 (opcional)</div>
          <div className="mt-2">
            <input
              accept="image/*"
              disabled={dropDisabled}
              type="file"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onSelectImageTwoFile(e.target.files?.[0] ?? null)
              }
            />
          </div>
        </div>

        <div className={"rounded-medium border border-dashed border-default-300 p-3 " + (dropDisabled ? "opacity-60" : "")}>
          <div className="text-sm text-default-600 mb-2">Logo (obligatorio)</div>
          <div className="mt-2">
            <input
              accept="image/*"
              disabled={dropDisabled}
              type="file"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onSelectLogoFile(e.target.files?.[0] ?? null)
              }
            />
          </div>
        </div>

        <Input
          isReadOnly
          label="URL prenda 1"
          value={String(value.clothingImageOneUrl ?? "")}
        />
        <Input isReadOnly label="URL prenda 2" value={String(value.clothingImageTwoUrl ?? "")} />
        <Input isReadOnly label="URL logo" value={String(value.logoImageUrl ?? "")} />
      </div>

      {resolvedImageOne || resolvedImageTwo || resolvedLogo ? (
        <div className="rounded-medium border border-default-200 bg-content1 p-3">
          <div className="text-sm font-semibold mb-2">Preview</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <div className="text-xs text-default-500 mb-1">Prenda 1</div>
              {resolvedImageOne ? (
                <img alt="Preview prenda 1" className="h-32 w-auto rounded-medium border border-default-200 object-contain" src={resolvedImageOne} />
              ) : (
                <div className="text-xs text-default-400">Sin imagen</div>
              )}
            </div>
            <div>
              <div className="text-xs text-default-500 mb-1">Prenda 2</div>
              {resolvedImageTwo ? (
                <img alt="Preview prenda 2" className="h-32 w-auto rounded-medium border border-default-200 object-contain" src={resolvedImageTwo} />
              ) : (
                <div className="text-xs text-default-400">Sin imagen</div>
              )}
            </div>
            <div>
              <div className="text-xs text-default-500 mb-1">Logo</div>
              {resolvedLogo ? (
                <img alt="Preview logo" className="h-32 w-auto rounded-medium border border-default-200 object-contain" src={resolvedLogo} />
              ) : (
                <div className="text-xs text-danger">Falta logo</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
