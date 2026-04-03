import { redirect } from "next/navigation";

import { getOvertimeRedirectPath } from "../_services/overtime.service";

export function OvertimeRedirect() {
  redirect(getOvertimeRedirectPath());
}
