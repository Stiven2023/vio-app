import { MesDesignDetailPageClient } from "@/app/mes/_components/mes-design-detail-page-client";

export default async function MesDesignDetailPage({
  params,
}: {
  params: Promise<{ orderItemId: string }>;
}) {
  const { orderItemId } = await params;

  return <MesDesignDetailPageClient orderItemId={orderItemId} />;
}