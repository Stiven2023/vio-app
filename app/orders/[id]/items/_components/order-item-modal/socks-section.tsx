"use client";

import type { OrderItemSockInput } from "@/app/orders/_lib/order-item-types";

import React from "react";
import NextLink from "next/link";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";

import { uploadToCloudinary } from "@/app/orders/_lib/cloudinary";
import { parseSocksFromRows, readExcelFirstSheetRows } from "@/app/orders/_lib/excel";

function asPositiveInt(v: unknown) {
  const n = Number(String(v ?? ""));

  if (!Number.isFinite(n)) return 0;

  return Math.max(1, Math.floor(n));
}

export function SocksSection({
  orderId,
  value,
  disabled,
  onChange,
  onUploadingChange,
  onError,
}: {
  orderId: string;
  value: OrderItemSockInput[];
  disabled: boolean;
  onChange: (next: OrderItemSockInput[]) => void;
  onUploadingChange: (uploading: boolean) => void;
  onError?: (message: string) => void;
}) {
  const [uploadingIndex, setUploadingIndex] = React.useState<number | null>(null);

  async function importExcel(file: File) {
    try {
      const rows = await readExcelFirstSheetRows(file);
      const parsed = parseSocksFromRows(rows);

    const next: OrderItemSockInput[] = parsed.map((s) => ({
      size: s.size,
      quantity: s.quantity,
      description: s.description,
      imageUrl: s.imageUrl,
    }));

      onChange([...(value ?? []), ...next]);
    } catch (e: any) {
      onError?.(e?.message ?? "No se pudo importar el Excel de medias");
    }
  }

  async function uploadRowImage(idx: number, file: File) {
    setUploadingIndex(idx);
    onUploadingChange(true);
    try {
      const url = await uploadToCloudinary({
        file,
        folder: `order-items/${orderId}/socks`,
      });

      onChange(
        value.map((x, i) => (i === idx ? { ...x, imageUrl: url } : x)),
      );
    } catch (e: any) {
      onError?.(e?.message ?? "No se pudo subir la imagen de la media");
    } finally {
      setUploadingIndex(null);
      onUploadingChange(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Medias</div>
        <Button
          isDisabled={disabled}
          size="sm"
          variant="flat"
          onPress={() =>
            onChange([
              ...value,
              { size: "", quantity: 1, description: "", imageUrl: null },
            ])
          }
        >
          Agregar
        </Button>
      </div>

      <div>
        <div className="text-sm text-default-600 mb-1">Importar Excel</div>
        <input
          accept=".xlsx,.xls"
          disabled={disabled}
          type="file"
          onChange={(e) => {
            const f = e.target.files?.[0];

            if (!f) return;

            importExcel(f);
          }}
        />
        <div className="text-xs text-default-500 mt-1">
          Columnas esperadas: talla, cantidad (obligatoria). Opcional:
          descripción, imagen/url.
        </div>
      </div>

      {value.length === 0 ? (
        <div className="text-sm text-default-500">Sin medias.</div>
      ) : null}

      <div className="flex flex-col gap-3">
        {value.map((s, idx) => (
          <div key={idx} className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <Input
              isDisabled={disabled}
              label="Talla"
              value={String(s.size ?? "")}
              onValueChange={(v: string) =>
                onChange(value.map((x, i) => (i === idx ? { ...x, size: v } : x)))
              }
            />
            <Input
              isDisabled={disabled}
              label="Cantidad"
              type="number"
              value={String(s.quantity ?? 1)}
              onValueChange={(v: string) =>
                onChange(
                  value.map((x, i) =>
                    i === idx ? { ...x, quantity: asPositiveInt(v) } : x,
                  ),
                )
              }
            />
            <Input
              isDisabled={disabled}
              label="Descripción"
              value={String(s.description ?? "")}
              onValueChange={(v: string) =>
                onChange(
                  value.map((x, i) =>
                    i === idx ? { ...x, description: v } : x,
                  ),
                )
              }
            />

            <div>
              <div className="text-sm text-default-600 mb-1">Imagen</div>
              <input
                accept="image/*"
                disabled={disabled || uploadingIndex === idx}
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0];

                  if (!f) return;

                  uploadRowImage(idx, f);
                }}
              />
              <div className="text-xs text-default-500 mt-1">
                {uploadingIndex === idx ? "Subiendo..." : ""}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {s.imageUrl ? (
                <Button
                  as={NextLink}
                  href={s.imageUrl}
                  isDisabled={disabled}
                  size="sm"
                  target="_blank"
                  variant="flat"
                >
                  Ver
                </Button>
              ) : null}
              <Button
                color="danger"
                isDisabled={disabled}
                size="sm"
                variant="flat"
                onPress={() => onChange(value.filter((_, i) => i !== idx))}
              >
                Quitar
              </Button>
            </div>

            <div className="flex items-center">
              {s.imageUrl ? (
                <img
                  alt="Preview media"
                  className="h-12 w-12 rounded-small border border-default-200 object-cover"
                  src={s.imageUrl}
                />
              ) : (
                <div className="text-xs text-default-400">Sin imagen</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
