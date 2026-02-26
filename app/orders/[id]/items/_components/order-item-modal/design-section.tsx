"use client";

import type { OrderItemInput } from "@/app/orders/_lib/order-item-types";

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
  imageFile,
  computedTotal,
  orderKind,
  isCreateBlocked,
  canEditUnitPrice,
  onChange,
  onSelectImageFile,
}: {
  value: OrderItemInput;
  imageFile: File | null;
  computedTotal: string;
  orderKind: "NUEVO" | "COMPLETACION" | "REFERENTE";
  isCreateBlocked: boolean;
  canEditUnitPrice: boolean;
  onChange: (next: OrderItemInput) => void;
  onSelectImageFile: (file: File | null) => void;
}) {
  const locked = orderKind === "COMPLETACION";
  const dropDisabled = locked || isCreateBlocked;

  const previewUrl = React.useMemo(() => {
    if (!imageFile) return null;
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const resolvedImage = previewUrl ?? (value.imageUrl ? String(value.imageUrl) : "");

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
          label="Proceso"
          selectedKeys={value.process ? [String(value.process)] : []}
          onSelectionChange={(keys: any) => {
            const k = Array.from(keys as any)[0];

            onChange({ ...value, process: k ? String(k) : null });
          }}
        >
          <SelectItem key="CONFECCION">Confección</SelectItem>
          <SelectItem key="BORDADO">Bordado</SelectItem>
          <SelectItem key="ESTAMPADO">Estampado</SelectItem>
          <SelectItem key="SUBLIMADO">Sublimado</SelectItem>
          <SelectItem key="CORTE_MANUAL">Corte manual</SelectItem>
          <SelectItem key="OTRO">Otro</SelectItem>
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
            if (f) onSelectImageFile(f);
          }}
          onPaste={(e) => {
            if (dropDisabled) return;
            const f = getPastedImageFile(e);
            if (f) {
              e.preventDefault();
              onSelectImageFile(f);
            }
          }}
          tabIndex={dropDisabled ? -1 : 0}
        >
          <div className="text-sm text-default-600 mb-2">Imagen (opcional)</div>
          <div className="text-xs text-default-500">
            Arrastra y suelta aquí, o pega desde el portapapeles (Ctrl+V).
          </div>
          <div className="mt-2">
            <input
              accept="image/*"
              disabled={dropDisabled}
              type="file"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onSelectImageFile(e.target.files?.[0] ?? null)
              }
            />
          </div>
        </div>
        <Input
          isReadOnly
          label="URL actual"
          value={String(value.imageUrl ?? "")}
        />
      </div>

      {resolvedImage ? (
        <div className="rounded-medium border border-default-200 bg-content1 p-3">
          <div className="text-sm font-semibold mb-2">Preview</div>
          <div className="flex flex-col gap-2 md:flex-row md:items-start">
            <img
              alt="Preview del diseño"
              className="h-40 w-auto rounded-medium border border-default-200 object-contain"
              src={resolvedImage}
            />
            <div className="text-xs text-default-500">
              {imageFile ? imageFile.name : "Imagen actual"}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
