import { redirect } from "next/navigation";

import { getVacationsRedirectPath } from "../_services/vacations.service";

export function VacationsRedirect() {
  redirect(getVacationsRedirectPath());
}
