export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function Page() {
  redirect(
    "/erp/under-construction?modulo=erp&area=dashboard-estados-resultados",
  );
}
