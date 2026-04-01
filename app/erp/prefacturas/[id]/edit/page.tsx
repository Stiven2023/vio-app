export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default async function EditPrefacturaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(`/erp/pre-invoices/${id}/edit`);
}
