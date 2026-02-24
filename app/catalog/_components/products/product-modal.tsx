"use client";

import type { Category, Product, ProductPrice } from "../../_lib/types";

import { useEffect, useMemo, useState } from "react";
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
import { BsBoxSeam, BsCashCoin, BsClockHistory, BsTag } from "react-icons/bs";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createProductSchema } from "../../_lib/schemas";

type FormState = {
  name: string;
  description: string;
  categoryId: string;
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
  categories,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    categoryId: "",
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
  const [loadingPrice, setLoadingPrice] = useState(false);

  const canPickCategory = useMemo(() => categories.length > 0, [categories]);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;

    setErrors({});
    setSubmitting(false);
    setLoadingPrice(false);
    setForm({
      name: product?.name ?? "",
      description: product?.description ?? "",
      categoryId: product?.categoryId ?? "",
      priceCopR1: "",
      priceCopR2: "",
      priceCopR3: "",
      priceMayorista: "",
      priceColanta: "",
      priceUSD: "",
      startDate: "",
      endDate: "",
      isActive: Boolean(product?.isActive ?? true),
    });

    if (!product?.id) return;

    setLoadingPrice(true);
    apiJson<{ items: ProductPrice[] }>(
      `/api/product-prices?productId=${product.id}&page=1&pageSize=1`,
    )
      .then((response) => {
        if (!active) return;
        const first = response.items?.[0];

        if (!first) return;

        setForm((state) => ({
          ...state,
          priceCopR1: first.priceCopR1 ?? "",
          priceCopR2: first.priceCopR2 ?? "",
          priceCopR3: first.priceCopR3 ?? "",
          priceMayorista: first.priceMayorista ?? "",
          priceColanta: first.priceColanta ?? "",
          priceUSD: first.priceUSD ?? "",
          startDate: first.startDate ? String(first.startDate).slice(0, 10) : "",
          endDate: first.endDate ? String(first.endDate).slice(0, 10) : "",
          isActive: Boolean(first.isActive ?? state.isActive),
        }));
      })
      .catch(() => {
        if (!active) return;
      })
      .finally(() => {
        if (!active) return;
        setLoadingPrice(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, product]);

  const submit = async () => {
    if (submitting) return;

    const parsed = createProductSchema.safeParse({
      name: form.name,
      description: form.description.trim() ? form.description : undefined,
      categoryId: form.categoryId ? form.categoryId : undefined,
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

    const payload = {
      ...parsed.data,
      description: parsed.data.description ? parsed.data.description : null,
      categoryId: parsed.data.categoryId ? parsed.data.categoryId : null,
      priceUSD: parsed.data.priceUSD ? parsed.data.priceUSD : null,
      startDate: parsed.data.startDate ? parsed.data.startDate : null,
      endDate: parsed.data.endDate ? parsed.data.endDate : null,
    };

    try {
      setSubmitting(true);
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
            </section>

            <section className="rounded-large border border-default-200 p-3 space-y-3">
              <h4 className="text-sm font-semibold text-default-700">Precios y vigencia</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input
                  errorMessage={errors.priceUSD}
                  isInvalid={Boolean(errors.priceUSD)}
                  label="Precio USD (opcional)"
                  startContent={<BsCashCoin className="text-default-400" />}
                  value={form.priceUSD}
                  onValueChange={(v) => setForm((s) => ({ ...s, priceUSD: v }))}
                />
                <Input
                  label="Inicio vigencia"
                  type="date"
                  startContent={<BsClockHistory className="text-default-400" />}
                  value={form.startDate}
                  onValueChange={(v) => setForm((s) => ({ ...s, startDate: v }))}
                />
                <Input
                  label="Fin vigencia"
                  type="date"
                  startContent={<BsClockHistory className="text-default-400" />}
                  value={form.endDate}
                  onValueChange={(v) => setForm((s) => ({ ...s, endDate: v }))}
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
            isDisabled={submitting || loadingPrice}
            variant="flat"
            onPress={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            color="primary"
            isLoading={submitting || loadingPrice}
            onPress={submit}
          >
            {product ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
