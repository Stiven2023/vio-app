import { redirect } from "next/navigation";

import { getPermisosAusenciasRedirectPath } from "../_services/permisos-ausencias.service";

export function PermisosAusenciasRedirect() {
  redirect(getPermisosAusenciasRedirectPath());
}
