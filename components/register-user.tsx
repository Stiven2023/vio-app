"use client";
import { Card } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Skeleton } from "@heroui/skeleton";
import { useState } from "react";

import { validateUserRegister } from "@/utils/validation";

export default function RegisterUser() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => validateUserRegister(form);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = validate();

    if (err) {
      return;
    }
    setLoading(true);
    try {
      // Aquí va la llamada a la API
      await new Promise((res) => setTimeout(res, 1200));
      // showViomarToast({ type: "success", title: "¡Éxito!", content: "Usuario registrado exitosamente." });
    } catch {
      // showViomarToast({ type: "danger", content: "No se pudo registrar. Intenta nuevamente." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto mt-8">
      <form onSubmit={handleSubmit}>
        <h2 className="text-xl font-bold mb-4">Registro de Usuario</h2>
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
          {loading ? <Skeleton className="w-6 h-6 mx-auto" /> : "Registrar"}
        </Button>
      </form>
    </Card>
  );
}
