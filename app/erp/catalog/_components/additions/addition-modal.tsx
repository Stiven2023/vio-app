"use client";

import type { Addition, Category } from "../../_lib/types";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { BsBoxSeam, BsCashCoin, BsTag } from "react-icons/bs";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { getTRMColombia, applyTRMConversion } from "@/src/utils/trm";

function formatCurrency(value: string | null | undefined, currency: "COP" | "USD") {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || value === null || value === undefined || value === "") {
    return "";
  }

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

type FormState = {
  name: string;
  description: string;
  categoryId: string;
  priceCopBase: string;
  priceCopInternational: string;
  priceUSD: string;
  isActive: boolean;
};

export function AdditionModal({
  addition,
  categories,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  addition: Addition | null;
  categories: Category[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    categoryId: "",
    priceCopBase: "",
    priceCopInternational: "",
    priceUSD: "",
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const conversionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const canPickCategory = useMemo(() => categories.length > 0, [categories]);

  const applyInternationalMarkup = (value: number) =>
    Number((value * 1.19).toFixed(2));

  const scheduleInternationalFromR1 = useCallback(
    (value: string) => {
      if (conversionTimerRef.current) {
        clearTimeout(conversionTimerRef.current);
      }

      conversionTimerRef.current = setTimeout(async () => {
        const trimmed = value.trim();

        if (!trimmed) {
          setForm((s) => ({
            ...s,
            priceCopInternational: "",
            priceUSD: "",
          }));
          return;
        }

        const numeric = Number(trimmed);

        if (Number.isNaN(numeric)) return;

        try {
          const adjustedCop = applyInternationalMarkup(numeric);
          const converted = await applyTRMConversion({
            priceCopBase: adjustedCop,
            sourceCurrency: "COP",
          });

          setForm((s) => ({
            ...s,
            priceCopInternational: String(adjustedCop),
            priceUSD: String(converted.priceUSD),
          }));
        } catch (trmError) {
          console.error("TRM conversion error:", trmError);
          toast.error("Error al obtener TRM. Intenta nuevamente.");
        }
      }, 400);
    },
    [toast]
  );

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setSubmitting(false);
    setForm({
      name: addition?.name ?? "",
      description: addition?.description ?? "",
      categoryId: addition?.categoryId ?? "",
      priceCopBase: addition?.priceCopBase ?? "",
      priceCopInternational: addition?.priceCopInternational ?? "",
      priceUSD: addition?.priceUSD ?? "",
      isActive: Boolean(addition?.isActive ?? true),
    });

    return () => {
      if (conversionTimerRef.current) {
        clearTimeout(conversionTimerRef.current);
        conversionTimerRef.current = null;
      }
    };
  }, [isOpen, addition]);

  useEffect(() => {
    // Recalcula los precios cuando cambia el precio base
    if (form.priceCopBase.trim()) {
      scheduleInternationalFromR1(form.priceCopBase);
    }
  }, [scheduleInternationalFromR1]);

  async function handleSave() {
    setErrors({});
    setSubmitting(true);

    try {
      // Get TRM if needed and converting prices
      let trmUsed: number | null = null;
      let finalPriceCopBase = form.priceCopBase.trim();
      let finalPriceCopInternational = form.priceCopInternational.trim();
      let finalPriceUSD = form.priceUSD.trim();

      try {
        const trm = await getTRMColombia();
        trmUsed = trm;

        const basePrice = Number(finalPriceCopBase || "");

        if (!Number.isFinite(basePrice) || basePrice <= 0) {
          toast.error("Precio base requerido.");
          return;
        }

        const adjustedCop = applyInternationalMarkup(basePrice);
        const converted = await applyTRMConversion({
          priceCopBase: adjustedCop,
          sourceCurrency: "COP",
        });

        finalPriceCopInternational = String(adjustedCop);
        finalPriceUSD = String(converted.priceUSD);
        trmUsed = converted.trmUsed;
      } catch (trmError) {
        console.error("TRM conversion error:", trmError);
        toast.error("Error al obtener TRM. Intenta nuevamente.");
        return;
      }

      const payload: any = {
        ...(addition?.id && { id: addition.id }),
        catalogType: "INTERNACIONAL",
        productKind: addition?.productKind ?? "REGULAR",
        name: form.name,
        description: form.description,
        categoryId: form.categoryId,
        isActive: form.isActive,
        priceCopBase: finalPriceCopBase ? Number(finalPriceCopBase) : null,
        priceCopInternational: finalPriceCopInternational
          ? Number(finalPriceCopInternational)
          : null,
        priceUSD: finalPriceUSD ? Number(finalPriceUSD) : null,
        trmUsed: trmUsed,
      };

      const method = addition?.id ? "PUT" : "POST";
      const res = await fetch("/api/additions", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text();
        toast.error(msg || `${method} error`);
        return;
      }

      toast.success(addition?.id ? "Adición actualizada" : "Adición creada");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <BsBoxSeam className="h-5 w-5" />
          {addition?.id ? "Editar Adición" : "Nueva Adición"}
        </ModalHeader>
        <ModalBody className="gap-4">
          <Select
            label="Categoría"
            selectedKeys={form.categoryId ? [form.categoryId] : []}
            onChange={(e) =>
              setForm((s) => ({ ...s, categoryId: e.target.value }))
            }
            isDisabled={!canPickCategory}
            errorMessage={errors.categoryId}
            isInvalid={!!errors.categoryId}
          >
            {categories.map((cat) => (
              <SelectItem key={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </Select>

          <Input
            label="Nombre"
            placeholder="Ej: Empaque pequeño"
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            errorMessage={errors.name}
            isInvalid={!!errors.name}
          />

          <Input
            label="Descripción"
            placeholder="Descripción breve"
            value={form.description}
            onChange={(e) =>
              setForm((s) => ({ ...s, description: e.target.value }))
            }
          />

          <div className="rounded-large border border-default-200 p-3 space-y-3">
            <h4 className="text-sm font-semibold text-default-700">Precios</h4>
            <div className="space-y-3">
              <Input
                label="Precio base"
                placeholder="Ej: 50000"
                startContent={<BsCashCoin className="text-default-400" />}
                value={form.priceCopBase}
                onChange={(e) =>
                  setForm((s) => ({ ...s, priceCopBase: e.target.value }))
                }
                onBlur={(e) => {
                  if (e.target.value.trim()) {
                    scheduleInternationalFromR1(e.target.value);
                  }
                }}
              />
              <Input
                label="Precio COP internacional (calculado +19%)"
                startContent={<BsCashCoin className="text-default-400" />}
                value={formatCurrency(form.priceCopInternational, "COP")}
                isReadOnly
              />
              <Input
                label="Precio USD (calculado)"
                startContent={<BsCashCoin className="text-default-400" />}
                value={formatCurrency(form.priceUSD, "USD")}
                isReadOnly
              />
              <p className="text-xs text-default-500">
                Ingresa el precio base. Los precios en COP internacional y USD se calcularán automáticamente.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-divider px-4 py-3">
            <span className="text-sm font-medium">Activo</span>
            <Switch
              checked={form.isActive}
              onChange={(e) =>
                setForm((s) => ({ ...s, isActive: e.target.checked }))
              }
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            color="default"
            variant="light"
            onPress={() => onOpenChange(false)}
            isDisabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            color="primary"
            onPress={handleSave}
            isLoading={submitting}
          >
            {addition?.id ? "Guardar cambios" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
