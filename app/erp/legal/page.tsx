export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { JuridicaTabs } from "@/app/erp/legal/_components/juridica-tabs";
import { checkPermissions } from "@/src/utils/permission-middleware";

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

  const perms = await checkPermissions(req, [
    "VER_CLIENTE",
    "VER_EMPLEADO",
    "VER_PROVEEDOR",
    "VER_CONFECCIONISTA",
    "VER_EMPAQUE",
    "CAMBIAR_ESTADO_JURIDICO_CLIENTE",
    "CAMBIAR_ESTADO_JURIDICO_EMPLEADO",
    "CAMBIAR_ESTADO_JURIDICO_PROVEEDOR",
    "CAMBIAR_ESTADO_JURIDICO_CONFECCIONISTA",
    "CAMBIAR_ESTADO_JURIDICO_EMPAQUE",
  ]);

  const canViewClient = perms.VER_CLIENTE;
  const canViewEmployee = perms.VER_EMPLEADO;
  const canViewSupplier = perms.VER_PROVEEDOR;
  const canViewConfectionist = perms.VER_CONFECCIONISTA;
  const canViewPacker = perms.VER_EMPAQUE;

  if (
    !canViewClient &&
    !canViewEmployee &&
    !canViewSupplier &&
    !canViewConfectionist &&
    !canViewPacker
  ) {
    redirect("/unauthorized");
  }

  const canChangeClientLegalStatus = perms.CAMBIAR_ESTADO_JURIDICO_CLIENTE;
  const canChangeEmployeeLegalStatus = perms.CAMBIAR_ESTADO_JURIDICO_EMPLEADO;
  const canChangeSupplierLegalStatus = perms.CAMBIAR_ESTADO_JURIDICO_PROVEEDOR;
  const canChangeConfectionistLegalStatus =
    perms.CAMBIAR_ESTADO_JURIDICO_CONFECCIONISTA;
  const canChangePackerLegalStatus = perms.CAMBIAR_ESTADO_JURIDICO_EMPAQUE;

  const resolvedParams = searchParams ? await searchParams : undefined;
  const initialTab = String(resolvedParams?.tab ?? "clientes");

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Legal</h1>
        <p className="text-default-600 mt-1">
          Single view by sections with tabs. Starts with clients and their legal
          status.
        </p>
      </header>

      <JuridicaTabs
        canChangeClientLegalStatus={canChangeClientLegalStatus}
        canChangeConfectionistLegalStatus={canChangeConfectionistLegalStatus}
        canChangeEmployeeLegalStatus={canChangeEmployeeLegalStatus}
        canChangePackerLegalStatus={canChangePackerLegalStatus}
        canChangeSupplierLegalStatus={canChangeSupplierLegalStatus}
        canViewClient={canViewClient}
        canViewConfectionist={canViewConfectionist}
        canViewEmployee={canViewEmployee}
        canViewPacker={canViewPacker}
        canViewSupplier={canViewSupplier}
        initialTab={initialTab}
      />
    </div>
  );
}
