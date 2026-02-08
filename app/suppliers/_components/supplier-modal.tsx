"use client";

import type { Supplier } from "./suppliers-tab";

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
import { Switch } from "@heroui/switch";
import { z } from "zod";

import { apiJson, getErrorMessage } from "@/app/catalog/_lib/api";

const supplierSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
  email: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || z.string().email().safeParse(v).success,
      "Email inválido",
    ),
  phone: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

type FormState = {
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
};

export function SupplierModal({
  supplier,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  supplier: Supplier | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setSubmitting(false);
    setForm({
      name: supplier?.name ?? "",
      email: supplier?.email ?? "",
      phone: supplier?.phone ?? "",
      isActive: Boolean(supplier?.isActive ?? true),
    });
  }, [supplier, isOpen]);

  const submit = async () => {
    if (submitting) return;

    const parsed = supplierSchema.safeParse({
      ...form,
      phone: form.phone.trim() ? form.phone : undefined,
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
      name: parsed.data.name,
      email: parsed.data.email.trim() ? parsed.data.email.trim() : null,
      phone: form.phone.trim() ? form.phone.trim() : null,
      isActive: Boolean(parsed.data.isActive ?? true),
    };

    try {
      setSubmitting(true);
      await apiJson(`/api/suppliers`, {
        method: supplier ? "PUT" : "POST",
        body: JSON.stringify(supplier ? { id: supplier.id, ...payload } : payload),
      });

      toast.success(supplier ? "Proveedor actualizado" : "Proveedor creado");
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
          {supplier ? "Editar proveedor" : "Crear proveedor"}
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
            errorMessage={errors.email}
            isInvalid={Boolean(errors.email)}
            label="Email"
            type="email"
            value={form.email}
            onValueChange={(v) => setForm((s) => ({ ...s, email: v }))}
          />

          <Input
            label="Teléfono"
            value={form.phone}
            onValueChange={(v) => setForm((s) => ({ ...s, phone: v }))}
          />

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
            {supplier ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
