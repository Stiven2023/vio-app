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
      setToast({ message: "Email is required.", type: "error" });

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
          message: text || "Could not send the recovery email.",
          type: "error",
        });

        return;
      }

      setToast({
        message: "We sent you a token to recover your password.",
        type: "success",
      });

      const nextEmail = email.trim();

      onSent(nextEmail);
    } catch {
      setToast({
        message: "Could not send the recovery email.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      disableAnimation
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
        <ModalHeader>Recover password</ModalHeader>
        <ModalBody>
          {toast ? (
            <div
              aria-live="polite"
              className={
                toast.type === "error"
                  ? "rounded-medium border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
                  : toast.type === "success"
                    ? "rounded-medium border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
                    : "rounded-medium border border-default-200/50 bg-content1/40 px-3 py-2 text-sm text-default-600"
              }
              role="status"
            >
              {toast.message}
            </div>
          ) : null}
          <Input
            isDisabled={loading}
            label="Email address"
            startContent={
              <BsEnvelopeFill className="text-xl text-default-500" />
            }
            type="email"
            value={email}
            onValueChange={setEmail}
          />
          <p className="text-sm text-default-500">
            We will send a recovery token to your email.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={loading}
            variant="flat"
            onPress={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button color="primary" isDisabled={loading} onPress={submit}>
            Send
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
