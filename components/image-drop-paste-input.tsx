"use client";

import { useEffect, useMemo } from "react";

type ImageDropPasteInputProps = {
  label: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  existingImageUrl?: string | null;
  disabled?: boolean;
  accept?: string;
  helperText?: string;
};

function getPastedImageFile(e: React.ClipboardEvent<HTMLElement>) {
  const items = e.clipboardData?.items;
  if (!items) return null;

  for (const item of Array.from(items)) {
    if (String(item.type ?? "").startsWith("image/")) {
      return item.getAsFile();
    }
  }

  return null;
}

export function ImageDropPasteInput({
  label,
  file,
  onFileChange,
  existingImageUrl,
  disabled = false,
  accept = "image/*",
  helperText = "Drag an image here, select it or paste it with Ctrl+V.",
}: ImageDropPasteInputProps) {
  const localPreviewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const resolvedPreview = localPreviewUrl || existingImageUrl || null;

  return (
    <div>
      <div className="text-sm text-default-600 mb-1">{label}</div>
      <div
        className={
          "rounded-medium border border-dashed border-default-300 bg-default-50 p-3 " +
          (disabled ? "opacity-60" : "")
        }
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
        }}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          const dropped = e.dataTransfer.files?.[0] ?? null;
          onFileChange(dropped);
        }}
        onPaste={(e) => {
          if (disabled) return;
          const pasted = getPastedImageFile(e);
          if (!pasted) return;
          e.preventDefault();
          onFileChange(pasted);
        }}
        tabIndex={disabled ? -1 : 0}
      >
        <p className="text-xs text-default-500 mb-2">{helperText}</p>
        <input
          accept={accept}
          disabled={disabled}
          type="file"
          onChange={(e) => {
            const selected = e.target.files?.[0] ?? null;
            onFileChange(selected);
          }}
        />
      </div>

      {resolvedPreview ? (
        <div className="mt-2 overflow-hidden rounded-medium border border-default-200">
          <img
            alt="Vista previa de la imagen"
            className="h-40 w-full object-contain bg-default-50"
            src={resolvedPreview}
          />
        </div>
      ) : null}
    </div>
  );
}
