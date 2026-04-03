import { redirect } from "next/navigation";

import { getBonusesRedirectPath } from "../_services/bonuses.service";

export function BonusesRedirect() {
  redirect(getBonusesRedirectPath());
}
