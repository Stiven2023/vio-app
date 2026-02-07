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

import { AlertToast } from "@/components/alert-toast";

export function VerifyEmailModal({
  isOpen,
  onOpenChange,
  email,
  onVerified,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onVerified: () => void;
}) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setToken("");
      setToast(null);
      setLoading(false);
    }
  }, [isOpen]);

  const resend = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const text = await res.text();

        setToast({
          message: text || "No se pudo reenviar el token.",
          type: "error",
        });

        return;
      }

      setToast({ message: "Token reenviado.", type: "success" });
    } catch {
      setToast({ message: "No se pudo reenviar el token.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (!token.trim()) {
      setToast({ message: "El token es obligatorio.", type: "error" });

      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/users/verify-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: token.trim() }),
      });

      if (!res.ok) {
        const text = await res.text();

        setToast({ message: text || "Token inválido.", type: "error" });

        return;
      }

      setToast({ message: "Correo verificado.", type: "success" });
      setTimeout(() => {
        onVerified();
        onOpenChange(false);
      }, 400);
    } catch {
      setToast({ message: "No se pudo verificar el correo.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>Verificar correo</ModalHeader>
        <ModalBody>
          {toast ? (
            <AlertToast message={toast.message} type={toast.type} />
          ) : null}

          <Input isDisabled label="Correo" value={email} />
          <Input
            isDisabled={loading}
            label="Token"
            value={token}
            onValueChange={setToken}
          />
          <p className="text-sm text-default-500">
            Te enviamos un código al correo. Pégalo aquí para continuar.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={loading} variant="flat" onPress={resend}>
            Reenviar
          </Button>
          <Button color="primary" isDisabled={loading} onPress={verify}>
            Verificar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
