"use client";

import type { Category, Product } from "../../_lib/types";

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

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createProductSchema } from "../../_lib/schemas";

type FormState = {
  name: string;
  description: string;
  categoryId: string;
  isActive: boolean;
  isSet: boolean;
  productionType: "SUBLIMADO" | "CORTE_MANUAL" | "";
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
    isActive: true,
    isSet: false,
    productionType: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const canPickCategory = useMemo(() => categories.length > 0, [categories]);

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setSubmitting(false);
    setForm({
      name: product?.name ?? "",
      description: product?.description ?? "",
      categoryId: product?.categoryId ?? "",
      isActive: Boolean(product?.isActive ?? true),
      isSet: Boolean((product as any)?.isSet ?? false),
      productionType: ((product as any)?.productionType as any) ?? "",
    });
  }, [isOpen, product]);

  const submit = async () => {
    if (submitting) return;

    const parsed = createProductSchema.safeParse({
      name: form.name,
      description: form.description.trim() ? form.description : undefined,
      categoryId: form.categoryId ? form.categoryId : undefined,
      isActive: form.isActive,
      isSet: form.isSet,
      productionType: form.productionType ? form.productionType : undefined,
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
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          {product ? "Editar producto" : "Crear producto"}
        </ModalHeader>
        <ModalBody>
          <Input
            errorMessage={errors.name}
            isInvalid={Boolean(errors.name)}
            label="Nombre"
            value={form.name}
            onValueChange={(v) => setForm((s) => ({ ...s, name: v }))}
          />

          <Input
            label="Descripción"
            value={form.description}
            onValueChange={(v) => setForm((s) => ({ ...s, description: v }))}
          />

          <Select
            isDisabled={!canPickCategory}
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

          <div className="flex items-center justify-between">
            <span className="text-sm">Es conjunto (lleva medias)</span>
            <Switch
              isSelected={form.isSet}
              onValueChange={(v) => setForm((s) => ({ ...s, isSet: v }))}
            />
          </div>

          <Select
            label="Tipo de producción"
            selectedKeys={form.productionType ? [form.productionType] : []}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];

              setForm((s) => ({
                ...s,
                productionType: String(first ?? "") as any,
              }));
            }}
          >
            <SelectItem key="SUBLIMADO">Sublimado</SelectItem>
            <SelectItem key="CORTE_MANUAL">Corte manual</SelectItem>
          </Select>

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
            {product ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
