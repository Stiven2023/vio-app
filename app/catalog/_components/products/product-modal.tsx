"use client";

import type { Category, Product } from "../../_lib/types";

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
import { Tab, Tabs } from "@heroui/tabs";
import { BsBoxSeam, BsCashCoin, BsClockHistory, BsTag } from "react-icons/bs";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createProductSchema } from "../../_lib/schemas";
import { getTRMColombia, applyTRMConversion } from "@/src/utils/trm";

type FormState = {
  catalogType: "NACIONAL" | "INTERNACIONAL";
  name: string;
  description: string;
  categoryId: string;
  priceCopBase: string;
  priceCopInternational: string;
  priceCopR1: string;
  priceCopR2: string;
  priceCopR3: string;
  priceMayorista: string;
  priceColanta: string;
  priceUSD: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export function ProductModal({
  product,
  defaultCatalogType,
  categories,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  product: Product | null;
  defaultCatalogType?: "NACIONAL" | "INTERNACIONAL";
  categories: Category[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const conversionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [form, setForm] = useState<FormState>({
    catalogType: "NACIONAL",
    name: "",
    description: "",
    categoryId: "",
    priceCopBase: "",
    priceCopInternational: "",
    priceCopR1: "",
    priceCopR2: "",
    priceCopR3: "",
    priceMayorista: "",
    priceColanta: "",
    priceUSD: "",
    startDate: "",
    endDate: "",
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const fixedEndDate = useMemo(() => {
    const now = new Date();
    const nextYear = now.getFullYear() + 1;

    return `${nextYear}-02-01`;
  }, []);

  const canPickCategory = useMemo(() => categories.length > 0, [categories]);

  const applyInternationalMarkup = (value: number) =>
    Number((value * 1.19).toFixed(2));

  const scheduleInternationalFromR1 = useCallback(
    (value: string) => {
      if (form.catalogType !== "INTERNACIONAL") return;

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
    [form.catalogType, toast]
  );

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setSubmitting(false);
    const inferredCatalogType = (
      product?.priceUSD || product?.priceCopInternational
        ? "INTERNACIONAL"
        : defaultCatalogType ?? "NACIONAL"
    ) as "NACIONAL" | "INTERNACIONAL";
    const newForm = {
      catalogType: inferredCatalogType,
      name: product?.name ?? "",
      description: product?.description ?? "",
      categoryId: product?.categoryId ?? "",
      priceCopBase: product?.priceCopBase ? String(product.priceCopBase) : "",
      priceCopInternational: product?.priceCopInternational ? String(product.priceCopInternational) : "",
      priceCopR1: product?.priceCopR1 ? String(product.priceCopR1) : "",
      priceCopR2: product?.priceCopR2 ? String(product.priceCopR2) : "",
      priceCopR3: product?.priceCopR3 ? String(product.priceCopR3) : "",
      priceMayorista: product?.priceMayorista ? String(product.priceMayorista) : "",
      priceColanta: product?.priceColanta ? String(product.priceColanta) : "",
      priceUSD: product?.priceUSD ? String(product.priceUSD) : "",
      startDate: product?.startDate ? String(product.startDate).slice(0, 10) : "",
      endDate: product?.endDate ? String(product.endDate).slice(0, 10) : fixedEndDate,
      isActive: Boolean(product?.isActive ?? true),
    };
    setForm(newForm);

    return () => {
      if (conversionTimerRef.current) {
        clearTimeout(conversionTimerRef.current);
        conversionTimerRef.current = null;
      }
    };
  }, [defaultCatalogType, fixedEndDate, isOpen, product]);

  useEffect(() => {
    // Cuando cambias al tab internacional e ingresaste un R1, recalcula los precios
    if (form.catalogType === "INTERNACIONAL" && form.priceCopR1.trim()) {
      scheduleInternationalFromR1(form.priceCopR1);
    }
  }, [form.catalogType, scheduleInternationalFromR1]);

  const submit = async () => {
    if (submitting) return;

    const parsed = createProductSchema.safeParse({
      catalogType: form.catalogType,
      name: form.name,
      description: form.description.trim() ? form.description : undefined,
      categoryId: form.categoryId ? form.categoryId : undefined,
      priceCopBase: form.priceCopBase.trim() ? form.priceCopBase : undefined,
      priceCopInternational: form.priceCopInternational.trim() ? form.priceCopInternational : undefined,
      priceCopR1: form.priceCopR1,
      priceCopR2: form.priceCopR2,
      priceCopR3: form.priceCopR3,
      priceMayorista: form.priceMayorista,
      priceColanta: form.priceColanta,
      priceUSD: form.priceUSD.trim() ? form.priceUSD : undefined,
      startDate: form.startDate.trim() ? form.startDate : undefined,
      endDate: form.endDate.trim() ? form.endDate : undefined,
      isActive: form.isActive,
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};

      for (const issue of parsed.error.issues)
        next[String(issue.path[0] ?? "form")] = issue.message;
      setErrors(next);

      return;
    }

    setErrors({});

    try {
      setSubmitting(true);

      // Get TRM if converting prices
      let trmUsed: number | null = null;
      let finalPriceCopBase = parsed.data.priceCopBase;
      let finalPriceCopInternational = parsed.data.priceCopInternational;
      let finalPriceUSD = parsed.data.priceUSD;

      if (form.catalogType === "INTERNACIONAL") {
        try {
          const trm = await getTRMColombia();
          trmUsed = trm;

          const baseR1 = Number(parsed.data.priceCopR1 ?? "");

          if (!Number.isFinite(baseR1) || baseR1 <= 0) {
            toast.error("Precio base (1-499) requerido para internacional.");
            return;
          }

          const adjustedCop = applyInternationalMarkup(baseR1);
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
      }

      const payload = {
        name: parsed.data.name,
        description: parsed.data.description ? parsed.data.description : null,
        categoryId: parsed.data.categoryId ? parsed.data.categoryId : null,
        catalogType: parsed.data.catalogType,
        priceCopBase: finalPriceCopBase ? Number(finalPriceCopBase) : null,
        priceCopInternational:
          form.catalogType === "INTERNACIONAL" && finalPriceCopInternational
            ? Number(finalPriceCopInternational)
            : null,
        priceCopR1: parsed.data.priceCopR1 ? Number(parsed.data.priceCopR1) : null,
        priceCopR2: parsed.data.priceCopR2 ? Number(parsed.data.priceCopR2) : null,
        priceCopR3: parsed.data.priceCopR3 ? Number(parsed.data.priceCopR3) : null,
        priceMayorista: parsed.data.priceMayorista
          ? Number(parsed.data.priceMayorista)
          : null,
        priceColanta: parsed.data.priceColanta ? Number(parsed.data.priceColanta) : null,
        priceUSD:
          form.catalogType === "INTERNACIONAL" && finalPriceUSD
            ? Number(finalPriceUSD)
            : null,
        trmUsed: form.catalogType === "INTERNACIONAL" ? trmUsed : null,
        startDate: parsed.data.startDate ? parsed.data.startDate : null,
        endDate: form.endDate ? form.endDate : null,
        isActive: parsed.data.isActive,
      };

      await apiJson(`/api/products`, {
        method: product ? "PUT" : "POST",
        body: JSON.stringify(
          product ? { id: product.id, ...payload } : payload,
        ),
      });
      toast.success(product ? "Producto actualizado" : "Producto creado");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside">
      <ModalContent className="max-w-6xl">
        <ModalHeader>
          {product ? "Editar producto" : "Crear producto"}
        </ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-large border border-default-200 p-3 space-y-3 h-fit">
              <h4 className="text-sm font-semibold text-default-700">Datos del producto</h4>
              <Input
                isReadOnly
                label="Código de producto"
                placeholder="Se genera al guardar"
                startContent={<BsTag className="text-default-400" />}
                value={product?.productCode ?? ""}
              />

              <Input
                errorMessage={errors.name}
                isInvalid={Boolean(errors.name)}
                label="Nombre"
                startContent={<BsBoxSeam className="text-default-400" />}
                value={form.name}
                onValueChange={(v) => setForm((s) => ({ ...s, name: v }))}
              />

              <Input
                label="Descripción"
                startContent={<BsTag className="text-default-400" />}
                value={form.description}
                onValueChange={(v) => setForm((s) => ({ ...s, description: v }))}
              />

              <Select
                isDisabled={!canPickCategory}
                errorMessage={errors.categoryId}
                isInvalid={Boolean(errors.categoryId)}
                label="Categoría"
                selectedKeys={form.categoryId ? [form.categoryId] : []}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0];

                  setForm((s) => ({ ...s, categoryId: String(first ?? "") }));
                }}
              >
                {categories.map((c) => (
                  <SelectItem key={c.id}>{c.name}</SelectItem>
                ))}
              </Select>

              <Select
                label="Tipo de catálogo"
                selectedKeys={[form.catalogType]}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0];
                  const next =
                    String(first ?? "NACIONAL") === "INTERNACIONAL"
                      ? "INTERNACIONAL"
                      : "NACIONAL";

                  setForm((s) => ({
                    ...s,
                    catalogType: next,
                  }));
                }}
              >
                <SelectItem key="NACIONAL">Catálogo nacional</SelectItem>
                <SelectItem key="INTERNACIONAL">Catálogo internacional</SelectItem>
              </Select>
            </section>

            <section className="rounded-large border border-default-200 p-3 space-y-3">
              <h4 className="text-sm font-semibold text-default-700">Precios y vigencia</h4>
              <Tabs
                aria-label="Tipo de catálogo"
                selectedKey={form.catalogType}
                onSelectionChange={(key) => {
                  const next =
                    String(key) === "INTERNACIONAL"
                      ? "INTERNACIONAL"
                      : "NACIONAL";

                  setForm((s) => ({
                    ...s,
                    catalogType: next,
                  }));
                }}
                variant="underlined"
              >
                <Tab key="NACIONAL" title="Catálogo nacional">
                  <div className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-3">
                    <Input
                      errorMessage={errors.priceCopR1}
                      isInvalid={Boolean(errors.priceCopR1)}
                      label="Precio base (1-499)"
                      startContent={<BsCashCoin className="text-default-400" />}
                      value={form.priceCopR1}
                      onValueChange={(v) => setForm((s) => ({ ...s, priceCopR1: v }))}
                    />
                    <Input
                      errorMessage={errors.priceCopR2}
                      isInvalid={Boolean(errors.priceCopR2)}
                      label="Precio +499 (500-1000)"
                      startContent={<BsCashCoin className="text-default-400" />}
                      value={form.priceCopR2}
                      onValueChange={(v) => setForm((s) => ({ ...s, priceCopR2: v }))}
                    />
                    <Input
                      errorMessage={errors.priceCopR3}
                      isInvalid={Boolean(errors.priceCopR3)}
                      label="Precio +1000 (1001+)"
                      startContent={<BsCashCoin className="text-default-400" />}
                      value={form.priceCopR3}
                      onValueChange={(v) => setForm((s) => ({ ...s, priceCopR3: v }))}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-2">
                    <Input
                      errorMessage={errors.priceMayorista}
                      isInvalid={Boolean(errors.priceMayorista)}
                      label="Precio fijo Mayorista"
                      startContent={<BsCashCoin className="text-default-400" />}
                      value={form.priceMayorista}
                      onValueChange={(v) =>
                        setForm((s) => ({ ...s, priceMayorista: v }))
                      }
                    />
                    <Input
                      errorMessage={errors.priceColanta}
                      isInvalid={Boolean(errors.priceColanta)}
                      label="Precio fijo Colanta"
                      startContent={<BsCashCoin className="text-default-400" />}
                      value={form.priceColanta}
                      onValueChange={(v) => setForm((s) => ({ ...s, priceColanta: v }))}
                    />
                  </div>
                </Tab>
                <Tab key="INTERNACIONAL" title="Catálogo internacional">
                  <div className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-3">
                    <Input
                      errorMessage={errors.priceCopR1}
                      isInvalid={Boolean(errors.priceCopR1)}
                      label="Precio base (1-499)"
                      startContent={<BsCashCoin className="text-default-400" />}
                      value={form.priceCopR1}
                      onValueChange={(v) => {
                        setForm((s) => ({ ...s, priceCopR1: v }));
                        scheduleInternationalFromR1(v);
                      }}
                    />
                    <Input
                      label="Precio COP internacional"
                      startContent={<BsCashCoin className="text-default-400" />}
                      value={form.priceCopInternational}
                      isReadOnly
                    />
                    <Input
                      label="Precio USD"
                      startContent={<BsCashCoin className="text-default-400" />}
                      value={form.priceUSD}
                      isReadOnly
                    />
                  </div>
                </Tab>
              </Tabs>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Inicio vigencia"
                  type="date"
                  startContent={<BsClockHistory className="text-default-400" />}
                  value={form.startDate}
                  onValueChange={(v) => setForm((s) => ({ ...s, startDate: v }))}
                />
                <Input
                  isReadOnly
                  label="Fin vigencia (fijo)"
                  startContent={<BsClockHistory className="text-default-400" />}
                  value={form.endDate}
                />
              </div>

              <div className="flex items-center justify-between rounded-medium border border-default-200 px-3 py-2">
                <span className="text-sm">Activo</span>
                <Switch
                  isSelected={form.isActive}
                  onValueChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
                />
              </div>
            </section>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={submitting}
            variant="flat"
            onPress={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            color="primary"
            isLoading={submitting}
            onPress={submit}
          >
            {product ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
