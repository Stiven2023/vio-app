"use client";

import dynamic from "next/dynamic";

const PaymentsHubPageNoSSR = dynamic(
  () =>
    import("@/app/erp/pagos/_components/payments-hub-page").then(
      (mod) => mod.PaymentsHubPage,
    ),
  { ssr: false },
);

export function PaymentsHubClient({
  canApprove,
  canCreate,
  canEdit,
  initialOrderId,
}: {
  canApprove: boolean;
  canCreate: boolean;
  canEdit: boolean;
  initialOrderId?: string;
}) {
  return (
    <PaymentsHubPageNoSSR
      canApprove={canApprove}
      canCreate={canCreate}
      canEdit={canEdit}
      initialOrderId={initialOrderId}
    />
  );
}
