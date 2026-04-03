import { redirect } from "next/navigation";

import { getPilaRedirectPath } from "../_services/pila.service";

export function PilaRedirect() {
  redirect(getPilaRedirectPath());
}
