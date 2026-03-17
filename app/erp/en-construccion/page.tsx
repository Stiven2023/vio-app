import { redirect } from "next/navigation";

export default async function UnderConstructionLegacyBridgePage({
  searchParams,
}: {
  searchParams: Promise<{ modulo?: string; area?: string }>;
}) {
  const { modulo, area } = await searchParams;
  const query = new URLSearchParams();

  if (modulo) query.set("modulo", modulo);
  if (area) query.set("area", area);

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  redirect(`/erp/under-construction${suffix}`);
}
