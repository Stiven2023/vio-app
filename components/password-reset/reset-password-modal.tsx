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

function validateNewPassword(newPassword: string): string {
  if (!newPassword) return "Password is required.";
  if (newPassword.length < 7) return "Must be at least 7 characters.";
  if (!/[A-Z]/.test(newPassword))
    return "Must contain at least one uppercase letter.";
  if (/[^A-Za-z0-9.*]/.test(newPassword)) {
    return 'Only letters, numbers, "." and "*" are allowed.';
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
      setToast({ message: "Email and token are required.", type: "error" });

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
          message: text || "Could not change the password.",
          type: "error",
        });

        return;
      }

      setToast({ message: "Password updated.", type: "success" });
      setTimeout(() => onOpenChange(false), 800);
    } catch {
      setToast({ message: "Could not change the password.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal disableAnimation isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>Enter token</ModalHeader>
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
          <Input
            isDisabled={loading}
            label="Token"
            value={token}
            onValueChange={setToken}
          />
          <Input
            isDisabled={loading}
            label="New password"
            type="password"
            value={newPassword}
            onValueChange={setNewPassword}
          />
          <p className="text-sm text-default-500">
            Password must be 7+ chars, one uppercase letter, and only
            letters/numbers/./×.
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
            Change
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
