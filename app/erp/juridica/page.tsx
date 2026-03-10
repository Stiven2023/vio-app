import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { JuridicaTabs } from "@/app/erp/juridica/_components/juridica-tabs";
import { requirePermission } from "@/src/utils/permission-middleware";

export default async function JuridicaPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const canViewClient = !(await requirePermission(req, "VER_CLIENTE"));
  const canViewEmployee = !(await requirePermission(req, "VER_EMPLEADO"));
  const canViewSupplier = !(await requirePermission(req, "VER_PROVEEDOR"));
  const canViewConfectionist =
    !(await requirePermission(req, "VER_CONFECCIONISTA"));
  const canViewPacker = !(await requirePermission(req, "VER_EMPAQUE"));

  if (
    !canViewClient &&
    !canViewEmployee &&
    !canViewSupplier &&
    !canViewConfectionist &&
    !canViewPacker
  ) {
    redirect("/unauthorized");
  }

  const canChangeClientLegalStatus =
    !(await requirePermission(req, "CAMBIAR_ESTADO_JURIDICO_CLIENTE"));
  const canChangeEmployeeLegalStatus =
    !(await requirePermission(req, "CAMBIAR_ESTADO_JURIDICO_EMPLEADO"));
  const canChangeSupplierLegalStatus =
    !(await requirePermission(req, "CAMBIAR_ESTADO_JURIDICO_PROVEEDOR"));
  const canChangeConfectionistLegalStatus =
    !(await requirePermission(req, "CAMBIAR_ESTADO_JURIDICO_CONFECCIONISTA"));
  const canChangePackerLegalStatus =
    !(await requirePermission(req, "CAMBIAR_ESTADO_JURIDICO_EMPAQUE"));

  const resolvedParams = searchParams ? await searchParams : undefined;
  const initialTab = String(resolvedParams?.tab ?? "clientes");

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Juridica</h1>
        <p className="text-default-600 mt-1">
          Vista unica por secciones con tabs. Empezamos con clientes y su estado juridico.
        </p>
      </header>

      <JuridicaTabs
        canViewClient={canViewClient}
        canViewConfectionist={canViewConfectionist}
        canViewEmployee={canViewEmployee}
        canViewPacker={canViewPacker}
        canViewSupplier={canViewSupplier}
        canChangeClientLegalStatus={canChangeClientLegalStatus}
        canChangeConfectionistLegalStatus={canChangeConfectionistLegalStatus}
        canChangeEmployeeLegalStatus={canChangeEmployeeLegalStatus}
        canChangePackerLegalStatus={canChangePackerLegalStatus}
        canChangeSupplierLegalStatus={canChangeSupplierLegalStatus}
        initialTab={initialTab}
      />
    </div>
  );
}
