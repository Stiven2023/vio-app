"use client";
import { Card } from "@heroui/card";

import { EmployeeRegisterForm } from "@/components/employee-register-form";

export default function RegisterEmployee() {
  return (
    <Card className="max-w-md mx-auto mt-8">
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Registro de Empleado</h2>
        <EmployeeRegisterForm />
      </div>
    </Card>
  );
}
