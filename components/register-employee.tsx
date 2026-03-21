"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@heroui/skeleton";
import { useRouter, useSearchParams } from "next/navigation";

import { EmployeeRegisterForm } from "@/components/employee-register-form";

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
            {isEditMode ? "Edit employee" : "Register employee"}
          </h1>
          <EmployeeRegisterForm
            employeeId={employeeId || undefined}
            submitLabel={isEditMode ? "Save" : "Register"}
            onSuccess={() => router.push("/admin")}
          />
          <button
            className="mt-6 text-primary underline"
            type="button"
            onClick={() => router.push("/admin/employees")}
          >
            ← Back to employees
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
