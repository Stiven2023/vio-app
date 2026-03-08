"use client";

import type { Permission } from "../../_lib/types";

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
import { BsPersonFill } from "react-icons/bs";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { nameSchema } from "../../_lib/schemas";

export function PermissionModal({
  permission,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  permission: Permission | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(permission?.name ?? "");
    setError(null);
  }, [permission, isOpen]);

  const submit = async () => {
    if (submitting) return;
    const parsed = nameSchema.safeParse({ name });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Nombre inválido");

      return;
    }
    setError(null);
    try {
      setSubmitting(true);
      await apiJson(`/api/permissions`, {
        method: permission ? "PUT" : "POST",
        body: JSON.stringify(
          permission ? { id: permission.id, ...parsed.data } : parsed.data,
        ),
      });
      toast.success(permission ? "Permiso actualizado" : "Permiso creado");
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
          {permission ? "Editar permiso" : "Crear permiso"}
        </ModalHeader>
        <ModalBody>
          <Input
            errorMessage={error ?? undefined}
            isInvalid={Boolean(error)}
            label="Nombre"
            startContent={<BsPersonFill className="text-xl text-default-500" />}
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
            {permission ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
