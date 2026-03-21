"use client";

import type {
  OrderItemPackagingInput,
  OrderItemSockInput,
} from "@/app/erp/orders/_lib/order-item-types";

import React from "react";
import NextLink from "next/link";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";

import { uploadToCloudinary } from "@/app/erp/orders/_lib/cloudinary";
import {
  parseSocksFromRows,
  readExcelFirstSheetRows,
} from "@/app/erp/orders/_lib/excel";

const SOCKS_CURVE_SIZES = ["4-6", "6-8", "8-10", "9-11", "10-12"];
const ADULT_GARMENT_SIZES = new Set([
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "4XL",
]);

function mapGarmentSizeToSockSize(size: string) {
  const normalized = String(size ?? "")
    .trim()
    .toUpperCase();

  if (!normalized) return null;

  if (ADULT_GARMENT_SIZES.has(normalized)) {
    return "10-12";
  }

  const rangeMatch = normalized.match(/(\d+)\s*-\s*(\d+)/);

  if (rangeMatch) {
    const max = Number(rangeMatch[2]);

    if (!Number.isFinite(max)) return null;
    if (max <= 6) return "4-6";
    if (max <= 10) return "6-8";
    if (max <= 14) return "8-10";

    return "10-12";
  }

  const numeric = Number(normalized.replace(/[^\d]/g, ""));

  if (Number.isFinite(numeric) && numeric > 0) {
    if (numeric <= 6) return "4-6";
    if (numeric <= 10) return "6-8";
    if (numeric <= 14) return "8-10";

    return "10-12";
  }

  return null;
}

function buildAutoSocksFromPackaging(
  packaging: OrderItemPackagingInput[],
  currentSocks: OrderItemSockInput[],
) {
  const qtyBySockSize = new Map<string, number>();

  for (const row of packaging ?? []) {
    const sockSize = mapGarmentSizeToSockSize(String(row.size ?? ""));

    if (!sockSize) continue;

    const quantity = Math.max(0, Math.floor(Number(row.quantity ?? 0)));
    const safeQty = quantity > 0 ? quantity : 0;

    if (safeQty <= 0) continue;

    qtyBySockSize.set(sockSize, (qtyBySockSize.get(sockSize) ?? 0) + safeQty);
  }

  const bySizeExisting = new Map<string, OrderItemSockInput>();

  for (const sock of currentSocks ?? []) {
    const key = String(sock.size ?? "")
      .trim()
      .toUpperCase();

    if (!key) continue;
    if (!bySizeExisting.has(key)) bySizeExisting.set(key, sock);
  }

  return SOCKS_CURVE_SIZES.map((size) => {
    const existing = bySizeExisting.get(size);

    return {
      size,
      quantity: qtyBySockSize.get(size) ?? 0,
      description: existing?.description ?? "",
      imageUrl: existing?.imageUrl ?? null,
    };
  }).filter((row) => Number(row.quantity ?? 0) > 0);
}

function socksEquivalent(a: OrderItemSockInput[], b: OrderItemSockInput[]) {
  const normalize = (rows: OrderItemSockInput[]) =>
    (rows ?? [])
      .map((row) => ({
        size: String(row.size ?? "")
          .trim()
          .toUpperCase(),
        quantity: Math.max(0, Math.floor(Number(row.quantity ?? 0))),
      }))
      .filter((row) => row.size && row.quantity > 0)
      .sort((x, y) => x.size.localeCompare(y.size));

  const aa = normalize(a);
  const bb = normalize(b);

  if (aa.length !== bb.length) return false;

  for (let i = 0; i < aa.length; i += 1) {
    if (aa[i].size !== bb[i].size) return false;
    if (aa[i].quantity !== bb[i].quantity) return false;
  }

  return true;
}

function parseCount(v: unknown) {
  const digits = String(v ?? "").replace(/[^\d]/g, "");

  if (!digits) return 0;

  const n = Number(digits);

  if (!Number.isFinite(n)) return 0;

  return Math.max(0, Math.floor(n));
}

function formatCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";

  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function SocksSection({
  orderId,
  garmentType,
  requiresSocks,
  packaging,
  value,
  disabled,
  onChange,
  onUploadingChange,
  onError,
}: {
  orderId: string;
  garmentType?: string;
  requiresSocks?: boolean;
  packaging: OrderItemPackagingInput[];
  value: OrderItemSockInput[];
  disabled: boolean;
  onChange: (next: OrderItemSockInput[]) => void;
  onUploadingChange: (uploading: boolean) => void;
  onError?: (message: string) => void;
}) {
  const [uploadingIndex, setUploadingIndex] = React.useState<number | null>(
    null,
  );

  const socksMap = React.useMemo(() => {
    const map = new Map<string, number>();

    for (const row of value ?? []) {
      const key = String(row.size ?? "")
        .trim()
        .toUpperCase();

      if (!key) continue;
      const qty = Number(row.quantity ?? 0);
      const safeQty = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;

      if (safeQty <= 0) continue;

      map.set(key, (map.get(key) ?? 0) + safeQty);
    }

    return map;
  }, [value]);

  const getCurveQty = (size: string) =>
    socksMap.get(String(size).toUpperCase()) ?? 0;
  const socksCurveTotal = SOCKS_CURVE_SIZES.reduce(
    (acc, size) => acc + getCurveQty(size),
    0,
  );

  React.useEffect(() => {
    if (!requiresSocks) return;

    const auto = buildAutoSocksFromPackaging(packaging ?? [], value ?? []);

    if (socksEquivalent(auto, value ?? [])) return;

    onChange(auto);
  }, [requiresSocks, packaging, value, onChange]);

  function upsertCurveSize(size: string, raw: string) {
    const qty = parseCount(raw);
    const normalized = String(size).trim().toUpperCase();
    const existing = [...(value ?? [])];
    const index = existing.findIndex(
      (row) =>
        String(row.size ?? "")
          .trim()
          .toUpperCase() === normalized,
    );

    if (qty <= 0) {
      if (index >= 0) {
        onChange(existing.filter((_, i) => i !== index));
      }

      return;
    }

    if (index >= 0) {
      onChange(
        existing.map((row, i) =>
          i === index ? { ...row, size: normalized, quantity: qty } : row,
        ),
      );

      return;
    }

    onChange([
      ...existing,
      { size: normalized, quantity: qty, description: "", imageUrl: null },
    ]);
  }

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

      onChange(value.map((x, i) => (i === idx ? { ...x, imageUrl: url } : x)));
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
        <div className="text-sm font-semibold">
          Medias · {String(garmentType ?? "JUGADOR")}
        </div>
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

      <div className="space-y-2">
        <div className="text-xs text-default-500">
          Curva medias (admite centenas y miles, ej: 2.500).
        </div>
        <div className="text-xs text-primary">
          Auto-calculado desde empaque según tallas (editable si necesitas
          ajuste manual).
        </div>
        <div className="rounded-medium border border-default-200 overflow-x-auto">
          <div className="grid min-w-[700px] grid-cols-[120px_repeat(5,minmax(90px,1fr))_90px] gap-1 border-b border-default-200 bg-content2 px-2 py-2 text-xs font-semibold uppercase text-default-600">
            <div>Tallas medias</div>
            {SOCKS_CURVE_SIZES.map((size) => (
              <div key={`head-socks-${size}`} className="text-center">
                {size}
              </div>
            ))}
            <div className="text-center rounded-small bg-primary text-primary-foreground">
              Total
            </div>
          </div>
          <div className="grid min-w-[700px] grid-cols-[120px_repeat(5,minmax(90px,1fr))_90px] gap-1 px-2 py-2 items-center">
            <div className="text-sm font-semibold">Jugador</div>
            {SOCKS_CURVE_SIZES.map((size) => (
              <Input
                key={`socks-${size}`}
                isDisabled={disabled}
                placeholder="0"
                value={formatCount(getCurveQty(size))}
                onValueChange={(v: string) => upsertCurveSize(size, v)}
              />
            ))}
            <div className="text-center font-semibold rounded-small bg-primary text-primary-foreground py-2 px-1">
              {formatCount(socksCurveTotal) || "0"}
            </div>
          </div>
        </div>
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
                onChange(
                  value.map((x, i) => (i === idx ? { ...x, size: v } : x)),
                )
              }
            />
            <Input
              isDisabled={disabled}
              label="Cantidad"
              placeholder="0"
              value={formatCount(Number(s.quantity ?? 0))}
              onValueChange={(v: string) =>
                onChange(
                  value.map((x, i) =>
                    i === idx
                      ? { ...x, quantity: Math.max(1, parseCount(v)) }
                      : x,
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
