"use client";

import { DepositsTab } from "@/app/erp/contabilidad/_components/consignaciones-tab";

export function AccountingTabs({
  canEdit,
  canApprovePayments,
}: {
  canEdit: boolean;
  canApprovePayments: boolean;
}) {
  void canEdit;

  return (
    <div className="space-y-4">
      <DepositsTab canApprovePayments={canApprovePayments} />
    </div>
  );
}
