"use client";

import { useState } from "react";
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

export function RequestPasswordResetModal({
  isOpen,
  onOpenChange,
  onSent,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const submit = async () => {
    if (!email.trim()) {
      setToast({ message: "El correo es obligatorio.", type: "error" });

      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const text = await res.text();

        setToast({
          message: text || "No se pudo enviar el correo de recuperación.",
          type: "error",
        });

        return;
      }

      setToast({
        message: "Te enviamos un token para recuperar tu contraseña.",
        type: "success",
      });

      const nextEmail = email.trim();

      onSent(nextEmail);
    } catch {
      setToast({
        message: "No se pudo enviar el correo de recuperación.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          setLoading(false);
          setToast(null);
        }
      }}
    >
      <ModalContent>
        <ModalHeader>Recuperar contraseña</ModalHeader>
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
          <p className="text-sm text-default-500">
            Enviaremos un token de recuperación a tu correo.
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
            Enviar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
