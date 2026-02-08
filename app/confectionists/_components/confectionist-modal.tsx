"use client";

import type { Confectionist } from "./confectionists-tab";

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

const confectionistSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido"),
  type: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

type FormState = {
  name: string;
  type: string;
  phone: string;
  isActive: boolean;
};

export function ConfectionistModal({
  confectionist,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  confectionist: Confectionist | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    name: "",
    type: "",
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
      name: confectionist?.name ?? "",
      type: confectionist?.type ?? "",
      phone: confectionist?.phone ?? "",
      isActive: Boolean(confectionist?.isActive ?? true),
    });
  }, [confectionist, isOpen]);

  const submit = async () => {
    if (submitting) return;

    const parsed = confectionistSchema.safeParse({
      ...form,
      type: form.type.trim() ? form.type : undefined,
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
      type: form.type.trim() ? form.type.trim() : null,
      phone: form.phone.trim() ? form.phone.trim() : null,
      isActive: Boolean(parsed.data.isActive ?? true),
    };

    try {
      setSubmitting(true);
      await apiJson(`/api/confectionists`, {
        method: confectionist ? "PUT" : "POST",
        body: JSON.stringify(
          confectionist ? { id: confectionist.id, ...payload } : payload,
        ),
      });

      toast.success(
        confectionist ? "Confeccionista actualizado" : "Confeccionista creado",
      );
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
          {confectionist ? "Editar confeccionista" : "Crear confeccionista"}
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
            label="Tipo"
            value={form.type}
            onValueChange={(v) => setForm((s) => ({ ...s, type: v }))}
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
            {confectionist ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
