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
import { Tab, Tabs } from "@heroui/tabs";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createProductPriceSchema } from "../../_lib/schemas";

type FormState = {
  productId: string;
  referenceCode: string;
  priceCopR1: string;
  priceCopR2: string;
  priceCopR3: string;
  priceViomar: string;
  priceColanta: string;
  priceMayorista: string;
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
    priceCopR1: "",
    priceCopR2: "",
    priceCopR3: "",
    priceViomar: "",
    priceColanta: "",
    priceMayorista: "",
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
      priceCopR1: price?.priceCopR1 ?? "",
      priceCopR2: price?.priceCopR2 ?? "",
      priceCopR3: price?.priceCopR3 ?? "",
      priceViomar: price?.priceViomar ?? "",
      priceColanta: price?.priceColanta ?? "",
      priceMayorista: price?.priceMayorista ?? "",
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
      priceCopR1: form.priceCopR1.trim() ? form.priceCopR1 : undefined,
      priceCopR2: form.priceCopR2.trim() ? form.priceCopR2 : undefined,
      priceCopR3: form.priceCopR3.trim() ? form.priceCopR3 : undefined,
      priceViomar: form.priceViomar.trim() ? form.priceViomar : undefined,
      priceColanta: form.priceColanta.trim() ? form.priceColanta : undefined,
      priceMayorista: form.priceMayorista.trim()
        ? form.priceMayorista
        : undefined,
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
      priceCopR1: parsed.data.priceCopR1 ? parsed.data.priceCopR1 : null,
      priceCopR2: parsed.data.priceCopR2 ? parsed.data.priceCopR2 : null,
      priceCopR3: parsed.data.priceCopR3 ? parsed.data.priceCopR3 : null,
      priceViomar: parsed.data.priceViomar ? parsed.data.priceViomar : null,
      priceColanta: parsed.data.priceColanta ? parsed.data.priceColanta : null,
      priceMayorista: parsed.data.priceMayorista
        ? parsed.data.priceMayorista
        : null,
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

          <Tabs aria-label="Configuración de precio" size="sm" variant="underlined">
            <Tab key="cop" title="Escalas COP">
              <div className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-3">
                <Input
                  errorMessage={errors.priceCopR1}
                  isInvalid={Boolean(errors.priceCopR1)}
                  label="R1 COP (1-500)"
                  value={form.priceCopR1}
                  onValueChange={(v) => setForm((s) => ({ ...s, priceCopR1: v }))}
                />
                <Input
                  errorMessage={errors.priceCopR2}
                  isInvalid={Boolean(errors.priceCopR2)}
                  label="R2 COP (501-1000)"
                  value={form.priceCopR2}
                  onValueChange={(v) => setForm((s) => ({ ...s, priceCopR2: v }))}
                />
                <Input
                  errorMessage={errors.priceCopR3}
                  isInvalid={Boolean(errors.priceCopR3)}
                  label="R3 COP (1001+)"
                  value={form.priceCopR3}
                  onValueChange={(v) => setForm((s) => ({ ...s, priceCopR3: v }))}
                />
              </div>
            </Tab>
            <Tab key="fijos" title="Precios por cliente">
              <div className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-3">
                <Input
                  errorMessage={errors.priceViomar}
                  isInvalid={Boolean(errors.priceViomar)}
                  label="Precio Viomar"
                  value={form.priceViomar}
                  onValueChange={(v) => setForm((s) => ({ ...s, priceViomar: v }))}
                />
                <Input
                  errorMessage={errors.priceColanta}
                  isInvalid={Boolean(errors.priceColanta)}
                  label="Precio Colanta"
                  value={form.priceColanta}
                  onValueChange={(v) => setForm((s) => ({ ...s, priceColanta: v }))}
                />
                <Input
                  errorMessage={errors.priceMayorista}
                  isInvalid={Boolean(errors.priceMayorista)}
                  label="Precio Mayorista"
                  value={form.priceMayorista}
                  onValueChange={(v) => setForm((s) => ({ ...s, priceMayorista: v }))}
                />
                <Input
                  errorMessage={errors.priceUSD}
                  isInvalid={Boolean(errors.priceUSD)}
                  label="Precio USD"
                  value={form.priceUSD}
                  onValueChange={(v) => setForm((s) => ({ ...s, priceUSD: v }))}
                />
              </div>
              <p className="mt-2 text-xs text-default-500">
                La edición manual del precio en cotización depende del tipo de cliente (AUTORIZADO).
              </p>
            </Tab>
            <Tab key="vigencia" title="Vigencia">
              <div className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-2">
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
            </Tab>
          </Tabs>

          <div className="flex items-center justify-between">
            <span className="text-sm">Activo</span>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((state) => ({ ...state, isActive: event.target.checked }))
              }
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
