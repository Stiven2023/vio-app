"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@heroui/skeleton";
import { EmployeeRegisterForm } from "@/components/employee-register-form";
import { useRouter, useSearchParams } from "next/navigation";

export default function RegisterEmployee() {
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const employeeId = searchParams.get("id") ?? "";
  const isEditMode = Boolean(employeeId);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <div className="max-w-3xl mx-auto py-8">
      {hydrated ? (
        <>
          <h1 className="text-2xl font-bold mb-6">
            {isEditMode ? "Editar empleado" : "Registrar empleado"}
          </h1>
          <EmployeeRegisterForm
            employeeId={employeeId || undefined}
            onSuccess={() => router.push("/admin")}
            submitLabel={isEditMode ? "Guardar" : "Registrar"}
          />
          <button
            className="mt-6 text-primary underline"
            type="button"
            onClick={() => router.push("/admin/employees")}
          >
            ← Volver a empleados
          </button>
        </>
      ) : (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}
    </div>
  );
}
