"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";

type ApiErrorPayload = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function MesOperarioLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const focusEmail = () => {
    if (typeof document === "undefined") return;

    const input = document.getElementById("mes-login-email") as HTMLInputElement | null;

    input?.focus();
  };

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      setError("Debes ingresar un correo válido para el ingreso MES.");
      focusEmail();

      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/mes/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;

      if (!response.ok) {
        const fieldError = payload?.fieldErrors?.email?.[0];

        setError(
          String(
            fieldError ??
              payload?.message ??
              "No se pudo iniciar el acceso operativo MES.",
          ),
        );
        focusEmail();

        return;
      }

      router.replace("/mes");
      router.refresh();
    } catch {
      setError("No se pudo iniciar el acceso operativo MES.");
      focusEmail();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border border-default-200" radius="sm" shadow="none">
      <CardHeader className="flex flex-col items-start gap-1">
        <h1 className="text-xl font-semibold">Ingreso operativo MES</h1>
        <p className="text-sm text-default-500">
          El operario entra con su correo. Si el rol no trae proceso fijo, MES te pedirá elegirlo al ingresar.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <Input
          aria-describedby={error ? "mes-login-email-error" : undefined}
          aria-invalid={error ? "true" : "false"}
          aria-label="Correo del operario MES"
          id="mes-login-email"
          isRequired
          label="Correo"
          placeholder="operacion@viomar.com"
          type="email"
          value={email}
          onValueChange={(value) => {
            setEmail(value);
            if (error) {
              setError("");
            }
          }}
        />

        {error ? (
          <div
            className="rounded-medium border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger"
            id="mes-login-email-error"
            role="alert"
          >
            {error}
          </div>
        ) : (
          <div aria-live="polite" className="sr-only" />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button as="a" href="/login" variant="light">
            Ir al login normal
          </Button>
          <Button color="primary" isLoading={submitting} onPress={() => void handleSubmit()}>
            Ingresar a MES
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}