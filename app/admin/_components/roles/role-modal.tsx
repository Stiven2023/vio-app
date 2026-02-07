"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { nameSchema } from "../../_lib/schemas";
import type { Role } from "../../_lib/types";

export function RoleModal({ role, isOpen, onOpenChange, onSaved }: { role: Role | null; isOpen: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(role?.name ?? "");
    setError(null);
  }, [role, isOpen]);

  const submit = async () => {
    const parsed = nameSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Nombre inválido");
      return;
    }
    setError(null);
    try {
      await apiJson(`/api/roles`, {
        method: role ? "PUT" : "POST",
        body: JSON.stringify(role ? { id: role.id, ...parsed.data } : parsed.data),
      });
      toast.success(role ? "Rol actualizado" : "Rol creado");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>{role ? "Editar rol" : "Crear rol"}</ModalHeader>
        <ModalBody>
          <Input label="Nombre" value={name} onValueChange={setName} isInvalid={Boolean(error)} errorMessage={error ?? undefined} />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button color="primary" onPress={submit}>
            {role ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
