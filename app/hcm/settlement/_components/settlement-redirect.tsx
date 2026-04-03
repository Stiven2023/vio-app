import { redirect } from "next/navigation";

import { getSettlementRedirectPath } from "../_services/settlement.service";

export function SettlementRedirect() {
  redirect(getSettlementRedirectPath());
}
