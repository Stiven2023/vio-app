"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { nameSchema } from "../../_lib/schemas";
import type { Permission } from "../../_lib/types";

export function PermissionModal({ permission, isOpen, onOpenChange, onSaved }: { permission: Permission | null; isOpen: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(permission?.name ?? "");
    setError(null);
  }, [permission, isOpen]);

  const submit = async () => {
    const parsed = nameSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Nombre inválido");
      return;
    }
    setError(null);
    try {
      await apiJson(`/api/permissions`, {
        method: permission ? "PUT" : "POST",
        body: JSON.stringify(permission ? { id: permission.id, ...parsed.data } : parsed.data),
      });
      toast.success(permission ? "Permiso actualizado" : "Permiso creado");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>{permission ? "Editar permiso" : "Crear permiso"}</ModalHeader>
        <ModalBody>
          <Input label="Nombre" value={name} onValueChange={setName} isInvalid={Boolean(error)} errorMessage={error ?? undefined} />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button color="primary" onPress={submit}>
            {permission ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
