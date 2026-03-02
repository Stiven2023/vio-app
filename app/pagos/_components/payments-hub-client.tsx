"use client";

import dynamic from "next/dynamic";

const PaymentsHubPageNoSSR = dynamic(
  () =>
    import("@/app/pagos/_components/payments-hub-page").then(
      (mod) => mod.PaymentsHubPage,
    ),
  { ssr: false },
);

export function PaymentsHubClient({
  canCreate,
  canEdit,
  initialOrderId,
}: {
  canCreate: boolean;
  canEdit: boolean;
  initialOrderId?: string;
}) {
  return (
    <PaymentsHubPageNoSSR
      canCreate={canCreate}
      canEdit={canEdit}
      initialOrderId={initialOrderId}
    />
  );
}
