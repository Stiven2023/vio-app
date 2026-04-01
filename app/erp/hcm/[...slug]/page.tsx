export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { resolveLegacyHcmPath } from "@/src/utils/hcm-legacy-route";

type LegacyHcmCatchAllPageProps = {
  params: Promise<{
    slug: string[];
  }>;
};

export default async function LegacyHcmCatchAllPage({
  params,
}: LegacyHcmCatchAllPageProps) {
  const { slug } = await params;

  redirect(resolveLegacyHcmPath(slug));
}