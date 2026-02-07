"use client";

import type { AdminUser } from "../../_lib/types";

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

import { apiJson, getErrorMessage } from "../../_lib/api";
import { updateUserSchema } from "../../_lib/schemas";

export function EditUserModal({
  user,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  user: AdminUser | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [isActive, setIsActive] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setIsActive(Boolean(user?.isActive));
    setEmailVerified(Boolean(user?.emailVerified));
  }, [user]);

  const submit = async () => {
    if (!user) return;
    if (submitting) return;
    const parsed = updateUserSchema.safeParse({ isActive, emailVerified });

    if (!parsed.success) {
      toast.error("Datos inválidos");

      return;
    }
    try {
      setSubmitting(true);
      await apiJson(`/api/admin/users`, {
        method: "PUT",
        body: JSON.stringify({ id: user.id, ...parsed.data }),
      });
      toast.success("Usuario actualizado");
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
        <ModalHeader>Editar usuario</ModalHeader>
        <ModalBody>
          <Input isReadOnly label="Email" value={user?.email ?? ""} />
          <div className="flex items-center justify-between">
            <span className="text-sm">Activo</span>
            <Switch isSelected={isActive} onValueChange={setIsActive} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Email verificado</span>
            <Switch
              isSelected={emailVerified}
              onValueChange={setEmailVerified}
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
            Guardar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
