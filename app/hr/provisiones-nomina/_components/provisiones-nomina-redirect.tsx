import { redirect } from "next/navigation";

import { getProvisionesNominaRedirectPath } from "../_services/provisiones-nomina.service";

export function ProvisionesNominaRedirect() {
  redirect(getProvisionesNominaRedirectPath());
}
