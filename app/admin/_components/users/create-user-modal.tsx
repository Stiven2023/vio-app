"use client";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createUserSchema } from "../../_lib/schemas";

export function CreateUserModal({ isOpen, onOpenChange, onCreated }: { isOpen: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const canSubmit = useMemo(() => email.trim() !== "" && password.trim() !== "", [email, password]);

  const submit = async () => {
    const parsed = createUserSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0] ?? "form")] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      await apiJson(`/api/users`, { method: "POST", body: JSON.stringify(parsed.data) });
      toast.success("Usuario creado");
      setEmail("");
      setPassword("");
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>Crear usuario</ModalHeader>
        <ModalBody>
          <Input label="Email" value={email} onValueChange={setEmail} isInvalid={Boolean(errors.email)} errorMessage={errors.email} />
          <Input label="Contraseña" type="password" value={password} onValueChange={setPassword} isInvalid={Boolean(errors.password)} errorMessage={errors.password} />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button color="primary" isDisabled={!canSubmit} onPress={submit}>
            Crear
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
