"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { BsEnvelopeFill } from "react-icons/bs";

import { AlertToast } from "@/components/alert-toast";

function validateNewPassword(newPassword: string): string {
  if (!newPassword) return "La contraseña es obligatoria.";
  if (newPassword.length < 7) return "Debe tener al menos 7 caracteres.";
  if (!/[A-Z]/.test(newPassword))
    return "Debe contener al menos una letra mayúscula.";
  if (/[^A-Za-z0-9.*]/.test(newPassword)) {
    return 'Solo puede contener letras, números, "." y "*".';
  }

  return "";
}

export function ResetPasswordModal({
  isOpen,
  onOpenChange,
  initialEmail,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialEmail?: string;
}) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail ?? "");
      setToken("");
      setNewPassword("");
      setToast(null);
      setLoading(false);
    }
  }, [isOpen, initialEmail]);

  const submit = async () => {
    const e = email.trim();
    const t = token.trim();

    if (!e || !t) {
      setToast({ message: "Email y token son obligatorios.", type: "error" });

      return;
    }

    const passErr = validateNewPassword(newPassword);

    if (passErr) {
      setToast({ message: passErr, type: "error" });

      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, token: t, newPassword }),
      });

      if (!res.ok) {
        const text = await res.text();

        setToast({
          message: text || "No se pudo cambiar la contraseña.",
          type: "error",
        });

        return;
      }

      setToast({ message: "Contraseña actualizada.", type: "success" });
      setTimeout(() => onOpenChange(false), 800);
    } catch {
      setToast({ message: "No se pudo cambiar la contraseña.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>Ingresar token</ModalHeader>
        <ModalBody>
          {toast ? (
            <AlertToast message={toast.message} type={toast.type} />
          ) : null}

          <Input
            isDisabled={loading}
            label="Correo electrónico"
            startContent={
              <BsEnvelopeFill className="text-xl text-default-500" />
            }
            type="email"
            value={email}
            onValueChange={setEmail}
          />
          <Input
            isDisabled={loading}
            label="Token"
            value={token}
            onValueChange={setToken}
          />
          <Input
            isDisabled={loading}
            label="Nueva contraseña"
            type="password"
            value={newPassword}
            onValueChange={setNewPassword}
          />
          <p className="text-sm text-default-500">
            La contraseña debe tener 7+ caracteres, una mayúscula, y solo
            letras/números/./*.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={loading}
            variant="flat"
            onPress={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button color="primary" isDisabled={loading} onPress={submit}>
            Cambiar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
