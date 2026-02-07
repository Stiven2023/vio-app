"use client";

import type { Product, ProductPrice } from "../../_lib/types";

import { useEffect, useState } from "react";
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

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createProductPriceSchema } from "../../_lib/schemas";

type FormState = {
  productId: string;
  referenceCode: string;
  priceCOP: string;
  priceUSD: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export function PriceModal({
  price,
  products,
  defaultProductId,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  price: ProductPrice | null;
  products: Product[];
  defaultProductId?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    productId: "",
    referenceCode: "",
    priceCOP: "",
    priceUSD: "",
    startDate: "",
    endDate: "",
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setSubmitting(false);
    setForm({
      productId: price?.productId ?? defaultProductId ?? "",
      referenceCode: price?.referenceCode ?? "",
      priceCOP: price?.priceCOP ?? "",
      priceUSD: price?.priceUSD ?? "",
      startDate: price?.startDate ? String(price.startDate).slice(0, 10) : "",
      endDate: price?.endDate ? String(price.endDate).slice(0, 10) : "",
      isActive: Boolean(price?.isActive ?? true),
    });
  }, [defaultProductId, isOpen, price]);

  const submit = async () => {
    if (submitting) return;

    const parsed = createProductPriceSchema.safeParse({
      productId: form.productId,
      referenceCode: form.referenceCode,
      priceCOP: form.priceCOP.trim() ? form.priceCOP : undefined,
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
      productId: parsed.data.productId,
      referenceCode: parsed.data.referenceCode,
      priceCOP: parsed.data.priceCOP ? parsed.data.priceCOP : null,
      priceUSD: parsed.data.priceUSD ? parsed.data.priceUSD : null,
      startDate: parsed.data.startDate ? parsed.data.startDate : null,
      endDate: parsed.data.endDate ? parsed.data.endDate : null,
      isActive: parsed.data.isActive ?? true,
    };

    try {
      setSubmitting(true);
      await apiJson(`/api/product-prices`, {
        method: price ? "PUT" : "POST",
        body: JSON.stringify(price ? { id: price.id, ...payload } : payload),
      });
      toast.success(price ? "Precio actualizado" : "Precio creado");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>{price ? "Editar precio" : "Crear precio"}</ModalHeader>
        <ModalBody>
          <Select
            errorMessage={errors.productId}
            isInvalid={Boolean(errors.productId)}
            label="Producto"
            selectedKeys={form.productId ? [form.productId] : []}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];

              setForm((s) => ({ ...s, productId: String(first ?? "") }));
            }}
          >
            {products.map((p) => (
              <SelectItem key={p.id}>{p.name}</SelectItem>
            ))}
          </Select>

          <Input
            errorMessage={errors.referenceCode}
            isInvalid={Boolean(errors.referenceCode)}
            label="Código de referencia"
            value={form.referenceCode}
            onValueChange={(v) => setForm((s) => ({ ...s, referenceCode: v }))}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              errorMessage={errors.priceCOP}
              isInvalid={Boolean(errors.priceCOP)}
              label="Precio COP"
              value={form.priceCOP}
              onValueChange={(v) => setForm((s) => ({ ...s, priceCOP: v }))}
            />
            <Input
              errorMessage={errors.priceUSD}
              isInvalid={Boolean(errors.priceUSD)}
              label="Precio USD"
              value={form.priceUSD}
              onValueChange={(v) => setForm((s) => ({ ...s, priceUSD: v }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Inicio"
              type="date"
              value={form.startDate}
              onValueChange={(v) => setForm((s) => ({ ...s, startDate: v }))}
            />
            <Input
              label="Fin"
              type="date"
              value={form.endDate}
              onValueChange={(v) => setForm((s) => ({ ...s, endDate: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Activo</span>
            <Switch
              isSelected={form.isActive}
              onValueChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
            />
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
          <Button color="primary" isLoading={submitting} onPress={submit}>
            {price ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
