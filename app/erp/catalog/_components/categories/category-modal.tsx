"use client";

import type { Category } from "../../_lib/types";

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

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createCategorySchema } from "../../_lib/schemas";

export function CategoryModal({
  category,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  category: Category | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSubmitting(false);
    setError(null);
    setName(category?.name ?? "");
  }, [category, isOpen]);

  const submit = async () => {
    if (submitting) return;

    const parsed = createCategorySchema.safeParse({ name });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Nombre inválido");

      return;
    }

    setError(null);

    try {
      setSubmitting(true);
      await apiJson(`/api/categories`, {
        method: category ? "PUT" : "POST",
        body: JSON.stringify(
          category ? { id: category.id, ...parsed.data } : parsed.data,
        ),
      });
      toast.success(category ? "Categoría actualizada" : "Categoría creada");
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
          {category ? "Editar categoría" : "Crear categoría"}
        </ModalHeader>
        <ModalBody>
          <Input
            errorMessage={error ?? undefined}
            isInvalid={Boolean(error)}
            label="Nombre"
            value={name}
            onValueChange={setName}
          />
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
            {category ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
