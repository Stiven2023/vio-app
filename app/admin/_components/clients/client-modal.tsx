"use client";

import type { Client } from "../../_lib/types";

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
import { BsEnvelopeFill, BsPersonFill } from "react-icons/bs";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createClientSchema } from "../../_lib/schemas";

type FormState = {
  name: string;
  identification: string;
  email: string;
  phone: string;
  city: string;
  isActive: boolean;
};

export function ClientModal({
  client,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  client: Client | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    name: "",
    identification: "",
    email: "",
    phone: "",
    city: "Medellín",
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setSubmitting(false);
    setForm({
      name: client?.name ?? "",
      identification: client?.identification ?? "",
      email: client?.email ?? "",
      phone: client?.phone ?? "",
      city: client?.city ?? "Medellín",
      isActive: Boolean(client?.isActive ?? true),
    });
  }, [client, isOpen]);

  const submit = async () => {
    if (submitting) return;

    const parsed = createClientSchema.safeParse({
      ...form,
      phone: form.phone.trim() ? form.phone : undefined,
      city: form.city.trim() ? form.city : undefined,
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
      email: parsed.data.email.trim() ? parsed.data.email.trim() : null,
      phone: form.phone.trim() ? form.phone.trim() : null,
      city: form.city.trim() ? form.city.trim() : null,
    };

    try {
      setSubmitting(true);
      await apiJson(`/api/clients`, {
        method: client ? "PUT" : "POST",
        body: JSON.stringify(client ? { id: client.id, ...payload } : payload),
      });

      toast.success(client ? "Cliente actualizado" : "Cliente creado");
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
        <ModalHeader>{client ? "Editar cliente" : "Crear cliente"}</ModalHeader>
        <ModalBody>
          <Input
            errorMessage={errors.name}
            isInvalid={Boolean(errors.name)}
            label="Nombre"
            startContent={<BsPersonFill className="text-xl text-default-500" />}
            value={form.name}
            onValueChange={(v) => setForm((s) => ({ ...s, name: v }))}
          />

          <Input
            errorMessage={errors.identification}
            isInvalid={Boolean(errors.identification)}
            label="Identificación"
            value={form.identification}
            onValueChange={(v) => setForm((s) => ({ ...s, identification: v }))}
          />

          <Input
            errorMessage={errors.email}
            isInvalid={Boolean(errors.email)}
            label="Correo electrónico"
            startContent={<BsEnvelopeFill className="text-xl text-default-500" />}
            type="email"
            value={form.email}
            onValueChange={(v) => setForm((s) => ({ ...s, email: v }))}
          />

          <Input
            label="Teléfono"
            value={form.phone}
            onValueChange={(v) => setForm((s) => ({ ...s, phone: v }))}
          />

          <Input
            label="Ciudad"
            value={form.city}
            onValueChange={(v) => setForm((s) => ({ ...s, city: v }))}
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
            {client ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
