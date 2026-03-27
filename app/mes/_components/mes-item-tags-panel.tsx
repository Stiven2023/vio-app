"use client";

/**
 * MesItemTagsPanel — Panel para asignar/quitar tags a un diseño
 * Se usa dentro del detalle del ticket en mes-page-client.tsx
 */
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Textarea } from "@heroui/input";
import { Button } from "@heroui/button";

export const MES_TAG_LABELS: Record<string, string> = {
  REQUIERE_PICADA: "Picada",
  URGENTE: "Urgente",
  CONTROL_CALIDAD_EXTRA: "Control calidad extra",
  MATERIAL_ESPECIAL: "Material especial",
  SEGUNDA_REVISION: "Segunda revisión",
  DESPACHO_PARCIAL: "Despacho parcial",
};

const ALL_TAGS = Object.keys(MES_TAG_LABELS);

type ItemTag = {
  id: string;
  tag: string;
  notes: string | null;
};

export type MesItemTagsPanelProps = {
  orderId: string;
  orderItemId: string;
  /** Design name for display */
  designName: string;
  readOnly?: boolean;
};

function getErrorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e ?? "Error");
}

export function MesItemTagsPanel({
  orderId,
  orderItemId,
  designName,
  readOnly = false,
}: MesItemTagsPanelProps) {
  const [tags, setTags] = useState<ItemTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingTag, setPendingTag] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orderItemId) return;
    let active = true;
    setLoading(true);
    fetch(`/api/mes/item-tags?orderItemId=${orderItemId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setTags(data.items ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderItemId]);

  const hasTag = (tag: string) => tags.some((t) => t.tag === tag);

  const handleToggle = async (tag: string) => {
    if (readOnly) return;

    if (hasTag(tag)) {
      // Remove
      const existing = tags.find((t) => t.tag === tag);
      if (!existing) return;
      try {
        setSaving(true);
        await fetch(`/api/mes/item-tags?id=${existing.id}`, {
          method: "DELETE",
        });
        setTags((prev) => prev.filter((t) => t.id !== existing.id));
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setSaving(false);
      }
    } else {
      // Open notes input for this tag
      setPendingTag(tag);
      setNotes("");
    }
  };

  const confirmAddTag = async () => {
    if (!pendingTag || saving) return;
    try {
      setSaving(true);
      const res = await fetch("/api/mes/item-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          orderItemId,
          tag: pendingTag,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTags((prev) => [
        ...prev,
        { id: data.id, tag: pendingTag, notes: notes.trim() || null },
      ]);
      setPendingTag(null);
      setNotes("");
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner size="sm" />;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-default-500">
        Tags — {designName}
      </p>
      <div className="flex flex-wrap gap-2">
        {ALL_TAGS.map((tag) => {
          const active = hasTag(tag);
          return (
            <Chip
              key={tag}
              className={readOnly ? undefined : "cursor-pointer"}
              color={active ? "warning" : "default"}
              variant={active ? "solid" : "bordered"}
              onClick={() => handleToggle(tag)}
            >
              {MES_TAG_LABELS[tag]}
            </Chip>
          );
        })}
      </div>

      {pendingTag && (
        <div className="flex items-end gap-2">
          <Textarea
            className="flex-1"
            label={`Nota para "${MES_TAG_LABELS[pendingTag]}"`}
            minRows={1}
            placeholder="Opcional — ej. 'Solo 20 de 40 diseños'"
            value={notes}
            onValueChange={setNotes}
          />
          <div className="flex gap-1 pb-1">
            <Button
              isLoading={saving}
              size="sm"
              color="warning"
              onPress={confirmAddTag}
            >
              Agregar
            </Button>
            <Button
              size="sm"
              variant="light"
              onPress={() => {
                setPendingTag(null);
                setNotes("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
