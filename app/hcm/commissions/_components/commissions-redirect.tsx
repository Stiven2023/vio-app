import { redirect } from "next/navigation";

import { getCommissionsRedirectPath } from "../_services/commissions.service";

export function CommissionsRedirect() {
  redirect(getCommissionsRedirectPath());
}
