"use client";
import { Card } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Skeleton } from "@heroui/skeleton";
import { useState } from "react";

import { validateEmployeeRegister } from "@/utils/validation";

export default function RegisterEmployee() {
  const [form, setForm] = useState({ name: "", email: "", position: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => validateEmployeeRegister(form);

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
      // showViomarToast({ type: "success", title: "¡Éxito!", content: "Empleado registrado exitosamente." });
    } catch {
      // showViomarToast({ type: "danger", content: "No se pudo registrar el empleado. Intenta nuevamente." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto mt-8">
      <form onSubmit={handleSubmit}>
        <h2 className="text-xl font-bold mb-4">Registro de Empleado</h2>
        <Input
          required
          label="Nombre"
          name="name"
          value={form.name}
          onChange={handleChange}
        />
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
          label="Puesto"
          name="position"
          value={form.position}
          onChange={handleChange}
        />
        <Button className="mt-4 w-full" color="primary" disabled={loading} type="submit">
          {loading ? <Skeleton className="w-6 h-6 mx-auto" /> : "Registrar"}
        </Button>
      </form>
    </Card>
  );
}
