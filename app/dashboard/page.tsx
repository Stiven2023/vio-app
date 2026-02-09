import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyAuthToken } from "@/src/utils/auth";

export default async function DashboardPage() {
  const token = (await cookies()).get("auth_token")?.value;
  const payload = token ? verifyAuthToken(token) : null;

  if (!payload) redirect("/login");

  const role =
    payload && typeof payload === "object"
      ? (payload as { role?: unknown }).role
      : null;
  const roleName = typeof role === "string" ? role : "";
  const overrideRole = (await cookies()).get("role_override")?.value ?? "";
  const effectiveRole =
    process.env.NODE_ENV !== "production" && roleName === "ADMINISTRADOR"
      ? overrideRole || roleName
      : roleName;
  const roleDashboards: Record<string, string> = {
    ADMINISTRADOR: "/dashboard/admin",
    LIDER_DE_PROCESOS: "/dashboard/role/LIDER_DE_PROCESOS",
    ASESOR: "/dashboard/role/ASESOR",
    COMPRAS: "/dashboard/role/COMPRAS",
    DISEÑADOR: "/dashboard/role/DISEÑADOR",
    OPERARIO_EMPAQUE: "/dashboard/role/OPERARIO_EMPAQUE",
    OPERARIO_INVENTARIO: "/dashboard/role/OPERARIO_INVENTARIO",
    OPERARIO_INTEGRACION: "/dashboard/role/OPERARIO_INTEGRACION",
    OPERARIO_CORTE_LASER: "/dashboard/role/OPERARIO_CORTE_LASER",
    OPERARIO_CORTE_MANUAL: "/dashboard/role/OPERARIO_CORTE_MANUAL",
    OPERARIO_IMPRESION: "/dashboard/role/OPERARIO_IMPRESION",
    OPERARIO_ESTAMPACION: "/dashboard/role/OPERARIO_ESTAMPACION",
    OPERARIO_MONTAJE: "/dashboard/role/OPERARIO_MONTAJE",
    OPERARIO_SUBLIMACION: "/dashboard/role/OPERARIO_SUBLIMACION",
  };
  const target = roleDashboards[effectiveRole];

  if (target) redirect(target);

  redirect("/unauthorized");

  return null;
}
