import { redirect } from "next/navigation";

import { getHcmHomeRedirectPath } from "../_services/hcm-home.service";

export function HcmHomeRedirect() {
  redirect(getHcmHomeRedirectPath());
}
