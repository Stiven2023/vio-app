import { redirect } from "next/navigation";

import { getPerDiemRedirectPath } from "../_services/per-diem.service";

export function PerDiemRedirect() {
  redirect(getPerDiemRedirectPath());
}
