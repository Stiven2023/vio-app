"use client";
import { Card } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Skeleton } from "@heroui/skeleton";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { validateLogin } from "@/utils/validation";
import { AlertToast } from "@/components/alert-toast";
import { useSessionStore } from "@/store/session";

export default function LoginUser() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const router = useRouter();
  const login = useSessionStore((s) => s.login);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => validateLogin(form);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = validate();

    if (err) {
      setToast({ message: err, type: "error" });

      return;
    }
    setLoading(true);
    try {
      const ok = await login(form.email, form.password);

      if (ok) {
        setToast({ message: "Inicio de sesión exitoso.", type: "success" });
        setTimeout(() => {
          router.push("/dashboard");
        }, 1200);
      } else {
        setToast({
          message: "Credenciales inválidas o usuario no encontrado.",
          type: "error",
        });
      }
    } catch {
      setToast({
        message:
          "No se pudo iniciar sesión. Verifica tus datos e intenta nuevamente.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto mt-8">
      {toast && <AlertToast message={toast.message} type={toast.type} />}
      <form onSubmit={handleSubmit}>
        <h2 className="text-xl font-bold mb-4">Iniciar Sesión</h2>
        <Input
          required
          label="Correo electrónico"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
        />
        <Input
          required
          label="Contraseña"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
        />
        <Button className="mt-4 w-full" color="primary" disabled={loading} type="submit">
          {loading ? <Skeleton className="w-6 h-6 mx-auto" /> : "Entrar"}
        </Button>
      </form>
    </Card>
  );
}
