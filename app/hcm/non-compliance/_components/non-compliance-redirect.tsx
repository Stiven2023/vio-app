import { redirect } from "next/navigation";

import { getNonComplianceRedirectPath } from "../_services/non-compliance.service";

export function NonComplianceRedirect() {
  redirect(getNonComplianceRedirectPath());
}
