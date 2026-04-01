export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { resolveLegacyHcmPath } from "@/src/utils/hcm-legacy-route";

type LegacyHrCatchAllPageProps = {
  params: Promise<{
    slug: string[];
  }>;
};

export default async function LegacyHrCatchAllPage({
  params,
}: LegacyHrCatchAllPageProps) {
  const { slug } = await params;

  redirect(resolveLegacyHcmPath(slug));
}